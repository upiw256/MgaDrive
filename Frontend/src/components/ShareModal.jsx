import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Users, Globe, Trash2, Calendar, Share2, AlertCircle } from 'lucide-react';
import api from '../api';
import { showToast, showAlert } from '../utils/swal';

const ShareModal = ({ item, currentPath, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [newUser, setNewUser] = useState('');
  const [expirationOption, setExpirationOption] = useState('permanent'); // 'permanent' | '1d' | '7d' | '30d' | 'custom'
  const [customDate, setCustomDate] = useState('');
  const [copied, setCopied] = useState(false);

  const relativePath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
  const apiBaseUrl = window.location.origin;

  useEffect(() => {
    fetchExistingShare();
  }, [relativePath]);

  const fetchExistingShare = async () => {
    setLoading(true);
    try {
      // Find among my shares
      const response = await api.get('/shares/me');
      const existing = response.data.find(s => s.target_path === relativePath);
      if (existing) {
        setShareData(existing);
        setIsPublic(!existing.allowed_users || existing.allowed_users.length === 0);
        setAllowedUsers(existing.allowed_users || []);
        if (existing.expires_at) {
          setExpirationOption('custom');
          setCustomDate(new Date(existing.expires_at).toISOString().split('T')[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch share data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    setLoading(true);
    let expires_at = null;
    const now = new Date();
    
    if (expirationOption === '1d') expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    else if (expirationOption === '7d') expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    else if (expirationOption === '30d') expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    else if (expirationOption === 'custom' && customDate) expires_at = new Date(customDate);

    try {
      const response = await api.post('/shares', {
        path: relativePath,
        allowed_users: isPublic ? null : allowedUsers,
        expires_at: expires_at ? expires_at.toISOString() : null
      });
      setShareData(response.data);
      showToast('success', 'Share settings updated');
    } catch (err) {
      showAlert('error', 'Failed', 'Failed to update share settings');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!shareData) return;
    try {
      await api.delete(`/shares/${shareData.link_id}`);
      setShareData(null);
      setIsPublic(true);
      setAllowedUsers([]);
      setExpirationOption('permanent');
      showToast('success', 'Share link revoked');
    } catch (err) {
      showAlert('error', 'Failed', 'Could not revoke share link');
    }
  };

  const addUser = () => {
    if (newUser && !allowedUsers.includes(newUser)) {
      setAllowedUsers([...allowedUsers, newUser]);
      setNewUser('');
    }
  };

  const removeUser = (user) => {
    setAllowedUsers(allowedUsers.filter(u => u !== user));
  };

  const copyToClipboard = () => {
    if (!shareData) return;
    const shareUrl = `${apiBaseUrl}/s/${shareData.link_id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('success', 'Link copied to clipboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 rounded-lg text-blue-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Share Folder</h3>
              <p className="text-xs text-slate-500 truncate max-w-[300px]">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Visibility Section */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-400 block uppercase tracking-wider">Who can access?</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsPublic(true)}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${isPublic ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)]' : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-600'}`}
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">Public</span>
              </button>
              <button 
                onClick={() => setIsPublic(false)}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${!isPublic ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)]' : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-600'}`}
              >
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Restricted</span>
              </button>
            </div>
            {isPublic ? (
              <p className="text-xs text-slate-500 flex items-center gap-2 px-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Anyone with the link can view and download files.
              </p>
            ) : (
              <div className="mt-4 space-y-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700 animate-in slide-in-from-top-2 duration-300">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Enter username or email..."
                    value={newUser}
                    onChange={(e) => setNewUser(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addUser()}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button 
                    onClick={addUser}
                    className="bg-blue-600 hover:bg-blue-500 px-4 rounded-lg text-sm font-bold transition-colors"
                  >
                    Add
                  </button>
                </div>
                {allowedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {allowedUsers.map(user => (
                      <span key={user} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300">
                        {user}
                        <button onClick={() => removeUser(user)} className="hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expiration Section */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-400 block uppercase tracking-wider">Expires after</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'permanent', label: 'Never' },
                { id: '1d', label: '1 Day' },
                { id: '7d', label: '1 Week' },
                { id: '30d', label: '1 Month' },
                { id: 'custom', label: 'Custom' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setExpirationOption(opt.id)}
                  className={`text-[11px] py-2 rounded-lg border font-bold transition-all ${expirationOption === opt.id ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {expirationOption === 'custom' && (
              <div className="pt-2 animate-in slide-in-from-top-2 duration-300">
                <input 
                  type="date" 
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-white scheme-dark"
                />
              </div>
            )}
          </div>

          {/* Share Link Result */}
          {shareData && (
            <div className="p-4 bg-blue-600/5 border border-blue-600/20 rounded-2xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Shareable Link</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 truncate font-mono">
                  {apiBaseUrl}/s/{shareData.link_id}
                </div>
                <button 
                  onClick={copyToClipboard}
                  className={`px-4 rounded-lg flex items-center justify-center transition-all ${copied ? 'bg-green-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'}`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-800/30 border-t border-slate-800 flex gap-3">
          <button 
            onClick={handleShare}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 h-10 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Update Settings'}
          </button>
          {shareData && (
            <button 
              onClick={handleRevoke}
              className="flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 px-4 rounded-xl font-bold transition-all"
              title="Revoke Share Link"
            >
              <Trash2 className="w-4 h-4" />
              Revoke
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
