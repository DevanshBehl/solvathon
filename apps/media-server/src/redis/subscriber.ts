// ============================================
// Redis Subscriber — Alert Broadcast
// ============================================
// Subscribes to the 'alerts' Redis channel.
// When the Next.js API publishes an alert (from ML webhook),
// this subscriber parses it and broadcasts to relevant
// floor and hostel WebSocket rooms.
// ============================================

import Redis from 'ioredis';
import type { AlertPayload } from '@hostel-monitor/types';
import { broadcastToFloor, broadcastToHostel, broadcastToAll } from '../signaling/ws-server';

let subscriber: Redis | null = null;

/**
 * Initialize Redis subscriber for alert broadcasts.
 */
export function initRedisSubscriber(): void {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  subscriber = new Redis(redisUrl, {
    retryStrategy(times) {
      const delay = Math.min(times * 1000, 30000);
      console.info(`[redis] Reconnecting in ${delay / 1000}s (attempt ${times})...`);
      return delay;
    },
    maxRetriesPerRequest: null,
  });

  subscriber.on('connect', () => {
    console.info('[redis] Subscriber connected');
  });

  subscriber.on('error', (err) => {
    console.error('[redis] Subscriber error:', err.message);
  });

  // Subscribe to alert channel
  subscriber.subscribe('alerts', (err) => {
    if (err) {
      console.error('[redis] Failed to subscribe to alerts channel:', err);
    } else {
      console.info('[redis] Subscribed to "alerts" channel');
    }
  });

  // Handle incoming alert messages
  subscriber.on('message', (channel, message) => {
    if (channel !== 'alerts') return;

    try {
      const alert = JSON.parse(message) as AlertPayload;

      console.info(`[redis] Alert received: ${alert.alertType} on ${alert.cameraLabel}`);

      const alertMessage = JSON.stringify({
        type: 'ALERT',
        payload: alert,
        timestamp: Date.now(),
      });

      // Broadcast to the specific floor
      broadcastToFloor(alert.hostelId, alert.floorNumber, alertMessage);

      // Broadcast to hostel-level subscribers
      broadcastToHostel(alert.hostelId, alertMessage);

      // Also broadcast to all connected clients (for dashboard)
      broadcastToAll(alertMessage);
    } catch (err) {
      console.error('[redis] Failed to parse alert message:', err);
    }
  });
}

/**
 * Shutdown Redis subscriber.
 */
export async function shutdownRedisSubscriber(): Promise<void> {
  if (subscriber) {
    await subscriber.unsubscribe('alerts');
    await subscriber.quit();
    subscriber = null;
  }
}
