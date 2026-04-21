import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Folder, File as FileIcon, Download, ChevronRight, 
  HardDrive, LayoutGrid, List, Image, Video, FileText, Info, Lock
} from 'lucide-react';
import api from '../api';
import MediaPreview from '../components/MediaPreview';

const SharedFolder = () => {
  const { linkId } = useParams();
  const [items, setItems] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [folderName, setFolderName] = useState('Shared Folder');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [previewItem, setPreviewItem] = useState(null);

  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  const isVideo = (name) => /\.(mp4|webm|mov|ogg)$/i.test(name);

  const fetchSharedFiles = useCallback(async (path = '') => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/s/${linkId}/files?path=${path}`);
      setItems(response.data.items);
      setFolderName(response.data.name);
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
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    let url = `${apiUrl}/s/${linkId}/download?path=${encodeURIComponent(relativePath)}`;
    if (token) url += `&token=${token}`;
    return url;
  };

  const handleFolderClick = (name) => {
    const nextPath = currentPath ? `${currentPath}/${name}` : name;
    fetchSharedFiles(nextPath);
  };

  const handleBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    fetchSharedFiles(parts.join('/'));
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
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold">404</h2>
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
            MyCloud <span className="text-slate-600 font-normal ml-2">/ Shared</span>
          </h1>
        </div>
        {!localStorage.getItem('token') && (
          <Link to="/login" className="text-sm font-medium hover:text-blue-400 transition-colors">Login to MyCloud</Link>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
              <Folder className="w-6 h-6 text-blue-400" />
              {folderName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button onClick={() => fetchSharedFiles('')} className="hover:text-white transition-colors">Root</button>
              {currentPath.split('/').filter(Boolean).map((part, i) => (
                <React.Fragment key={i}>
                  <ChevronRight className="w-4 h-4" />
                  <span className="last:text-blue-400">{part}</span>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-800/50 p-1 rounded-xl border border-slate-700">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in fade-in duration-500">
            {currentPath && (
              <div 
                onClick={handleBack}
                className="group p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-800 hover:border-blue-500/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="text-slate-500 group-hover:text-blue-400">..</div>
                <span className="text-xs text-slate-400">Back</span>
              </div>
            )}
            {items.map((item, idx) => (
              <div 
                key={idx}
                onClick={() => {
                  if (item.is_dir) {
                    handleFolderClick(item.name);
                  } else {
                    setPreviewItem(item);
                  }
                }}
                className="group p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-800 hover:border-blue-500/50 transition-all cursor-pointer flex flex-col items-center gap-3 relative"
              >
                {(!item.is_dir && (isImage(item.name) || isVideo(item.name))) ? (
                  <div className="w-full h-24 mb-2 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/50 flex items-center justify-center relative">
                    {isImage(item.name) ? (
                      <img src={getDownloadUrl(item)} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <video src={getDownloadUrl(item)} className="w-full h-full object-cover" muted preload="metadata" />
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
                  <div className={`p-4 rounded-2xl mb-1 ${item.is_dir ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700/50 text-slate-400'}`}>
                    {item.is_dir ? <Folder className="w-8 h-8" /> : <FileIcon className="w-8 h-8" />}
                  </div>
                )}
                <div className="w-full text-center">
                  <span className="text-sm font-medium truncate block w-full px-2">{item.name}</span>
                  {!item.is_dir && <span className="text-[10px] text-slate-500">{(item.size / 1024).toFixed(1)} KB</span>}
                </div>
                {!item.is_dir && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); window.open(getDownloadUrl(item), '_blank'); }}
                    className="absolute top-2 right-2 p-1.5 bg-slate-900 rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-slate-700 hover:text-blue-400"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden animate-in fade-in duration-500">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="px-6 py-3 font-semibold text-slate-400 w-10"></th>
                  <th className="px-6 py-3 font-semibold text-slate-400">Name</th>
                  <th className="px-6 py-3 font-semibold text-slate-400">Size</th>
                  <th className="px-6 py-3 font-semibold text-slate-400 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {currentPath && (
                  <tr onClick={handleBack} className="hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-800/50">
                    <td className="px-6 py-3 text-center text-slate-500 font-bold">..</td>
                    <td className="px-6 py-3 text-slate-400 italic">Back to parent</td>
                    <td className="px-6 py-3">--</td>
                    <td className="px-6 py-3"></td>
                  </tr>
                )}
                {items.map((item, idx) => (
                  <tr 
                    key={idx} 
                    onClick={() => {
                      if (item.is_dir) {
                        handleFolderClick(item.name);
                      } else {
                        setPreviewItem(item);
                      }
                    }}
                    className="hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-800/50 group"
                  >
                    <td className="px-6 py-3">
                      {item.is_dir ? <Folder className="w-5 h-5 text-blue-400" /> : <FileIcon className="w-5 h-5 text-slate-400" />}
                    </td>
                    <td className="px-6 py-3 font-medium">{item.name}</td>
                    <td className="px-6 py-3 text-slate-400">{item.is_dir ? '--' : `${(item.size / 1024).toFixed(1)} KB`}</td>
                    <td className="px-6 py-3">
                      {!item.is_dir && (
                        <button onClick={(e) => { e.stopPropagation(); window.open(getDownloadUrl(item), '_blank'); }}>
                          <Download className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-blue-400" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {items.length === 0 && !loading && (
          <div className="text-center py-20 text-slate-500 animate-in fade-in duration-700">
            <div className="w-16 h-16 mx-auto mb-4 opacity-10 bg-slate-700 rounded-full flex items-center justify-center">
              <Folder className="w-8 h-8" />
            </div>
            <p>This folder is empty</p>
          </div>
        )}
      </main>

      {/* Media Preview Modal */}
      {previewItem && (
        <MediaPreview 
          item={previewItem} 
          fileUrl={getDownloadUrl(previewItem)}
          onClose={() => setPreviewItem(null)} 
        />
      )}

      <footer className="h-16 border-t border-slate-800 flex items-center justify-center text-xs text-slate-500">
        Powered by MyCloud Secure Sharing
      </footer>
    </div>
  );
};

export default SharedFolder;
