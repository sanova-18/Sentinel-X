import React from 'react';
import { HardHat, Activity, ShieldAlert, History, Users, Radio, AlertOctagon } from 'lucide-react';
import { useSafety } from '../../context/SafetyContext';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  const { isConnected, criticalAlertCount, activeIncidents } = useSafety();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'monitoring', label: 'Live Monitoring', icon: Radio },
    { id: 'workers', label: 'Worker Details', icon: Users },
    {
      id: 'emergency',
      label: 'Emergency Management',
      icon: ShieldAlert,
      badge: activeIncidents.length,
      badgeCritical: criticalAlertCount > 0,
    },
    { id: 'history', label: 'Incident History', icon: History },
  ];

  return (
    <header className="bg-[#0B1120] border-b border-slate-800 sticky top-0 z-50">
      {/* Top Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & System Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <HardHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-wider text-slate-100 font-mono">
                  SENTINEL<span className="text-teal-400">X</span>
                </span>
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono border border-slate-700">
                  v1.0-PROTOTYPE
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Intelligent IoT Safety & Emergency Response Platform
              </p>
            </div>
          </div>

          {/* Center: Prominent Simulation Mode Badge */}
          <div className="hidden md:flex items-center space-x-2 bg-amber-950/40 border border-amber-600/50 px-3 py-1.5 rounded-full text-xs font-mono text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold tracking-wide">SIMULATION MODE: SYNTHETIC DATA</span>
          </div>

          {/* Right Status Badges */}
          <div className="flex items-center space-x-4">
            {/* Socket Health */}
            <div className="flex items-center space-x-2 text-xs font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className={isConnected ? 'text-slate-300' : 'text-red-400'}>
                {isConnected ? 'LIVE BROKER' : 'DISCONNECTED'}
              </span>
            </div>

            {/* Critical Alert Indicator */}
            {criticalAlertCount > 0 && (
              <div
                onClick={() => setActiveTab('emergency')}
                className="cursor-pointer flex items-center space-x-1.5 bg-red-950/90 border border-red-500/80 text-red-300 px-3 py-1 rounded-full text-xs font-mono font-bold animate-pulse hover:bg-red-900/90 transition"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
                <span>{criticalAlertCount} CRITICAL</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-[#0F172A] border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex space-x-1 sm:space-x-4 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-teal-400 text-teal-300 bg-teal-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      item.badgeCritical
                        ? 'bg-red-500 text-white animate-bounce'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
