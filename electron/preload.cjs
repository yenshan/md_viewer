const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('folio', {
  restore: () => ipcRenderer.invoke('library:restore'),
  ready: () => ipcRenderer.invoke('library:ready'),
  onDocumentsOpened: callback => { const handler = (_, result) => callback(result); ipcRenderer.on('library:opened', handler); return () => ipcRenderer.removeListener('library:opened', handler); },
  open: () => ipcRenderer.invoke('library:open'),
  remove: id => ipcRenderer.invoke('library:remove', id),
  reload: id => ipcRenderer.invoke('library:reload', id),
  image: (id, source) => ipcRenderer.invoke('library:image', id, source),
  openLink: href => ipcRenderer.invoke('link:open', href),
  onOpen: callback => { const handler = () => callback(); ipcRenderer.on('menu:open', handler); return () => ipcRenderer.removeListener('menu:open', handler); }
});
