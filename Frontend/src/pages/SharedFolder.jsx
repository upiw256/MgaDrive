import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Folder, File as FileIcon, Download, ChevronRight, 
  HardDrive, LayoutGrid, List, Image, Video, FileText, Info, Lock
} from 'lucide-react';
import api from '../api';
import { getApiUrl } from '../utils/config';
import { trackedDownload } from '../utils/downloader';
import MediaPreview from '../components/MediaPreview';
import Footer from '../components/Footer';

const SharedFolder = () => {
  const { linkId } = useParams();
  const [items, setItems] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [folderName, setFolderName] = useState('Shared Folder');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [previewItem, setPreviewItem] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);

  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  const isVideo = (name) => /\.(mp4|webm|mov|ogg)$/i.test(name);

  const fetchSharedFiles = useCallback(async (path = '') => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/s/${linkId}/files?path=${path}`);
      setItems(response.data.items || []);
      setFolderName(response.data.name || 'Shared Folder');
      setCurrentPath(path);
    } catch (err) {
      console.error('Failed to fetch shared files', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('AUTH_REQUIRED');
      } else if (err.response?.status === 410) {
        setError('EXPIRED');
      } else {
        setError('NOT_FOUND');
      }
    } finally {
      setLoading(false);
    }
  }, [linkId]);

  useEffect(() => {
    fetchSharedFiles();
  }, [fetchSharedFiles]);

  const getDownloadUrl = (item) => {
    const relativePath = currentPath ? `${currentPath}/${item.name}` : item.name;
    const token = localStorage.getItem('token');
    const apiUrl = getApiUrl();
    let url = `${apiUrl}/s/${linkId}/download?path=${encodeURIComponent(relativePath)}`;
    if (token) url += `&token=${token}`;
    return url;
  };

  const handleDownload = async (item) => {
    const url = getDownloadUrl(item);
    try {
      await trackedDownload(url, item.name);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const handleBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    fetchSharedFiles(parts.join('/'));
  };

  const toggleSelect = (item) => {
    const path = currentPath ? `${currentPath}/${item.name}` : item.name;
    setSelectedItems(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      const allPaths = items.map(item => currentPath ? `${currentPath}/${item.name}` : item.name);
      setSelectedItems(allPaths);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedItems.length === 0) return;
    const apiUrl = getApiUrl();
    try {
      const formData = new FormData();
      selectedItems.forEach(path => formData.append('paths', path));
      const filename = `shared_batch_${linkId.slice(0, 8)}.zip`;
      await trackedDownload(`${apiUrl}/s/${linkId}/download-batch`, filename, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      setSelectedItems([]);
    } catch (err) {
      console.error('Batch download failed', err);
    }
  };

  if (error === 'AUTH_REQUIRED') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10 text-blue-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Restricted Access</h2>
            <p className="text-slate-400">This folder is private. Please log in to your account to view the contents.</p>
          </div>
          <Link 
            to={`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`}
            className="block w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-all"
          >
            Log In to Access
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'EXPIRED') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto">
            <Info className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold">Link Expired</h2>
          <p className="text-slate-400">This share link is no longer active. Please contact the owner for a new link.</p>
          <Link to="/" className="inline-block text-blue-400 hover:underline pt-4">Return Home</Link>
        </div>
      </div>
    );
  }

  if (error === 'NOT_FOUND') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <h2 className="text-4xl font-bold text-slate-600">404</h2>
          <p className="text-slate-400">Shared folder not found or link is broken.</p>
          <Link to="/" className="inline-block text-blue-400 hover:underline">Go to My Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-outfit">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
            <HardDrive className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            MyCloud <span className="text-slate-600 font-normal ml-2 hidden sm:inline">/ Shared</span>
          </h1>
        </div>
        {!localStorage.getItem('token') && (
          <Link to="/login" className="text-sm font-medium hover:text-blue-400 transition-colors">Login to MyCloud</Link>
        )}
      </header>

      {/* Selection Action Bar */}
      {selectedItems.length > 0 && (
        <div className="bg-blue-600 px-6 py-3 flex items-center justify-between animate-in slide-in-from-top duration-300 sticky top-16 z-20 shadow-lg">
          <div className="flex items-center gap-4">
            <span className="font-bold text-sm">{selectedItems.length} selected</span>
            <button 
              onClick={() => setSelectedItems([])}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-all"
            >
              Clear
            </button>
          </div>
          <button 
            onClick={handleBatchDownload}
            className="flex items-center gap-3 bg-white text-blue-600 px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all shadow-md"
          >
            <Download className="w-4 h-4" />
            Download ZIP
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-2">
              <Folder className="w-6 h-6 text-blue-400" />
              {folderName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button 
                onClick={() => fetchSharedFiles('')} 
                className="hover:text-white transition-colors"
                disabled={currentPath === ''}
              >
                Root
              </button>
              {currentPath.split('/').filter(Boolean).map((part, i) => (
                <React.Fragment key={i}>
                  <ChevronRight className="w-4 h-4" />
                  <span className="last:text-blue-400">{part}</span>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleSelectAll}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-700"
            >
              {selectedItems.length === items.length ? 'Unselect All' : 'Select All'}
            </button>
            <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 text-sm animate-pulse">Fetching shared contents...</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5" : "bg-slate-800/30 border border-slate-700 rounded-2xl overflow-hidden"}>
            {currentPath && viewMode === 'grid' && (
              <div 
                onClick={handleBack} 
                className="group p-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:bg-slate-800 hover:border-blue-500/50 transition-all cursor-pointer flex flex-col items-center justify-center"
              >
                <div className="text-slate-400 group-hover:text-blue-400 font-black text-lg mb-1 italic">..</div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Parent</span>
              </div>
            )}
            
            {viewMode === 'list' && currentPath && (
               <div onClick={handleBack} className="p-4 border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer flex items-center gap-3 text-slate-400 italic text-sm">
                  <ChevronRight className="w-4 h-4 rotate-180" /> Back to parent folder
               </div>
            )}

            {items.map((item, idx) => (
              viewMode === 'grid' ? (
                <div 
                  key={idx}
                  onClick={() => item.is_dir ? fetchSharedFiles(currentPath ? `${currentPath}/${item.name}` : item.name) : setPreviewItem(item)}
                  className={`group p-5 bg-slate-800/40 border rounded-2xl hover:bg-slate-800 transition-all cursor-pointer flex flex-col items-center gap-4 relative ${selectedItems.includes(currentPath ? `${currentPath}/${item.name}` : item.name) ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/50' : 'border-slate-700/50'}`}
                >
                  <div 
                    onClick={(e) => { e.stopPropagation(); toggleSelect(item); }} 
                    className={`absolute top-3 left-3 w-5 h-5 border rounded-lg flex items-center justify-center transition-all ${selectedItems.includes(currentPath ? `${currentPath}/${item.name}` : item.name) ? 'bg-blue-500 border-blue-500' : 'border-slate-600 bg-slate-900/50 opacity-0 group-hover:opacity-100'}`}
                  >
                    {selectedItems.includes(currentPath ? `${currentPath}/${item.name}` : item.name) && <div className="w-2.5 h-2.5 bg-white rounded-sm"></div>}
                  </div>
                  
                  {(!item.is_dir && (isImage(item.name) || isVideo(item.name))) ? (
                    <div className="w-full h-24 mb-1 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/50 flex items-center justify-center relative">
                      {isImage(item.name) ? (
                        <img 
                          src={getDownloadUrl(item)} 
                          alt={item.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          loading="lazy" 
                        />
                      ) : (
                        <video 
                          src={getDownloadUrl(item)} 
                          className="w-full h-full object-cover" 
                          muted 
                          preload="metadata" 
                        />
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
                    <div className={`p-4 rounded-2xl ${item.is_dir ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700/50 text-slate-400'}`}>
                      {item.is_dir ? <Folder className="w-10 h-10" /> : <FileIcon className="w-10 h-10" />}
                    </div>
                  )}
                  
                  <div className="w-full text-center">
                    <span className="text-sm font-bold truncate block w-full px-2" title={item.name}>{item.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">
                        {item.is_dir ? 'Folder' : `${(item.size / 1024).toFixed(1)} KB`}
                    </span>
                  </div>
                  
                  {!item.is_dir && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }} 
                        className="absolute top-3 right-3 p-2 bg-slate-900/80 rounded-xl opacity-0 group-hover:opacity-100 transition-all border border-slate-700 hover:text-blue-400 hover:border-blue-500/50"
                    >
                        <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div 
                  key={idx}
                  onClick={() => item.is_dir ? fetchSharedFiles(currentPath ? `${currentPath}/${item.name}` : item.name) : setPreviewItem(item)}
                  className={`p-4 border-b last:border-0 border-slate-700/50 hover:bg-slate-700/30 cursor-pointer flex items-center gap-4 transition-colors ${selectedItems.includes(currentPath ? `${currentPath}/${item.name}` : item.name) ? 'bg-blue-500/10' : ''}`}
                >
                  <div 
                    onClick={(e) => { e.stopPropagation(); toggleSelect(item); }} 
                    className={`w-5 h-5 flex-shrink-0 border rounded flex items-center justify-center transition-all ${selectedItems.includes(currentPath ? `${currentPath}/${item.name}` : item.name) ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`}
                  >
                    {selectedItems.includes(currentPath ? `${currentPath}/${item.name}` : item.name) && <div className="w-2.5 h-2.5 bg-white rounded-sm"></div>}
                  </div>
                  {item.is_dir ? <Folder className="w-5 h-5 text-blue-400" /> : <FileIcon className="w-5 h-5 text-slate-500" />}
                  <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                  <span className="text-xs text-slate-500 hidden sm:block w-24 text-right">
                    {item.is_dir ? '--' : `${(item.size / 1024).toFixed(1)} KB`}
                  </span>
                  {!item.is_dir && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }} 
                        className="p-2 hover:text-blue-400"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 opacity-50">
             <div className="p-6 bg-slate-800 rounded-full">
                <Folder className="w-12 h-12 text-slate-600" />
             </div>
             <p className="text-slate-400 font-medium italic">This shared folder is empty</p>
          </div>
        )}
      </main>

      {previewItem && (
        <MediaPreview 
            item={previewItem} 
            fileUrl={getDownloadUrl(previewItem)} 
            onClose={() => setPreviewItem(null)} 
        />
      )}
      
      <Footer />
    </div>
  );
};

export default SharedFolder;
