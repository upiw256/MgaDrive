export const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  // Jika diakses dari IP server (bukan localhost), arahkan API ke IP tersebut di port 9000
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && (!envUrl || envUrl.includes('localhost'))) {
    return `${window.location.protocol}//${window.location.hostname}:9000`;
  }
  return envUrl || 'http://localhost:9000';
};
