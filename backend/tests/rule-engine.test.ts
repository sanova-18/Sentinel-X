import { describe, it, expect } from 'vitest';
import { RuleEngineService } from '../src/services/rule-engine.service.js';
import { SeverityLevel, TelemetryPayload } from '../src/types/index.js';

describe('RuleEngineService Threshold Tests', () => {
  it('should classify normal vitals and environment as NORMAL', () => {
    const payload: TelemetryPayload = {
      helmetId: 'H-201',
      workerId: 'W-101',
      timestamp: new Date(),
      vitals: { heartRate: 75, spo2: 98 },
      environment: { temperature: 26, humidity: 50, gasRaw: 180 },
      motion: { fallDetected: false, inactivityDetected: false },
      isSimulated: true,
    };

    const res = RuleEngineService.evaluateTelemetry(payload);
    expect(res.overallSeverity).toBe(SeverityLevel.NORMAL);
    expect(res.alerts).toHaveLength(0);
  });

  it('should classify fall detection as CRITICAL', () => {
    const payload: TelemetryPayload = {
      helmetId: 'H-201',
      workerId: 'W-101',
      timestamp: new Date(),
      vitals: { heartRate: 85, spo2: 97 },
      environment: { temperature: 26, humidity: 50, gasRaw: 180 },
      motion: { fallDetected: true, inactivityDetected: false },
      isSimulated: true,
    };

    const res = RuleEngineService.evaluateTelemetry(payload);
    expect(res.overallSeverity).toBe(SeverityLevel.CRITICAL);
    expect(res.alerts.some(a => a.incidentType === 'FALL_DETECTED')).toBe(true);
  });

  it('should classify elevated gas as HIGH_RISK or CRITICAL based on threshold', () => {
    // High risk (> 650)
    const payloadHighRisk: TelemetryPayload = {
      helmetId: 'H-202',
      workerId: 'W-102',
      timestamp: new Date(),
      environment: { gasRaw: 720 },
      motion: { fallDetected: false, inactivityDetected: false },
      isSimulated: true,
    };
    const res1 = RuleEngineService.evaluateTelemetry(payloadHighRisk);
    expect(res1.overallSeverity).toBe(SeverityLevel.HIGH_RISK);

    // Critical (> 850)
    const payloadCritical: TelemetryPayload = {
      ...payloadHighRisk,
      environment: { gasRaw: 920 },
    };
    const res2 = RuleEngineService.evaluateTelemetry(payloadCritical);
    expect(res2.overallSeverity).toBe(SeverityLevel.CRITICAL);
  });

  it('should detect hypoxia when SpO2 drops', () => {
    const payloadHypoxia: TelemetryPayload = {
      helmetId: 'H-203',
      workerId: 'W-103',
      timestamp: new Date(),
      vitals: { heartRate: 78, spo2: 86.5 },
      motion: { fallDetected: false, inactivityDetected: false },
      isSimulated: true,
    };
    const res = RuleEngineService.evaluateTelemetry(payloadHypoxia);
    expect(res.overallSeverity).toBe(SeverityLevel.CRITICAL);
    expect(res.alerts.some(a => a.incidentType === 'HYPOXIA_CRITICAL')).toBe(true);
  });
});
