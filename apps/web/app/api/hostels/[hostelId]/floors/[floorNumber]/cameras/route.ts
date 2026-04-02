import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { prisma } from '@hostel-monitor/db';

export async function GET(
  request: Request,
  { params }: { params: { hostelId: string, floorNumber: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { hostelId, floorNumber } = params;
  const number = parseInt(floorNumber, 10);

  if (isNaN(number)) {
     return NextResponse.json({ error: 'Invalid floor number' }, { status: 400 });
  }

  try {
    const floor = await prisma.floor.findUnique({
      where: { hostelId_number: { hostelId, number } },
      include: {
        cameras: {
          include: {
            alerts: {
              where: { resolved: false }
            }
          }
        }
      }
    });

    if (!floor) {
        return NextResponse.json({ error: 'Floor not found' }, { status: 404 });
    }

    const cameras = floor.cameras.map(cam => ({
        id: cam.id,
        label: cam.label,
        posX: cam.posX,
        posY: cam.posY,
        isOnline: cam.isOnline,
        description: cam.description,
        unresolvedAlertsCount: cam.alerts.length
    }));

    return NextResponse.json(cameras);
  } catch (error) {
    console.error(`Error fetching cameras for floor:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
