/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { db } from '@hostel-monitor/db';
import Redis from 'ioredis';
import type { AlertPayload } from '@hostel-monitor/types';

let redis: Redis | null = null;
if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
}

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.ML_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
      const body = await request.json();
      const { cameraId, alertType, severity, description, thumbnail } = body;

      await db.connectDB();
      const camera: any = await db.Camera.findById(cameraId)
          .populate({ path: 'floor', populate: { path: 'hostel' } });

      if (!camera) {
          return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
      }

      const alert = await db.Alert.create({
          cameraId,
          type: alertType,
          severity: severity || 'HIGH',
          description,
          thumbnail
      });

      if (redis) {
          const payload: AlertPayload = {
              alertId: alert.id,
              cameraId: camera.id,
              cameraLabel: camera.label,
              hostelId: camera.floor.hostel.id,
              floorNumber: camera.floor.number,
              alertType,
              severity: alert.severity,
              description,
              thumbnail,
              posX: camera.posX,
              posY: camera.posY
          };
          await redis.publish('alerts', JSON.stringify(payload));
      } else {
          console.warn('Redis not configured, cannot broadcast alert');
      }

      return NextResponse.json({ ok: true, alertId: alert.id });

  } catch (error) {
      console.error('Error creating ML alert:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
