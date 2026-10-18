import { Worker, Incident, SensorReading } from '../types';

const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:5001';
const API_BASE = `${BACKEND_URL}/api`;

export async function fetchWorkers(): Promise<Worker[]> {
  const res = await fetch(`${API_BASE}/workers`);
  if (!res.ok) throw new Error('Failed to fetch workers');
  return res.json();
}

export async function fetchWorkerById(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/workers/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch worker ${id}`);
  return res.json();
}

export async function fetchWorkerHistory(id: string, limit = 50): Promise<SensorReading[]> {
  const res = await fetch(`${API_BASE}/workers/${id}/history?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch readings for ${id}`);
  return res.json();
}

export async function fetchActiveIncidents(): Promise<Incident[]> {
  const res = await fetch(`${API_BASE}/incidents/active`);
  if (!res.ok) throw new Error('Failed to fetch active incidents');
  return res.json();
}

export async function fetchAllIncidents(filters: {
  workerId?: string;
  severity?: string;
  status?: string;
  incidentType?: string;
} = {}): Promise<Incident[]> {
  const params = new URLSearchParams();
  if (filters.workerId) params.append('workerId', filters.workerId);
  if (filters.severity) params.append('severity', filters.severity);
  if (filters.status) params.append('status', filters.status);
  if (filters.incidentType) params.append('incidentType', filters.incidentType);

  const res = await fetch(`${API_BASE}/incidents?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function acknowledgeIncident(id: string, acknowledgedBy = 'Safety Supervisor'): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}/acknowledge`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acknowledgedBy }),
  });
  if (!res.ok) throw new Error('Failed to acknowledge incident');
  return res.json();
}

export async function resolveIncident(id: string): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}/resolve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to resolve incident');
  return res.json();
}
