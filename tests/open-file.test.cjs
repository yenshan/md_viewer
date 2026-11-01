const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function harness(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'folio-open-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = [path.join(root, '日本語 ノート.md'), path.join(root, 'second.markdown')];
  for (const file of files) await fs.writeFile(file, '# ' + path.basename(file));
  const app = new EventEmitter();
  let finishReady;
  app.whenReady = () => new Promise(resolve => { finishReady = resolve; });
  app.commandLine = { getSwitchValue: () => '' };
  app.getPath = () => root;
  app.quit = () => assert.fail('App unexpectedly quit');
  const handlers = new Map();
  const windows = [];
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.bounds = options; this.webContents = new EventEmitter(); this.messages = [];
      this.webContents.setWindowOpenHandler = () => {};
      this.webContents.send = (channel, data) => { this.messages.push({ channel, data }); };
      this.closed = false; windows.push(this);
    }
    getNormalBounds() { const { x, y, width, height } = this.bounds; return { x, y, width, height }; }
    isMaximized() { return false; }
    isFullScreen() { return false; }
    isDestroyed() { return this.closed; }
    isMinimized() { return true; }
    restore() { this.wasRestored = true; }
    show() { this.wasShown = true; }
    focus() { this.wasFocused = true; }
    loadFile() { this.webContents.emit('did-start-loading'); }
    loadURL() { this.loadFile(); }
    close() { this.closed = true; this.emit('closed'); }
    static getAllWindows() { return windows.filter(window => !window.closed); }
  }
  const electron = { screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 25, width: 1440, height: 875 } }), getAllDisplays() { return [this.getPrimaryDisplay()]; } }, app, BrowserWindow: Window, ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) }, Menu: { buildFromTemplate: x => x, setApplicationMenu: () => {} }, dialog: { showErrorBox: (_, message) => assert.fail(message) }, shell: {} };
  const source = await fs.readFile(path.resolve('electron/main.cjs'), 'utf8');
  vm.runInNewContext(source, { require: name => name === 'electron' ? electron : name.startsWith('./') ? require('../electron/' + name.slice(2)) : require(name), __dirname: path.resolve('electron'), process, console });
  const open = file => { let prevented = false; app.emit('open-file', { preventDefault: () => { prevented = true; } }, file); assert.ok(prevented); };
  const waitFor = async predicate => { for (let count = 0; count < 200; count++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); } assert.fail('Timed out'); };
  const start = async () => { finishReady(); await waitFor(() => windows.length > 0); };
  const ready = async () => { const window = windows.at(-1); await handlers.get('library:restore')(); await handlers.get('library:ready')({ sender: window.webContents }); return window; };
  return { files, root, windows, open, start, ready, waitFor, handlers };
}

test('Finder files received before launch wait for restoration and renderer readiness', async t => {
  const h = await harness(t);
  h.open(h.files[0]); h.open(h.files[1]); h.open(h.files[0]);
  await h.start();
  assert.equal(h.windows[0].messages.length, 0);
  const window = await h.ready();
  assert.deepEqual(Array.from(window.messages[0].data.documents, doc => doc.id), h.files);
  const stored = JSON.parse(await fs.readFile(path.join(h.root, 'library.json'), 'utf8'));
  assert.deepEqual(stored, h.files);
});

test('Finder files open in the existing window, survive renderer reload, and reopen a closed window', async t => {
  const h = await harness(t);
  await h.start();
  const window = await h.ready();
  h.open(h.files[0]);
  await h.waitFor(() => window.messages.length === 1);
  assert.equal(h.windows.length, 1);
  assert.ok(window.wasRestored && window.wasShown && window.wasFocused);
  assert.equal(window.messages[0].data.documents[0].id, h.files[0]);
  window.webContents.emit('did-start-loading');
  h.open(h.files[1]);
  assert.equal(window.messages.length, 1);
  await h.ready();
  assert.equal(window.messages[1].data.documents[0].id, h.files[1]);
  window.close();
  h.open(h.files[0]);
  assert.equal(h.windows.length, 2);
  assert.equal(h.windows[1].messages.length, 0);
  const reopened = await h.ready();
  assert.equal(reopened.messages[0].data.documents[0].id, h.files[0]);
  h.open(path.join(h.root, 'missing.md'));
  await h.waitFor(() => reopened.messages.length === 2);
  assert.equal(reopened.messages[1].data.documents.length, 0);
  assert.match(reopened.messages[1].data.errors[0], /missing.md/);
});
