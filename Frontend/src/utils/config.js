export const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // 1. Jika ada VITE_API_URL dan bukan localhost, gunakan itu langsung (Prioritas Utama)
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }

  // 2. Smart fallback untuk akses IP Lokal (192.168.x.x) agar tetap bisa konek ke port 9000
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `${window.location.protocol}//${window.location.hostname}:9000`;
  }
  
  // 3. Terakhir, gunakan envUrl (yang mungkin localhost) atau default localhost
  return envUrl || 'http://localhost:9000';
};
