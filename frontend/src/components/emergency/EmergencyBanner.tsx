import React from 'react';
import { AlertOctagon, ArrowRight } from 'lucide-react';
import { useSafety } from '../../context/SafetyContext';

interface Props {
  onGoToEmergency: () => void;
}

export const EmergencyBanner: React.FC<Props> = ({ onGoToEmergency }) => {
  const { activeIncidents } = useSafety();

  const criticals = activeIncidents.filter((i) => i.severity === 'CRITICAL');
  if (criticals.length === 0) return null;

  const topIncident = criticals[0];

  return (
    <div className="bg-red-950/90 border-b border-red-500/80 px-4 py-2.5 text-red-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-1 rounded bg-red-600 text-white animate-pulse">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <span className="font-mono font-bold text-white uppercase tracking-wider text-xs bg-red-600 px-2 py-0.5 rounded mr-2">
              ACTIVE EMERGENCY
            </span>
            <span className="text-sm font-semibold text-white">
              {topIncident.incidentType.replace('_', ' ')}
            </span>
            <span className="text-sm text-red-300 ml-2 hidden sm:inline">
              Worker: <span className="font-mono text-white">{topIncident.workerId}</span> | {topIncident.description}
            </span>
          </div>
        </div>

        <button
          onClick={onGoToEmergency}
          className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold px-3 py-1.5 rounded transition shadow-lg shadow-red-900/50"
        >
          <span>MANAGE ({criticals.length})</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
