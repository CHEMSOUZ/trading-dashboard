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
  setKey:       (key)        => ipcRenderer.invoke('ai:setKey', key),
  chat:         (msgs, sys)  => ipcRenderer.invoke('ai:chat', msgs, sys),
  getMessages:  ()           => ipcRenderer.invoke('ai:getMessages'),
  addMessage:   (msg)        => ipcRenderer.invoke('ai:addMessage', msg),
  clearHistory: ()           => ipcRenderer.invoke('ai:clearHistory'),
});

contextBridge.exposeInMainWorld('market', {
  getOHLCV:            (pair, date, tf) => ipcRenderer.invoke('market:getOHLCV', pair, date, tf),
  getAiAnalyses:       ()               => ipcRenderer.invoke('market:getAiAnalyses'),
  generateAiAnalysis:  (type, date)     => ipcRenderer.invoke('market:generateAiAnalysis', type, date),
  deleteAiAnalysis:    (id)             => ipcRenderer.invoke('market:deleteAiAnalysis', id),
  onAnalysisGenerated: (cb)             => ipcRenderer.on('market:analysisGenerated', (_, d) => cb(d)),
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
