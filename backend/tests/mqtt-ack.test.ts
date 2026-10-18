import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ connected: true, on: vi.fn(), publish: vi.fn(), subscribe: vi.fn() }));
vi.mock('mqtt', () => ({ default: { connect: vi.fn(() => fake) } }));
vi.mock('../src/mqtt/handlers.js', () => ({ handleTelemetryMessage: vi.fn(), handleAlertMessage: vi.fn() }));
import { initMqttClient, publishAlertAcknowledgement } from '../src/mqtt/client.js';
const identity = { helmetId: 'test-helmet', workerId: 'test-worker', eventId: 'test-event' };

beforeEach(() => {
  vi.clearAllMocks();
  fake.connected = true;
  fake.publish.mockImplementation((_topic, _payload, _options, callback) => callback());
  initMqttClient();
});

describe('MQTT ACK transport', () => {
  it('publishes the exact non-retained QoS1 receipt contract', async () => {
    await publishAlertAcknowledgement(identity);
    expect(fake.publish).toHaveBeenCalledWith('sentinelx/test-helmet/ack',
      JSON.stringify({ ...identity, status: 'persisted' }), { qos: 1, retain: false }, expect.any(Function));
  });

  it('reports an offline broker so the device can retry later', async () => {
    fake.connected = false;
    await expect(publishAlertAcknowledgement(identity)).rejects.toThrow('unavailable');
    expect(fake.publish).not.toHaveBeenCalled();
  });

  it('propagates a publish failure without claiming acknowledgement', async () => {
    fake.publish.mockImplementation((_topic, _payload, _options, callback) => callback(new Error('publish failed')));
    await expect(publishAlertAcknowledgement(identity)).rejects.toThrow('publish failed');
  });
});
