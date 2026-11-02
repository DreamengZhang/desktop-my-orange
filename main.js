const { app, BrowserWindow, screen, ipcMain, Menu, Tray, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const ASPECT = 751 / 512;
const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 120;
const MAX_WIDTH = 520;
const SIZE_STEP = 28;

let win = null;
let tray = null;
let dragOffset = null;
let petWidth = DEFAULT_WIDTH;

if (process.platform === 'win32') {
  app.disableHardwareAcceleration();
}

function stateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function sizeFor(nextWidth) {
  const width = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, nextWidth)));
  return { width, height: Math.round(width * ASPECT) };
}

function readState() {
  try {
    const data = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (Number.isFinite(data.width)) petWidth = sizeFor(data.width).width;
    return data;
  } catch {
    return null;
  }
}

function defaultPosition() {
  const size = sizeFor(petWidth);
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + area.width - size.width - 36,
    y: area.y + area.height - size.height - 36,
  };
}

function positionOnScreen(x, y) {
  const size = sizeFor(petWidth);
  const centerX = x + size.width / 2;
  const centerY = y + size.height / 2;
  const visible = screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return centerX >= area.x && centerX <= area.x + area.width
      && centerY >= area.y && centerY <= area.y + area.height;
  });
  return visible ? { x, y } : defaultPosition();
}

function saveState() {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  const [width] = win.getSize();
  petWidth = width;
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify({ x, y, width }));
}

function applySize(nextWidth) {
  if (!win || win.isDestroyed()) return;
  const size = sizeFor(nextWidth);
  const bounds = win.getBounds();
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  petWidth = size.width;
  win.setBounds({
    x: Math.round(centerX - size.width / 2),
    y: Math.round(centerY - size.height / 2),
    width: size.width,
    height: size.height,
  });
  saveState();
}

function trayFile() {
  return path.join(__dirname, 'src', 'assets', 'tray.png');
}

function createTrayIcon() {
  return nativeImage.createFromPath(trayFile()).resize({ width: 32, height: 32 });
}

function resetPosition() {
  if (!win || win.isDestroyed()) return;
  const pos = defaultPosition();
  win.setPosition(pos.x, pos.y);
  saveState();
}

function popupMenu() {
  if (!win || win.isDestroyed()) return;
  const menu = Menu.buildFromTemplate([
    { label: '放大', click: () => applySize(petWidth + SIZE_STEP) },
    { label: '缩小', click: () => applySize(petWidth - SIZE_STEP) },
    { label: '默认大小', click: () => applySize(DEFAULT_WIDTH) },
    { type: 'separator' },
    { label: '重置到右下角', click: () => resetPosition() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  menu.popup({ window: win });
}

function createWindow() {
  const saved = readState();
  const pos = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
    ? positionOnScreen(saved.x, saved.y)
    : defaultPosition();
  const size = sizeFor(petWidth);

  win = new BrowserWindow({
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    width: size.width,
    height: size.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    icon: trayFile(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.webContents.on('context-menu', (event) => event.preventDefault());
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    win = null;
  });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('卜卜');
  tray.on('click', () => {
    if (win && !win.isDestroyed()) win.show();
  });
  tray.on('right-click', () => popupMenu());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) win.show();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('local.desktop.my-orange');
    createWindow();
    createTray();
  });
}

app.on('before-quit', () => {
  saveState();
  if (tray) tray.destroy();
});

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.handle('pointer', () => {
  if (!win || win.isDestroyed()) return null;
  return {
    cursor: screen.getCursorScreenPoint(),
    bounds: win.getContentBounds(),
  };
});

ipcMain.on('set-ignore', (event, ignore) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  if (!target || target.isDestroyed()) return;
  if (ignore) target.setIgnoreMouseEvents(true, { forward: true });
  else target.setIgnoreMouseEvents(false);
});

ipcMain.on('drag-start', (event) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  if (!target || target.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const [x, y] = target.getPosition();
  dragOffset = { x: cursor.x - x, y: cursor.y - y };
  target.setIgnoreMouseEvents(false);
});

ipcMain.on('drag-move', (event) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  if (!target || target.isDestroyed() || !dragOffset) return;
  const cursor = screen.getCursorScreenPoint();
  target.setPosition(
    Math.round(cursor.x - dragOffset.x),
    Math.round(cursor.y - dragOffset.y),
  );
});

ipcMain.on('drag-end', () => {
  dragOffset = null;
  saveState();
});

ipcMain.on('show-menu', () => popupMenu());
ipcMain.on('resize-step', (_event, direction) => {
  applySize(petWidth + direction * SIZE_STEP);
});
