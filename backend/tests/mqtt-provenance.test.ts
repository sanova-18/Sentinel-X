import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  readingCreate: vi.fn(), createIncident: vi.fn(), ping: vi.fn(),
  emitTelemetry: vi.fn(), acknowledge: vi.fn(),
  workerFindUnique: vi.fn(),
}));
vi.mock('../src/config/db.js', () => ({ prisma: {
  sensorReading: { create: mocks.readingCreate },
  worker: { findUnique: mocks.workerFindUnique },
} }));
vi.mock('../src/services/incident.service.js', () => ({ IncidentService: { createIncident: mocks.createIncident } }));
vi.mock('../src/services/heartbeat.service.js', () => ({ HeartbeatService: { recordPing: mocks.ping } }));
vi.mock('../src/socket/io.js', () => ({ emitTelemetry: mocks.emitTelemetry }));
vi.mock('../src/mqtt/client.js', () => ({ publishAlertAcknowledgement: mocks.acknowledge }));
import { handleAlertMessage, handleTelemetryMessage } from '../src/mqtt/handlers.js';
import { AlertPayloadSchema, TelemetryPayloadSchema } from '../src/types/index.js';

const identity = { workerId: 'test-worker', helmetId: 'test-helmet', timestamp: '2026-10-15T12:00:00Z' };
const alert = { ...identity, eventId: 'test-event', alertType: 'FALL_DETECTED', severity: 'CRITICAL', description: 'Test fixture', isSimulated: false };
const asBuffer = (value: unknown) => Buffer.from(JSON.stringify(value));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.workerFindUnique.mockResolvedValue({ assignedHelmetId: identity.helmetId });
  mocks.readingCreate.mockImplementation(async ({ data }) => ({ ...data, readingId: 1, worker: { name: 'Test', assignedZone: 'Bench' } }));
  mocks.createIncident.mockResolvedValue({ incidentId: 'test-incident' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('Input identity and timestamps', () => {
  it.each(['', 'not-a-date', '2026-99-99T12:00:00Z'])('rejects invalid timestamps before database work: %s', async (timestamp) => {
    expect(TelemetryPayloadSchema.safeParse({ ...identity, timestamp }).success).toBe(false);
    expect(AlertPayloadSchema.safeParse({ ...alert, timestamp }).success).toBe(false);
    await handleTelemetryMessage('sentinelx/test-helmet/telemetry', asBuffer({ ...identity, timestamp }));
    await handleAlertMessage('sentinelx/test-helmet/alert', asBuffer({ ...alert, timestamp }));
    expect(mocks.workerFindUnique).not.toHaveBeenCalled();
    expect(mocks.ping).not.toHaveBeenCalled();
    expect(mocks.readingCreate).not.toHaveBeenCalled();
    expect(mocks.createIncident).not.toHaveBeenCalled();
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });

  it('accepts valid historical timestamps for queued alert retries', () => {
    const timestamp = '2026-01-01T00:00:00Z';
    expect(AlertPayloadSchema.parse({ ...alert, timestamp }).timestamp.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(TelemetryPayloadSchema.parse({ ...identity, timestamp: new Date(timestamp) }).timestamp.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rejects a mismatched telemetry topic before assignment lookup or heartbeat', async () => {
    await handleTelemetryMessage('sentinelx/wrong-helmet/telemetry', asBuffer(identity));
    expect(mocks.workerFindUnique).not.toHaveBeenCalled();
    expect(mocks.ping).not.toHaveBeenCalled();
    expect(mocks.readingCreate).not.toHaveBeenCalled();
    expect(mocks.emitTelemetry).not.toHaveBeenCalled();
  });

  it.each([null, { assignedHelmetId: null }, { assignedHelmetId: 'another-helmet' }])('rejects unknown/unassigned/mismatched workers before heartbeat or writes: %j', async (worker) => {
    mocks.workerFindUnique.mockResolvedValue(worker);
    await handleTelemetryMessage('sentinelx/test-helmet/telemetry', asBuffer(identity));
    await handleAlertMessage('sentinelx/test-helmet/alert', asBuffer(alert));
    expect(mocks.ping).not.toHaveBeenCalled();
    expect(mocks.readingCreate).not.toHaveBeenCalled();
    expect(mocks.createIncident).not.toHaveBeenCalled();
    expect(mocks.emitTelemetry).not.toHaveBeenCalled();
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });

  it('requires the assignment lookup to succeed before treating the device as online', async () => {
    mocks.workerFindUnique.mockRejectedValue(new Error('DB unavailable'));
    await handleTelemetryMessage('sentinelx/test-helmet/telemetry', asBuffer(identity));
    await handleAlertMessage('sentinelx/test-helmet/alert', asBuffer(alert));
    expect(mocks.ping).not.toHaveBeenCalled();
    expect(mocks.readingCreate).not.toHaveBeenCalled();
    expect(mocks.createIncident).not.toHaveBeenCalled();
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });
});

describe('Source provenance', () => {
  it.each([true, false, null, undefined])('persists and broadcasts telemetry source %s unchanged', async (isSimulated) => {
    await handleTelemetryMessage('sentinelx/test-helmet/telemetry', asBuffer({ ...identity, motion: { fallDetected: true }, isSimulated }));
    const expected = isSimulated ?? null;
    expect(mocks.readingCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isSimulated: expected }) }));
    expect(mocks.createIncident).toHaveBeenCalledWith(expect.objectContaining({ isSimulated: expected }));
    expect(mocks.emitTelemetry).toHaveBeenCalledWith(expect.objectContaining({ isSimulated: expected }));
  });

  it('does not infer a simulator source from a missing flag', () => {
    expect(TelemetryPayloadSchema.parse(identity).isSimulated).toBeNull();
    const { isSimulated, ...legacyAlert } = alert;
    expect(AlertPayloadSchema.parse(legacyAlert).isSimulated).toBeNull();
  });

  it('rejects string flags instead of treating false as truthy', () => {
    expect(TelemetryPayloadSchema.safeParse({ ...identity, isSimulated: 'false' }).success).toBe(false);
    expect(AlertPayloadSchema.safeParse({ ...alert, isSimulated: 'true' }).success).toBe(false);
  });
});

