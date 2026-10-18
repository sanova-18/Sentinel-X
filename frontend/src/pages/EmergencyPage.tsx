import React, { useState } from 'react';
import { ShieldAlert, CheckCircle, Check, User, Clock, AlertTriangle } from 'lucide-react';
import { useSafety } from '../context/SafetyContext';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { SourceBadge } from '../components/common/SourceBadge';

export const EmergencyPage: React.FC = () => {
  const { activeIncidents, acknowledge, resolve } = useSafety();
  const [operatorName, setOperatorName] = useState<string>('Control Room Lead');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const handleAck = async (id: string) => {
    setActionInProgress(id);
    try {
      await acknowledge(id, operatorName);
    } catch (err) {
      console.error(err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRes = async (id: string) => {
    setActionInProgress(id);
    try {
      await resolve(id);
    } catch (err) {
      console.error(err);
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <span>Emergency Operations &amp; Incident Triage</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Active industrial hazard response queue with verified database persistence.
          </p>
        </div>

        {/* Supervisor Profile Selector */}
        <div className="flex items-center space-x-2 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          <User className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-slate-400">Supervisor:</span>
          <input
            type="text"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            className="bg-transparent border-b border-teal-500/50 text-slate-100 focus:outline-none focus:border-teal-400 text-xs font-mono w-36"
            placeholder="Operator Name"
          />
        </div>
      </div>

      {/* Incidents Queue */}
      {activeIncidents.length === 0 ? (
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-12 text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No Active Emergencies</h3>
          <p className="text-xs text-slate-400 font-mono max-w-md mx-auto">
            All worker safety telemetry is operating within nominal thresholds. No fall detections, gas spikes, or distress signals are currently unaddressed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeIncidents.map((incident) => {
            const isCritical = incident.severity === 'CRITICAL';
            const isAcknowledged = incident.status === 'ACKNOWLEDGED';
            const isBusy = actionInProgress === incident.incidentId;

            return (
              <div
                key={incident.incidentId}
                className={`bg-[#0F172A] border rounded-xl p-5 transition shadow-lg ${
                  isCritical
                    ? 'border-red-500/70 bg-gradient-to-r from-red-950/20 to-[#0F172A]'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Incident Info */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={incident.severity} size="md" />
                      <SourceBadge isSimulated={incident.isSimulated} />
                      <span className="font-mono font-bold text-sm text-slate-100">
                        {incident.incidentType}
                      </span>
                      <span className="text-xs font-mono bg-slate-800 text-teal-400 px-2 py-0.5 rounded border border-slate-700">
                        Worker: {incident.workerId}
                      </span>
                      <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                        Helmet: {incident.helmetId}
                      </span>
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                          isAcknowledged
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                            : 'bg-red-950 text-red-300 border border-red-800/50 animate-pulse'
                        }`}
                      >
                        {incident.status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 font-medium">
                      {incident.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Detected: {new Date(incident.detectedAt).toLocaleString()}</span>
                      </div>
                      {incident.acknowledgedAt && (
                        <div className="flex items-center space-x-1 text-teal-400">
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            Ack by {incident.acknowledgedBy} at{' '}
                            {new Date(incident.acknowledgedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Buttons */}
                  <div className="flex items-center space-x-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                    {!isAcknowledged && (
                      <button
                        onClick={() => handleAck(incident.incidentId)}
                        disabled={isBusy}
                        className="flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-mono font-bold px-4 py-2 rounded-lg transition shadow-md shadow-amber-950/50"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>ACKNOWLEDGE</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleRes(incident.incidentId)}
                      disabled={isBusy}
                      className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-mono font-bold px-4 py-2 rounded-lg transition shadow-md shadow-emerald-950/50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>RESOLVE INCIDENT</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
