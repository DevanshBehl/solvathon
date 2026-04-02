// ============================================
// Database Seed Script
// Populates hostels, floors, cameras, and sample users
// ============================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const HOSTEL_DATA = [
  { id: 'A', name: 'Hostel A', floors: 15 },
  { id: 'C', name: 'Hostel C', floors: 16 },
  { id: 'D1', name: 'Hostel D1', floors: 16 },
  { id: 'D2', name: 'Hostel D2', floors: 16 },
];

/** Camera positions — 3 cameras per floor spread across the map */
const CAMERA_POSITIONS = [
  { posX: 20, posY: 30, description: 'Near staircase' },
  { posX: 50, posY: 60, description: 'Corridor center' },
  { posX: 80, posY: 40, description: 'Near emergency exit' },
];

async function main() {
  console.info('🌱 Seeding database...');

  // ── Seed Users ──────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@hostel.com' },
    update: {},
    create: {
      email: 'admin@hostel.com',
      name: 'Super Admin',
      password: passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'warden@hostel.com' },
    update: {},
    create: {
      email: 'warden@hostel.com',
      name: 'Head Warden',
      password: passwordHash,
      role: 'WARDEN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'security@hostel.com' },
    update: {},
    create: {
      email: 'security@hostel.com',
      name: 'Security Guard',
      password: passwordHash,
      role: 'SECURITY',
    },
  });

  console.info('✅ Users seeded');

  // ── Seed Hostels ────────────────────────────
  for (const hostel of HOSTEL_DATA) {
    await prisma.hostel.upsert({
      where: { id: hostel.id },
      update: { name: hostel.name, floors: hostel.floors },
      create: hostel,
    });

    // ── Seed Floors & Cameras ───────────────
    for (let floorNum = 1; floorNum <= hostel.floors; floorNum++) {
      const floor = await prisma.floor.upsert({
        where: {
          hostelId_number: {
            hostelId: hostel.id,
            number: floorNum,
          },
        },
        update: {},
        create: {
          hostelId: hostel.id,
          number: floorNum,
        },
      });

      // 3 cameras per floor
      for (let camIdx = 0; camIdx < CAMERA_POSITIONS.length; camIdx++) {
        const pos = CAMERA_POSITIONS[camIdx];
        const camNumber = String(camIdx + 1).padStart(3, '0');
        const floorStr = String(floorNum).padStart(2, '0');
        const label = `CAM-${hostel.id}-${floorStr}-${camNumber}`;
        const rtspUrl = `rtsp://192.168.1.${floorNum}:${5000 + camIdx}/stream`;

        // Check if camera with this label already exists on this floor
        const existing = await prisma.camera.findFirst({
          where: { label, floorId: floor.id },
        });

        if (!existing) {
          await prisma.camera.create({
            data: {
              label,
              floorId: floor.id,
              rtspUrl,
              posX: pos.posX,
              posY: pos.posY,
              isOnline: true,
              description: pos.description,
            },
          });
        }
      }
    }

    console.info(`✅ ${hostel.name}: ${hostel.floors} floors, ${hostel.floors * 3} cameras seeded`);
  }

  const totalCameras = await prisma.camera.count();
  const totalFloors = await prisma.floor.count();
  console.info(`\n🎉 Seeding complete!`);
  console.info(`   Hostels: ${HOSTEL_DATA.length}`);
  console.info(`   Floors: ${totalFloors}`);
  console.info(`   Cameras: ${totalCameras}`);
  console.info(`   Users: 3 (admin/warden/security)`);
  console.info(`   Password: password123`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
