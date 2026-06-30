const fs   = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo_data.json'), 'utf-8'));

function pnlOf(t) { return t.result_net ?? t.result ?? 0; }
function round2(n) { return Math.round(n * 100) / 100; }

// Miroir de database.cjs::getStats, mais opérant sur le tableau JS du dataset
// démo plutôt que sur une requête SQL — mêmes formules, même arrondi.
function computeStats(trades) {
  const total    = trades.length;
  const wins     = trades.filter(t => pnlOf(t) > 0);
  const losses   = trades.filter(t => pnlOf(t) < 0);
  const be       = trades.filter(t => pnlOf(t) === 0).length;
  const totalPnl = trades.reduce((s, t) => s + pnlOf(t), 0);
  const grossWin = wins.reduce((s, t) => s + pnlOf(t), 0);
  const grossLoss= Math.abs(losses.reduce((s, t) => s + pnlOf(t), 0));
  const rated    = trades.filter(t => t.rr != null);
  const avgRR    = rated.length > 0 ? rated.reduce((s, t) => s + t.rr, 0) / rated.length : 0;
  const avgWin   = wins.length   > 0 ? grossWin  / wins.length   : 0;
  const avgLoss  = losses.length > 0 ? grossLoss / losses.length : 0;
  const totalFees= trades.reduce((s, t) => s + (t.fees ?? 0) + (t.commissions ?? 0), 0);
  const winrate  = total > 0 ? (wins.length / total) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;

  const recentSorted = [...trades].sort((a, b) =>
    (b.date + (b.entered_at ?? '')).localeCompare(a.date + (a.entered_at ?? '')));
  const recent = recentSorted.slice(0, 50).map(pnlOf);
  let streak = 0;
  if (recent.length > 0) {
    const firstPos = recent[0] > 0;
    for (const pnl of recent) { if ((pnl > 0) === firstPos) streak++; else break; }
    if (!firstPos) streak = -streak;
  }

  const ascSorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  let peak = 0, cum = 0, maxDD = 0;
  for (const t of ascSorted) {
    cum += pnlOf(t);
    if (cum > peak) peak = cum;
    const dd = peak - cum; if (dd > maxDD) maxDD = dd;
  }

  const byPnlDesc  = [...trades].sort((a, b) => pnlOf(b) - pnlOf(a));
  const bestTrade  = byPnlDesc[0] ?? null;
  const worstTrade = byPnlDesc[byPnlDesc.length - 1] ?? null;

  const byDowMap = {};
  for (const t of trades) {
    const dow = String(new Date(t.date + 'T12:00:00Z').getUTCDay());
    if (!byDowMap[dow]) byDowMap[dow] = { dow, cnt: 0, pnl: 0, wins: 0 };
    byDowMap[dow].cnt += 1;
    byDowMap[dow].pnl += pnlOf(t);
    if (pnlOf(t) > 0) byDowMap[dow].wins += 1;
  }

  return {
    total, wins: wins.length, losses: losses.length, be,
    totalPnl: round2(totalPnl), totalNet: round2(totalPnl),
    grossWin: round2(grossWin), grossLoss: round2(grossLoss),
    avgRR: round2(avgRR), avgWin: round2(avgWin), avgLoss: round2(avgLoss),
    totalFees: round2(totalFees),
    winrate: Math.round(winrate * 10) / 10,
    profitFactor: round2(profitFactor),
    streak, maxDrawdown: round2(maxDD),
    bestTrade, worstTrade,
    byDow: Object.values(byDowMap),
  };
}

function getDemoTrades()          { return DATA.trades; }
function getDemoAccount()         { return DATA.account; }
function getDemoAccountsList()    { return { accounts: [DATA.account], activeId: DATA.account.id }; }
function getDemoStats()           { return computeStats(DATA.trades); }
function getDemoEmotionalReport() { return DATA.emotionalReport; }
function getDemoTraitCalendar()   { return DATA.traitCalendar; }

function getDemoBudgetSubcategories()    { return DATA.budget.subcategories; }
function getDemoBudgetTransactions(mk)   { return DATA.budget.transactions.filter(t => t.month_key === mk); }
function getDemoBudgetSettings()         { return null; } // toujours null → Budget.jsx tombe sur getLatestSettings
function getDemoLatestBudgetSettings()   { return DATA.budget.monthlySettings; }

function getDemoPayoutData()             { return DATA.payout; }

module.exports = {
  getDemoTrades, getDemoAccount, getDemoAccountsList, getDemoStats,
  getDemoEmotionalReport, getDemoTraitCalendar,
  getDemoBudgetSubcategories, getDemoBudgetTransactions,
  getDemoBudgetSettings, getDemoLatestBudgetSettings,
  getDemoPayoutData,
};
