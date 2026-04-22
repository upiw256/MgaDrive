import React, { useState, useEffect, useCallback } from 'react';
import { 
  Folder, File as FileIcon, MoreVertical, Upload, FolderPlus, 
  ChevronRight, Download, Trash2, LogOut, HardDrive, Eye, ShieldCheck,
  Search, LayoutGrid, List, Image, Video, FileText, X, Share2
} from 'lucide-react';
import api from '../api';
import { getApiUrl } from '../utils/config';
import { trackedDownload } from '../utils/downloader';
import MediaPreview from '../components/MediaPreview';
import ShareModal from '../components/ShareModal';
import Footer from '../components/Footer';
import PremiumSwal, { showAlert, showToast, showConfirm, showProgressAlert } from '../utils/swal';

const Dashboard = () => {
  const [items, setItems] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [dbStatus, setDbStatus] = useState('checking');
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [shareItem, setShareItem] = useState(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

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
      setItems(response.data.items || []);
      setCurrentPath(path);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching files:', err);
      setLoading(false);
      if (err.response?.status === 401) {
        window.location.href = '/login';
      }
    }
  }, []);

  const checkDbStatus = useCallback(async () => {
    try {
      await api.get('/health');
      setDbStatus('connected');
    } catch (err) {
      setDbStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    checkDbStatus();
    
    const fetchUser = async () => {
      try {
        const response = await api.get('/me');
        setUser(response.data);
      } catch (err) {}
    };
    fetchUser();

    const interval = setInterval(checkDbStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchFiles, checkDbStatus]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      const delayDebounceFn = setTimeout(async () => {
        try {
          const response = await api.get(`/search?query=${searchQuery}`);
          setSearchResults(response.data.items || []);
        } catch (err) {
          console.error('Search error:', err);
        }
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  }, [searchQuery]);

  const onContextMenu = (e, item) => {
    e.preventDefault();
    setSelectedItem(item);
    
    const menuWidth = 192;
    let x = e.pageX;
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    
    setContextMenu({ x, y: e.pageY });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    const path = selectedItem.path || (currentPath ? `${currentPath}/${selectedItem.name}` : selectedItem.name);
    
    const result = await showConfirm('Are you sure?', `Delete ${selectedItem.name}? This action cannot be undone.`);
    if (result.isConfirmed) {
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

  const handleBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    fetchFiles(parts.join('/'));
  };

  const handleDownload = async () => {
    if (!selectedItem || selectedItem.is_dir) return;
    const relativePath = selectedItem.path || (currentPath ? `${currentPath}/${selectedItem.name}` : selectedItem.name);
    const apiUrl = getApiUrl();
    const downloadUrl = `${apiUrl}/download?path=${encodeURIComponent(relativePath)}&token=${localStorage.getItem('token')}`;
    
    try {
      setContextMenu(null);
      await trackedDownload(downloadUrl, selectedItem.name);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const toggleSelect = (item) => {
    const path = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
    setSelectedItems(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleSelectAll = () => {
    const allItems = isSearching ? searchResults : items;
    if (selectedItems.length === allItems.length) {
      setSelectedItems([]);
    } else {
      const allPaths = allItems.map(item => item.path || (currentPath ? `${currentPath}/${item.name}` : item.name));
      setSelectedItems(allPaths);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedItems.length === 0) return;
    const apiUrl = getApiUrl();
    
    try {
      const formData = new FormData();
      selectedItems.forEach(path => formData.append('paths', path));
      
      const filename = `mgadrive_batch_${new Date().getTime()}.zip`;
      
      await trackedDownload(`${apiUrl}/download-batch`, filename, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      setSelectedItems([]);
      showToast('success', 'Batch download complete');
    } catch (err) {
      console.error('Batch download failed', err);
      showAlert('error', 'Error', 'Failed to prepare batch download');
    }
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

    try {
      await api.post('/folders', { name, path: currentPath });
      fetchFiles(currentPath);
      showToast('success', 'Folder created');
    } catch (err) {
      showAlert('error', 'Error', 'Failed to create folder');
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const formData = new FormData();
    formData.append('path', currentPath);
    files.forEach(file => {
      formData.append('files', file);
    });

    setIsUploading(true);
    try {
      showProgressAlert('Uploading...', `Processing ${files.length} files`);
      
      await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          
          const progressBar = document.getElementById('progress-bar');
          const progressText = document.getElementById('progress-text');
          if (progressBar) progressBar.style.width = `${percentCompleted}%`;
          if (progressText) progressText.innerText = `${percentCompleted}%`;
        }
      });

      PremiumSwal.close();
      setIsUploading(false);
      fetchFiles(currentPath);
      showToast('success', 'Upload complete');
      e.target.value = null;
    } catch (err) {
      PremiumSwal.close();
      setIsUploading(false);
      const errorMessage = err.response?.data?.detail || 'There was an error uploading your files.';
      showAlert('error', 'Upload Failed', errorMessage);
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
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent hidden sm:block">
            MyCloud
          </h1>
          <button 
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden p-2 text-slate-400 hover:text-white"
          >
            {showMobileSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>
        </div>
        
        {/* Mobile Search Overlay */}
        {showMobileSearch && (
          <div className="absolute inset-x-0 top-16 p-4 bg-slate-900 border-b border-slate-800 md:hidden animate-in slide-in-from-top-4 duration-200 z-20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                autoFocus
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>
        )}
          
          <div className="flex-1 max-w-md mx-6 hidden md:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search in your cloud..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
            <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
              {dbStatus}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-[10px] font-bold text-slate-300">{user?.username}</p>
          </div>
          {user?.is_admin && (
            <button 
              onClick={() => window.location.href = '/admin'}
              className="p-2 bg-purple-600/20 rounded-full text-purple-400 border border-purple-500/30 px-3"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Selection Action Bar */}
      {selectedItems.length > 0 && (
        <div className="bg-blue-600 px-6 py-3 flex items-center justify-between sticky top-16 z-20 shadow-lg">
          <span className="font-bold text-sm">{selectedItems.length} selected</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedItems([])} className="text-xs bg-white/20 px-3 py-1 rounded-full">Clear</button>
            <button onClick={handleBatchDownload} className="flex items-center gap-2 bg-white text-blue-600 px-4 py-1 rounded-lg font-bold text-sm">
              <Download className="w-4 h-4" /> ZIP
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Folder className="w-6 h-6 text-blue-500" />
              {currentPath || 'Root Storage'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
              <button 
                onClick={handleSelectAll}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 bg-slate-800"
              >
                {selectedItems.length > 0 ? 'Unselect All' : 'Select All'}
              </button>
              <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="p-2 bg-slate-800 rounded-lg">
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-4 mb-8">
          <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold cursor-pointer transition-all">
            <Upload className="w-5 h-5" />
            Upload
            <input type="file" multiple className="hidden" onChange={handleUpload} disabled={isUploading} />
          </label>
          <button 
            onClick={handleCreateFolder}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-bold border border-slate-700"
          >
            <FolderPlus className="w-5 h-5 text-blue-400" />
            New Folder
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {(isSearching ? searchResults : items).map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => item.is_dir ? fetchFiles(item.path || (currentPath ? `${currentPath}/${item.name}` : item.name)) : setPreviewItem(item)}
                className={`group p-4 bg-slate-800/40 border rounded-xl hover:bg-slate-800 transition-all cursor-pointer flex flex-col items-center gap-3 relative ${
                  selectedItems.includes(item.path || (currentPath ? `${currentPath}/${item.name}` : item.name)) 
                  ? 'border-blue-500 bg-blue-500/5' 
                  : 'border-slate-700/50'
                }`}
              >
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleSelect(item); }}
                  className={`absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center ${
                    selectedItems.includes(item.path || (currentPath ? `${currentPath}/${item.name}` : item.name))
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-slate-600'
                  }`}
                >
                  {selectedItems.includes(item.path || (currentPath ? `${currentPath}/${item.name}` : item.name)) && <div className="w-2 h-2 bg-white rounded-sm"></div>}
                </div>

                {(!item.is_dir && (isImage(item.name) || isVideo(item.name))) ? (
                  <div className="w-full h-32 mb-2 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/50 flex items-center justify-center relative">
                    {isImage(item.name) ? (
                      <img 
                        src={getFileUrl(item)} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        loading="lazy" 
                      />
                    ) : (
                      <video 
                        src={getFileUrl(item)} 
                        className="w-full h-full object-cover" 
                        muted 
                        preload="metadata" 
                      />
                    )}
                    {isVideo(item.name) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                          <div className="w-0 h-0 border-y-5 border-y-transparent border-l-8 border-l-white ml-1"></div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`p-3 rounded-xl mb-1 ${item.is_dir ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700/50 text-slate-400'}`}>
                      {item.is_dir ? <Folder className="w-8 h-8" /> : <FileIcon className="w-8 h-8" />}
                  </div>
                )}
                <span className="text-sm font-medium truncate w-full text-center px-2">{item.name}</span>
                
                <button 
                  className="absolute top-2 right-2 p-1 text-slate-500 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); onContextMenu(e, item); }}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <tbody>
                {currentPath && (
                  <tr onClick={handleBack} className="hover:bg-slate-700/50 cursor-pointer border-b border-slate-800">
                    <td className="px-4 py-3 text-slate-500 font-bold">.. Back</td>
                  </tr>
                )}
                {(isSearching ? searchResults : items).map((item, idx) => (
                  <tr 
                    key={idx} 
                    onClick={() => item.is_dir ? fetchFiles(item.path || (currentPath ? `${currentPath}/${item.name}` : item.name)) : setPreviewItem(item)}
                    className="hover:bg-slate-700/50 cursor-pointer border-b border-slate-800"
                  >
                    <td className="px-4 py-3 flex items-center gap-3">
                      {item.is_dir ? <Folder className="w-5 h-5 text-blue-400" /> : <FileIcon className="w-5 h-5 text-slate-400" />}
                      {item.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modals */}
      {contextMenu && (
        <div 
          className="fixed bg-slate-800 border border-slate-700 shadow-2xl rounded-lg py-1 w-48 z-50"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {!selectedItem.is_dir && (
            <>
              <button onClick={() => { setPreviewItem(selectedItem); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-700">Preview</button>
              <button onClick={handleDownload} className="w-full text-left px-4 py-2 hover:bg-blue-600">Download</button>
            </>
          )}
          <button onClick={() => { setShareItem(selectedItem); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-700">Share</button>
          <button onClick={handleDelete} className="w-full text-left px-4 py-2 hover:bg-red-600 text-red-400 hover:text-white">Delete</button>
        </div>
      )}

      {previewItem && <MediaPreview item={previewItem} currentPath={currentPath} onClose={() => setPreviewItem(null)} />}
      {shareItem && <ShareModal item={shareItem} currentPath={currentPath} onClose={() => setShareItem(null)} />}
      
      <Footer />
    </div>
  );
};

export default Dashboard;
