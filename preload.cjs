const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('db', {
  getAllTrades:            ()           => ipcRenderer.invoke('db:getAllTrades'),
  getTradesForPath:       (dbPath)     => ipcRenderer.invoke('db:getTradesForPath', dbPath),
  getTradeById:           (id)      => ipcRenderer.invoke('db:getTradeById', id),
  insertTrade:            (t)       => ipcRenderer.invoke('db:insertTrade', t),
  updateTrade:            (id, t)   => ipcRenderer.invoke('db:updateTrade', id, t),
  deleteTrade:            (id)      => ipcRenderer.invoke('db:deleteTrade', id),
  getStats:               ()        => ipcRenderer.invoke('db:getStats'),
  importCsvTrades:        (rows)    => ipcRenderer.invoke('db:importCsvTrades', rows),
  insertEmotionalCheck:   (c)       => ipcRenderer.invoke('db:insertEmotionalCheck', c),
  getTodayEmotionalCheck: ()        => ipcRenderer.invoke('db:getTodayEmotionalCheck'),
  // Analysis
  getDailyAnalyses:       ()        => ipcRenderer.invoke('db:getDailyAnalyses'),
  upsertDailyAnalysis:    (a)       => ipcRenderer.invoke('db:upsertDailyAnalysis', a),
  deleteDailyAnalysis:    (id)      => ipcRenderer.invoke('db:deleteDailyAnalysis', id),
  getWeeklyAnalyses:      ()        => ipcRenderer.invoke('db:getWeeklyAnalyses'),
  upsertWeeklyAnalysis:   (a)       => ipcRenderer.invoke('db:upsertWeeklyAnalysis', a),
  deleteWeeklyAnalysis:   (id)      => ipcRenderer.invoke('db:deleteWeeklyAnalysis', id),
  // Bilan psychologique quotidien
  getMentalReport:        (date)              => ipcRenderer.invoke('db:getMentalReport', date),
  getMentalReportsRange:  (startDate, endDate) => ipcRenderer.invoke('db:getMentalReportsRange', startDate, endDate),
  saveMentalReport:       (date, emotion, description) => ipcRenderer.invoke('db:saveMentalReport', date, emotion, description),
  // Bilan psychologique hebdomadaire
  getWeeklyReport:        (weekStart)                    => ipcRenderer.invoke('db:getWeeklyReport', weekStart),
  saveWeeklyReport:       (weekStart, trend, description, extra) => ipcRenderer.invoke('db:saveWeeklyReport', weekStart, trend, description, extra),
});

contextBridge.exposeInMainWorld('accounts', {
  getAll:    ()            => ipcRenderer.invoke('accounts:getAll'),
  create:    (acc)         => ipcRenderer.invoke('accounts:create', acc),
  update:    (id, updates) => ipcRenderer.invoke('accounts:update', id, updates),
  delete:    (id)          => ipcRenderer.invoke('accounts:delete', id),
  setActive: (id)          => ipcRenderer.invoke('accounts:setActive', id),
  getActive: ()            => ipcRenderer.invoke('accounts:getActive'),
  getTypes:  ()            => ipcRenderer.invoke('accounts:types'),
});

contextBridge.exposeInMainWorld('electron', {
  openCsvDialog:       () => ipcRenderer.invoke('dialog:openCsv'),
  openImageDialog:     () => ipcRenderer.invoke('dialog:openImage'),
  openImagesDialog:    () => ipcRenderer.invoke('dialog:openImages'),
  onUpdateDownloaded:  (cb) => ipcRenderer.on('update:downloaded', (_, info) => cb(info)),
  installUpdate:       () => ipcRenderer.invoke('update:install'),
});

contextBridge.exposeInMainWorld('shell', {
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});

contextBridge.exposeInMainWorld('ai', {
  hasKey:       ()           => ipcRenderer.invoke('ai:hasKey'),
  // chat() résout toujours { ok, data } ou { ok:false, error: 'unauthenticated'|'subscription_inactive'|'quota_exceeded'|string, message?, resetDate?, used?, limit? }
  chat:         (msgs, sys)  => ipcRenderer.invoke('ai:chat', msgs, sys),
  getMessages:  ()           => ipcRenderer.invoke('ai:getMessages'),
  addMessage:   (msg)        => ipcRenderer.invoke('ai:addMessage', msg),
  clearHistory: ()           => ipcRenderer.invoke('ai:clearHistory'),
});

