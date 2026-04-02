import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@hostel-monitor/db';
import { HOSTEL_CONFIG, ALL_HOSTEL_IDS } from '@hostel-monitor/types';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hostelsData = await prisma.hostel.findMany({
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
          }
        }
      }
    });

    const enrichedHostels = hostelsData.map(h => {
        let onlineCameras = 0;
        let activeAlerts = 0;

        h.floorList.forEach(floor => {
            floor.cameras.forEach(cam => {
                if (cam.isOnline) onlineCameras++;
                activeAlerts += cam.alerts.length;
            });
        });

        return {
            id: h.id,
            name: h.name,
            floors: h.floors,
            onlineCameras,
            activeAlerts,
            color: HOSTEL_CONFIG[h.id as keyof typeof HOSTEL_CONFIG]?.color || '#ffffff'
        }
    });

    // Make sure we always return 4 hostels per spec, even if DB doesn't have them yet
    const result = ALL_HOSTEL_IDS.map(id => {
       const found = enrichedHostels.find(h => h.id === id);
       if (found) return found;
       return {
            id,
            name: HOSTEL_CONFIG[id].name,
            floors: HOSTEL_CONFIG[id].totalFloors,
            onlineCameras: 0,
            activeAlerts: 0,
            color: HOSTEL_CONFIG[id].color
       };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching hostels:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
