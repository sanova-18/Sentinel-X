import React, { useState } from 'react';
import { SafetyProvider } from './context/SafetyContext';
import { Navbar } from './components/common/Navbar';
import { EmergencyBanner } from './components/emergency/EmergencyBanner';
import { OverviewPage } from './pages/OverviewPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { WorkerDetailsPage } from './pages/WorkerDetailsPage';
import { EmergencyPage } from './pages/EmergencyPage';
import { IncidentHistoryPage } from './pages/IncidentHistoryPage';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('W-101');

  const handleSelectWorker = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setActiveTab('workers');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1120] text-slate-100">
      {/* Top Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Emergency Audio/Visual Banner */}
      <EmergencyBanner onGoToEmergency={() => setActiveTab('emergency')} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewPage
            onSelectWorker={handleSelectWorker}
            onGoToEmergency={() => setActiveTab('emergency')}
          />
        )}

        {activeTab === 'monitoring' && (
          <LiveMonitoringPage onSelectWorker={handleSelectWorker} />
        )}

        {activeTab === 'workers' && (
          <WorkerDetailsPage
            selectedWorkerId={selectedWorkerId}
            onSelectWorker={setSelectedWorkerId}
          />
        )}

        {activeTab === 'emergency' && <EmergencyPage />}

        {activeTab === 'history' && <IncidentHistoryPage />}
      </main>

      {/* Footer */}
      <footer className="bg-[#070D18] border-t border-slate-900 py-4 text-xs font-mono text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            SentinelX Industrial Safety Prototype &bull; Source shown on each reading and incident
          </div>
          <div className="text-amber-500/80">
            Educational prototype. Sensor readings and alerts require validation; no medical or mine-safety certification.
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <SafetyProvider>
      <AppContent />
    </SafetyProvider>
  );
};

export default App;
