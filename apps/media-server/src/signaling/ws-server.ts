// ============================================
// WebSocket Signaling Server
// ============================================
// Handles the complete mediasoup SFU signaling flow:
// 1. Client connects → gets clientId
// 2. Client requests router capabilities → loads Device
// 3. Client creates recv transport → negotiates DTLS
// 4. Client joins floor → receives PRODUCER_ADDED for active streams
// 5. Client consumes producers → receives video tracks
// 6. On disconnect → cleanup resources
// ============================================

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { WSMessage, WSMessageType, AlertPayload } from '@hostel-monitor/types';
import { db } from '@hostel-monitor/db';
import { getDefaultRouter } from '../mediasoup/workers';
import {
  createRecvTransport,
  connectRecvTransport,
  consumeProducer,
  resumeConsumer,
  closeTransport,
  cleanupClientConsumers,
} from '../mediasoup/transport';
import {
  producerMap,
  startCameraIngest,
  incrementConsumerCount,
  decrementConsumerCount,
  getProducerWorkerId,
} from '../mediasoup/ingest';

// ── Client State ────────────────────────────

interface ClientState {
  ws: WebSocket;
  clientId: string;
  transportId?: string;
  workerIndex?: number;
  subscribedFloors: Set<string>; // "floor:{hostelId}:{floorNumber}"
  subscribedHostels: Set<string>;
  consumerIds: Set<string>;
}

const clientMap = new Map<string, ClientState>();

// ── Helpers ─────────────────────────────────

function createMessage<T>(type: WSMessageType, payload: T, id?: string): string {
  const msg: WSMessage<T> = {
    type,
    payload,
    timestamp: Date.now(),
    ...(id && { id }),
  };
  return JSON.stringify(msg);
}

function parseMessage(data: string): WSMessage | null {
  try {
    return JSON.parse(data) as WSMessage;
  } catch {
    return null;
  }
}

function floorKey(hostelId: string, floorNumber: number): string {
  return `floor:${hostelId}:${floorNumber}`;
}

// ── Room Broadcast ──────────────────────────

