const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

const ACCOUNTS_FILE = path.join(app.getPath('userData'), 'accounts.json');

const ACCOUNT_TYPES = {
  // ── Topstep Combine (évaluation) ─────────────────────────────
  'topstep_50k':       { label: 'Topstep Combine 50K',   size: 50000,  maxLoss: 2000, dailyLoss: 1000 },
  'topstep_100k':      { label: 'Topstep Combine 100K',  size: 100000, maxLoss: 3000, dailyLoss: 2000 },
  'topstep_150k':      { label: 'Topstep Combine 150K',  size: 150000, maxLoss: 4500, dailyLoss: 3000 },
  // ── Topstep Express Funded (live) ────────────────────────────
  'topstep_ef_50k':    { label: 'Topstep Funded 50K',   size: 50000,  maxLoss: 2000, dailyLoss: 1000 },
  'topstep_ef_100k':   { label: 'Topstep Funded 100K',  size: 100000, maxLoss: 3000, dailyLoss: 2000 },
  'topstep_ef_150k':   { label: 'Topstep Funded 150K',  size: 150000, maxLoss: 4500, dailyLoss: 3000 },
  // ── LucidFlex Evaluation (pas de DLL) ────────────────────────
  'lucid_eval_25k':    { label: 'LucidFlex Eval 25K',   size: 25000,  maxLoss: 1000, dailyLoss: null, profitTarget: 1250, consistencyPct: 0.50 },
  'lucid_eval_50k':    { label: 'LucidFlex Eval 50K',   size: 50000,  maxLoss: 2000, dailyLoss: null, profitTarget: 3000, consistencyPct: 0.50 },
  'lucid_eval_100k':   { label: 'LucidFlex Eval 100K',  size: 100000, maxLoss: 3000, dailyLoss: null, profitTarget: 6000, consistencyPct: 0.50 },
  'lucid_eval_150k':   { label: 'LucidFlex Eval 150K',  size: 150000, maxLoss: 4500, dailyLoss: null, profitTarget: 9000, consistencyPct: 0.50 },
  // ── LucidFlex Funded (live) ───────────────────────────────────
  'lucid_funded_25k':  { label: 'LucidFlex Funded 25K',  size: 25000,  maxLoss: 1000, dailyLoss: 1000, profitTarget: null, consistencyPct: null },
  'lucid_funded_50k':  { label: 'LucidFlex Funded 50K',  size: 50000,  maxLoss: 2500, dailyLoss: 2000, profitTarget: null, consistencyPct: null },
  'lucid_funded_100k': { label: 'LucidFlex Funded 100K', size: 100000, maxLoss: 3000, dailyLoss: 3000, profitTarget: null, consistencyPct: null },
  'lucid_funded_150k': { label: 'LucidFlex Funded 150K', size: 150000, maxLoss: 4500, dailyLoss: 4500, profitTarget: null, consistencyPct: null },
  // ── Topstep Express Funded Consistency ───────────────────────
  'topstep_cons_50k':  { label: 'Topstep Funded Consistency 50K',  size: 50000,  maxLoss: 2000, dailyLoss: 1000 },
  'topstep_cons_100k': { label: 'Topstep Funded Consistency 100K', size: 100000, maxLoss: 3000, dailyLoss: 2000 },
  'topstep_cons_150k': { label: 'Topstep Funded Consistency 150K', size: 150000, maxLoss: 4500, dailyLoss: 3000 },
  // ── Topstep Live Funded ───────────────────────────────────────
  'topstep_live_50k':  { label: 'Topstep Live Funded 50K',  size: 50000,  maxLoss: null, dailyLoss: 1000 },
  'topstep_live_100k': { label: 'Topstep Live Funded 100K', size: 100000, maxLoss: null, dailyLoss: 2000 },
  'topstep_live_150k': { label: 'Topstep Live Funded 150K', size: 150000, maxLoss: null, dailyLoss: 3000 },
  // ── Génériques ───────────────────────────────────────────────
  'tradovate_live': { label: 'Tradovate Live', size: null,   maxLoss: null, dailyLoss: null },
  'tradovate_demo': { label: 'Tradovate Demo', size: null,   maxLoss: null, dailyLoss: null },
  'perso':          { label: 'Compte Personnel', size: null, maxLoss: null, dailyLoss: null },
  'autre':          { label: 'Autre compte',     size: null, maxLoss: null, dailyLoss: null },
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
  const data = loadAccounts();
  // Auto-repair: fix stale typeInfo for accounts whose type is now known
  let changed = false;
  for (const acc of data.accounts) {
    const correct = ACCOUNT_TYPES[acc.type];
    if (correct && (!acc.typeInfo?.label || acc.typeInfo.label === 'Autre compte') && correct.label !== 'Autre compte') {
      acc.typeInfo = correct;
      changed = true;
    }
  }
  if (changed) saveAccounts(data);
  return data;
}

function createAccount({ name, type, color, brokerAccountId, tradovateConfig }) {
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
    ...(tradovateConfig ? { tradovateConfig } : {}),
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
  // Auto-update typeInfo when type changes
  if (updates.type && updates.type !== data.accounts[idx].type) {
    updates.typeInfo = ACCOUNT_TYPES[updates.type] ?? ACCOUNT_TYPES['autre'];
  }
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
