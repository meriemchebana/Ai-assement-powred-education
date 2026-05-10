const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Get app version
  getVersion: () => '1.0.0',
  
  // Platform info
  platform: process.platform,
  
  // Send notifications (optional)
  sendNotification: (title, body) => {
    new Notification(title, { body });
  },
  
  // Check if running in Electron
  isElectron: true,
});

