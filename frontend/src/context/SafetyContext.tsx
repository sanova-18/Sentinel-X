import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Worker, Incident, LiveTelemetryEvent, ConnectivityStatus } from '../types';
import { fetchWorkers, fetchActiveIncidents, acknowledgeIncident, resolveIncident } from '../services/api';
import { socket } from '../services/socket';

interface SafetyContextType {
  workers: Worker[];
  activeIncidents: Incident[];
  recentEvents: LiveTelemetryEvent[];
  isConnected: boolean;
  criticalAlertCount: number;
  warningAlertCount: number;
  onlineCount: number;
  offlineCount: number;
  acknowledge: (id: string, operatorName?: string) => Promise<void>;
  resolve: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const SafetyContext = createContext<SafetyContextType | undefined>(undefined);

export const SafetyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [recentEvents, setRecentEvents] = useState<LiveTelemetryEvent[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);

  const refreshData = useCallback(async () => {
    try {
      const [workersData, incidentsData] = await Promise.all([
        fetchWorkers(),
        fetchActiveIncidents(),
      ]);
      setWorkers(workersData);
      setActiveIncidents(incidentsData);
    } catch (err) {
      console.error('[SafetyContext] Failed to load initial data:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();

    function onConnect() {
      setIsConnected(true);
      refreshData();
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onTelemetry(event: LiveTelemetryEvent) {
      // Append to rolling recent event feed (max 30 items)
      setRecentEvents((prev) => [event, ...prev.slice(0, 29)]);

      // Update worker in state
      setWorkers((prev) =>
        prev.map((w) => {
          if (w.workerId === event.workerId || w.helmetId === event.helmetId) {
            return {
              ...w,
              connectivityStatus: 'ONLINE' as ConnectivityStatus,
              lastSeen: event.timestamp,
              riskLevel: event.riskLevel,
              latestReading: {
                readingId: event.readingId || Date.now(),
                helmetId: event.helmetId,
                workerId: event.workerId,
                heartRate: event.vitals?.heartRate ?? null,
                spo2: event.vitals?.spo2 ?? null,
                gasRaw: event.environment?.gasRaw ?? null,
                temperature: event.environment?.temperature ?? null,
                humidity: event.environment?.humidity ?? null,
                fallDetected: event.motion?.fallDetected ?? false,
                inactivityDetected: event.motion?.inactivityDetected ?? false,
                timestamp: event.timestamp,
                isSimulated: event.isSimulated ?? null,
              },
            };
          }
          return w;
        })
      );
    }

    function onHelmetStatus(data: { helmetId: string; status: ConnectivityStatus; lastSeen: string }) {
      setWorkers((prev) =>
        prev.map((w) => {
          if (w.helmetId === data.helmetId) {
            return {
              ...w,
              connectivityStatus: data.status,
              lastSeen: data.lastSeen,
            };
          }
          return w;
        })
      );
    }

    function onNewIncident(incident: Incident) {
      setActiveIncidents((prev) => {
        // Prevent duplicate in UI list
        if (prev.some((i) => i.incidentId === incident.incidentId)) return prev;
        return [incident, ...prev];
      });

      // Mark worker alert flag
      setWorkers((prev) =>
        prev.map((w) =>
          w.workerId === incident.workerId ? { ...w, hasActiveAlert: true } : w
        )
      );
    }

    function onIncidentUpdated(incident: Incident) {
      setActiveIncidents((prev) => {
        if (incident.status === 'RESOLVED') {
          return prev.filter((i) => i.incidentId !== incident.incidentId);
        }
        return prev.map((i) => (i.incidentId === incident.incidentId ? incident : i));
      });
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('telemetry:new', onTelemetry);
    socket.on('helmet:status', onHelmetStatus);
    socket.on('incident:new', onNewIncident);
    socket.on('incident:updated', onIncidentUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('telemetry:new', onTelemetry);
      socket.off('helmet:status', onHelmetStatus);
      socket.off('incident:new', onNewIncident);
      socket.off('incident:updated', onIncidentUpdated);
    };
  }, [refreshData]);

  const handleAcknowledge = async (id: string, operatorName?: string) => {
    await acknowledgeIncident(id, operatorName);
  };

  const handleResolve = async (id: string) => {
    await resolveIncident(id);
    await refreshData();
  };

  const criticalAlertCount = activeIncidents.filter((i) => i.severity === 'CRITICAL').length;
  const warningAlertCount = activeIncidents.filter((i) => i.severity === 'WARNING' || i.severity === 'HIGH_RISK').length;
  const onlineCount = workers.filter((w) => w.connectivityStatus === 'ONLINE').length;
  const offlineCount = workers.filter((w) => w.connectivityStatus === 'OFFLINE').length;

  return (
    <SafetyContext.Provider
      value={{
        workers,
        activeIncidents,
        recentEvents,
        isConnected,
        criticalAlertCount,
        warningAlertCount,
        onlineCount,
        offlineCount,
        acknowledge: handleAcknowledge,
        resolve: handleResolve,
        refreshData,
      }}
    >
      {children}
    </SafetyContext.Provider>
  );
};

export const useSafety = () => {
  const context = useContext(SafetyContext);
  if (!context) {
    throw new Error('useSafety must be used within a SafetyProvider');
  }
  return context;
};