describe('Persistence acknowledgements', () => {
  it('does not acknowledge until the persistence promise has completed', async () => {
    let commit!: () => void;
    mocks.createIncident.mockImplementation(() => new Promise<void>((resolve) => { commit = resolve; }));
    const processing = handleAlertMessage('sentinelx/test-helmet/alert', asBuffer(alert));
    await vi.waitFor(() => expect(mocks.createIncident).toHaveBeenCalled());
    expect(mocks.acknowledge).not.toHaveBeenCalled();
    commit();
    await processing;
    expect(mocks.acknowledge).toHaveBeenCalledWith({ helmetId: alert.helmetId, workerId: alert.workerId, eventId: alert.eventId });
    expect(mocks.createIncident).toHaveBeenCalledWith(expect.objectContaining({ isSimulated: false }));
  });

  it('never acknowledges a DB failure and allows the same event to retry', async () => {
    mocks.createIncident.mockRejectedValueOnce(new Error('DB unavailable'));
    await handleAlertMessage('sentinelx/test-helmet/alert', asBuffer(alert));
    expect(mocks.acknowledge).not.toHaveBeenCalled();
    await handleAlertMessage('sentinelx/test-helmet/alert', asBuffer(alert));
    expect(mocks.acknowledge).toHaveBeenCalledTimes(1);
  });

  it('retries acknowledgement after a lost ACK without rejecting the replay', async () => {
    mocks.acknowledge.mockRejectedValueOnce(new Error('Broker disconnected'));
    await handleAlertMessage('sentinelx/test-helmet/alert', asBuffer(alert));
    await handleAlertMessage('sentinelx/test-helmet/alert', asBuffer(alert));
    expect(mocks.createIncident).toHaveBeenCalledTimes(2);
    expect(mocks.acknowledge).toHaveBeenCalledTimes(2);
  });

  it('rejects mismatched topic identity before persistence or acknowledgement', async () => {
    await handleAlertMessage('sentinelx/wrong-helmet/alert', asBuffer(alert));
    expect(mocks.ping).not.toHaveBeenCalled();
    expect(mocks.createIncident).not.toHaveBeenCalled();
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });

  it('rejects empty event IDs so an acknowledgement always represents a receipt', async () => {
    await handleAlertMessage('sentinelx/test-helmet/alert', asBuffer({ ...alert, eventId: '' }));
    expect(mocks.createIncident).not.toHaveBeenCalled();
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });
});
