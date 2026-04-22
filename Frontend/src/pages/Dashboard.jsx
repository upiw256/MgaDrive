import React, { useState, useEffect, useCallback } from 'react';
import { 
  Folder, File as FileIcon, MoreVertical, Upload, FolderPlus, 
  ChevronRight, Download, Trash2, LogOut, HardDrive, Eye, ShieldCheck,
  Search, LayoutGrid, List, Image, Video, FileText, X, Share2
} from 'lucide-react';
import api from '../api';
import { getApiUrl } from '../utils/config';
import MediaPreview from '../components/MediaPreview';
import ShareModal from '../components/ShareModal';
import { showAlert, showToast, showConfirm } from '../utils/swal';
import PremiumSwal from '../utils/swal';

const Dashboard = () => {
  const [items, setItems] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [dbStatus, setDbStatus] = useState('checking'); // 'connected', 'disconnected', 'checking'
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'image', 'video', 'document'
  const [shareItem, setShareItem] = useState(null);

  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  const isVideo = (name) => /\.(mp4|webm|mov|ogg)$/i.test(name);
  
  const getFileUrl = (item) => {
    const relativePath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
    const token = localStorage.getItem('token');
    const apiUrl = getApiUrl();
    return `${apiUrl}/download?path=${encodeURIComponent(relativePath)}&token=${token}`;
  };

  const fetchFiles = useCallback(async (path = '') => {
    setLoading(true);
    try {
      const response = await api.get(`/files?path=${path}`);
      let folderItems = response.data.items;
      
      // Apply local filtering if not searching
      if (!isSearching && activeFilter !== 'all') {
        folderItems = folderItems.filter(item => {
          if (activeFilter === 'image') return isImage(item.name);
          if (activeFilter === 'video') return isVideo(item.name);
          if (activeFilter === 'document') return /\.(pdf|doc|docx|txt|xls|xlsx|ppt|pptx)$/i.test(item.name);
          return true;
        });
      }
      
      setItems(folderItems);
      setCurrentPath(path);
    } catch (err) {
      console.error('Failed to fetch files', err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, isSearching]);

  const handleSearch = useCallback(async (query, filterType) => {
    if (!query && filterType === 'all') {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setLoading(true);
    try {
      const response = await api.get(`/search?q=${query}&file_type=${filterType === 'all' ? '' : filterType}`);
      setSearchResults(response.data.items);
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search effect - Reverted to Ph7 behavior (filters trigger global search)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery || activeFilter !== 'all') {
        handleSearch(searchQuery, activeFilter);
      } else {
        setIsSearching(false);
        fetchFiles(currentPath);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeFilter, handleSearch, currentPath, fetchFiles]);

  const checkHealth = async () => {
    try {
      const response = await api.get('/health', { timeout: 5000 }); // Tambahkan timeout 5s
      setDbStatus(response.data.database === 'connected' ? 'connected' : 'disconnected');
    } catch (err) {
      console.error('Health Check Failed:', err);
      setDbStatus('disconnected');
    }
  };

  const fetchUser = async () => {
    try {
      const response = await api.get('/me');
      setUser(response.data);
    } catch (err) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    fetchUser();
    fetchFiles();
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [fetchFiles]);

  const handleFolderClick = (name) => {
    const nextPath = currentPath ? `${currentPath}/${name}` : name;
    fetchFiles(nextPath);
  };

  const handleBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    fetchFiles(parts.join('/'));
  };

  const onContextMenu = (e, item) => {
    e.preventDefault();
    setSelectedItem(item);
    setContextMenu({ x: e.pageX, y: e.pageY });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    
    const result = await showConfirm(
      'Are you sure?',
      `Do you want to delete ${selectedItem.name}? This action cannot be undone.`,
      'Yes, delete it!'
    );

    if (result.isConfirmed) {
      const path = currentPath ? `${currentPath}/${selectedItem.name}` : selectedItem.name;
      try {
        await api.delete(`/files?path=${path}`);
        fetchFiles(currentPath);
        setContextMenu(null);
        showToast('success', 'Deleted successfully');
      } catch (err) {
        showAlert('error', 'Failed', 'Failed to delete the item');
      }
    }
  };

  const handleDownload = async () => {
    if (!selectedItem || selectedItem.is_dir) return;
    const apiUrl = getApiUrl();
    window.open(`${apiUrl}/download?path=${encodeURIComponent(relativePath)}&token=${localStorage.getItem('token')}`, '_blank');
    setContextMenu(null);
  };

  const handleCreateFolder = async () => {
    const { value: name } = await PremiumSwal.fire({
      title: 'New Folder',
      input: 'text',
      inputLabel: 'Enter folder name',
      inputPlaceholder: 'My New Folder',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'You need to write something!';
      }
    });

    if (!name) return;

    const formData = new FormData();
    formData.append('path', currentPath);
    formData.append('name', name);
    try {
      await api.post('/folder', formData);
      fetchFiles(currentPath);
      showToast('success', 'Folder created');
    } catch (err) {
      showAlert('error', 'Error', 'Failed to create folder');
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('path', currentPath);
    formData.append('file', file);
    try {
      showToast('info', 'Uploading...');
      await api.post('/upload', formData);
      fetchFiles(currentPath);
      showToast('success', 'Upload complete');
    } catch (err) {
      showAlert('error', 'Upload Failed', 'There was an error uploading your file');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
            <HardDrive className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            MyCloud
          </h1>
          </div>
          
          {/* Global Search */}
          <div className="flex-1 max-w-md mx-6 hidden md:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search files everywhere..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
            <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : dbStatus === 'checking' ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
              DB: {dbStatus}
            </span>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium">{user?.username}</p>
            <p className="text-xs text-slate-500">{user?.quota_gb} GB Total</p>
          </div>
          {user?.is_admin && (
            <button 
              onClick={() => window.location.href = '/admin'}
              className="p-2 bg-purple-600/20 hover:bg-purple-600/40 rounded-full text-purple-400 border border-purple-500/30 transition-all flex items-center gap-2 px-3 pl-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase">Admin</span>
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <button onClick={() => fetchFiles('')} className="hover:text-white transition-colors">Root</button>
            {currentPath.split('/').filter(Boolean).map((part, i) => (
              <React.Fragment key={i}>
                <ChevronRight className="w-4 h-4" />
                <span className="last:text-blue-400">{part}</span>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {/* Filter Pills */}
            <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700">
              {[
                { id: 'all', label: 'All', icon: LayoutGrid },
                { id: 'image', label: 'Images', icon: Image },
                { id: 'video', label: 'Videos', icon: Video },
                { id: 'document', label: 'Docs', icon: FileText },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeFilter === f.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <f.icon className="w-3.5 h-3.5" />
                  {f.label}
                </button>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-white'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-white'}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <div className="h-8 w-px bg-slate-700 mx-1"></div>

            <div className="flex items-center gap-3">
              <label className="cursor-pointer flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium transition-all transform active:scale-95 shadow-lg shadow-blue-500/20">
                <Upload className="w-4 h-4" />
                Upload
                <input type="file" className="hidden" onChange={handleUpload} />
              </label>
              <button 
                onClick={handleCreateFolder}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg font-medium transition-all"
              >
                <FolderPlus className="w-4 h-4" />
                New Folder
              </button>
            </div>
          </div>
        </div>

        {/* Search Header for Mobile/Title */}
        {isSearching && (
          <div className="mb-6 animate-in slide-in-from-top-4 duration-300">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-400" />
              Search Results for "{searchQuery || activeFilter}"
              <button 
                onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
                className="text-xs font-normal text-slate-500 hover:text-white underline underline-offset-4 ml-2"
              >
                Clear Results
              </button>
            </h2>
          </div>
        )}

        {/* File Container */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in fade-in duration-500">
            {currentPath && !isSearching && (
              <div 
                onClick={handleBack}
                className="group p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-800 hover:border-blue-500/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="text-slate-500 group-hover:text-blue-400">..</div>
                <span className="text-xs text-slate-400">Back</span>
              </div>
            )}
            {(isSearching ? searchResults : items).map((item, idx) => (
              <div 
                key={idx}
                onContextMenu={(e) => onContextMenu(e, item)}
                onClick={() => {
                  if (item.is_dir) {
                    const nextPath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
                    if (isSearching) {
                      setItems([]); // Clear local items
                      setIsSearching(false);
                      setSearchQuery('');
                    }
                    fetchFiles(nextPath);
                  } else {
                    setPreviewItem(item);
                  }
                }}
                className="group p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-800 hover:border-blue-500/50 transition-all cursor-pointer flex flex-col items-center gap-3 relative"
              >
                {(!item.is_dir && (isImage(item.name) || isVideo(item.name))) ? (
                  <div className="w-full h-24 mb-2 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/50 flex items-center justify-center relative">
                    {isImage(item.name) ? (
                      <img src={getFileUrl(item)} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <video src={getFileUrl(item)} className="w-full h-full object-cover" muted preload="metadata" />
                    )}
                    {isVideo(item.name) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                          <div className="w-0 h-0 border-y-4 border-y-transparent border-l-6 border-l-white ml-1"></div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`p-3 rounded-xl mb-1 ${item.is_dir ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700/50 text-slate-400'}`}>
                    {item.is_dir ? <Folder className="w-8 h-8" /> : <FileIcon className="w-8 h-8" />}
                  </div>
                )}
                <div className="w-full flex flex-col items-center">
                  <span className="text-sm font-medium truncate w-full text-center px-2">{item.name}</span>
                  {isSearching && item.path && <span className="text-[10px] text-slate-500 truncate w-full text-center">/{item.path.split('/').slice(0, -1).join('/')}</span>}
                  {!item.is_dir && <span className="text-[10px] text-slate-500">{(item.size / 1024).toFixed(1)} KB</span>}
                </div>
                
                <button 
                  className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); onContextMenu(e, item); }}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden animate-in fade-in duration-500">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="px-4 py-3 font-semibold text-slate-400 w-10"></th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 hidden sm:table-cell">Size</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 hidden md:table-cell">Modified</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {currentPath && !isSearching && (
                  <tr onClick={handleBack} className="hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-800/50">
                    <td className="px-4 py-3 text-center text-slate-500 font-bold">..</td>
                    <td className="px-4 py-3 text-slate-400 italic">Back to parent</td>
                    <td className="px-4 py-3 hidden sm:table-cell">--</td>
                    <td className="px-4 py-3 hidden md:table-cell">--</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                )}
                {(isSearching ? searchResults : items).map((item, idx) => (
                  <tr 
                    key={idx} 
                    onClick={() => {
                      if (item.is_dir) {
                        const nextPath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
                        fetchFiles(nextPath);
                      } else {
                        setPreviewItem(item);
                      }
                    }}
                    onContextMenu={(e) => onContextMenu(e, item)}
                    className="hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-800/50 group"
                  >
                    <td className="px-4 py-3">
                      {item.is_dir ? (
                        <Folder className="w-5 h-5 text-blue-400" />
                      ) : (
                        <FileIcon className="w-5 h-5 text-slate-400" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{item.name}</span>
                        {isSearching && item.path && (
                          <span className="text-[10px] text-slate-500">/{item.path.split('/').slice(0, -1).join('/')}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">
                      {item.is_dir ? '--' : `${(item.size / 1024).toFixed(1)} KB`}
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell text-xs">
                      {new Date(item.modified).toLocaleDateString()} {new Date(item.modified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-white"
                        onClick={(e) => { e.stopPropagation(); onContextMenu(e, item); }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(isSearching ? searchResults : items).length === 0 && !loading && (
          <div className="text-center py-20 text-slate-500">
            <div className="w-16 h-16 mx-auto mb-4 opacity-10 bg-slate-700 rounded-full flex items-center justify-center">
              <Folder className="w-8 h-8" />
            </div>
            <p>{isSearching ? 'No results found match your criteria' : 'This folder is empty'}</p>
          </div>
        )}
      </main>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed bg-slate-800 border border-slate-700 shadow-2xl rounded-lg py-1 w-48 z-50 animate-in fade-in zoom-in duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {!selectedItem.is_dir && (
            <>
              <button 
                onClick={() => { setPreviewItem(selectedItem); setContextMenu(null); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" /> Preview
              </button>
              <button 
                onClick={handleDownload}
                className="w-full text-left px-4 py-2 text-sm hover:bg-blue-600 flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </>
          )}
          <button 
            onClick={handleDelete}
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          {selectedItem.is_dir && (
            <button 
              onClick={() => { setShareItem(selectedItem); setContextMenu(null); }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-blue-600 flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          )}
        </div>
      )}

      {/* Media Preview Modal */}
      {previewItem && (
        <MediaPreview 
          item={previewItem} 
          currentPath={currentPath} 
          onClose={() => setPreviewItem(null)} 
        />
      )}
      {/* Share Modal */}
      {shareItem && (
        <ShareModal 
          item={shareItem} 
          currentPath={currentPath} 
          onClose={() => setShareItem(null)} 
        />
      )}
    </div>
  );
};

export default Dashboard;