contextBridge.exposeInMainWorld('globalProfile', {
  // Résolvent toujours { ok, data } ou { ok:false, error: 'unauthenticated'|'subscription_inactive'|'quota_exceeded'|string, message?, resetDate?, used?, limit? }
  getLatest: ()              => ipcRenderer.invoke('globalProfile:getLatest'),
  generate:  (stats, force)  => ipcRenderer.invoke('globalProfile:generate', stats, force),
});

contextBridge.exposeInMainWorld('auth', {
  register:         (email, password) => ipcRenderer.invoke('auth:register', email, password),
  login:             (email, password) => ipcRenderer.invoke('auth:login', email, password),
  logout:            ()                => ipcRenderer.invoke('auth:logout'),
  getSession:        ()                => ipcRenderer.invoke('auth:getSession'),
  onSessionExpired:  (cb)              => ipcRenderer.on('auth:sessionExpired', () => cb()),
});

contextBridge.exposeInMainWorld('demo', {
  getEmotionalReport: () => ipcRenderer.invoke('demo:getEmotionalReport'),
  getTraitCalendar:   () => ipcRenderer.invoke('demo:getTraitCalendar'),
});

contextBridge.exposeInMainWorld('market', {
  getOHLCV:            (pair, date, tf) => ipcRenderer.invoke('market:getOHLCV', pair, date, tf),
  getCandles:          (from, to, tf, sym)      => ipcRenderer.invoke('market:getCandles', from, to, tf, sym),
  getHistoricalCandles:(asset, days)           => ipcRenderer.invoke('market:getHistoricalCandles', asset, days),
  getAiAnalyses:       ()                       => ipcRenderer.invoke('market:getAiAnalyses'),
  generateAiAnalysis:  (type, date, asset)      => ipcRenderer.invoke('market:generateAiAnalysis', type, date, asset),
  deleteAiAnalysis:    (id)             => ipcRenderer.invoke('market:deleteAiAnalysis', id),
  onAnalysisGenerated: (cb)             => ipcRenderer.on('market:analysisGenerated', (_, d) => cb(d)),
});

contextBridge.exposeInMainWorld('budget', {
  getCategories:    ()                         => ipcRenderer.invoke('budget:getCategories'),
  addCategory:      (cat)                      => ipcRenderer.invoke('budget:addCategory', cat),
  updateCategory:   (id, cat)                  => ipcRenderer.invoke('budget:updateCategory', id, cat),
  deleteCategory:   (id)                       => ipcRenderer.invoke('budget:deleteCategory', id),
  getTransactions:  (monthKey)                 => ipcRenderer.invoke('budget:getTransactions', monthKey),
  addTransaction:   (tx)                       => ipcRenderer.invoke('budget:addTransaction', tx),
  deleteTransaction:(id)                       => ipcRenderer.invoke('budget:deleteTransaction', id),
  getSettings:      (monthKey)                 => ipcRenderer.invoke('budget:getSettings', monthKey),
  getLatestSettings:()                         => ipcRenderer.invoke('budget:getLatestSettings'),
  updateSettings:   (monthKey, income, targets)=> ipcRenderer.invoke('budget:updateSettings', monthKey, income, targets),
});

contextBridge.exposeInMainWorld('bot', {
  getSignals:   ()       => ipcRenderer.invoke('bot:getSignals'),
  clearSignals: ()       => ipcRenderer.invoke('bot:clearSignals'),
  getPort:      ()       => ipcRenderer.invoke('bot:getPort'),
  setPort:      (port)   => ipcRenderer.invoke('bot:setPort', port),
  getStats:      ()           => ipcRenderer.invoke('bot:getStats'),
  updateOutcome: (id, outcome) => ipcRenderer.invoke('bot:updateOutcome', id, outcome),
  getWebhookLogs:  ()   => ipcRenderer.invoke('bot:getWebhookLogs'),
  onSignal:        (cb) => ipcRenderer.on('bot:signal',          (_, d) => cb(d)),
  onServerReady:   (cb) => ipcRenderer.on('bot:server-ready',    (_, d) => cb(d)),
  onServerError:   (cb) => ipcRenderer.on('bot:server-error',    (_, d) => cb(d)),
  onOutcomeUpdate: (cb) => ipcRenderer.on('bot:outcome-update',  (_, d) => cb(d)),
  onWebhookLog:    (cb) => ipcRenderer.on('bot:webhook-log',     (_, d) => cb(d)),
  offSignal:       (cb) => ipcRenderer.removeListener('bot:signal', cb),
  offOutcomeUpdate:(cb) => ipcRenderer.removeListener('bot:outcome-update', cb),
  offWebhookLog:   (cb) => ipcRenderer.removeListener('bot:webhook-log', cb),
});
