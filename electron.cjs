const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path  = require('path');
const fs    = require('fs');
const http  = require('http');
const https = require('https');
const { autoUpdater } = require('electron-updater');

// ── Load .env ─────────────────────────────────────────────────
(function loadEnv() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(process.env.APPDATA || process.env.HOME || '', 'trading-dashboard', '.env'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
        const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch(_) {}
    break;
  }
})();

// ── Anthropic API ─────────────────────────────────────────────
function callAnthropicApi(messages, systemPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Promise.reject(new Error('NO_API_KEY'));
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });
    const req = https.request({
      hostname: 'api.anthropic.com', port: 443, path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.content?.[0]?.text ?? '');
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

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
let botServer      = null;
let botPort        = 3001;
let botSignals     = [];
let botSignalsFile = null;
let webhookLogs    = []; // max 50 dernières requêtes

function pushWebhookLog(entry) {
  webhookLogs.unshift(entry);
  if (webhookLogs.length > 50) webhookLogs = webhookLogs.slice(0, 50);
  mainWindow?.webContents.send('bot:webhook-log', entry);
}

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
      const from = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 8192) req.destroy(); });
      req.on('end', () => {
        const ts = new Date().toISOString();
        try {
          const signal = JSON.parse(body);
          const logType = signal.type === 'bar' ? 'bar' : signal.type === 'close' ? 'close' : 'signal';
          const logLabel = signal.type === 'bar' ? `BAR ${signal.bot ?? ''}` : signal.type === 'close' ? `CLOSE ${signal.result?.toUpperCase() ?? ''} ${signal.bot ?? ''}` : `${(signal.signal ?? signal.direction ?? '').toUpperCase() || 'SIGNAL'} ${signal.bot ?? ''} ${signal.symbol ?? ''}`;
          pushWebhookLog({ ts, from, type: logType, label: logLabel.trim(), status: 200 });

          // ── Signal de fermeture automatique (TP/SL détecté par TV) ──
          if (signal.type === 'close') {
            const outcome  = signal.result; // 'win' | 'loss' | 'be'
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
              // Filtre principal : même bot
              let opens = botSignals.filter(s =>
                !s.type && !s._outcome &&
                (!botName || s.bot === botName) &&
                (s.tp || s.tp2 || s.tp1) && s.sl && (s.signal || s.direction)
              );
              // Fallback : signaux sans champ bot (anciens signaux)
              if (opens.length === 0 && botName) {
                opens = botSignals.filter(s =>
                  !s.type && !s._outcome && !s.bot &&
                  (s.tp || s.tp2 || s.tp1) && s.sl && (s.signal || s.direction)
                );
              }
              let changed = false;
              for (const sig of opens) {
                const tp  = parseFloat(sig.tp) || parseFloat(sig.tp2) || parseFloat(sig.tp1);
                const sl  = parseFloat(sig.sl);
                const dir = (sig.signal || sig.direction || '').toUpperCase();
                let outcome = null;
                if (dir === 'LONG') {
                  if (h >= tp)       outcome = 'win';
                  else if (l <= sl)  outcome = 'loss';
                } else if (dir === 'SHORT') {
                  if (l <= tp)       outcome = 'win';
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
          console.error('[webhook] JSON parse error:', e.message, '| body:', body.slice(0, 300));
          pushWebhookLog({ ts: new Date().toISOString(), from, type: 'error', label: `400 JSON INVALIDE — ${body.slice(0, 60)}`, status: 400 });
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON', body: body.slice(0, 200) }));
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
    title: `Trading Dashboard ${app.getVersion()}`,
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
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle(`Trading Dashboard ${app.getVersion()}`);
  });
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
  ipcMain.handle('bot:getSignals',     () => ({ ok: true, data: botSignals }));
  ipcMain.handle('bot:clearSignals',   () => { botSignals = []; saveBotSignalsToFile(); return { ok: true }; });
  ipcMain.handle('bot:getPort',        () => ({ ok: true, data: botPort }));
  ipcMain.handle('bot:getWebhookLogs', () => ({ ok: true, data: webhookLogs }));
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

  // ── AI Coach handlers ─────────────────────────────────────────
  ipcMain.handle('ai:hasKey', () => ({ ok: true, data: !!process.env.ANTHROPIC_API_KEY }));

  ipcMain.handle('ai:chat', async (_, messages, systemPrompt) => {
    try {
      const text = await callAnthropicApi(messages, systemPrompt);
      return { ok: true, data: text };
    } catch(e) {
      if (e.message === 'NO_API_KEY') return { ok: false, error: 'no_api_key' };
      return { ok: false, error: e.message };
    }
  });

  dbHandle('ai:getMessages',  (db) => dbModule.getAiMessages(db));
  dbHandle('ai:addMessage',   (db, dbp, msg) => dbModule.insertAiMessage(db, dbp, msg));
  dbHandle('ai:clearHistory', (db, dbp) => dbModule.clearAiConversations(db, dbp));

  // ── Market Data ───────────────────────────────────────────
  ipcMain.handle('market:getOHLCV', async (_, pair, date, interval) => {
    try {
      const SYMBOL_MAP = {
        MNQ:'NQ=F', NQ:'NQ=F', MES:'ES=F', ES:'ES=F',
        MGC:'GC=F', GC:'GC=F', MCL:'CL=F', CL:'CL=F',
        M2K:'RTY=F', RTY:'RTY=F', YM:'YM=F', MYM:'YM=F',
        NASDAQ:'NQ=F', SP500:'ES=F', SI:'SI=F', DAX:'%5EGDAXI',
      };
      const symbol  = SYMBOL_MAP[(pair||'').toUpperCase()] ?? pair;
      const dayStart = Math.floor(new Date(date + 'T06:00:00Z').getTime() / 1000);
      const dayEnd   = Math.floor(new Date(date + 'T23:59:59Z').getTime() / 1000);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&period1=${dayStart}&period2=${dayEnd}&events=`;
      const raw = await new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, res => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
      });
      const result = raw?.chart?.result?.[0];
      if (!result) return { ok: false, error: 'Symbole introuvable sur Yahoo Finance' };
      const ts = result.timestamp ?? [];
      const q  = result.indicators?.quote?.[0] ?? {};
      const candles = ts
        .map((t, i) => ({ ts: t, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i] }))
        .filter(c => c.open != null && c.high != null && c.low != null && c.close != null);
      return { ok: true, data: candles };
    } catch(e) {
      return { ok: false, error: e.message };
    }
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
