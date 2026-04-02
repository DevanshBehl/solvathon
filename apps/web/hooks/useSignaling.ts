'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WSMessage, WSMessageType, AlertPayload } from '@hostel-monitor/types';
import { v4 as uuidv4 } from 'uuid';

type SubscribeCallback = (payload: any) => void;

interface SignalingHook {
  sendMessage: (type: WSMessageType, payload: any) => void;
  request: (type: WSMessageType, payload: any) => Promise<any>;
  subscribe: (type: WSMessageType, callback: SubscribeCallback) => () => void;
  connected: boolean;
  reconnect: () => void;
}

let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let pingTimer: NodeJS.Timeout | null = null;
let reconnectDelay = 1000;
let isIntentionalClose = false;

const pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timeout: NodeJS.Timeout }>();
const subscribers = new Map<WSMessageType, Set<SubscribeCallback>>();

const connect = () => {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  if (!process.env.NEXT_PUBLIC_MEDIA_SERVER_WS_URL) return;

  isIntentionalClose = false;
  ws = new WebSocket(process.env.NEXT_PUBLIC_MEDIA_SERVER_WS_URL);

  ws.onopen = () => {
    console.log('[ws] Connected to media server');
    reconnectDelay = 1000;
    startPing();
    
    // Dispatch a custom event to notify components that ws is open
    window.dispatchEvent(new Event('ws-connected'));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as WSMessage;

      // Handle request/response
      if (msg.id && pendingRequests.has(msg.id)) {
        const req = pendingRequests.get(msg.id)!;
        clearTimeout(req.timeout);
        if (msg.type === 'ERROR') {
            req.reject(msg.payload);
        } else {
            req.resolve(msg.payload);
        }
        pendingRequests.delete(msg.id);
        return;
      }

      // Handle subscritions
      const callbacks = subscribers.get(msg.type);
      if (callbacks) {
        callbacks.forEach(cb => cb(msg.payload));
      }
    } catch (e) {
      console.error('[ws] Failed to parse message:', e);
    }
  };

  ws.onclose = () => {
    console.log('[ws] Disconnected from media server');
    stopPing();
    if (!isIntentionalClose) {
      scheduleReconnect();
    }
    window.dispatchEvent(new Event('ws-disconnected'));
  };

  ws.onerror = (e) => {
    console.error('[ws] WebSocket error:', e);
  };
};

const scheduleReconnect = () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    console.log(`[ws] Reconnecting in ${reconnectDelay}ms...`);
    connect();
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  }, reconnectDelay);
};

const startPing = () => {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg: WSMessage = { type: 'PING', payload: {}, timestamp: Date.now() };
      ws.send(JSON.stringify(msg));
    }
  }, 25000); // Send PING every 25 seconds
};

const stopPing = () => {
  if (pingTimer) clearInterval(pingTimer);
};

// Initialize connection on module load if in browser
if (typeof window !== 'undefined') {
  connect();
}

export function useSignaling(): SignalingHook {
  const [connected, setConnected] = useState(ws?.readyState === WebSocket.OPEN);

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    window.addEventListener('ws-connected', handleConnect);
    window.addEventListener('ws-disconnected', handleDisconnect);

    return () => {
      window.removeEventListener('ws-connected', handleConnect);
      window.removeEventListener('ws-disconnected', handleDisconnect);
    };
  }, []);

  const sendMessage = useCallback((type: WSMessageType, payload: any) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`[ws] Cannot send message, WebSocket not open (type: ${type})`);
      return;
    }
    const msg: WSMessage = { type, payload, timestamp: Date.now() };
    ws.send(JSON.stringify(msg));
  }, []);

  const request = useCallback((type: WSMessageType, payload: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'));
      }

      const id = uuidv4();
      const msg: WSMessage = { type, id, payload, timestamp: Date.now() };
      
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Timeout waiting for response to ${type}`));
      }, 10000);

      pendingRequests.set(id, { resolve, reject, timeout });
      ws.send(JSON.stringify(msg));
    });
  }, []);

  const subscribe = useCallback((type: WSMessageType, callback: SubscribeCallback) => {
    if (!subscribers.has(type)) {
      subscribers.set(type, new Set());
    }
    subscribers.get(type)!.add(callback);

    return () => {
      const cbs = subscribers.get(type);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          subscribers.delete(type);
        }
      }
    };
  }, []);

  const manualReconnect = useCallback(() => {
    isIntentionalClose = true;
    if (ws) ws.close();
    reconnectDelay = 1000;
    connect();
  }, []);

  return {
    sendMessage,
    request,
    subscribe,
    connected,
    reconnect: manualReconnect
  };
}
