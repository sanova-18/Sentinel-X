import React from 'react';
import { Heart, Activity, Wind, Thermometer, Droplets, Radio, Clock } from 'lucide-react';
import { useSafety } from '../context/SafetyContext';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { SourceBadge } from '../components/common/SourceBadge';

interface Props {
  onSelectWorker: (workerId: string) => void;
}

export const LiveMonitoringPage: React.FC<Props> = ({ onSelectWorker }) => {
  const { workers } = useSafety();

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center space-x-2">
            <Radio className="w-5 h-5 text-teal-400" />
            <span>Real-Time Wearable Telemetry Matrix</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Latest helmet readings with their recorded source. Offline helmets retain their last reading.
          </p>
        </div>
        <div className="text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300">
          Live telemetry
        </div>
      </div>

      {/* Grid of 3 Workers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {workers.map((worker) => {
          const r = worker.latestReading;
          const isOnline = worker.connectivityStatus === 'ONLINE';
          const risk = worker.riskLevel || (worker.hasActiveAlert ? 'CRITICAL' : 'NORMAL');
          const isCritical = risk === 'CRITICAL';

          return (
            <div
              key={worker.workerId}
              className={`bg-[#0F172A] border rounded-xl overflow-hidden transition shadow-lg ${
                isCritical
                  ? 'border-red-500/80 shadow-red-950/40 ring-1 ring-red-500/50'
                  : 'border-slate-800 hover:border-teal-500/40 shadow-slate-950/50'
              }`}
            >
              {/* Card Header */}
              <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-base text-slate-100">{worker.name}</span>
                    <span className="text-xs font-mono text-teal-400 bg-teal-950/60 border border-teal-800/40 px-2 py-0.5 rounded">
                      {worker.workerId}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{worker.assignedZone}</div>
                  <div className="mt-1">
                    {r ? <SourceBadge isSimulated={r.isSimulated} /> : <span className="text-xs text-slate-500">No reading</span>}
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-1">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
                      }`}
                    />
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {worker.connectivityStatus}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Helmet: {worker.helmetId}
                  </span>
                </div>
              </div>

              {/* Status & Risk Banner */}
              <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">Overall Hazard Status:</span>
                <SeverityBadge severity={risk} size="md" />
              </div>

              {/* Sensor Readings Body */}
              <div className="p-4 space-y-4">
                {/* Vitals Section */}
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-2">
                    Biometric Telemetry (MAX30102)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Heart Rate */}
                    <div className="bg-[#0B1120] border border-slate-800 p-3 rounded-lg flex items-center space-x-3">
                      <div className="p-2 rounded bg-rose-950/50 text-rose-400 border border-rose-800/30">
                        <Heart className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-slate-400">HEART RATE</div>
                        <div className="text-lg font-bold font-mono text-slate-100">
                          {r?.heartRate ? `${r.heartRate}` : '--'}
                          <span className="text-xs text-slate-400 ml-1 font-normal">bpm</span>
                        </div>
                      </div>
                    </div>

                    {/* SpO2 */}
                    <div className="bg-[#0B1120] border border-slate-800 p-3 rounded-lg flex items-center space-x-3">
                      <div className="p-2 rounded bg-cyan-950/50 text-cyan-400 border border-cyan-800/30">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-slate-400">SpO2 OXYGEN</div>
                        <div className="text-lg font-bold font-mono text-slate-100">
                          {r?.spo2 ? `${r.spo2}` : '--'}
                          <span className="text-xs text-slate-400 ml-1 font-normal">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Environmental Section */}
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-2">
                    Environmental Conditions (MQ-5 &amp; DHT11)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Gas Raw */}
                    <div className="bg-[#0B1120] border border-slate-800 p-2.5 rounded-lg text-center">
                      <Wind className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                      <div className="text-[10px] font-mono text-slate-400">GAS (RAW)</div>
                      <div className="text-sm font-bold font-mono text-slate-100">
                        {r?.gasRaw ?? '--'}
                      </div>
                    </div>

                    {/* Temperature */}
                    <div className="bg-[#0B1120] border border-slate-800 p-2.5 rounded-lg text-center">
                      <Thermometer className="w-4 h-4 mx-auto mb-1 text-orange-400" />
                      <div className="text-[10px] font-mono text-slate-400">TEMP</div>
                      <div className="text-sm font-bold font-mono text-slate-100">
                        {r?.temperature ? `${r.temperature}°C` : '--'}
                      </div>
                    </div>

                    {/* Humidity */}
                    <div className="bg-[#0B1120] border border-slate-800 p-2.5 rounded-lg text-center">
                      <Droplets className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                      <div className="text-[10px] font-mono text-slate-400">HUMIDITY</div>
                      <div className="text-sm font-bold font-mono text-slate-100">
                        {r?.humidity ? `${r.humidity}%` : '--'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Motion Status Section (MPU6050) */}
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-2">
                    Kinematic Motion Status (MPU6050)
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div
                      className={`p-2 rounded border flex items-center justify-between ${
                        r?.fallDetected
                          ? 'bg-red-950/80 border-red-500 text-red-300 font-bold'
                          : 'bg-[#0B1120] border-slate-800 text-slate-400'
                      }`}
                    >
                      <span>Fall Detection:</span>
                      <span>{r?.fallDetected ? 'FALL DETECTED!' : 'NORMAL'}</span>
                    </div>

                    <div
                      className={`p-2 rounded border flex items-center justify-between ${
                        r?.inactivityDetected
                          ? 'bg-amber-950/80 border-amber-500 text-amber-300 font-bold'
                          : 'bg-[#0B1120] border-slate-800 text-slate-400'
                      }`}
                    >
                      <span>Inactivity:</span>
                      <span>{r?.inactivityDetected ? 'INACTIVE' : 'ACTIVE'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Last Seen & Details Button */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center text-slate-400 space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {worker.lastSeen ? new Date(worker.lastSeen).toLocaleTimeString() : 'No ping'}
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectWorker(worker.workerId)}
                    className="text-teal-400 hover:text-teal-300 underline font-semibold transition"
                  >
                    View Analytics &amp; History &rarr;
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
