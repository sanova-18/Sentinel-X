import { prisma } from '../config/db.js';
import { SeverityLevel, IncidentStatus } from '../types/index.js';
import { emitIncident, emitIncidentUpdate } from '../socket/io.js';

interface CreateIncidentInput {
  workerId: string;
  helmetId: string;
  incidentType: string;
  severity: SeverityLevel;
  description: string;
  detectedAt?: Date;
  eventId?: string;
  isSimulated?: boolean | null;
}

export class IncidentService {
  /**
   * Commit a receipt and its incident together. Source-specific ongoing hazards are
   * grouped, while each event ID is durable across retries and backend restarts.
   * Serializable retries also prevent concurrent telemetry/alert processing from
   * creating two active incidents for the same worker, helmet, type and source.
   */
  public static async createIncident(data: CreateIncidentInput) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          if (data.eventId) {
            const receipt = await tx.alertReceipt.findUnique({
              where: { helmetId_eventId: { helmetId: data.helmetId, eventId: data.eventId } },
              include: { incident: { include: { worker: true, helmet: true } } },
            });
            if (receipt) {
              if (receipt.workerId !== data.workerId ||
                  receipt.isSimulated !== (data.isSimulated ?? null) ||
                  receipt.incident.incidentType !== data.incidentType) {
                throw new Error('Alert event ID was reused with a different identity, source or type');
              }
              return { incident: receipt.incident, created: false };
            }
          }

          const where = {
            workerId: data.workerId,
            helmetId: data.helmetId,
            isSimulated: data.isSimulated ?? null,
            incidentType: data.incidentType,
          };
          const existingActive = await tx.incident.findFirst({
            where: { ...where, status: { in: [IncidentStatus.ACTIVE, IncidentStatus.ACKNOWLEDGED] } },
            include: { worker: true, helmet: true },
          });
          const incident = existingActive ?? await tx.incident.create({
            data: {
              ...where,
              status: IncidentStatus.ACTIVE,
              severity: data.severity,
              description: data.description,
              detectedAt: data.detectedAt || new Date(),
            },
            include: { worker: true, helmet: true },
          });

          if (data.eventId) {
            await tx.alertReceipt.create({
              data: {
                helmetId: data.helmetId,
                eventId: data.eventId,
                workerId: data.workerId,
                isSimulated: data.isSimulated ?? null,
                incidentId: incident.incidentId,
              },
            });
          }
          return { incident, created: !existingActive };
        }, { isolationLevel: 'Serializable' });

        // Emit only after commit. A retry can safely ACK an existing DB receipt.
        if (result.created) {
          console.log(`🚨 [IncidentService] Created ${result.incident.severity} incident [${result.incident.incidentType}] for Worker ${result.incident.workerId}`);
          emitIncident(result.incident);
        }
        return result.incident;
      } catch (err) {
        const code = (err as { code?: string }).code;
        // P2034: serialization conflict; P2002: concurrent receipt key insertion.
        // Re-read the durable receipt in a fresh transaction before accepting it.
        if (attempt < 3 && (code === 'P2034' || (data.eventId && code === 'P2002'))) continue;
        throw err;
      }
    }
    throw new Error('Incident transaction retry limit exceeded');
  }

  public static async getAllIncidents(filters: {
    workerId?: string;
    severity?: SeverityLevel;
    status?: IncidentStatus;
    incidentType?: string;
  } = {}) {
    return prisma.incident.findMany({
      where: {
        ...(filters.workerId && { workerId: filters.workerId }),
        ...(filters.severity && { severity: filters.severity }),
        ...(filters.status && { status: filters.status }),
        ...(filters.incidentType && { incidentType: filters.incidentType }),
      },
      include: {
        worker: true,
        helmet: true,
      },
      orderBy: {
        detectedAt: 'desc',
      },
    });
  }

  public static async getActiveIncidents() {
    return prisma.incident.findMany({
      where: {
        status: {
          in: [IncidentStatus.ACTIVE, IncidentStatus.ACKNOWLEDGED],
        },
      },
      include: {
        worker: true,
        helmet: true,
      },
      orderBy: {
        detectedAt: 'desc',
      },
    });
  }

  public static async acknowledgeIncident(incidentId: string, acknowledgedBy = 'Control Center Supervisor') {
    const existing = await prisma.incident.findUnique({ where: { incidentId } });
    if (!existing) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const updated = await prisma.incident.update({
      where: { incidentId },
      data: {
        status: IncidentStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedBy,
      },
      include: {
        worker: true,
        helmet: true,
      },
    });

    console.log(`[IncidentService] Acknowledged incident ${incidentId} by ${acknowledgedBy}`);
    emitIncidentUpdate(updated);
    return updated;
  }

  public static async resolveIncident(incidentId: string) {
    const existing = await prisma.incident.findUnique({ where: { incidentId } });
    if (!existing) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const updated = await prisma.incident.update({
      where: { incidentId },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
      },
      include: {
        worker: true,
        helmet: true,
      },
    });

    console.log(`[IncidentService] Resolved incident ${incidentId}`);
    emitIncidentUpdate(updated);
    return updated;
  }
}
