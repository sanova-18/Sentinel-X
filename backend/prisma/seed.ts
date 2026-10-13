import { PrismaClient, ConnectivityStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SentinelX database...');

  // Clean existing data for a fresh seed
  await prisma.incident.deleteMany({});
  await prisma.sensorReading.deleteMany({});
  await prisma.worker.deleteMany({});
  await prisma.helmet.deleteMany({});

  const workersData = [
    {
      workerId: 'W-101',
      name: 'Alex Carter',
      assignedZone: 'Zone A - Extraction Pit',
      helmetId: 'H-201',
    },
    {
      workerId: 'W-102',
      name: 'Marcus Vance',
      assignedZone: 'Zone B - Shaft 3',
      helmetId: 'H-202',
    },
    {
      workerId: 'W-103',
      name: 'Elena Rostova',
      assignedZone: 'Zone C - Processing Plant',
      helmetId: 'H-203',
    },
  ];

  for (const item of workersData) {
    // Upsert Helmet
    const helmet = await prisma.helmet.create({
      data: {
        helmetId: item.helmetId,
        connectivityStatus: ConnectivityStatus.OFFLINE,
        lastSeen: new Date(),
        assignedWorkerId: item.workerId,
      },
    });

    // Upsert Worker
    await prisma.worker.create({
      data: {
        workerId: item.workerId,
        name: item.name,
        assignedZone: item.assignedZone,
        assignedHelmetId: helmet.helmetId,
      },
    });

    console.log(`✓ Seeded Worker ${item.name} (${item.workerId}) paired with Helmet ${item.helmetId}`);
  }

  console.log('✅ Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
