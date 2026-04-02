import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@hostel-monitor/db';

export async function GET(
  request: Request,
  { params }: { params: { cameraId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const camera = await prisma.camera.findUnique({
      where: { id: params.cameraId },
    });

    if (!camera) {
        return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    const alerts = await prisma.alert.findMany({
        where: { cameraId: params.cameraId },
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    return NextResponse.json({ ...camera, alerts });

  } catch (error) {
    console.error(`Error fetching camera:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { cameraId: string } }
) {
  const session = await getServerSession(authOptions);
  // @ts-ignore
  if (!session || session.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 403 });
  }

  try {
     const body = await request.json();
     const { posX, posY, description, rtspUrl } = body;

     const updateData: any = {};
     if (typeof posX === 'number') updateData.posX = posX;
     if (typeof posY === 'number') updateData.posY = posY;
     if (typeof description === 'string') updateData.description = description;
     if (typeof rtspUrl === 'string') updateData.rtspUrl = rtspUrl;

     const updatedCamera = await prisma.camera.update({
         where: { id: params.cameraId },
         data: updateData
     });

     return NextResponse.json(updatedCamera);

  } catch (error) {
      console.error('Error updating camera:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
