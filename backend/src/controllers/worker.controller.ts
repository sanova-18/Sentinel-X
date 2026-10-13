import { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { IncidentStatus } from '../types/index.js';

export async function getAllWorkers(req: Request, res: Response) {
  try {
    const workers = await prisma.worker.findMany({
      include: {
        helmet: true,
        readings: {
          take: 1,
          orderBy: { timestamp: 'desc' },
        },
        incidents: {
          where: {
            status: { in: [IncidentStatus.ACTIVE, IncidentStatus.ACKNOWLEDGED] },
          },
        },
      },
      orderBy: { workerId: 'asc' },
    });

    // Format output with latest reading summary
    const formatted = workers.map((w) => ({
      workerId: w.workerId,
      name: w.name,
      assignedZone: w.assignedZone,
      helmetId: w.helmet?.helmetId || null,
      connectivityStatus: w.helmet?.connectivityStatus || 'OFFLINE',
      lastSeen: w.helmet?.lastSeen || null,
      latestReading: w.readings[0] || null,
      activeIncidents: w.incidents,
      hasActiveAlert: w.incidents.length > 0,
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getWorkerById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const worker = await prisma.worker.findUnique({
      where: { workerId: id },
      include: {
        helmet: true,
        readings: {
          take: 1,
          orderBy: { timestamp: 'desc' },
        },
        incidents: {
          take: 10,
          orderBy: { detectedAt: 'desc' },
        },
      },
    });

    if (!worker) {
      return res.status(404).json({ error: `Worker ${id} not found` });
    }

    res.json(worker);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getWorkerLatestReading(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const reading = await prisma.sensorReading.findFirst({
      where: { workerId: id },
      orderBy: { timestamp: 'desc' },
    });

    if (!reading) {
      return res.status(404).json({ message: 'No readings found for this worker' });
    }

    res.json(reading);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getWorkerHistory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string || '60', 10);

    const readings = await prisma.sensorReading.findMany({
      where: { workerId: id },
      take: Math.min(limit, 200),
      orderBy: { timestamp: 'desc' },
    });

    // Return in chronological order for charting
    res.json(readings.reverse());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
