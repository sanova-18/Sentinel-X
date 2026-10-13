import { config } from '../config/index.js';
import { SeverityLevel, TelemetryPayload, RuleEngineResult, EvaluatedAlert } from '../types/index.js';

export class RuleEngineService {
  /**
   * Evaluates telemetry sensor readings against safety thresholds.
   * Note: Thresholds are prototype demonstration boundaries for educational simulation.
   */
  public static evaluateTelemetry(payload: TelemetryPayload): RuleEngineResult {
    const alerts: EvaluatedAlert[] = [];
    const t = config.thresholds;

    // 1. Motion: Fall Detection (CRITICAL)
    if (payload.motion?.fallDetected) {
      alerts.push({
        incidentType: 'FALL_DETECTED',
        severity: SeverityLevel.CRITICAL,
        description: `Critical impact and sudden fall posture detected on helmet ${payload.helmetId}`,
      });
    }

    // 2. Motion: Inactivity / Man-Down (WARNING)
    if (payload.motion?.inactivityDetected) {
      alerts.push({
        incidentType: 'PROLONGED_INACTIVITY',
        severity: SeverityLevel.WARNING,
        description: `Worker inactivity detected without motion on helmet ${payload.helmetId}`,
      });
    }

    // 3. Environmental: Toxic Gas Raw Value (MQ-5)
    if (payload.environment?.gasRaw !== undefined && payload.environment?.gasRaw !== null) {
      const gas = payload.environment.gasRaw;
      if (gas >= t.gasRaw.criticalThreshold) {
        alerts.push({
          incidentType: 'GAS_LEAK_CRITICAL',
          severity: SeverityLevel.CRITICAL,
          description: `Severe gas spike detected: raw sensor reading ${gas} exceeds critical threshold (${t.gasRaw.criticalThreshold})`,
        });
      } else if (gas >= t.gasRaw.warningThreshold) {
        alerts.push({
          incidentType: 'GAS_LEAK_WARNING',
          severity: SeverityLevel.HIGH_RISK,
          description: `Elevated gas concentration detected: raw sensor reading ${gas} exceeds threshold (${t.gasRaw.warningThreshold})`,
        });
      }
    }

    // 4. Vitals: SpO2 Blood Oxygenation
    if (payload.vitals?.spo2 !== undefined && payload.vitals?.spo2 !== null) {
      const spo2 = payload.vitals.spo2;
      if (spo2 <= t.spo2.criticalMin) {
        alerts.push({
          incidentType: 'HYPOXIA_CRITICAL',
          severity: SeverityLevel.CRITICAL,
          description: `Severe hypoxemia detected: blood oxygen level at ${spo2}% (threshold <= ${t.spo2.criticalMin}%)`,
        });
      } else if (spo2 <= t.spo2.warningMin) {
        alerts.push({
          incidentType: 'HYPOXIA_WARNING',
          severity: SeverityLevel.WARNING,
          description: `Mild hypoxemia warning: blood oxygen level at ${spo2}% (threshold <= ${t.spo2.warningMin}%)`,
        });
      }
    }

    // 5. Vitals: Heart Rate (bpm)
    if (payload.vitals?.heartRate !== undefined && payload.vitals?.heartRate !== null) {
      const hr = payload.vitals.heartRate;
      if (hr >= t.heartRate.criticalMax) {
        alerts.push({
          incidentType: 'TACHYCARDIA_CRITICAL',
          severity: SeverityLevel.CRITICAL,
          description: `Extreme tachycardia: heart rate ${hr} bpm exceeds critical limit (${t.heartRate.criticalMax} bpm)`,
        });
      } else if (hr >= t.heartRate.maxNormal) {
        alerts.push({
          incidentType: 'TACHYCARDIA_WARNING',
          severity: SeverityLevel.HIGH_RISK,
          description: `Elevated heart rate warning: ${hr} bpm exceeds threshold (${t.heartRate.maxNormal} bpm)`,
        });
      } else if (hr <= t.heartRate.minNormal) {
        alerts.push({
          incidentType: 'BRADYCARDIA_WARNING',
          severity: SeverityLevel.WARNING,
          description: `Low heart rate warning: ${hr} bpm is below safe threshold (${t.heartRate.minNormal} bpm)`,
        });
      }
    }

    // 6. Environmental: Ambient Temperature (Heat Stress)
    if (payload.environment?.temperature !== undefined && payload.environment?.temperature !== null) {
      const temp = payload.environment.temperature;
      if (temp >= t.temperature.heatCritical) {
        alerts.push({
          incidentType: 'HEAT_STRESS_CRITICAL',
          severity: SeverityLevel.CRITICAL,
          description: `Hazardous thermal exposure: ambient temperature ${temp}°C`,
        });
      } else if (temp >= t.temperature.heatWarning) {
        alerts.push({
          incidentType: 'HEAT_STRESS_WARNING',
          severity: SeverityLevel.WARNING,
          description: `Elevated heat stress warning: ambient temperature ${temp}°C`,
        });
      }
    }

    // Determine overall highest severity
    let overallSeverity = SeverityLevel.NORMAL;
    if (alerts.some((a) => a.severity === SeverityLevel.CRITICAL)) {
      overallSeverity = SeverityLevel.CRITICAL;
    } else if (alerts.some((a) => a.severity === SeverityLevel.HIGH_RISK)) {
      overallSeverity = SeverityLevel.HIGH_RISK;
    } else if (alerts.some((a) => a.severity === SeverityLevel.WARNING)) {
      overallSeverity = SeverityLevel.WARNING;
    }

    return { overallSeverity, alerts };
  }
}