export function broadcastToFloor(hostelId: string, floorNumber: number, message: string): void {
  const key = floorKey(hostelId, floorNumber);
  for (const [, client] of clientMap) {
    if (client.subscribedFloors.has(key) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

export function broadcastToHostel(hostelId: string, message: string): void {
  for (const [, client] of clientMap) {
    if (client.subscribedHostels.has(hostelId) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

export function broadcastToAll(message: string): void {
  for (const [, client] of clientMap) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

// ── Message Handlers ────────────────────────

async function handleJoinFloor(client: ClientState, msg: WSMessage): Promise<void> {
  const { hostelId, floorNumber } = msg.payload as { hostelId: string; floorNumber: number };
  const key = floorKey(hostelId, floorNumber);

  client.subscribedFloors.add(key);
  client.subscribedHostels.add(hostelId);

  console.info(`[ws] Client ${client.clientId} joined ${key}`);

  // Look up cameras on this floor
  await db.connectDB();
  const floor = await db.Floor.findOne({ hostelId, number: floorNumber }).populate('cameras');

  if (!floor) {
    client.ws.send(createMessage('ERROR', { message: `Floor ${hostelId}:${floorNumber} not found` }, msg.id));
    return;
  }

  // For each camera, notify of active producers and start inactive ones
  for (const camera of floor.cameras || []) {
    const existing = producerMap.get(camera.id);

    if (existing) {
      // Producer already active — notify client
      client.ws.send(
        createMessage('PRODUCER_ADDED', {
          producerId: existing.producer.id,
          cameraId: camera.id,
          cameraLabel: camera.label,
          hostelId,
          floorNumber,
        })
      );
    } else {
      // Start on-demand ingest
      const entry = await startCameraIngest({
        id: camera.id,
        label: camera.label,
        rtspUrl: camera.rtspUrl,
        floorId: camera.floorId,
      });

      if (entry) {
        // Broadcast PRODUCER_ADDED to all clients on this floor
        broadcastToFloor(
          hostelId,
          floorNumber,
          createMessage('PRODUCER_ADDED', {
            producerId: entry.producer.id,
            cameraId: camera.id,
            cameraLabel: camera.label,
            hostelId,
            floorNumber,
          })
        );
      }
    }
  }
}

async function handleLeaveFloor(client: ClientState, msg: WSMessage): Promise<void> {
  const { hostelId, floorNumber } = msg.payload as { hostelId: string; floorNumber: number };
  const key = floorKey(hostelId, floorNumber);
  client.subscribedFloors.delete(key);
  console.info(`[ws] Client ${client.clientId} left ${key}`);

  // Decrement consumer counts for cameras on this floor
  // The auto-stop timer will handle cleanup
}

async function handleGetRouterCapabilities(client: ClientState, msg: WSMessage): Promise<void> {
  const router = getDefaultRouter();
  client.ws.send(
    createMessage(
      'ROUTER_RTP_CAPABILITIES',
      { rtpCapabilities: router.rtpCapabilities },
      msg.id
    )
  );
}

async function handleCreateRecvTransport(client: ClientState, msg: WSMessage): Promise<void> {
  // Use worker 0 by default for viewers
  const workerIndex = 0;
  client.workerIndex = workerIndex;

  const params = await createRecvTransport(client.clientId, workerIndex);
  client.transportId = params.transportId;

  client.ws.send(createMessage('RECV_TRANSPORT_CREATED', params, msg.id));
}

async function handleConnectRecvTransport(client: ClientState, msg: WSMessage): Promise<void> {
  const { transportId, dtlsParameters } = msg.payload as {
    transportId: string;
    dtlsParameters: any;
  };

  await connectRecvTransport(transportId, dtlsParameters);
  client.ws.send(createMessage('RECV_TRANSPORT_CONNECTED', { transportId }, msg.id));
}

async function handleConsume(client: ClientState, msg: WSMessage): Promise<void> {
  const { producerId, transportId, rtpCapabilities } = msg.payload as {
    producerId: string;
    transportId: string;
    rtpCapabilities: any;
  };

  // Find cameraId for this producer
  let cameraId = '';
  for (const [camId, entry] of producerMap.entries()) {
    if (entry.producer.id === producerId) {
      cameraId = camId;
      break;
    }
  }

  const workerIndex = getProducerWorkerId(cameraId) ?? client.workerIndex ?? 0;

  const result = await consumeProducer(
    transportId,
    producerId,
    rtpCapabilities,
    cameraId,
    workerIndex
  );

  client.consumerIds.add(result.consumerId);
  incrementConsumerCount(cameraId);

  client.ws.send(
    createMessage('CONSUMED', { ...result, cameraId }, msg.id)
  );
}

async function handleResumeConsumer(client: ClientState, msg: WSMessage): Promise<void> {
  const { consumerId } = msg.payload as { consumerId: string };
  await resumeConsumer(consumerId);
}

// ── Disconnect Cleanup ──────────────────────

function handleDisconnect(client: ClientState): void {
  console.info(`[ws] Client ${client.clientId} disconnected`);

  // Close transport
  if (client.transportId) {
    closeTransport(client.transportId);
  }

  // Clean up consumers and decrement camera counts
  if (client.consumerIds.size > 0) {
    const decrements = cleanupClientConsumers(Array.from(client.consumerIds));
    for (const [cameraId, count] of decrements) {
      for (let i = 0; i < count; i++) {
        decrementConsumerCount(cameraId);
      }
    }
  }

  clientMap.delete(client.clientId);
}

// ── WebSocket Server ────────────────────────

export function createSignalingServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  console.info(`[ws] Signaling server listening on port ${port}`);

  wss.on('connection', (ws: WebSocket) => {
    const clientId = uuidv4();
    const client: ClientState = {
      ws,
      clientId,
      subscribedFloors: new Set(),
      subscribedHostels: new Set(),
      consumerIds: new Set(),
    };
    clientMap.set(clientId, client);

    console.info(`[ws] Client ${clientId} connected (total: ${clientMap.size})`);

    ws.on('message', async (raw: Buffer) => {
      const msg = parseMessage(raw.toString());
      if (!msg) {
        ws.send(createMessage('ERROR', { message: 'Invalid JSON' }));
        return;
      }

      try {
        switch (msg.type) {
          case 'JOIN_FLOOR':
            await handleJoinFloor(client, msg);
            break;
          case 'LEAVE_FLOOR':
            await handleLeaveFloor(client, msg);
            break;
          case 'GET_ROUTER_RTP_CAPABILITIES':
            await handleGetRouterCapabilities(client, msg);
            break;
          case 'CREATE_RECV_TRANSPORT':
            await handleCreateRecvTransport(client, msg);
            break;
          case 'CONNECT_RECV_TRANSPORT':
            await handleConnectRecvTransport(client, msg);
            break;
          case 'CONSUME':
            await handleConsume(client, msg);
            break;
          case 'RESUME_CONSUMER':
            await handleResumeConsumer(client, msg);
            break;
          case 'PING':
            ws.send(createMessage('PONG', {}, msg.id));
            break;
          default:
            ws.send(createMessage('ERROR', { message: `Unknown message type: ${msg.type}` }, msg.id));
        }
      } catch (error: any) {
        console.error(`[ws] Error handling ${msg.type}:`, error);
        ws.send(createMessage('ERROR', { message: error.message || 'Internal error' }, msg.id));
      }
    });

    ws.on('close', () => handleDisconnect(client));
    ws.on('error', (error) => {
      console.error(`[ws] Client ${clientId} error:`, error);
      handleDisconnect(client);
    });
  });

  return wss;
}
