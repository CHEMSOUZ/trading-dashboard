const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('db', {
  getAllTrades:            ()           => ipcRenderer.invoke('db:getAllTrades'),
  getTradeById:           (id)         => ipcRenderer.invoke('db:getTradeById', id),
  insertTrade:            (trade)      => ipcRenderer.invoke('db:insertTrade', trade),
  updateTrade:            (id, t)      => ipcRenderer.invoke('db:updateTrade', id, t),
  deleteTrade:            (id)         => ipcRenderer.invoke('db:deleteTrade', id),
  getStats:               ()           => ipcRenderer.invoke('db:getStats'),
  importCsvTrades:        (rows)       => ipcRenderer.invoke('db:importCsvTrades', rows),
  insertEmotionalCheck:   (c)          => ipcRenderer.invoke('db:insertEmotionalCheck', c),
  getTodayEmotionalCheck: ()           => ipcRenderer.invoke('db:getTodayEmotionalCheck'),
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
  openCsvDialog: () => ipcRenderer.invoke('dialog:openCsv'),
});
