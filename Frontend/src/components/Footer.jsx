import React, { useState, useEffect } from 'react';
import { ArrowDownCircle, Activity, CheckCircle2, AlertCircle, Wifi, Zap } from 'lucide-react';
import socket from '../utils/socket';

const Footer = () => {
    const [status, setStatus] = useState({ active: false });
    const [latency, setLatency] = useState(0);
    const [serverStats, setServerStats] = useState({ usage: 0 });
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Download Progress Listener
        const handleProgress = (e) => {
            setStatus(e.detail);
        };
        window.addEventListener('download-progress', handleProgress);

        // Socket Events
        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));
        
        socket.on('server_pong', (startTime) => {
            const endTime = Date.now();
            setLatency(endTime - startTime);
        });

        socket.on('server_stats', (stats) => {
            setServerStats(stats);
        });

        // Ping Loop
        const pingInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('client_ping', Date.now());
            }
        }, 5000);

        return () => {
            window.removeEventListener('download-progress', handleProgress);
            socket.off('connect');
            socket.off('disconnect');
            socket.off('server_pong');
            socket.off('server_stats');
            clearInterval(pingInterval);
        };
    }, []);

    return (
        <footer className="h-10 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-6 text-[10px] sm:text-xs text-slate-500 z-50">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 min-w-[80px]">
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'} animate-pulse`}></div>
                    <span className="font-bold uppercase tracking-tight text-slate-300">
                        {isConnected ? 'LIVE' : 'OFFLINE'}
                    </span>
                </span>
                
                <div className="flex items-center gap-3 border-l border-slate-800 pl-4 h-4 ml-2 sm:ml-4">
                    <span className="flex items-center gap-1 group relative" title="Network Latency">
                        <Wifi className="w-3 h-3 text-blue-500" />
                        <span className="text-slate-400">Ping:</span> {latency}ms
                    </span>
                    <span className="hidden sm:flex items-center gap-1 group relative" title="Server CPU Usage">
                        <Zap className="w-3 h-3 text-purple-500" />
                        <span className="text-slate-400">CPU:</span> {serverStats.usage}%
                    </span>
                </div>
            </div>

            <div className="flex-1 flex justify-center px-4">
                {status.active ? (
                    <div className="flex items-center gap-3 text-blue-400 font-medium animate-in fade-in slide-in-from-bottom-1 blur-in-sm duration-300">
                        <div className="flex items-center gap-1.5 animate-pulse overflow-hidden">
                            <ArrowDownCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[80px] sm:max-w-[200px] whitespace-nowrap">{status.filename}</span>
                        </div>
                        <span className="font-mono text-[10px] w-16">{status.speed}</span>
                        <div className="w-16 sm:w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shrink-0">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${status.progress}%` }}
                            ></div>
                        </div>
                        <span className="hidden sm:inline w-8 font-mono">{status.progress}%</span>
                    </div>
                ) : status.progress === 100 ? (
                    <div className="flex items-center gap-2 text-green-500 font-bold animate-pulse">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>TRANSFER COMPLETE</span>
                    </div>
                ) : status.error ? (
                    <div className="flex items-center gap-2 text-red-500 animate-pulse font-bold uppercase tracking-tighter">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>ERROR: {status.error}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 opacity-50 uppercase tracking-widest text-[9px] font-medium">
                        <Activity className="w-3 h-3 text-blue-500 animate-spin-slow" />
                        System Ready
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-4 text-right">
                <span className="hidden md:inline text-slate-600 font-medium">
                    storage.sman1margaasih.sch.id
                </span>
                <span className="text-slate-700 font-mono">v1.1</span>
            </div>
        </footer>
    );
};

export default Footer;
