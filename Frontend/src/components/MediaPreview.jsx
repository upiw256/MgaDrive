import { X, FileText } from 'lucide-react';

const MediaPreview = ({ item, currentPath, onClose, fileUrl: overrideUrl }) => {
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  
  // Use overrideUrl if provided (for shared links), otherwise construct standard download URL
  const relativePath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
  const fileUrl = overrideUrl || `${apiUrl}/download?path=${encodeURIComponent(relativePath)}&token=${token}`;

  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  const isVideo = (name) => /\.(mp4|webm|mov|ogg)$/i.test(name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300 p-4">
      <div className="relative w-full max-w-5xl h-full max-h-[90vh] flex flex-col items-center justify-center">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between text-white bg-gradient-to-b from-black/50 to-transparent">
          <h3 className="text-lg font-medium truncate pr-8">{item.name}</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="w-full h-full flex items-center justify-center overflow-auto mt-12 pb-4">
          {isImage(item.name) ? (
            <img 
              src={fileUrl} 
              alt={item.name}
              className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300"
            />
          ) : isVideo(item.name) ? (
            <video 
              controls 
              autoPlay 
              className="max-w-full max-h-full shadow-2xl animate-in zoom-in-95 duration-300"
            >
              <source src={fileUrl} />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="text-center text-white space-y-4">
              <div className="p-6 bg-slate-800 rounded-3xl inline-block">
                <FileText className="w-16 h-16 text-slate-400" />
              </div>
              <p>Preview not available for this file type.</p>
              <a 
                href={fileUrl} 
                download 
                className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full font-medium transition-colors"
              >
                Download Instead
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaPreview;
