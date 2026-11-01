const fs = require('node:fs');

const MIN_WIDTH = 800;
const MIN_HEIGHT = 560;
function validBounds(bounds) {
  return bounds && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key])) && bounds.width > 0 && bounds.height > 0;
}
function restoreBounds(saved, workAreas, primary) {
  const bounds = validBounds(saved) ? saved : null;
  let area = primary;
  let largest = 0;
  if (bounds) {
    for (const candidate of workAreas) {
      const width = Math.max(0, Math.min(bounds.x + bounds.width, candidate.x + candidate.width) - Math.max(bounds.x, candidate.x));
      const height = Math.max(0, Math.min(bounds.y + bounds.height, candidate.y + candidate.height) - Math.max(bounds.y, candidate.y));
      if (width * height > largest) { largest = width * height; area = candidate; }
    }
  }
  const width = Math.round(Math.min(area.width, Math.max(MIN_WIDTH, bounds?.width ?? 1280)));
  const height = Math.round(Math.min(area.height, Math.max(MIN_HEIGHT, bounds?.height ?? 860)));
  const x = bounds && largest ? bounds.x : area.x + (area.width - width) / 2;
  const y = bounds && largest ? bounds.y : area.y + (area.height - height) / 2;
  return {
    x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height))),
    width, height,
  };
}
function createWindowState(file, screen) {
  let state = {};
  try { const saved = JSON.parse(fs.readFileSync(file, 'utf8')); if (saved && typeof saved === 'object') state = saved; } catch { /* First launch or corrupt settings: use defaults. */ }
  return {
    options() {
      const primary = screen.getPrimaryDisplay().workArea;
      const bounds = restoreBounds(state.bounds, screen.getAllDisplays().map(display => display.workArea), primary);
      return { ...bounds, minWidth: Math.min(MIN_WIDTH, bounds.width), minHeight: Math.min(MIN_HEIGHT, bounds.height) };
    },
    track(window) {
      let timer;
      const capture = () => {
        if (window.isDestroyed()) return;
        const bounds = window.getNormalBounds();
        if (validBounds(bounds)) state.bounds = { ...bounds };
        if (!window.isMinimized() && !window.isFullScreen()) state.maximized = window.isMaximized();
      };
      const save = () => {
        clearTimeout(timer);
        capture();
        try {
          fs.writeFileSync(file + '.tmp', JSON.stringify(state));
          fs.renameSync(file + '.tmp', file);
        } catch (error) { console.warn('ウィンドウ位置を保存できませんでした:', error.message); }
      };
      const schedule = () => { capture(); clearTimeout(timer); timer = setTimeout(save, 300); };
      for (const event of ['move', 'resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) window.on(event, schedule);
      window.on('close', save);
      window.on('closed', () => clearTimeout(timer));
      if (state.maximized === true) window.maximize();
    },
  };
}
module.exports = { restoreBounds, createWindowState };
