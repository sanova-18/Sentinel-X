import React from 'react';
import { Users, Radio, ShieldAlert, AlertTriangle, HardHat, Clock, ArrowRight } from 'lucide-react';
import { useSafety } from '../context/SafetyContext';
import { SeverityBadge } from '../components/common/SeverityBadge';

interface Props {
  onSelectWorker: (workerId: string) => void;
  onGoToEmergency: () => void;
}

export const OverviewPage: React.FC<Props> = ({ onSelectWorker, onGoToEmergency }) => {
  const {
    workers,
    activeIncidents,
    recentEvents,
    onlineCount,
    offlineCount,
    criticalAlertCount,
  } = useSafety();

  const totalWorkers = workers.length;

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Workers */}
        <div onClick={onGoToEmergency} className="cursor-pointer hover:border-teal-500/50 transition bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Monitored Personnel</span>
            <Users className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{totalWorkers}</div>
          <div className="text-[11px] text-slate-400 mt-1">3 Active Industrial Zones</div>
        </div>

        {/* Online Helmets */}
        <div onClick={onGoToEmergency} className="cursor-pointer hover:border-teal-500/50 transition bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Online Helmets</span>
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{onlineCount}</div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Telemetry transmitting</div>
        </div>

        {/* Offline Helmets */}
        <div onClick={onGoToEmergency} className="cursor-pointer hover:border-teal-500/50 transition bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Offline Helmets</span>
            <Radio className="w-4 h-4 text-slate-500" />
          </div>
          <div className={`text-2xl font-bold font-mono ${offlineCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {offlineCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">&gt;10s Heartbeat timeout</div>
        </div>

        {/* Active Emergencies */}
        <div onClick={onGoToEmergency} className="cursor-pointer hover:border-teal-500/50 transition bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Active Incidents</span>
            <ShieldAlert className="w-4 h-4 text-orange-400" />
          </div>
          <div className={`text-2xl font-bold font-mono ${activeIncidents.length > 0 ? 'text-orange-400' : 'text-slate-400'}`}>
            {activeIncidents.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Pending triage</div>
        </div>

        {/* Critical Incidents */}
        <div onClick={onGoToEmergency} className="cursor-pointer hover:border-teal-500/50 transition bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Critical Alerts</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className={`text-2xl font-bold font-mono ${criticalAlertCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`}>
            {criticalAlertCount}
          </div>
          <div className="text-[11px] text-red-400/80 mt-1">Immediate response needed</div>
        </div>
      </div>

      {/* Main Content Layout: Worker Status Matrix & Live Events Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workers Status Summary (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <HardHat className="w-4 h-4 text-teal-400" />
              <span>Monitored Personnel Status Summary</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">Real-time sync</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {workers.map((worker) => {
              const r = worker.latestReading;
              const isOnline = worker.connectivityStatus === 'ONLINE';
              const risk = worker.riskLevel || (worker.hasActiveAlert ? 'CRITICAL' : 'NORMAL');

              return (
                <div
                  key={worker.workerId}
                  onClick={() => onSelectWorker(worker.workerId)}
                  className="cursor-pointer bg-[#0F172A] border border-slate-800 hover:border-teal-500/50 rounded-xl p-4 transition-all duration-200 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Worker Info */}
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-100 group-hover:text-teal-300 transition">
                            {worker.name}
                          </span>
                          <span className="text-xs font-mono text-slate-400">({worker.workerId})</span>
                          <span className="text-xs font-mono bg-slate-800 text-teal-400 px-2 py-0.5 rounded border border-slate-700">
                            {worker.helmetId}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {worker.assignedZone}
                        </div>
                      </div>
                    </div>

                    {/* Sensor Snapshot Badges */}
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                      {r ? (
                        <>
                          <div className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                            <span className="text-slate-400 mr-1">HR:</span>
                            <span className={r.heartRate && (r.heartRate > 125 || r.heartRate < 50) ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                              {r.heartRate ? `${r.heartRate} bpm` : '--'}
                            </span>
                          </div>

                          <div className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                            <span className="text-slate-400 mr-1">SpO2:</span>
                            <span className={r.spo2 && r.spo2 < 92 ? 'text-red-400 font-bold' : 'text-slate-200'}>
                              {r.spo2 ? `${r.spo2}%` : '--'}
                            </span>
                          </div>

                          <div className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                            <span className="text-slate-400 mr-1">Gas:</span>
                            <span className={r.gasRaw && r.gasRaw > 650 ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                              {r.gasRaw ?? '--'}
                            </span>
                          </div>

                          <div className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                            <span className="text-slate-400 mr-1">Temp:</span>
                            <span className="text-slate-200">
                              {r.temperature ? `${r.temperature}°C` : '--'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500 italic">Awaiting telemetry...</span>
                      )}

                      <SeverityBadge severity={risk} size="sm" />
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 transition" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Recent Emergency & Telemetry Events Feed (Right 1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>Live Ingestion Feed</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">QoS Telemetry</span>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 max-h-[500px] overflow-y-auto space-y-3">
            {recentEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-mono">
                Listening for incoming MQTT packets on sentinelx/+/telemetry...
              </div>
            ) : (
              recentEvents.map((evt, idx) => (
                <div
                  key={evt.readingId || idx}
                  className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs font-mono space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-teal-400 font-semibold">{evt.helmetId}</span>
                    <span className="text-slate-500">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>{evt.workerName || evt.workerId}</span>
                    <SeverityBadge severity={evt.riskLevel} size="sm" />
                  </div>
                  <div className="text-[11px] text-slate-400 flex space-x-3 pt-1 border-t border-slate-800">
                    <span>HR: {evt.vitals?.heartRate ?? '--'}</span>
                    <span>SpO2: {evt.vitals?.spo2 ?? '--'}%</span>
                    <span>Gas: {evt.environment?.gasRaw ?? '--'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
