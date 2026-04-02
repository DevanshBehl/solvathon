import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma, Prisma } from '@hostel-monitor/db';

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

  const where: Prisma.AlertWhereInput = {};

  if (hostelId) {
      where.camera = { floor: { hostelId } };
  }
  if (hostelId && floorNumber) {
      where.camera = { floor: { hostelId, number: parseInt(floorNumber, 10) } };
  }
  if (alertType) {
      where.type = alertType as any;
  }
  if (severity) {
      where.severity = severity as any;
  }
  if (resolvedStr) {
      where.resolved = resolvedStr === 'true';
  }

  try {
     const skip = (page - 1) * limit;
     
     const [total, alerts] = await Promise.all([
         prisma.alert.count({ where }),
         prisma.alert.findMany({
             where,
             orderBy: { createdAt: 'desc' },
             skip,
             take: limit,
             include: {
                 camera: {
                     include: {
                         floor: {
                             include: { hostel: true }
                         }
                     }
                 }
             }
         })
     ]);

     const formattedAlerts = alerts.map(a => ({
         ...a,
         cameraLabel: a.camera.label,
         hostelName: a.camera.floor.hostel.name,
         hostelId: a.camera.floor.hostelId,
         floorNumber: a.camera.floor.number
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
