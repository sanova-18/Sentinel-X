import React, { useEffect, useState } from 'react';
import { History, RefreshCw, Download, Search } from 'lucide-react';
import { fetchAllIncidents } from '../services/api';
import { Incident } from '../types';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { SourceBadge, sourceLabel } from '../components/common/SourceBadge';

export const IncidentHistoryPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const data = await fetchAllIncidents({
        workerId: selectedWorker || undefined,
        severity: selectedSeverity || undefined,
        status: selectedStatus || undefined,
      });
      setIncidents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [selectedWorker, selectedSeverity, selectedStatus]);

  const filtered = incidents.filter((i) =>
    i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.incidentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.workerId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportCSV = () => {
    const headers = ['IncidentID', 'WorkerID', 'HelmetID', 'Type', 'Source', 'Severity', 'Status', 'DetectedAt', 'AcknowledgedBy', 'ResolvedAt'];
    const rows = filtered.map(i => [
      i.incidentId,
      i.workerId,
      i.helmetId,
      i.incidentType,
      sourceLabel(i.isSimulated),
      i.severity,
      i.status,
      i.detectedAt,
      i.acknowledgedBy || '',
      i.resolvedAt || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sentinelx_incidents_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center space-x-2">
            <History className="w-5 h-5 text-teal-400" />
            <span>Industrial Incident &amp; Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Stored incident records. Older records without source information are marked unknown.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={exportCSV}
            className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono px-3 py-2 rounded-lg transition"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>EXPORT CSV</span>
          </button>
          <button
            onClick={loadIncidents}
            className="flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-mono font-bold px-3 py-2 rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-4 text-xs font-mono">
        {/* Search Input */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search incident type, description, worker..."
            className="w-full bg-[#0B1120] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Worker Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-slate-400">Worker:</span>
          <select
            value={selectedWorker}
            onChange={(e) => setSelectedWorker(e.target.value)}
            className="bg-[#0B1120] border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="">All Workers</option>
            <option value="W-101">W-101 (Alex Carter)</option>
            <option value="W-102">W-102 (Marcus Vance)</option>
            <option value="W-103">W-103 (Elena Rostova)</option>
          </select>
        </div>

        {/* Severity Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-slate-400">Severity:</span>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-[#0B1120] border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH_RISK">HIGH RISK</option>
            <option value="WARNING">WARNING</option>
            <option value="NORMAL">NORMAL</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-slate-400">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#0B1120] border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Incident Type</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Worker / Helmet</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Detected</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No incident records match the selected criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.incidentId} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <SeverityBadge severity={item.severity} size="sm" />
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100">
                      {item.incidentType}
                    </td>
                    <td className="py-3 px-4"><SourceBadge isSimulated={item.isSimulated} /></td>
                    <td className="py-3 px-4 text-teal-400">
                      {item.workerId} <span className="text-slate-500">({item.helmetId})</span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-300" title={item.description}>
                      {item.description}
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(item.detectedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'ACTIVE'
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : item.status === 'ACKNOWLEDGED'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                      {item.resolvedAt ? (
                        <span className="text-emerald-400">
                          Resolved {new Date(item.resolvedAt).toLocaleTimeString()}
                        </span>
                      ) : item.acknowledgedAt ? (
                        <span className="text-amber-400">
                          Ack by {item.acknowledgedBy}
                        </span>
                      ) : (
                        <span className="text-red-400">Pending action</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
