const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const http = require('http');
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;
let accounts;
let dbModule;
let activeDb     = null;
let activeDbPath = null;
let globalDb     = null;
let globalDbPath = null;

// ── Bot webhook server ────────────────────────────────────────
let botServer    = null;
let botPort      = 3001;
let botSignals   = [];
let botSignalsFile = null;

function loadBotSignalsFromFile() {
  try {
    if (botSignalsFile && fs.existsSync(botSignalsFile)) {
      const raw = fs.readFileSync(botSignalsFile, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch(e) { console.error('[Bot] Erreur chargement historique:', e.message); }
  return [];
}

function saveBotSignalsToFile() {
  try {
    if (botSignalsFile) fs.writeFileSync(botSignalsFile, JSON.stringify(botSignals), 'utf-8');
  } catch(e) { console.error('[Bot] Erreur sauvegarde historique:', e.message); }
}

function startBotServer(port) {
  if (botServer) { try { botServer.close(); } catch(_) {} }
  botPort = port || 3001;
  botServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method === 'POST' && req.url === '/webhook') {
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 8192) req.destroy(); });
      req.on('end', () => {
        try {
          const signal = JSON.parse(body);

          // ── Signal de fermeture automatique (TP/SL détecté par TV) ──
          if (signal.type === 'close') {
            const outcome  = signal.result; // 'win' | 'loss'
            const botName  = signal.bot;
            const target   = botSignals.find(s =>
              !s.type && !s._outcome &&
              (!botName || s.bot === botName)
            );
            if (target) {
              target._outcome     = outcome;
              target._autoOutcome = true;
              saveBotSignalsToFile();
              mainWindow?.webContents.send('bot:outcome-update', {
                id: String(target._id), outcome, auto: true,
              });
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, matched: !!target }));
            return;
          }

          // ── Données de barre — détection TP/SL côté backend ──────
          if (signal.type === 'bar') {
            const h       = parseFloat(signal.h);
            const l       = parseFloat(signal.l);
            const botName = signal.bot;
            if (!isNaN(h) && !isNaN(l)) {
              const opens = botSignals.filter(s =>
                !s.type && !s._outcome &&
                (!botName || s.bot === botName) &&
                s.tp2 && s.sl && (s.signal || s.direction)
              );
              let changed = false;
              for (const sig of opens) {
                const tp2 = parseFloat(sig.tp2);
                const sl  = parseFloat(sig.sl);
                const dir = (sig.signal || sig.direction || '').toUpperCase();
                let outcome = null;
                if (dir === 'LONG') {
                  if (h >= tp2)      outcome = 'win';
                  else if (l <= sl)  outcome = 'loss';
                } else if (dir === 'SHORT') {
                  if (l <= tp2)      outcome = 'win';
                  else if (h >= sl)  outcome = 'loss';
                }
                if (outcome) {
                  sig._outcome     = outcome;
                  sig._autoOutcome = true;
                  changed = true;
                  mainWindow?.webContents.send('bot:outcome-update', {
                    id: String(sig._id), outcome, auto: true,
                  });
                }
              }
              if (changed) saveBotSignalsToFile();
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // ── Signal d'entrée normal ──
          signal._id         = Date.now() + Math.random();
          signal._receivedAt = new Date().toISOString();
          botSignals.unshift(signal);
          if (botSignals.length > 2000) botSignals = botSignals.slice(0, 2000);
          saveBotSignalsToFile();
          mainWindow?.webContents.send('bot:signal', signal);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
    } else {
      res.writeHead(404); res.end();
    }
  });
  botServer.on('error', (e) => {
    console.error('[Bot] Server error:', e.message);
    mainWindow?.webContents.send('bot:server-error', e.message);
  });
  botServer.listen(botPort, '127.0.0.1', () => {
    console.log(`[Bot] Webhook server listening on port ${botPort}`);
    mainWindow?.webContents.send('bot:server-ready', botPort);
  });
}

async function init() {
  accounts = require('./accounts.cjs');
  dbModule = require('./database.cjs');
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

  const distIndex = path.join(__dirname, 'dist', 'index.html');
  const useVite   = !app.isPackaged && !fs.existsSync(distIndex);
  if (useVite) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(distIndex);
  }
}

app.whenReady().then(async () => {
  await init();
  await loadActiveDb();
  await loadGlobalDb();
  registerHandlers();
  botSignalsFile = path.join(app.getPath('userData'), 'bot_signals.json');
  botSignals     = loadBotSignalsFromFile();
  createWindow();
  startBotServer(3001);

  if (app.isPackaged) {
    mainWindow.webContents.on('did-finish-load', () => {
      autoUpdater.checkForUpdatesAndNotify();
    });
  }

});

app.on('window-all-closed', () => {
  if (botServer) { try { botServer.close(); } catch(_) {} }
  if (process.platform !== 'darwin') app.quit();
});

autoUpdater.on('update-available',  (info) => { mainWindow?.webContents.send('update:available', info); });
autoUpdater.on('update-downloaded', (info) => { mainWindow?.webContents.send('update:downloaded', info); });
autoUpdater.on('error', (err) => { console.error('AutoUpdater error:', err); });

function registerHandlers() {
  ipcMain.handle('update:install', () => { autoUpdater.quitAndInstall(); });

  // ── Shell handlers ────────────────────────────────────────
  ipcMain.handle('shell:openExternal', (_, url) => { shell.openExternal(url); return { ok: true }; });

  // ── Bot handlers ──────────────────────────────────────────
  ipcMain.handle('bot:getSignals',  () => ({ ok: true, data: botSignals }));
  ipcMain.handle('bot:clearSignals',() => { botSignals = []; saveBotSignalsToFile(); return { ok: true }; });
  ipcMain.handle('bot:getPort',     () => ({ ok: true, data: botPort }));
  ipcMain.handle('bot:setPort',     (_, port) => {
    try { startBotServer(parseInt(port) || 3001); return { ok: true, data: botPort }; }
    catch(e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('bot:updateOutcome', (_, id, outcome) => {
    const sig = botSignals.find(s => String(s._id) === String(id));
    if (!sig) return { ok: false, error: 'Signal introuvable' };
    if (outcome === null) delete sig._outcome; else sig._outcome = outcome;
    saveBotSignalsToFile();
    return { ok: true };
  });

  ipcMain.handle('bot:getStats',    () => {
    const total   = botSignals.length;
    const longs   = botSignals.filter(s => (s.signal ?? s.direction ?? '').toUpperCase() === 'LONG').length;
    const shorts  = total - longs;
    const oldest  = botSignals.length > 0 ? botSignals[botSignals.length - 1]._receivedAt : null;
    const newest  = botSignals.length > 0 ? botSignals[0]._receivedAt : null;
    const bots    = [...new Set(botSignals.map(s => s.bot).filter(Boolean))];
    return { ok: true, data: { total, longs, shorts, oldest, newest, bots } };
  });

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
