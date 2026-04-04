import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@hostel-monitor/db';

/**
 * PATCH /api/alerts/resolve-all
 * Resolves all unresolved alerts, optionally filtered by hostelId and/or floorNumber.
 * 
 * Query params:
 *   hostelId    — resolve only alerts from this hostel
 *   floorNumber — resolve only alerts from this floor (requires hostelId)
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.connectDB();

    const { searchParams } = new URL(request.url);
    const hostelId = searchParams.get('hostelId');
    const floorNumber = searchParams.get('floorNumber');

    // Build the filter for unresolved alerts
    const filter: Record<string, any> = { resolved: false };

    if (hostelId) {
      // Find cameras belonging to this hostel (optionally filtered by floor)
      const hostel = await db.Hostel.findById(hostelId);
      if (!hostel) {
        return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
      }

      const floorFilter: Record<string, any> = { hostelId: hostel._id };
      if (floorNumber) {
        floorFilter.number = parseInt(floorNumber, 10);
      }

      const floors = await db.Floor.find(floorFilter);
      const floorIds = floors.map((f: any) => f._id);
      const cameras = await db.Camera.find({ floorId: { $in: floorIds } });
      const cameraIds = cameras.map((c: any) => c._id);

      filter.cameraId = { $in: cameraIds };
    }

    const resolvedBy = session.user?.name || session.user?.email || 'Unknown User';

    const result = await db.Alert.updateMany(filter, {
      $set: {
        resolved: true,
        resolvedBy,
        resolvedAt: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        resolved: result.modifiedCount,
        message: `Resolved ${result.modifiedCount} alert(s)`,
      },
    });
  } catch (error) {
    console.error('[api/alerts/resolve-all] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
