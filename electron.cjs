const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;
let accounts;
let dbModule;
let tradovate;
let activeDb     = null;
let activeDbPath = null;
let globalDb     = null;
let globalDbPath = null;
let tdvSyncInterval = null;

async function init() {
  accounts  = require('./accounts.cjs');
  dbModule  = require('./database.cjs');
  tradovate = require('./tradovate.cjs');
}

async function loadActiveDb() {
  const active = accounts.getActiveAccount();
  if (!active) { activeDb = null; activeDbPath = null; return null; }
  activeDbPath = active.dbPath;
  activeDb     = await dbModule.getDb(activeDbPath);
  return activeDb;
}

async function loadGlobalDb() {
  globalDbPath = path.join(app.getPath('userData'), 'global.db');
  globalDb     = await dbModule.getDb(globalDbPath);
  // One-time migration: copy analyses from all account DBs
  const migFlag = path.join(app.getPath('userData'), '.analyses_migrated');
  if (!fs.existsSync(migFlag)) {
    try {
      const { accounts: accs } = accounts.getAllAccounts();
      for (const acc of accs) {
        try {
          const accDb = await dbModule.getDb(acc.dbPath);
          for (const a of dbModule.getDailyAnalyses(accDb)) {
            try { dbModule.upsertDailyAnalysis(globalDb, globalDbPath, a); } catch(_) {}
          }
          for (const a of dbModule.getWeeklyAnalyses(accDb)) {
            try { dbModule.upsertWeeklyAnalysis(globalDb, globalDbPath, a); } catch(_) {}
          }
        } catch(_) {}
      }
    } catch(_) {}
    fs.writeFileSync(migFlag, new Date().toISOString());
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 1000, minHeight: 700,
    backgroundColor: '#070d12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  await init();
  await loadActiveDb();
  await loadGlobalDb();
  registerHandlers();
  createWindow();

  if (app.isPackaged) {
    mainWindow.webContents.on('did-finish-load', () => {
      autoUpdater.checkForUpdatesAndNotify();
    });
  }

  // Start auto-sync for any already-configured Tradovate accounts
  startTdvAutoSync();
});

app.on('window-all-closed', () => {
  stopTdvAutoSync();
  if (process.platform !== 'darwin') app.quit();
});

// ── Tradovate auto-sync (all accounts) ───────────────────────
let isSyncing = false;

async function syncAllTradovateAccounts() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const { accounts: allAccounts } = accounts.getAllAccounts();
    const tdvAccs = allAccounts.filter(a =>
      a.type?.startsWith('tradovate') && a.tradovateConfig?.username
    );
    for (const acc of tdvAccs) {
      try {
        const db = await dbModule.getDb(acc.dbPath);
        const result = await tradovate.syncAccount(acc.tradovateConfig, dbModule.insertTrade, db, acc.dbPath);
        // Persist last sync time on the account
        accounts.updateAccount(acc.id, { lastTdvSync: result.syncedAt });
        mainWindow?.webContents.send('tradovate:synced', { accountId: acc.id, ...result });
      } catch (err) {
        mainWindow?.webContents.send('tradovate:error', { accountId: acc.id, error: err.message });
      }
    }
  } finally {
    isSyncing = false;
  }
}

function startTdvAutoSync() {
  stopTdvAutoSync();
  tdvSyncInterval = setInterval(syncAllTradovateAccounts, 60_000);
}
function stopTdvAutoSync() {
  if (tdvSyncInterval) { clearInterval(tdvSyncInterval); tdvSyncInterval = null; }
}

autoUpdater.on('update-available',  (info) => { mainWindow?.webContents.send('update:available', info); });
autoUpdater.on('update-downloaded', (info) => { mainWindow?.webContents.send('update:downloaded', info); });
autoUpdater.on('error', (err) => { console.error('AutoUpdater error:', err); });

