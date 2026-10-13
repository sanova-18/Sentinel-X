import { Request, Response } from 'express';
import { prisma } from '../config/db.js';

export async function getHelmetStatuses(req: Request, res: Response) {
  try {
    const helmets = await prisma.helmet.findMany({
      include: {
        worker: true,
      },
      orderBy: { helmetId: 'asc' },
    });

    res.json(helmets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
