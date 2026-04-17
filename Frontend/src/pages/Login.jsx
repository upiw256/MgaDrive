import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, User, Lock, HardDrive } from 'lucide-react';
import api from '../api';
import { showToast } from '../utils/swal';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [dbStatus, setDbStatus] = useState('checking');
  const navigate = useNavigate();

  const checkHealth = async () => {
    try {
      const response = await api.get('/health');
      setDbStatus(response.data.database === 'connected' ? 'connected' : 'disconnected');
    } catch {
      setDbStatus('disconnected');
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      const response = await api.post('/token', formData);
      localStorage.setItem('token', response.data.access_token);
      navigate('/');
    } catch (err) {
      showToast('error', 'Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
        {/* DB Status Indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2 px-2 py-1 bg-slate-800/50 rounded-full border border-slate-700/50">
          <div className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'connected' ? 'bg-green-500' : dbStatus === 'checking' ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
          <span className="text-[8px] uppercase font-bold text-slate-500">{dbStatus}</span>
        </div>

        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20 mb-4">
            <HardDrive className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Welcome Back</h2>
          <p className="text-slate-400">Sign in to access your cloud storage</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Error messages are now handled by SweetAlert toasts */}
          
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input 
                type="text" 
                placeholder="Username" 
                className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 pl-11 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input 
                type="password" 
                placeholder="Password" 
                className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 pl-11 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95">
            <LogIn className="w-5 h-5" />
            Sign In
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
