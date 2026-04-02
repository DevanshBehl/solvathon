import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@hostel-monitor/db';

export async function PATCH(
  request: Request,
  { params }: { params: { alertId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
     const alert = await prisma.alert.findUnique({ where: { id: params.alertId } });
     if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });

     const updatedAlert = await prisma.alert.update({
         where: { id: params.alertId },
         data: {
             resolved: true,
             resolvedBy: session.user?.name || session.user?.email || 'Unknown User',
             resolvedAt: new Date()
         }
     });

     return NextResponse.json(updatedAlert);

  } catch (error) {
      console.error('Error resolving alert:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
