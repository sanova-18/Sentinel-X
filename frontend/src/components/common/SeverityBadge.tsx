import React from 'react';
import { SeverityLevel } from '../../types';

interface Props {
  severity: SeverityLevel;
  size?: 'sm' | 'md' | 'lg';
}

export const SeverityBadge: React.FC<Props> = ({ severity, size = 'md' }) => {
  const styles = {
    NORMAL: 'bg-emerald-950/80 text-emerald-400 border-emerald-600/40',
    WARNING: 'bg-amber-950/80 text-amber-400 border-amber-600/40',
    HIGH_RISK: 'bg-orange-950/80 text-orange-400 border-orange-600/40',
    CRITICAL: 'bg-red-950/90 text-red-400 border-red-500 animate-pulse',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-full border ${styles[severity] || styles.NORMAL} ${sizeClasses[size]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          severity === 'CRITICAL'
            ? 'bg-red-400'
            : severity === 'HIGH_RISK'
            ? 'bg-orange-400'
            : severity === 'WARNING'
            ? 'bg-amber-400'
            : 'bg-emerald-400'
        }`}
      />
      {severity.replace('_', ' ')}
    </span>
  );
};
