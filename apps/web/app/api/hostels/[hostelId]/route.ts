import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@hostel-monitor/db';

export async function GET(
  request: Request,
  { params }: { params: { hostelId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { hostelId } = params;

  try {
    const hostel = await prisma.hostel.findUnique({
      where: { id: hostelId },
      include: {
        floorList: {
          include: {
            cameras: {
              include: {
                alerts: {
                  where: { resolved: false }
                }
              }
            }
          },
          orderBy: { number: 'asc' }
        }
      }
    });

    if (!hostel) {
       return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    const floors = hostel.floorList.map(floor => {
        const cameraCount = floor.cameras.length;
        let activeAlertCount = 0;
        floor.cameras.forEach(cam => {
            activeAlertCount += cam.alerts.length;
        });

        return {
            id: floor.id,
            number: floor.number,
            cameraCount,
            activeAlertCount
        }
    });

    return NextResponse.json({
        id: hostel.id,
        name: hostel.name,
        floors
    });
  } catch (error) {
    console.error(`Error fetching hostel ${hostelId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
