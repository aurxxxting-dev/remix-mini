const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agnesAPI', {
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  pasteImage: () => ipcRenderer.invoke('paste-image'),
  generateImage: (data) => ipcRenderer.invoke('generate-image', data),
  closeApp: () => ipcRenderer.invoke('close-app'),
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (key) => ipcRenderer.invoke('set-api-key', key),
  getApiType: () => ipcRenderer.invoke('get-api-type'),
  setApiType: (type) => ipcRenderer.invoke('set-api-type', type),
  getTokenBalance: () => ipcRenderer.invoke('get-token-balance'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
  getHistoryImages: () => ipcRenderer.invoke('get-history-images'),
  startDragFile: (filePath) => ipcRenderer.send('start-drag-file', filePath),
  onNewImageGenerated: (callback) => ipcRenderer.on('new-image-generated', (_, data) => callback(data)),
  setWindowHeight: (height) => ipcRenderer.invoke('set-window-height', height),
});

contextBridge.exposeInMainWorld('screenshotAPI', {
  onScreenshotData: (callback) => ipcRenderer.on('screenshot-data', (_, data) => callback(data)),
  sendCropped: (dataUrl, size, aspectRatio) => ipcRenderer.send('screenshot-cropped', { dataUrl, size, aspectRatio }),
  sendCancelled: () => ipcRenderer.send('screenshot-cancelled'),
});
