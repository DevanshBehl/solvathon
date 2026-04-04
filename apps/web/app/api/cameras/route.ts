import { NextRequest, NextResponse } from 'next/server';
import { db } from '@hostel-monitor/db';

const ML_API_KEY = process.env.ML_API_KEY || 'hms-ml-key-2026';

/**
 * GET /api/cameras — List all cameras across all hostels/floors.
 * Accepts either session auth or ML API key auth (for bridge.py).
 */
export async function GET(req: NextRequest) {
  // API key auth for bridge service + internal use
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (apiKey !== ML_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.connectDB();

    const hostels = await db.Hostel.find({}).sort({ _id: 1 });
    const cameras: Array<{
      id: string;
      label: string;
      hostelId: string;
      hostelName: string;
      floorNumber: number;
      floorId: string;
      description: string | null;
    }> = [];

    for (const hostel of hostels) {
      const floors = await db.Floor.find({ hostelId: hostel._id }).sort({ number: 1 });
      for (const floor of floors) {
        const floorCameras = await db.Camera.find({ floorId: floor._id }).sort({ label: 1 });
        for (const cam of floorCameras) {
          cameras.push({
            id: cam.id,
            label: cam.label,
            hostelId: (hostel._id as any).toString(),
            hostelName: hostel.name,
            floorNumber: floor.number,
            floorId: (floor._id as any).toString(),
            description: cam.description || null,
          });
        }
      }
    }

    return NextResponse.json({ data: cameras, total: cameras.length });
  } catch (error) {
    console.error('[api/cameras] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
