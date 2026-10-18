import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { TelemetryPayloadSchema, AlertPayloadSchema } from '../../backend/src/types/index.js';
const lines = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(line => JSON.parse(line));
assert.equal(lines.length, 3);
for (const value of lines.slice(0, 2)) {
  const result = TelemetryPayloadSchema.parse(value);
  assert.equal(result.isSimulated, false);
  assert.equal(result.timestamp.toISOString(), '2026-10-15T00:00:00.000Z');
}
assert.equal(lines[0].environment.gasRaw, 200);
assert.equal(lines[0].vitals.heartRate, 76);
assert.equal(lines[1].vitals.heartRate, null);
assert.equal(lines[1].vitals.spo2, null);
assert.equal(lines[1].environment.gasRaw, null);
assert.equal(lines[1].environment.temperature, null);
assert.equal(AlertPayloadSchema.parse(lines[2]).alertType, 'SOS_TRIGGERED');
assert.equal(lines[2].isSimulated, false);
console.log('PASS: actual firmware JSON builders accepted by existing Zod schemas; full, missing, and SOS cases');
