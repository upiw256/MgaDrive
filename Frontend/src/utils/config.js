export const getApiUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:9000';
  
  const hostname = window.location.hostname;
  
  // 1. Production Domain Mapping
  if (hostname === 'storage.sman1margaasih.sch.id') {
    return 'https://apistorage.sman1margaasih.sch.id';
  }
  
  // 2. Environment Variable Override
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }

  // 3. Smart fallback for Local IP (192.168.x.x) or other custom hostnames
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${window.location.protocol}//${hostname}:9000`;
  }
  
  // 4. Default Localhost
  return envUrl || 'http://localhost:9000';
};
