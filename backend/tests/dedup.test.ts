import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), emitIncident: vi.fn() }));
vi.mock('../src/config/db.js', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('../src/socket/io.js', () => ({ emitIncident: mocks.emitIncident, emitIncidentUpdate: vi.fn() }));
import { IncidentService } from '../src/services/incident.service.js';
import { SeverityLevel } from '../src/types/index.js';

const input = {
  workerId: 'test-worker', helmetId: 'test-helmet', eventId: 'test-event',
  incidentType: 'FALL_DETECTED', severity: SeverityLevel.CRITICAL,
  description: 'Test fixture', isSimulated: false,
};
let incidents: any[];
let receipts: any[];
let failCommit: boolean;
let tx: any;

beforeEach(() => {
  vi.resetAllMocks();
  incidents = []; receipts = []; failCommit = false;
  mocks.transaction.mockImplementation(async (callback) => {
    const pendingIncidents = [...incidents];
    const pendingReceipts = [...receipts];
    tx = {
      incident: {
        findFirst: vi.fn(async ({ where }) => pendingIncidents.find((incident) =>
          Object.entries(where).every(([key, value]) =>
            value && typeof value === 'object' && 'in' in value
              ? (value.in as unknown[]).includes(incident[key])
              : incident[key] === value)) ?? null),
        create: vi.fn(async ({ data }) => {
          const incident = { ...data, incidentId: `incident-${pendingIncidents.length + 1}`, worker: {}, helmet: {} };
          pendingIncidents.push(incident);
          return incident;
        }),
      },
      alertReceipt: {
        findUnique: vi.fn(async ({ where: { helmetId_eventId: key } }) => {
          const receipt = pendingReceipts.find((r) => r.helmetId === key.helmetId && r.eventId === key.eventId);
          return receipt ? { ...receipt, incident: pendingIncidents.find((i) => i.incidentId === receipt.incidentId) } : null;
        }),
        create: vi.fn(async ({ data }) => { pendingReceipts.push(data); return data; }),
      },
    };
    const result = await callback(tx);
    if (failCommit) throw new Error('Test commit failure');
    incidents = pendingIncidents; receipts = pendingReceipts;
    return result;
  });
});

describe('Durable alert receipts', () => {
  it('commits the receipt and incident together and emits once after commit', async () => {
    mocks.emitIncident.mockImplementation(() => expect(receipts).toHaveLength(1));
    const incident = await IncidentService.createIncident(input);
    expect(receipts).toEqual([expect.objectContaining({ incidentId: incident.incidentId, isSimulated: false })]);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(mocks.emitIncident).toHaveBeenCalledTimes(1);
  });

  it('reuses a durable receipt after module reload without creating or emitting again', async () => {
    const original = await IncidentService.createIncident(input);
    incidents[0].status = 'RESOLVED';
    vi.resetModules();
    const { IncidentService: restartedService } = await import('../src/services/incident.service.js');
    const repeated = await restartedService.createIncident(input);
    expect(repeated.incidentId).toBe(original.incidentId);
    expect(incidents).toHaveLength(1);
    expect(receipts).toHaveLength(1);
    expect(tx.incident.create).not.toHaveBeenCalled();
    expect(mocks.emitIncident).toHaveBeenCalledTimes(1);
  });

  it('does not poison retries when a transaction fails', async () => {
    failCommit = true;
    await expect(IncidentService.createIncident(input)).rejects.toThrow('commit failure');
    expect(incidents).toHaveLength(0);
    expect(receipts).toHaveLength(0);
    expect(mocks.emitIncident).not.toHaveBeenCalled();
    failCommit = false;
    await IncidentService.createIncident(input);
    expect(incidents).toHaveLength(1);
    expect(receipts).toHaveLength(1);
  });

  it.each(['P2034', 'P2002'])('retries a concurrent transaction conflict %s', async (code) => {
    mocks.transaction.mockRejectedValueOnce({ code });
    await IncidentService.createIncident(input);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(receipts).toHaveLength(1);
  });

  it('stops after bounded serialization retries without acknowledging success', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2034' });
    await expect(IncidentService.createIncident(input)).rejects.toMatchObject({ code: 'P2034' });
    expect(mocks.transaction).toHaveBeenCalledTimes(4);
    expect(mocks.emitIncident).not.toHaveBeenCalled();
  });

  it('gives new events receipts even when they join the same ongoing hazard', async () => {
    await IncidentService.createIncident(input);
    await IncidentService.createIncident({ ...input, eventId: 'test-event-2' });
    expect(incidents).toHaveLength(1);
    expect(receipts).toHaveLength(2);
    expect(mocks.emitIncident).toHaveBeenCalledTimes(1);
  });

  it('keeps acknowledged hazards grouped for telemetry and new alert events', async () => {
    const original = await IncidentService.createIncident(input);
    incidents[0].status = 'ACKNOWLEDGED';
    const telemetry = await IncidentService.createIncident({ ...input, eventId: undefined });
    const nextAlert = await IncidentService.createIncident({ ...input, eventId: 'next-event' });
    expect(telemetry.incidentId).toBe(original.incidentId);
    expect(nextAlert.incidentId).toBe(original.incidentId);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].status).toBe('ACKNOWLEDGED');
    expect(receipts).toHaveLength(2);
    expect(mocks.emitIncident).toHaveBeenCalledTimes(1);
  });

  it('creates a new incident for a new event after the previous hazard is resolved', async () => {
    const original = await IncidentService.createIncident(input);
    incidents[0].status = 'RESOLVED';
    const next = await IncidentService.createIncident({ ...input, eventId: 'next-event' });
    expect(next.incidentId).not.toBe(original.incidentId);
    expect(next.status).toBe('ACTIVE');
    expect(incidents).toHaveLength(2);
    expect(receipts).toHaveLength(2);
  });

  it('separates active hardware, simulated and unknown hazards', async () => {
    for (const isSimulated of [true, false, null]) {
      await IncidentService.createIncident({ ...input, eventId: undefined, isSimulated });
    }
    expect(incidents.map((incident) => incident.isSimulated)).toEqual([true, false, null]);
    expect(receipts).toHaveLength(0);
  });

  it('permits the same eventId from different helmets', async () => {
    await IncidentService.createIncident(input);
    await IncidentService.createIncident({ ...input, helmetId: 'another-helmet' });
    expect(receipts).toHaveLength(2);
    expect(incidents).toHaveLength(2);
  });

  it.each([
    { workerId: 'different-worker' }, { isSimulated: true }, { incidentType: 'DIFFERENT_HAZARD' },
  ])('rejects an event ID reused with different identifying data: %j', async (change) => {
    await IncidentService.createIncident(input);
    await expect(IncidentService.createIncident({ ...input, ...change })).rejects.toThrow('reused');
    expect(receipts).toHaveLength(1);
    expect(incidents).toHaveLength(1);
  });
});
