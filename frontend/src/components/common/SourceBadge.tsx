import React from 'react';

export const sourceLabel = (isSimulated?: boolean | null): string => {
  if (isSimulated === true) return 'Simulated';
  if (isSimulated === false) return 'Hardware';
  return 'Source unknown';
};

export const SourceBadge: React.FC<{ isSimulated?: boolean | null }> = ({ isSimulated }) => {
  const color = isSimulated === true
    ? 'bg-amber-950/50 text-amber-300 border-amber-700/50'
    : isSimulated === false
    ? 'bg-teal-950/50 text-teal-300 border-teal-700/50'
    : 'bg-slate-900 text-slate-400 border-slate-700';

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-mono ${color}`}
      title={isSimulated == null ? 'This record has no saved source information.' : 'Source reported by the device or simulator.'}
    >
      {sourceLabel(isSimulated)}
    </span>
  );
};
