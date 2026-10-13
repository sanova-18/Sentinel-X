import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { HardHat, Activity, Heart, Wind, Thermometer, ShieldAlert, RefreshCw } from 'lucide-react';
import { useSafety } from '../context/SafetyContext';
import { fetchWorkerHistory } from '../services/api';
import { SensorReading } from '../types';
import { SeverityBadge } from '../components/common/SeverityBadge';

interface Props {
  selectedWorkerId: string;
  onSelectWorker: (workerId: string) => void;
}

export const WorkerDetailsPage: React.FC<Props> = ({ selectedWorkerId, onSelectWorker }) => {
  const { workers, activeIncidents } = useSafety();
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const currentWorker = workers.find((w) => w.workerId === selectedWorkerId) || workers[0];

  const loadHistory = async (workerId: string) => {
    setLoading(true);
    try {
      const data = await fetchWorkerHistory(workerId, 40);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentWorker) {
      loadHistory(currentWorker.workerId);
    }
  }, [currentWorker?.workerId]);

  // Format chart data with short time labels
  const chartData = history.map((item) => ({
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    heartRate: item.heartRate,
    spo2: item.spo2,
    gasRaw: item.gasRaw,
    temperature: item.temperature,
  }));

  const workerIncidents = activeIncidents.filter((i) => i.workerId === currentWorker?.workerId);

  return (
    <div className="space-y-6">
      {/* Top Header & Worker Selector Bar */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-100">{currentWorker?.name}</h1>
              <span className="text-xs font-mono bg-slate-800 text-teal-400 px-2 py-0.5 rounded border border-slate-700">
                {currentWorker?.workerId}
              </span>
              <SeverityBadge severity={currentWorker?.riskLevel || 'NORMAL'} size="sm" />
            </div>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Zone: {currentWorker?.assignedZone} | Helmet: {currentWorker?.helmetId} | Status: {currentWorker?.connectivityStatus}
            </p>
          </div>
        </div>

        {/* Worker Switcher */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-slate-400 mr-1">Select Personnel:</span>
          {workers.map((w) => (
            <button
              key={w.workerId}
              onClick={() => onSelectWorker(w.workerId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition border ${
                w.workerId === currentWorker?.workerId
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {w.workerId}
            </button>
          ))}
          <button
            onClick={() => currentWorker && loadHistory(currentWorker.workerId)}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sensor Graphs Grid (4 Recharts graphs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Graph 1: Heart Rate */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-bold text-slate-200 flex items-center space-x-2">
              <Heart className="w-4 h-4 text-rose-400" />
              <span>HEART RATE (MAX30102 - bpm)</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              Normal: 50 - 125 bpm
            </span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis domain={[40, 160]} stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B1120', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  stroke="#F43F5E"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#F43F5E' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: SpO2 */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-bold text-slate-200 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>BLOOD OXYGEN SpO2 (%)</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              Threshold: &lt;92% Warning, &lt;88% Critical
            </span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis domain={[80, 100]} stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B1120', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Line
                  type="monotone"
                  dataKey="spo2"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#06B6D4' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 3: Gas Raw */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-bold text-slate-200 flex items-center space-x-2">
              <Wind className="w-4 h-4 text-amber-400" />
              <span>GAS RAW CONCENTRATION (MQ-5 ADC)</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              Threshold: &gt;650 High, &gt;850 Critical
            </span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis domain={[100, 1024]} stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B1120', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Line
                  type="monotone"
                  dataKey="gasRaw"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#F59E0B' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 4: Temperature */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-bold text-slate-200 flex items-center space-x-2">
              <Thermometer className="w-4 h-4 text-orange-400" />
              <span>AMBIENT TEMPERATURE (DHT11 - °C)</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              Threshold: &gt;38°C Warning
            </span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis domain={[15, 45]} stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B1120', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  stroke="#F97316"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#F97316' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active Incidents for this worker */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
        <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-300 mb-3 flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-teal-400" />
          <span>Active Emergencies for {currentWorker?.name}</span>
        </h3>

        {workerIncidents.length === 0 ? (
          <div className="text-xs font-mono text-slate-500 py-3">
            No active emergencies logged for this worker. All telemetry within nominal ranges.
          </div>
        ) : (
          <div className="space-y-2">
            {workerIncidents.map((inc) => (
              <div
                key={inc.incidentId}
                className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <SeverityBadge severity={inc.severity} size="sm" />
                    <span className="font-bold text-slate-200">{inc.incidentType}</span>
                    <span className="text-slate-500">[{inc.status}]</span>
                  </div>
                  <div className="text-slate-400 mt-1">{inc.description}</div>
                </div>
                <div className="text-slate-500 text-[11px]">
                  {new Date(inc.detectedAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
