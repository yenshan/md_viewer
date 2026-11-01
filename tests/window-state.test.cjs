const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { restoreBounds, createWindowState } = require('../electron/window-state.cjs');
const primary = { x: 0, y: 25, width: 1440, height: 875 };
const left = { x: -1920, y: 0, width: 1920, height: 1080 };
const screen = { getPrimaryDisplay: () => ({ workArea: primary }), getAllDisplays: () => [{ workArea: primary }, { workArea: left }] };

test('restores positions on secondary screens including negative coordinates', () => {
  const saved = { x: -1700, y: 100, width: 1000, height: 700 };
  assert.deepEqual(restoreBounds(saved, [primary, left], primary), saved);
});

test('detached monitors, oversized windows and invalid bounds fall back inside the work area', () => {
  const saved = { x: -1700, y: 100, width: 1000, height: 700 };
  assert.deepEqual(restoreBounds(saved, [primary], primary), { x: 220, y: 113, width: 1000, height: 700 });
  assert.deepEqual(restoreBounds({ x: 1400, y: 850, width: 3000, height: 2000 }, [primary], primary), primary);
  const small = { x: 0, y: 0, width: 640, height: 480 };
  assert.deepEqual(restoreBounds(null, [small], small), small);
  assert.deepEqual(restoreBounds({ x: NaN, y: 0, width: -1, height: 20 }, [primary], primary), restoreBounds(null, [primary], primary));
});

test('saves on close and restores size, position and maximization in a new session', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-window-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'window-state.json');
  const normal = { x: 130, y: 90, width: 1100, height: 720 };
  const window = new EventEmitter();
  Object.assign(window, { isDestroyed: () => false, getNormalBounds: () => normal, isMinimized: () => false, isFullScreen: () => false, isMaximized: () => true });
  const state = createWindowState(file, screen);
  state.track(window);
  window.emit('resize');
  window.emit('close');
  window.emit('closed');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { bounds: normal, maximized: true });
  const restored = createWindowState(file, screen);
  assert.deepEqual(restored.options(), { ...normal, minWidth: 800, minHeight: 560 });
  let maximized = false;
  const next = new EventEmitter();
  next.maximize = () => { maximized = true; };
  restored.track(next);
  assert.ok(maximized);
  next.emit('closed');
  fs.writeFileSync(file, '{invalid');
  assert.deepEqual(createWindowState(file, screen).options(), { ...restoreBounds(null, [primary, left], primary), minWidth: 800, minHeight: 560 });
});
