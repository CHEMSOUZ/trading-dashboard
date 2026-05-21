const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

const ACCOUNTS_FILE = path.join(app.getPath('userData'), 'accounts.json');

const ACCOUNT_TYPES = {
  'topstep_50k':  { label: 'Topstep Express 50K',  size: 50000,  maxLoss: 2000, dailyLoss: 1000 },
  'topstep_100k': { label: 'Topstep Express 100K', size: 100000, maxLoss: 3000, dailyLoss: 2000 },
  'topstep_150k': { label: 'Topstep Express 150K', size: 150000, maxLoss: 4500, dailyLoss: 3000 },
  'perso':        { label: 'Compte Personnel',      size: null,   maxLoss: null, dailyLoss: null },
  'autre':        { label: 'Autre compte',          size: null,   maxLoss: null, dailyLoss: null },
};

const COLORS = ['#00ff88','#00aaff','#ff6644','#aa88ff','#ffcc00','#ff4488','#44ffcc'];

// ── Load / Save ───────────────────────────────────────────────
function loadAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
    }
  } catch {}
  return { accounts: [], activeId: null };
}

function saveAccounts(data) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2));
}

// ── DB path for account ───────────────────────────────────────
function getDbPath(accountId) {
  return path.join(app.getPath('userData'), `trading_${accountId}.db`);
}

// ── CRUD ──────────────────────────────────────────────────────
function getAllAccounts() {
  return loadAccounts();
}

function createAccount({ name, type, color, brokerAccountId }) {
  const data = loadAccounts();
  const id   = `acc_${Date.now()}`;
  const typeInfo = ACCOUNT_TYPES[type] ?? ACCOUNT_TYPES['autre'];
  const usedColors = data.accounts.map(a => a.color);
  const autoColor  = color ?? COLORS.find(c => !usedColors.includes(c)) ?? COLORS[0];

  const account = {
    id,
    name,
    type,
    color: autoColor,
    brokerAccountId: brokerAccountId ?? '',
    typeInfo,
    dbPath: getDbPath(id),
    createdAt: new Date().toISOString(),
  };

  data.accounts.push(account);
  if (!data.activeId) data.activeId = id;
  saveAccounts(data);
  return account;
}

function updateAccount(id, updates) {
  const data = loadAccounts();
  const idx  = data.accounts.findIndex(a => a.id === id);
  if (idx === -1) throw new Error('Account not found');
  data.accounts[idx] = { ...data.accounts[idx], ...updates };
  saveAccounts(data);
  return data.accounts[idx];
}

function deleteAccount(id) {
  const data = loadAccounts();
  const acc  = data.accounts.find(a => a.id === id);
  if (!acc) throw new Error('Account not found');

  // Delete DB file
  if (fs.existsSync(acc.dbPath)) fs.unlinkSync(acc.dbPath);

  data.accounts = data.accounts.filter(a => a.id !== id);
  if (data.activeId === id) {
    data.activeId = data.accounts[0]?.id ?? null;
  }
  saveAccounts(data);
  return { deleted: true };
}

function setActiveAccount(id) {
  const data = loadAccounts();
  if (!data.accounts.find(a => a.id === id)) throw new Error('Account not found');
  data.activeId = id;
  saveAccounts(data);
  return { activeId: id };
}

function getActiveAccount() {
  const data = loadAccounts();
  return data.accounts.find(a => a.id === data.activeId) ?? null;
}

module.exports = {
  ACCOUNT_TYPES,
  getAllAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  setActiveAccount,
  getActiveAccount,
  getDbPath,
};
