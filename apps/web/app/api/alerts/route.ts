/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@hostel-monitor/db';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const hostelId = searchParams.get('hostelId');
  const floorNumber = searchParams.get('floorNumber');
  const alertType = searchParams.get('alertType');
  const severity = searchParams.get('severity');
  const resolvedStr = searchParams.get('resolved');

  try {
     await db.connectDB();
     const where: any = {};

     if (hostelId || floorNumber) {
         const floorMatch: any = {};
         if (hostelId) floorMatch.hostelId = hostelId;
         if (floorNumber) floorMatch.number = parseInt(floorNumber, 10);
         
         const floors = await db.Floor.find(floorMatch).select('_id');
         const floorIds = floors.map(f => f._id);
         
         const cameras = await db.Camera.find({ floorId: { $in: floorIds } }).select('_id');
         const cameraIds = cameras.map(c => c._id);
         
         where.cameraId = { $in: cameraIds };
     }
     if (alertType) {
         where.type = alertType;
     }
     if (severity) {
         where.severity = severity;
     }
     if (resolvedStr) {
         where.resolved = resolvedStr === 'true';
     }

     const skip = (page - 1) * limit;
     
     const [total, alerts] = await Promise.all([
         db.Alert.countDocuments(where),
         db.Alert.find(where)
             .sort({ createdAt: -1 })
             .skip(skip)
             .limit(limit)
             .populate({
                 path: 'camera',
                 populate: {
                     path: 'floor',
                     populate: { path: 'hostel' }
                 }
             })
     ]);

     const formattedAlerts = alerts.map((a: any) => ({
         id: a.id,
         cameraId: a.cameraId,
         type: a.type,
         severity: a.severity,
         description: a.description,
         thumbnail: a.thumbnail,
         resolved: a.resolved,
         resolvedBy: a.resolvedBy,
         createdAt: a.createdAt,
         resolvedAt: a.resolvedAt,
         cameraLabel: a.camera?.label,
         hostelName: a.camera?.floor?.hostel?.name,
         hostelId: a.camera?.floor?.hostelId,
         floorNumber: a.camera?.floor?.number
     }));

     return NextResponse.json({
         alerts: formattedAlerts,
         pagination: {
             total,
             page,
             limit,
             totalPages: Math.ceil(total / limit)
         }
     });

  } catch (error) {
     console.error('Error fetching alerts:', error);
     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