function registerHandlers() {
  ipcMain.handle('update:install', () => { autoUpdater.quitAndInstall(); });

  // ── Account handlers ──────────────────────────────────────
  ipcMain.handle('accounts:getAll',    async () => { try { return { ok: true, data: accounts.getAllAccounts() }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:create',    async (_, acc) => { try { const a = accounts.createAccount(acc); await loadActiveDb(); return { ok: true, data: a }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:update',    async (_, id, u) => { try { return { ok: true, data: accounts.updateAccount(id, u) }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:delete',    async (_, id) => { try { const r = accounts.deleteAccount(id); await loadActiveDb(); return { ok: true, data: r }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:setActive', async (_, id) => { try { const r = accounts.setActiveAccount(id); await loadActiveDb(); return { ok: true, data: r }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:getActive', async () => { try { return { ok: true, data: accounts.getActiveAccount() }; } catch(e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('accounts:types',     async () => { try { return { ok: true, data: accounts.ACCOUNT_TYPES }; } catch(e) { return { ok: false, error: e.message }; } });

  // ── DB handlers ───────────────────────────────────────────
  const dbHandle = (channel, fn) => {
    ipcMain.handle(channel, async (_, ...args) => {
      try {
        if (!activeDb || !activeDbPath) return { ok: false, error: 'Aucun compte actif' };
        return { ok: true, data: fn(activeDb, activeDbPath, ...args) };
      } catch(e) {
        console.error(`[IPC] ${channel}:`, e.message);
        return { ok: false, error: e.message };
      }
    });
  };

  const globalDbHandle = (channel, fn) => {
    ipcMain.handle(channel, async (_, ...args) => {
      try {
        if (!globalDb || !globalDbPath) return { ok: false, error: 'Global DB non initialisée' };
        return { ok: true, data: fn(globalDb, globalDbPath, ...args) };
      } catch(e) {
        console.error(`[IPC] ${channel}:`, e.message);
        return { ok: false, error: e.message };
      }
    });
  };

  dbHandle('db:getAllTrades',           (db) => dbModule.getAllTrades(db));
  dbHandle('db:getTradeById',           (db, _, id) => dbModule.getTradeById(db, id));
  dbHandle('db:insertTrade',            (db, dbp, t) => dbModule.insertTrade(db, dbp, t));
  dbHandle('db:updateTrade',            (db, dbp, id, t) => dbModule.updateTrade(db, dbp, id, t));
  dbHandle('db:deleteTrade',            (db, dbp, id) => dbModule.deleteTrade(db, dbp, id));
  dbHandle('db:getStats',               (db) => dbModule.getStats(db));
  dbHandle('db:importCsvTrades',        (db, dbp, rows) => dbModule.importCsvTrades(db, dbp, rows));
  dbHandle('db:insertEmotionalCheck',   (db, dbp, c) => dbModule.insertEmotionalCheck(db, dbp, c));
  dbHandle('db:getTodayEmotionalCheck', (db) => dbModule.getTodayEmotionalCheck(db));

  // Analysis handlers (global DB — shared across all accounts)
  globalDbHandle('db:getDailyAnalyses',    (db) => dbModule.getDailyAnalyses(db));
  globalDbHandle('db:upsertDailyAnalysis', (db, dbp, a) => dbModule.upsertDailyAnalysis(db, dbp, a));
  globalDbHandle('db:deleteDailyAnalysis', (db, dbp, id) => dbModule.deleteDailyAnalysis(db, dbp, id));
  globalDbHandle('db:getWeeklyAnalyses',   (db) => dbModule.getWeeklyAnalyses(db));
  globalDbHandle('db:upsertWeeklyAnalysis',(db, dbp, a) => dbModule.upsertWeeklyAnalysis(db, dbp, a));
  globalDbHandle('db:deleteWeeklyAnalysis',(db, dbp, id) => dbModule.deleteWeeklyAnalysis(db, dbp, id));

  // ── Tradovate (per-account) ───────────────────────────────────
  ipcMain.handle('tradovate:testConnect', async (_, creds) => {
    try {
      const info = await tradovate.testConnect(creds);
      return { ok: true, data: info };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // Sync a specific account by ID
  ipcMain.handle('tradovate:syncAccount', async (_, accountId) => {
    try {
      const { accounts: all } = accounts.getAllAccounts();
      const acc = all.find(a => a.id === accountId);
      if (!acc) return { ok: false, error: 'Compte introuvable' };
      if (!acc.tradovateConfig?.username) return { ok: false, error: 'Compte non configuré Tradovate' };
      const db = await dbModule.getDb(acc.dbPath);
      const result = await tradovate.syncAccount(acc.tradovateConfig, dbModule.insertTrade, db, acc.dbPath);
      accounts.updateAccount(accountId, { lastTdvSync: result.syncedAt });
      mainWindow?.webContents.send('tradovate:synced', { accountId, ...result });
      return { ok: true, data: result };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // Update credentials on an existing account and re-sync
  ipcMain.handle('tradovate:updateCredentials', async (_, accountId, creds) => {
    try {
      await tradovate.testConnect(creds);
      accounts.updateAccount(accountId, { tradovateConfig: creds });
      const { accounts: all } = accounts.getAllAccounts();
      const acc = all.find(a => a.id === accountId);
      const db  = await dbModule.getDb(acc.dbPath);
      const result = await tradovate.syncAccount(creds, dbModule.insertTrade, db, acc.dbPath);
      accounts.updateAccount(accountId, { lastTdvSync: result.syncedAt });
      return { ok: true, data: result };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── File dialogs ──────────────────────────────────────────
  ipcMain.handle('dialog:openCsv', async () => {
    const result = await dialog.showOpenDialog({ title: 'Importer CSV TopstepX', filters: [{ name: 'CSV', extensions: ['csv'] }], properties: ['openFile'] });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      return { ok: true, content };
    } catch(e) { return { ok: false, error: e.message }; }
  });

  // Open image file dialog → return base64
  ipcMain.handle('dialog:openImage', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Sélectionner une image',
      filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp','gif','bmp'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    try {
      const filePath = result.filePaths[0];
      const data     = fs.readFileSync(filePath);
      const ext      = path.extname(filePath).slice(1).toLowerCase();
      const mime     = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const b64      = `data:${mime};base64,${data.toString('base64')}`;
      const name     = path.basename(filePath);
      return { ok: true, dataUrl: b64, name };
    } catch(e) { return { ok: false, error: e.message }; }
  });

  // Open multiple images
  ipcMain.handle('dialog:openImages', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Sélectionner des images',
      filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp','gif','bmp'] }],
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    try {
      const images = result.filePaths.map(filePath => {
        const data = fs.readFileSync(filePath);
        const ext  = path.extname(filePath).slice(1).toLowerCase();
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        return { dataUrl: `data:${mime};base64,${data.toString('base64')}`, name: path.basename(filePath) };
      });
      return { ok: true, images };
    } catch(e) { return { ok: false, error: e.message }; }
  });
}
