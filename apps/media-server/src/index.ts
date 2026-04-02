// ============================================
// Media Server — Entry Point
// ============================================
// Starts the mediasoup SFU, WebSocket signaling server,
// HTTP health endpoint, and Redis alert subscriber.
// ============================================

import 'dotenv/config';
import http from 'http';
import { initializeWorkers, getAllWorkers } from './mediasoup/workers';
import { createSignalingServer } from './signaling/ws-server';
import { initRedisSubscriber, shutdownRedisSubscriber } from './redis/subscriber';

const HTTP_PORT = parseInt(process.env.MEDIA_HTTP_PORT || '3001', 10);
const WS_PORT = parseInt(process.env.MEDIA_WS_PORT || '4000', 10);

async function main(): Promise<void> {
  console.info('='.repeat(50));
  console.info('  Hostel Monitor — Media Server');
  console.info('='.repeat(50));

  // ── Step 1: Initialize mediasoup workers ──
  await initializeWorkers();

  // ── Step 2: Start WebSocket signaling server ──
  createSignalingServer(WS_PORT);

  // ── Step 3: Start Redis subscriber for alerts ──
  try {
    initRedisSubscriber();
  } catch (err) {
    console.warn('[main] Redis not available, alerts will not be relayed:', err);
  }

  // ── Step 4: HTTP health endpoint ──
  const httpServer = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        workers: getAllWorkers().length,
        uptime: process.uptime(),
      }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  httpServer.listen(HTTP_PORT, () => {
    console.info(`[http] Health endpoint on http://localhost:${HTTP_PORT}/health`);
  });

  // ── Graceful shutdown ──
  const shutdown = async () => {
    console.info('\n[main] Shutting down...');

    await shutdownRedisSubscriber();

    for (const { worker } of getAllWorkers()) {
      worker.close();
    }

    httpServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.info('\n✅ Media server ready');
  console.info(`   HTTP: http://localhost:${HTTP_PORT}`);
  console.info(`   WS:   ws://localhost:${WS_PORT}`);
  console.info(`   ANNOUNCED_IP: ${process.env.ANNOUNCED_IP || '127.0.0.1'}`);
}

main().catch((err) => {
  console.error('Failed to start media server:', err);
  process.exit(1);
});
