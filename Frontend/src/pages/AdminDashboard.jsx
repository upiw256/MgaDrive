import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Shield, HardDrive, Download, Upload, 
  Trash2, Edit, ChevronLeft, CreditCard, Activity, Terminal, UserPlus,
  Mail, Lock, User as UserIcon
} from 'lucide-react';
import api from '../api';
import LogViewer from '../components/LogViewer';
import { showAlert, showToast, showConfirm } from '../utils/swal';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '' });
  const [editForm, setEditForm] = useState({
    quota_gb: 5,
    download_limit_kbps: 500,
    upload_limit_kbps: 500
  });
  const navigate = useNavigate();

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
      if (err.response?.status === 403) navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      quota_gb: user.quota_gb,
      download_limit_kbps: user.download_limit_kbps,
      upload_limit_kbps: user.upload_limit_kbps
    });
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/admin/users/${editingUser._id}`, editForm);
      setEditingUser(null);
      fetchUsers();
      showToast('success', 'User updated successfully');
    } catch (err) {
      showAlert('error', 'Update Failed', 'Failed to update user settings');
    }
  };

  const deleteUser = async (id) => {
    const result = await showConfirm(
      'Are you sure?',
      'All user files and data will be permanently deleted. This action cannot be undone.',
      'Yes, delete user'
    );

    if (result.isConfirmed) {
      try {
        await api.delete(`/admin/users/${id}`);
        fetchUsers();
        showToast('success', 'User deleted');
      } catch (err) {
        showAlert('error', 'Deletion Failed', 'Failed to delete the user');
      }
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/register', newUser);
      setNewUser({ username: '', email: '', password: '' });
      setShowAddModal(false);
      fetchUsers();
      showToast('success', 'User registered successfully');
    } catch (err) {
      showAlert('error', 'Registration Failed', err.response?.data?.detail || 'Failed to create user');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-500 font-bold" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Control Center
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowLogs(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all text-sm font-medium"
            >
              <Terminal className="w-4 h-4 text-blue-500" />
              View Logs
            </button>
            <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">System Online</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-1">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Total Users</p>
            <p className="text-3xl font-bold">{users.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-1">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Active Storage</p>
            <p className="text-3xl font-bold">{(users.reduce((acc, u) => acc + (u.used_bytes || 0), 0) / (1024 ** 3)).toFixed(2)} GB</p>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" />
              User Management
            </h2>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              Add New User
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-950/50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Quota</th>
                  <th className="px-6 py-4">Speed Limits</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map(user => (
                  <tr key={user._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold">{user.username}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">
                      <div className="w-32 bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1">
                        <div 
                          className="bg-blue-500 h-full" 
                          style={{width: `${Math.min(100, (user.used_bytes / (user.quota_gb * 1024**3)) * 100)}%`}}
                        ></div>
                      </div>
                      {(user.used_bytes / (1024**2)).toFixed(1)}MB / {user.quota_gb}GB
                    </td>
                    <td className="px-6 py-4 text-sm space-y-1">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Download className="w-3 h-3 text-green-500" /> {user.download_limit_kbps} KB/s
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Upload className="w-3 h-3 text-orange-500" /> {user.upload_limit_kbps} KB/s
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${user.is_admin ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        {user.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleEdit(user)}
                        className="p-2 hover:bg-blue-500/20 rounded-lg text-blue-400 transition-all active:scale-90"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteUser(user._id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg text-red-500 transition-all active:scale-90"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8 space-y-6 shadow-2xl scale-in-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-500" />
              Manage {editingUser.username}
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Storage Quota (GB)</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input 
                    type="number" 
                    value={editForm.quota_gb}
                    onChange={(e) => setEditForm({...editForm, quota_gb: parseFloat(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase text-[10px]">Download Limit (KB/s)</label>
                  <input 
                    type="number" 
                    value={editForm.download_limit_kbps}
                    onChange={(e) => setEditForm({...editForm, download_limit_kbps: parseInt(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase text-[10px]">Upload Limit (KB/s)</label>
                  <input 
                    type="number" 
                    value={editForm.upload_limit_kbps}
                    onChange={(e) => setEditForm({...editForm, upload_limit_kbps: parseInt(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setEditingUser(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={saveEdit}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-all text-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleAddUser} className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8 space-y-6 shadow-2xl scale-in-center">
            <div className="space-y-2 text-center">
              <div className="inline-flex p-3 bg-blue-600/20 rounded-2xl mb-2">
                <UserPlus className="w-6 h-6 text-blue-500" />
              </div>
              <h2 className="text-xl font-bold">Register New User</h2>
              <p className="text-xs text-slate-500 text-balance">Create a new account with default access limits</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input 
                    type="text" 
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 focus:border-blue-500 outline-none transition-all"
                    placeholder="johndoe"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input 
                    type="email" 
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 focus:border-blue-500 outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Default Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input 
                    type="password" 
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 focus:border-blue-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all text-sm"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all text-sm shadow-lg shadow-blue-500/20"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Log Viewer Modal */}
      {showLogs && (
        <LogViewer onClose={() => setShowLogs(false)} />
      )}
    </div>
  );
};

export default AdminDashboard;
