/**
 * trackedDownload utility
 * Handles file downloads with real-time speed and progress tracking.
 * Dispatches 'download-progress' CustomEvent for UI updates.
 */

const formatSpeed = (bps) => {
  if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(2)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
};

const formatSize = (bytes) => {
  if (!bytes) return '--';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

export const trackedDownload = async (url, filename, options = {}) => {
  const start = Date.now();
  let lastTime = start;
  let lastBytes = 0;

  const dispatch = (data) => {
    window.dispatchEvent(new CustomEvent('download-progress', { detail: data }));
  };

  try {
    const fetchOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body || null
    };

    const response = await fetch(url, fetchOptions);
    if (!response.ok) throw new Error('Download failed');

    const totalBytes = parseInt(response.headers.get('content-length'), 10);
    const reader = response.body.getReader();
    
    let receivedBytes = 0;
    const chunks = [];

    dispatch({ 
        active: true, 
        filename, 
        progress: 0, 
        speed: 'Connecting...',
        received: '0 KB',
        total: formatSize(totalBytes)
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedBytes += value.length;
      
      const now = Date.now();
      const elapsedBatch = (now - lastTime) / 1000;
      
      // Update stats every 500ms
      if (elapsedBatch >= 0.5 || receivedBytes === totalBytes) {
        const speedBps = (receivedBytes - lastBytes) / elapsedBatch;
        const speedFormatted = formatSpeed(speedBps);
        const progress = totalBytes ? Math.round((receivedBytes / totalBytes) * 100) : 0;
        
        dispatch({ 
          active: true, 
          filename, 
          progress, 
          speed: speedFormatted,
          received: formatSize(receivedBytes),
          total: formatSize(totalBytes)
        });
        
        lastTime = now;
        lastBytes = receivedBytes;
      }
    }

    const blob = new Blob(chunks);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);

    // Briefly show 100% before closing
    dispatch({ active: true, progress: 100, speed: 'Complete' });
    setTimeout(() => {
        dispatch({ active: false });
    }, 2000);

  } catch (error) {
    console.error('Download error:', error);
    dispatch({ active: false, error: error.message });
    throw error;
  }
};
