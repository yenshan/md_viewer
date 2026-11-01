const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { readDocument, isMarkdown } = require('./library.cjs');
const customUserData = app.commandLine.getSwitchValue('user-data-dir');
if (customUserData) app.setPath('userData', path.resolve(customUserData));
let window;
let createWindow;
let rendererReady = false;
let deliveringFiles = false;
const pendingFiles = new Set();
let library = [];
let sessionPath;
let saveQueue = Promise.resolve();
const allowed = new Set();
async function deliverPendingFiles() {
  if (deliveringFiles) return;
  deliveringFiles = true;
  try {
    while (rendererReady && window && !window.isDestroyed() && pendingFiles.size) {
      const target = window;
      const paths = [...pendingFiles];
      pendingFiles.clear();
      let result;
      try { result = await addFiles(paths); }
      catch (error) { result = { documents: [], errors: [error.message] }; }
      if (!rendererReady || window !== target || target.isDestroyed()) {
        paths.forEach(file => pendingFiles.add(file));
        break;
      }
      target.webContents.send('library:opened', result);
    }
  } finally {
    deliveringFiles = false;
    if (rendererReady && window && !window.isDestroyed() && pendingFiles.size) void deliverPendingFiles();
  }
}
// macOS can send files before app.whenReady() or before React has mounted.
app.on('open-file', (event, file) => {
  event.preventDefault();
  pendingFiles.add(file);
  if (createWindow) {
    if (!window || window.isDestroyed()) createWindow();
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    void deliverPendingFiles();
  }
});
function saveLibrary() {
  const snapshot = JSON.stringify(library);
  const pending = saveQueue.then(async () => {
    await fs.writeFile(sessionPath + '.tmp', snapshot);
    await fs.rename(sessionPath + '.tmp', sessionPath);
  });
  saveQueue = pending.catch(() => {});
  return pending;
}
async function addFiles(paths) {
  const documents = [], errors = [];
  for (const file of paths) {
    try {
      const doc = await readDocument(file);
      allowed.add(file);
      if (!library.includes(file)) library.push(file);
      documents.push(doc);
    } catch (error) { errors.push(`${path.basename(file)}: ${error.message}`); }
  }
  await saveLibrary();
  return { documents, errors };
}
app.whenReady().then(async () => {
  sessionPath = path.join(app.getPath('userData'), 'library.json');
  try { library = JSON.parse(await fs.readFile(sessionPath, 'utf8')); if (!Array.isArray(library)) library = []; } catch { library = []; }
  library = library.filter(file => typeof file === 'string' && isMarkdown(file));
  library.forEach(file => allowed.add(file));
  ipcMain.handle('library:restore', () => addFiles([...library]));
  ipcMain.handle('library:ready', event => {
    if (event.sender !== window?.webContents) return;
    rendererReady = true;
    return deliverPendingFiles();
  });
  ipcMain.handle('library:open', async () => {
    const result = await dialog.showOpenDialog(window, { title: 'Markdownファイルを追加', filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }], properties: ['openFile', 'multiSelections'] });
    return result.canceled ? { documents: [], errors: [] } : addFiles(result.filePaths);
  });
  ipcMain.handle('library:remove', async (_, id) => {
    library = library.filter(file => file !== id); allowed.delete(id); await saveLibrary();
  });
  ipcMain.handle('library:reload', async (_, id) => { if (!allowed.has(id)) throw new Error('このファイルは開かれていません。'); return readDocument(id); });
  ipcMain.handle('library:image', async (_, id, source) => {
    if (!allowed.has(id) || typeof source !== 'string') return null;
    try {
      const folder = await fs.realpath(path.dirname(id));
      const resolved = await fs.realpath(path.resolve(folder, decodeURIComponent(source)));
      const relative = path.relative(folder, resolved);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
      const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif' };
      const type = types[path.extname(resolved).toLowerCase()];
      if (!type || (await fs.stat(resolved)).size > 20 * 1024 * 1024) return null;
      return `data:${type};base64,${(await fs.readFile(resolved)).toString('base64')}`;
    } catch { return null; }
  });
  ipcMain.handle('link:open', async (_, href) => {
    if (typeof href !== 'string') return;
    const url = new URL(href);
    if (['https:', 'http:', 'mailto:'].includes(url.protocol)) await shell.openExternal(url.href);
  });
  createWindow = function () {
    rendererReady = false;
    window = new BrowserWindow({ width: 1280, height: 860, minWidth: 800, minHeight: 560, title: 'Folio', backgroundColor: '#faf9f6', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 20 }, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('did-start-loading', () => { rendererReady = false; });
    window.on('closed', () => { window = null; rendererReady = false; });
    if (process.argv.includes('--dev')) window.loadURL('http://127.0.0.1:5173');
    else window.loadFile(path.join(__dirname, '../dist/index.html'));
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ label: 'Folio', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'ファイル', submenu: [{ label: 'Markdownを追加…', accelerator: 'CmdOrCtrl+O', click: () => { if (!window || window.isDestroyed()) createWindow(); else window.webContents.send('menu:open'); } }, { role: 'close' }] },
    { role: 'editMenu' }, { label: '表示', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'togglefullscreen' }] }
  ]));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
}).catch(error => { dialog.showErrorBox('Folioを起動できません', error.message); app.quit(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
