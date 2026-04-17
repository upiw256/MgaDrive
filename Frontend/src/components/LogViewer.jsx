import React, { useState, useEffect } from 'react';
import { X, Terminal, RefreshCw, FileText } from 'lucide-react';
import api from '../api';

const LogViewer = ({ onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/logs');
      setLogs(response.data.logs);
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl scale-in-center">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg">
              <Terminal className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">System Logs</h2>
              <p className="text-xs text-slate-500">Real-time backend activity tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchLogs}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Log Content */}
        <div className="flex-1 overflow-auto p-6 font-mono text-sm bg-slate-950/50">
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <p>Fetching logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
              <FileText className="w-12 h-12 opacity-20" />
              <p>No log data available yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-4 hover:bg-white/5 py-1 px-2 rounded transition-colors group">
                  <span className="text-slate-700 min-w-[30px] select-none text-right">{i + 1}</span>
                  <span className={`break-all ${
                    log.includes('ERROR') ? 'text-red-400' : 
                    log.includes('WARNING') ? 'text-yellow-400' : 
                    'text-slate-300'
                  }`}>
                    {log}
                  </span>
                </div>
              ))}
              <div className="pt-4 text-[10px] text-slate-700 uppercase tracking-widest text-center">
                --- End of Logs ---
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-3xl">
          <p className="text-[10px] text-slate-500 text-center">
            Showing last 100 log entries from <code className="text-blue-400">backend/app.log</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
