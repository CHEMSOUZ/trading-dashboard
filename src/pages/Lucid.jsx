import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Règles Lucid ──────────────────────────────────────────────
// ── Règles par taille de compte ───────────────────────────────
const LUCID_EVAL_MAP = {
  lucid_eval_25k:  { ACCOUNT_SIZE: 25000,  PROFIT_TARGET: 1250, MAX_TRAILING_DD: 1000, CONSISTENCY_PCT: 0.50 },
  lucid_eval_50k:  { ACCOUNT_SIZE: 50000,  PROFIT_TARGET: 3000, MAX_TRAILING_DD: 2000, CONSISTENCY_PCT: 0.50 },
  lucid_eval_100k: { ACCOUNT_SIZE: 100000, PROFIT_TARGET: 6000, MAX_TRAILING_DD: 3000, CONSISTENCY_PCT: 0.50 },
  lucid_eval_150k: { ACCOUNT_SIZE: 150000, PROFIT_TARGET: 9000, MAX_TRAILING_DD: 4500, CONSISTENCY_PCT: 0.50 },
  tradovate_live:  { ACCOUNT_SIZE: 50000,  PROFIT_TARGET: 3000, MAX_TRAILING_DD: 2000, CONSISTENCY_PCT: 0.50 },
};
const LUCID_FUNDED_MAP = {
  lucid_funded_25k:  { ACCOUNT_SIZE: 25000,  MAX_DAILY_LOSS: 1000, MAX_TRAILING_DD: 1000, PROFIT_SPLIT: 90, MIN_PAYOUT_DAYS: 5, MIN_DAILY_PROFIT: 100, MIN_PAYOUT_AMOUNT: 250,  MAX_PAYOUT_AMOUNT: 1000, MAX_PAYOUTS: 5 },
  lucid_funded_50k:  { ACCOUNT_SIZE: 50000,  MAX_DAILY_LOSS: 2000, MAX_TRAILING_DD: 2500, PROFIT_SPLIT: 90, MIN_PAYOUT_DAYS: 5, MIN_DAILY_PROFIT: 150, MIN_PAYOUT_AMOUNT: 500,  MAX_PAYOUT_AMOUNT: 2000, MAX_PAYOUTS: 5 },
  lucid_funded_100k: { ACCOUNT_SIZE: 100000, MAX_DAILY_LOSS: 3000, MAX_TRAILING_DD: 3000, PROFIT_SPLIT: 90, MIN_PAYOUT_DAYS: 5, MIN_DAILY_PROFIT: 250, MIN_PAYOUT_AMOUNT: 1000, MAX_PAYOUT_AMOUNT: 4000, MAX_PAYOUTS: 5 },
  lucid_funded_150k: { ACCOUNT_SIZE: 150000, MAX_DAILY_LOSS: 4500, MAX_TRAILING_DD: 4500, PROFIT_SPLIT: 90, MIN_PAYOUT_DAYS: 5, MIN_DAILY_PROFIT: 350, MIN_PAYOUT_AMOUNT: 1500, MAX_PAYOUT_AMOUNT: 6000, MAX_PAYOUTS: 5 },
};
const DEFAULT_EVAL   = LUCID_EVAL_MAP['lucid_eval_50k'];
const DEFAULT_FUNDED = LUCID_FUNDED_MAP['lucid_funded_50k'];

// ── Options du sélecteur de phase ─────────────────────────────
const LUCID_PHASE_OPTIONS = [
  { group: '🎯 LucidFlex Evaluation', phase: 'eval', color: '#00ff88', options: [
    { value: 'lucid_eval_25k',  label: '25K', sub: 'Profit: +1 250$ · Max Loss: -1 000$ · Pas de DLL' },
    { value: 'lucid_eval_50k',  label: '50K', sub: 'Profit: +3 000$ · Max Loss: -2 000$ · Pas de DLL' },
    { value: 'lucid_eval_100k', label: '100K', sub: 'Profit: +6 000$ · Max Loss: -3 000$ · Pas de DLL' },
    { value: 'lucid_eval_150k', label: '150K', sub: 'Profit: +9 000$ · Max Loss: -4 500$ · Pas de DLL' },
  ]},
  { group: '💰 LucidFlex Funded (Live)', phase: 'funded', color: '#f0c020', options: [
    { value: 'lucid_funded_25k',  label: '25K', sub: 'Payout 90% · DLL: -1 000$ · Trailing DD: -1 000$' },
    { value: 'lucid_funded_50k',  label: '50K', sub: 'Payout 90% · DLL: -2 000$ · Trailing DD: -2 500$' },
    { value: 'lucid_funded_100k', label: '100K', sub: 'Payout 90% · DLL: -3 000$ · Trailing DD: -3 000$' },
    { value: 'lucid_funded_150k', label: '150K', sub: 'Payout 90% · DLL: -4 500$ · Trailing DD: -4 500$' },
  ]},
];

// ── Phase Selector ─────────────────────────────────────────────
function LucidPhaseSelector({ account, onChanged }) {
  const [open, setOpen]       = useState(false);
  const [selected, setSelected] = useState(account?.type ?? '');
  const [saving, setSaving]   = useState(false);

  const allOpts = LUCID_PHASE_OPTIONS.flatMap(g => g.options.map(o => ({ ...o, phase: g.phase, color: g.color })));
  const current = allOpts.find(o => o.value === account?.type);
  const groupColor = current?.color ?? '#3a6a4a';

  async function confirm() {
    if (!account || selected === account?.type) { setOpen(false); return; }
    setSaving(true);
    await window.accounts.update(account.id, { type: selected });
    setSaving(false);
    setOpen(false);
    onChanged(selected);
    window.dispatchEvent(new Event('account-updated'));
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ background: `rgba(${groupColor==='#00ff88'?'0,255,136':groupColor==='#f0c020'?'240,192,32':'58,106,74'},0.04)`, border: `1px solid ${groupColor}20`, borderRadius: '6px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '3px' }}>PHASE DU COMPTE</div>
          {current ? (
            <div>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#e8f8e8' }}>{current.phase === 'eval' ? '🎯' : '💰'} {account?.typeInfo?.label ?? account?.type}</span>
              <span style={{ fontSize: '10px', color: groupColor, marginLeft: '10px' }}>{current.sub}</span>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#f0a020' }}>⚠ Phase non définie — cliquez "Modifier" pour configurer</div>
          )}
        </div>
        <button onClick={() => { setSelected(account?.type ?? ''); setOpen(true); }} style={{ background: 'rgba(0,170,255,0.1)', border: '1px solid rgba(0,170,255,0.25)', color: '#00aaff', padding: '7px 14px', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px', fontWeight: '600', whiteSpace: 'nowrap' }}>
          Modifier →
        </button>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#070d12', border: '1px solid rgba(0,170,255,0.3)', borderRadius: '10px', padding: '24px', width: '560px', maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '4px' }}>LUCID TRADING</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#e8f8e8' }}>Sélectionner la phase du compte</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}>×</button>
            </div>

            {LUCID_PHASE_OPTIONS.map(grp => (
              <div key={grp.group} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', color: grp.color, letterSpacing: '2px', marginBottom: '8px', opacity: 0.8 }}>{grp.group.toUpperCase()}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                  {grp.options.map(opt => (
                    <div key={opt.value} onClick={() => setSelected(opt.value)} style={{ padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', background: selected === opt.value ? `rgba(${grp.color==='#00ff88'?'0,255,136':'240,192,32'},0.08)` : 'rgba(10,28,18,0.4)', border: `1px solid ${selected === opt.value ? grp.color+'44' : 'rgba(0,255,136,0.06)'}`, transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${selected === opt.value ? grp.color : '#2a5a3a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {selected === opt.value && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: grp.color }} />}
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: selected === opt.value ? '#e8f8e8' : '#8aaa90' }}>{opt.label}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#4a7a5a', paddingLeft: '22px' }}>{opt.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ background: 'rgba(240,160,32,0.06)', border: '1px solid rgba(240,160,32,0.2)', borderRadius: '4px', padding: '8px 12px', marginBottom: '16px', fontSize: '11px', color: '#f0a020' }}>
              ⚠ Ce choix est permanent. Éval → validé quand profit target atteint · Funded → compte LIVE dans la sidebar.
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setOpen(false)} style={{ padding: '9px 18px', borderRadius: '5px', border: '1px solid #1a3a22', background: 'transparent', color: '#5a8a6a', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>Annuler</button>
              <button onClick={confirm} disabled={saving || !selected || selected === account?.type} style={{ padding: '9px 22px', borderRadius: '5px', background: !selected || selected === account?.type ? 'rgba(10,28,18,0.4)' : 'linear-gradient(135deg,rgba(0,170,255,0.2),rgba(0,120,200,0.1))', border: `1px solid ${!selected || selected === account?.type ? '#1a3a22' : 'rgba(0,170,255,0.35)'}`, color: !selected || selected === account?.type ? '#2a5a32' : '#00aaff', fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: saving || !selected || selected === account?.type ? 'not-allowed' : 'pointer' }}>
                {saving ? 'SAUVEGARDE...' : selected === account?.type ? 'DÉJÀ SÉLECTIONNÉ' : '✓ CONFIRMER LA PHASE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function getNet(t) { return t.result_net ?? t.result ?? 0; }
function fmt(n, sign = false) {
  if (n == null || isNaN(n)) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}$`;
}
function pnlColor(v) {
  if (v > 0) return '#00ff88';
  if (v < 0) return '#ff4455';
  return '#8aaa90';
}

function CTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(6,18,12,0.97)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit' }}>
      <div style={{ color: '#3a6a4a', marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.name === 'Floor' ? '#ff4455' : '#00ff88', fontWeight: '700' }}>
          {p.name}: {typeof p.value === 'number' ? `${p.value.toFixed(2)}$` : p.value}
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, sub, color = '#c8d8c8', alert = false }) {
  return (
    <div style={{ background: alert ? 'rgba(255,68,85,0.06)' : 'rgba(10,28,18,0.5)', border: `1px solid ${alert ? 'rgba(255,68,85,0.3)' : 'rgba(0,255,136,0.08)'}`, borderTop: `2px solid ${color}`, borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '1.5px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '21px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: alert ? '#ff8888' : '#3a6a4a', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ label, current, max, color, displayText }) {
  const pct = Math.min((current / Math.max(max, 1)) * 100, 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label !== null && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {label && <span style={{ fontSize: '13px', color: '#8aaa90' }}>{label}</span>}
          <span style={{ fontSize: '13px', color, fontWeight: '700' }}>{displayText}</span>
        </div>
      )}
      <div style={{ height: '6px', background: 'rgba(0,255,136,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease', boxShadow: `0 0 6px ${color}60` }} />
      </div>
    </div>
  );
}

function DayDot({ date, pnl }) {
  const isWin = pnl > 0;
  return (
    <div title={`${date}: ${fmt(pnl, true)}`} style={{ width: '34px', height: '34px', borderRadius: '50%', background: isWin ? 'rgba(0,255,136,0.12)' : 'rgba(255,68,85,0.12)', border: `1.5px solid ${isWin ? '#00ff88' : '#ff4455'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: isWin ? '#00ff88' : '#ff4455', fontWeight: '700' }}>
      {isWin ? '✓' : '✗'}
    </div>
  );
}

function computeTrailing(trades, manualBalance, accountSize, maxLoss) {
  const sorted = [...trades].filter(t => (t.result_net ?? t.result) != null)
    .sort((a, b) => (a.entered_at || a.date).localeCompare(b.entered_at || b.date));
  let runBal = manualBalance > 0 ? manualBalance - trades.reduce((s, t) => s + getNet(t), 0) : accountSize;
  // Floor is capped at accountSize: once profit >= maxLoss, the floor locks at the starting balance
  let hwm = runBal, floor = Math.min(accountSize, runBal - maxLoss);
  const byDayArr = sorted.reduce((acc, t) => {
    const last = acc[acc.length - 1];
    if (last && last.date === t.date) last.pnl += getNet(t);
    else acc.push({ date: t.date, pnl: getNet(t) });
    return acc;
  }, []);
  const points = [{ date: 'Start', balance: runBal, floor }];
  byDayArr.forEach(({ date, pnl }) => {
    runBal += pnl;
    if (runBal > hwm) { hwm = runBal; floor = Math.min(accountSize, hwm - maxLoss); }
    points.push({ date: date.slice(5), balance: Math.round(runBal * 100) / 100, floor: Math.round(floor * 100) / 100 });
  });
  return { points, hwm, floor, byDayArr };
}

// ── LUCID EVAL TAB ────────────────────────────────────────────
function LucidEvalTab({ trades, manualBalance, setManualBalance, balanceInput, setBalanceInput, accountType }) {
  const { ACCOUNT_SIZE, PROFIT_TARGET, MAX_TRAILING_DD, CONSISTENCY_PCT } = LUCID_EVAL_MAP[accountType] ?? DEFAULT_EVAL;
  const MAX_DAILY_LOSS = null; // Pas de DLL sur LucidFlex Eval

  const totalNet = trades.reduce((s, t) => s + getNet(t), 0);
  const currentBalance = manualBalance > 0 ? manualBalance : ACCOUNT_SIZE + totalNet;
  const { points: equityPoints, hwm, floor } = computeTrailing(trades, manualBalance, ACCOUNT_SIZE, MAX_TRAILING_DD);

  const distanceToFloor = currentBalance - floor;
  const accountLost    = currentBalance <= floor;
  const floorLocked    = floor >= ACCOUNT_SIZE;

  const byDay = trades.reduce((acc, t) => { if (!acc[t.date]) acc[t.date] = 0; acc[t.date] += getNet(t); return acc; }, {});
  const allDays = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
  const tradingDays   = allDays.length;
  const winningDays   = Object.values(byDay).filter(p => p > 0).length;
  const dailyArr = allDays.map(([date, pnl]) => ({ date: date.slice(5), pnl: Math.round(pnl * 100) / 100 }));

  // Pas de DLL sur LucidFlex Eval
  const dailyLossBreached = false;

  // Net profit progress
  const netProfit = Math.max(currentBalance - ACCOUNT_SIZE, 0);
  const targetReached = currentBalance >= ACCOUNT_SIZE + PROFIT_TARGET;

  // Consistency (50%)
  const posNetPnl  = trades.filter(t => getNet(t) > 0).reduce((s, t) => s + getNet(t), 0);
  const bestDayNet = Math.max(...Object.values(byDay).filter(p => p > 0), 0);
  const bestDayPct = posNetPnl > 0 ? (bestDayNet / posNetPnl) * 100 : 0;
  const consistencyOk = bestDayPct <= CONSISTENCY_PCT * 100 || posNetPnl === 0;

  const rule1 = !accountLost;               // Drawdown trailing uniquement (pas de DLL)
  const rule2 = targetReached;
  const allPassed = rule1 && rule2 && consistencyOk;

  const status = accountLost
    ? { label: '❌ COMPTE PERDU (Max Loss atteint)', color: '#ff4455' }
    : allPassed ? { label: '✅ ÉVALUATION VALIDÉE !', color: '#00ff88' }
    : { label: '⏳ EN COURS', color: '#f0a020' };

  function saveBalance() {
    const v = parseFloat(balanceInput);
    if (!isNaN(v) && v > 0) { setManualBalance(v); localStorage.setItem('lucid_eval_balance', String(v)); setBalanceInput(''); }
  }

  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '4px', padding: '7px 10px', color: '#c8d8c8', fontSize: '13px', fontFamily: 'inherit', outline: 'none' };
  const equityWithTarget = equityPoints.map(p => ({ ...p, target: ACCOUNT_SIZE + PROFIT_TARGET }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Info */}
      <div style={{ background: 'rgba(0,170,255,0.04)', border: '1px solid rgba(0,170,255,0.15)', borderRadius: '6px', padding: '12px 16px', fontSize: '13px', color: '#4a7a5a' }}>
        <div style={{ fontWeight: '700', color: '#00aaff', marginBottom: '6px', fontSize: '12px', letterSpacing: '1px' }}>RÈGLES LUCIDFLEX EVALUATION — COMPTE 50K</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '8px' }}>
          {[
            { label: 'Profit Target', value: `+${PROFIT_TARGET.toLocaleString()}$ (6%)`, color: '#00ff88' },
            { label: 'Max Loss Limit (Trailing DD)', value: `-${MAX_TRAILING_DD.toLocaleString()}$ (4%)`, color: '#f0a020' },
            { label: 'Perte journalière', value: 'Aucune (pas de DLL)', color: '#00aaff' },
            { label: 'Jours minimum', value: 'Aucun — illimité', color: '#c8d8c8' },
            { label: 'Règle cohérence', value: `Max 50% du P&L net/jour`, color: '#aa88ff' },
            { label: 'Durée', value: 'Illimitée · 1 frais unique', color: '#c8d8c8' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '4px', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', color: '#3a6a4a', marginBottom: '3px', letterSpacing: '0.5px' }}>{label}</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Balance + Status */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input type="number" placeholder="Balance réelle ($)" value={balanceInput} onChange={e => setBalanceInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveBalance()} style={{ ...inp, width: '170px' }} />
          <button onClick={saveBalance} style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', padding: '7px 14px', borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>MAJ</button>
        </div>
        <div style={{ background: `rgba(${status.color === '#ff4455' ? '255,68,85' : status.color === '#00ff88' ? '0,255,136' : '240,160,32'},0.08)`, border: `1px solid ${status.color}40`, borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', color: status.color }}>{status.label}</div>
        <div style={{ fontSize: '13px', color: '#3a6a4a' }}>P&L net: <span style={{ color: pnlColor(totalNet), fontWeight: '700' }}>{fmt(totalNet, true)}</span></div>
      </div>

      {/* Trailing Drawdown */}
      <div style={{ background: 'rgba(10,28,18,0.4)', border: `1px solid ${distanceToFloor < 500 ? 'rgba(255,68,85,0.3)' : 'rgba(0,255,136,0.08)'}`, borderRadius: '8px', padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px' }}>⚠️ TRAILING DRAWDOWN SUIVEUR — {MAX_TRAILING_DD.toLocaleString()}$</div>
          {floorLocked
            ? <div style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', color: '#00ff88', fontWeight: '700', letterSpacing: '1px' }}>🔒 VERROUILLÉ AU CAPITAL INITIAL</div>
            : <div style={{ background: 'rgba(240,160,32,0.08)', border: '1px solid rgba(240,160,32,0.25)', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', color: '#f0a020', letterSpacing: '1px' }}>↑ EN SUIVI — se verrouille à {ACCOUNT_SIZE.toLocaleString()}$ dès +{MAX_TRAILING_DD.toLocaleString()}$ de profit</div>
          }
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '14px' }}>
          <MetricCard label="BALANCE" value={`${currentBalance.toFixed(2)}$`} color="#c8d8c8" sub={manualBalance > 0 ? 'Manuelle' : 'Estimée'} />
          <MetricCard label="HIGH WATER MARK" value={`${hwm.toFixed(2)}$`} color="#f0a020" sub="Plus haut atteint" />
          <MetricCard label="FLOOR" value={`${floor.toFixed(2)}$`} color="#ff4455" alert={distanceToFloor < 500} sub="Ne pas descendre sous" />
          <MetricCard label="MARGE" value={`${distanceToFloor.toFixed(2)}$`} color={distanceToFloor < 500 ? '#ff4455' : distanceToFloor < 1000 ? '#f0a020' : '#00ff88'} alert={distanceToFloor < 500} />
        </div>
        <div style={{ height: '18px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', width: `${Math.min((distanceToFloor / MAX_TRAILING_DD) * 100, 100)}%`, background: distanceToFloor < 500 ? 'linear-gradient(90deg,#ff4455,#ff6677)' : distanceToFloor < 1000 ? 'linear-gradient(90deg,#f0a020,#f0c040)' : 'linear-gradient(90deg,#00aa55,#00ff88)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontWeight: '700' }}>
            {distanceToFloor.toFixed(2)}$ de marge · Floor: {floor.toFixed(2)}$
          </div>
        </div>
      </div>

      {/* Rules checklist */}
      <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '18px' }}>
        <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>🎯 VALIDATION DES RÈGLES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Rule 1 — Drawdown uniquement (pas de DLL) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px', background: rule1 ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,85,0.06)', border: `1px solid ${rule1 ? 'rgba(0,255,136,0.12)' : 'rgba(255,68,85,0.3)'}`, borderRadius: '6px' }}>
            <span style={{ fontSize: '19px' }}>{rule1 ? '✅' : '❌'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', color: '#c8d8c8', fontWeight: '600', marginBottom: '3px' }}>Max Loss Limit (Trailing Drawdown)</div>
              <div style={{ fontSize: '12px', color: '#4a7a5a' }}>
                Marge restante: {fmt(distanceToFloor)} · Floor: {floor.toFixed(2)}$ · <span style={{ color: '#00aaff' }}>Pas de DLL</span>
              </div>
            </div>
          </div>

          {/* Rule 2 — Profit target */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px', background: rule2 ? 'rgba(0,255,136,0.04)' : 'rgba(10,28,18,0.4)', border: `1px solid ${rule2 ? 'rgba(0,255,136,0.12)' : 'rgba(0,255,136,0.06)'}`, borderRadius: '6px' }}>
            <span style={{ fontSize: '19px' }}>{rule2 ? '✅' : '⏳'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', color: '#c8d8c8', fontWeight: '600', marginBottom: '8px' }}>Profit Target — Atteindre +{PROFIT_TARGET.toLocaleString()}$</div>
              <ProgressBar label={null} current={Math.min(netProfit, PROFIT_TARGET)} max={PROFIT_TARGET} color={rule2 ? '#00ff88' : '#f0a020'} displayText={`${fmt(netProfit, true)} / +${PROFIT_TARGET}$`} />
            </div>
          </div>

          {/* Rule 3 — Consistency 50% */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px', background: consistencyOk ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,85,0.06)', border: `1px solid ${consistencyOk ? 'rgba(0,255,136,0.12)' : 'rgba(255,68,85,0.3)'}`, borderRadius: '6px' }}>
            <span style={{ fontSize: '19px' }}>{consistencyOk ? '✅' : '⚠️'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', color: '#c8d8c8', fontWeight: '600', marginBottom: '4px' }}>Règle de cohérence — Max 50% du P&L net positif par jour</div>
              <div style={{ fontSize: '12px', color: '#4a7a5a' }}>
                Meilleur jour: {fmt(bestDayNet, true)} · Total net+: {fmt(posNetPnl, true)} · Part: {bestDayPct.toFixed(1)}%/50%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Suivi journalier */}
      {allDays.length > 0 && (
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>📅 SUIVI JOURNALIER — <span style={{ color: '#00aaff', fontSize: '10px' }}>Pas de DLL · Max Loss Limit trailing: -{MAX_TRAILING_DD}$</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
            {allDays.slice().reverse().map(([date, pnl]) => {
              const rowColor = pnl > 0 ? '#00ff88' : pnl < 0 ? '#ff4455' : '#8aaa90';
              return (
                <div key={date} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px', gap: '10px', alignItems: 'center', padding: '7px 10px', background: 'rgba(10,28,18,0.3)', borderRadius: '4px', border: `1px solid rgba(0,255,136,0.04)` }}>
                  <span style={{ fontSize: '11px', color: '#4a7a5a' }}>{date}</span>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(Math.abs(pnl) / Math.max(PROFIT_TARGET, 1) * 100, 100)}%`, background: pnl >= 0 ? '#00ff88' : '#ff4455', borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: rowColor, textAlign: 'right' }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}$
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '12px' }}>
            {[
              { label: 'MOY. GAGNANTS', value: winningDays > 0 ? `+${(Object.values(byDay).filter(p=>p>0).reduce((s,v)=>s+v,0)/winningDays).toFixed(2)}$` : '—', color: '#00ff88' },
              { label: 'MOY. PERDANTS', value: (tradingDays - winningDays) > 0 ? `-${(Math.abs(Object.values(byDay).filter(p=>p<0).reduce((s,v)=>s+v,0))/(tradingDays-winningDays)).toFixed(2)}$` : '—', color: '#ff4455' },
              { label: 'MEILLEUR JOUR', value: tradingDays > 0 ? `+${Math.max(...Object.values(byDay)).toFixed(2)}$` : '—', color: '#00ff88' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '4px', padding: '8px 10px' }}>
                <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '0.5px', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
        <MetricCard label="BALANCE NETTE" value={`${currentBalance.toFixed(2)}$`} color={rule2 ? '#00ff88' : '#c8d8c8'} sub={manualBalance > 0 ? 'Manuelle' : 'Estimée'} />
        <MetricCard label="PROFIT NET" value={fmt(netProfit, true)} color={pnlColor(netProfit)} sub={`Objectif: +${PROFIT_TARGET}$`} />
        <MetricCard label="MAX LOSS FLOOR" value={`${floor.toFixed(2)}$`} color="#ff4455" alert={distanceToFloor < 300} sub={`Marge: ${distanceToFloor.toFixed(2)}$`} />
        <MetricCard label="JOURS TRADÉS" value={tradingDays} color="#c8d8c8" sub={`Aucun minimum · ${winningDays} gagnants`} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>PROGRESSION NETTE — Objectif: +{PROFIT_TARGET}$</div>
          {equityWithTarget.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={equityWithTarget} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs><linearGradient id="lG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00ff88" stopOpacity={0.15}/><stop offset="95%" stopColor="#00ff88" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} domain={['auto','auto']} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={ACCOUNT_SIZE + PROFIT_TARGET} stroke="#00ff88" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `+${PROFIT_TARGET}$`, fill: '#00ff88', fontSize: 11 }} />
                <ReferenceLine y={ACCOUNT_SIZE - MAX_TRAILING_DD} stroke="#ff4455" strokeDasharray="4 4" strokeOpacity={0.4} />
                <Area type="monotone" dataKey="balance" name="Capital net" stroke="#00ff88" strokeWidth={2} fill="url(#lG)" dot={false} />
                <Area type="monotone" dataKey="floor" name="Floor" stroke="#ff4455" strokeWidth={1.5} fill="none" strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '13px' }}>Aucun trade</div>}
        </div>
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>P&L NET PAR JOUR</div>
          {dailyArr.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyArr} margin={{ top: 5, right: 5, bottom: 0, left: 5 }} barCategoryGap="35%">
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Bar dataKey="pnl" name="P&L net" radius={[3,3,0,0]} fill="#00ff88" isAnimationActive maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '13px' }}>Aucun trade</div>}
        </div>
      </div>

      {allPassed && (
        <div style={{ background: 'rgba(0,255,136,0.08)', border: '2px solid #00ff88', borderRadius: '8px', padding: '20px', textAlign: 'center', boxShadow: '0 0 30px rgba(0,255,136,0.1)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
          <div style={{ fontSize: '19px', fontWeight: '700', color: '#00ff88', marginBottom: '6px' }}>LUCIDFLEX EVAL VALIDÉE !</div>
          <div style={{ fontSize: '13px', color: '#4a7a5a' }}>Profit target +{PROFIT_TARGET.toLocaleString()}$ atteint · Cohérence OK · Tu peux passer au compte Funded.</div>
        </div>
      )}
    </div>
  );
}

// ── LUCID FUNDED TAB ──────────────────────────────────────────
function LucidFundedTab({ trades, manualBalance, setManualBalance, balanceInput, setBalanceInput, accountType }) {
  const { ACCOUNT_SIZE, MAX_DAILY_LOSS, MAX_TRAILING_DD, PROFIT_SPLIT, MIN_PAYOUT_DAYS, MIN_DAILY_PROFIT, MIN_PAYOUT_AMOUNT, MAX_PAYOUT_AMOUNT, MAX_PAYOUTS } = LUCID_FUNDED_MAP[accountType] ?? DEFAULT_FUNDED;

  const totalNet = trades.reduce((s, t) => s + getNet(t), 0);
  const currentBalance = manualBalance > 0 ? manualBalance : ACCOUNT_SIZE + totalNet;
  const { points: equityPoints, hwm, floor } = computeTrailing(trades, manualBalance, ACCOUNT_SIZE, MAX_TRAILING_DD);

  const distanceToFloor = currentBalance - floor;
  const accountLost = currentBalance <= floor;
  const floorLocked = floor >= ACCOUNT_SIZE;

  const byDay = trades.reduce((acc, t) => { if (!acc[t.date]) acc[t.date] = 0; acc[t.date] += getNet(t); return acc; }, {});
  const allDays = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
  const tradingDays = allDays.length;
  const winningDays = Object.values(byDay).filter(p => p > 0).length;
  const dailyArr = allDays.map(([date, pnl]) => ({ date: date.slice(5), pnl: Math.round(pnl * 100) / 100 }));

  const worstDay = Math.min(...Object.values(byDay), 0);
  const dailyLossBreached = Math.abs(worstDay) >= MAX_DAILY_LOSS;

  const qualifiedDays = Object.values(byDay).filter(p => p >= MIN_DAILY_PROFIT).length;
  const cycleNetProfit = Math.max(totalNet, 0);
  const rawPayout = cycleNetProfit * (PROFIT_SPLIT / 100);
  const payoutAmount = Math.min(rawPayout, MAX_PAYOUT_AMOUNT);
  const payoutEligible = qualifiedDays >= MIN_PAYOUT_DAYS && totalNet >= MIN_PAYOUT_AMOUNT && !accountLost && !dailyLossBreached;

  const status = accountLost || dailyLossBreached
    ? { label: dailyLossBreached ? '❌ PERTE JOURNALIÈRE DÉPASSÉE' : '❌ COMPTE PERDU', color: '#ff4455' }
    : payoutEligible ? { label: '💰 PAYOUT DISPONIBLE', color: '#00ff88' }
    : { label: '✓ COMPTE ACTIF', color: '#00cc66' };

  function saveBalance() {
    const v = parseFloat(balanceInput);
    if (!isNaN(v) && v > 0) { setManualBalance(v); localStorage.setItem('lucid_funded_balance', String(v)); setBalanceInput(''); }
  }

  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '4px', padding: '7px 10px', color: '#c8d8c8', fontSize: '13px', fontFamily: 'inherit', outline: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Info */}
      <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '6px', padding: '12px 16px', fontSize: '13px', color: '#4a7a5a' }}>
        <div style={{ fontWeight: '700', color: '#00ff88', marginBottom: '6px', fontSize: '12px', letterSpacing: '1px' }}>CONDITIONS PAYOUT LUCID FUNDED — COMPTE 50K</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '8px' }}>
          {[
            { label: 'Pas de Profit Target', value: 'Aucun objectif requis', color: '#00ff88' },
            { label: 'Perte journalière max', value: `-${MAX_DAILY_LOSS.toLocaleString()}$ (4%)`, color: '#ff4455' },
            { label: 'Drawdown trailing max', value: `-${MAX_TRAILING_DD.toLocaleString()}$ (5%)`, color: '#f0a020' },
            { label: 'Part des profits', value: `${PROFIT_SPLIT}% pour le trader`, color: '#00ff88' },
            { label: 'Payout disponible après', value: `${MIN_PAYOUT_DAYS} jours avec profit ≥ ${MIN_DAILY_PROFIT}$`, color: '#c8d8c8' },
            { label: 'Payout minimum / maximum', value: `${MIN_PAYOUT_AMOUNT}$ — ${MAX_PAYOUT_AMOUNT}$`, color: '#c8d8c8' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '4px', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', color: '#3a6a4a', marginBottom: '3px', letterSpacing: '0.5px' }}>{label}</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Balance + Status */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input type="number" placeholder="Balance réelle ($)" value={balanceInput} onChange={e => setBalanceInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveBalance()} style={{ ...inp, width: '170px' }} />
          <button onClick={saveBalance} style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', padding: '7px 14px', borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>MAJ</button>
        </div>
        <div style={{ background: `rgba(${status.color === '#ff4455' ? '255,68,85' : '0,255,136'},0.08)`, border: `1px solid ${status.color}40`, borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', color: status.color }}>{status.label}</div>
        <div style={{ fontSize: '13px', color: '#3a6a4a' }}>P&L net: <span style={{ color: pnlColor(totalNet), fontWeight: '700' }}>{fmt(totalNet, true)}</span></div>
      </div>

      {/* Drawdown */}
      <div style={{ background: 'rgba(10,28,18,0.4)', border: `1px solid ${distanceToFloor < 500 ? 'rgba(255,68,85,0.3)' : 'rgba(0,255,136,0.08)'}`, borderRadius: '8px', padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px' }}>⚠️ TRAILING DRAWDOWN SUIVEUR — {MAX_TRAILING_DD.toLocaleString()}$</div>
          {floorLocked
            ? <div style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', color: '#00ff88', fontWeight: '700', letterSpacing: '1px' }}>🔒 VERROUILLÉ AU CAPITAL INITIAL</div>
            : <div style={{ background: 'rgba(240,160,32,0.08)', border: '1px solid rgba(240,160,32,0.25)', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', color: '#f0a020', letterSpacing: '1px' }}>↑ EN SUIVI — se verrouille à {ACCOUNT_SIZE.toLocaleString()}$ dès +{MAX_TRAILING_DD.toLocaleString()}$ de profit</div>
          }
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '14px' }}>
          <MetricCard label="BALANCE" value={`${currentBalance.toFixed(2)}$`} color="#c8d8c8" sub={manualBalance > 0 ? 'Manuelle' : 'Estimée'} />
          <MetricCard label="HIGH WATER MARK" value={`${hwm.toFixed(2)}$`} color="#f0a020" sub="Plus haut net" />
          <MetricCard label="FLOOR" value={`${floor.toFixed(2)}$`} color="#ff4455" alert={distanceToFloor < 500} sub="Ne pas descendre sous" />
          <MetricCard label="MARGE" value={`${distanceToFloor.toFixed(2)}$`} color={distanceToFloor < 500 ? '#ff4455' : distanceToFloor < 1000 ? '#f0a020' : '#00ff88'} alert={distanceToFloor < 500} />
        </div>
        <div style={{ height: '18px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', width: `${Math.min((distanceToFloor / MAX_TRAILING_DD) * 100, 100)}%`, background: distanceToFloor < 500 ? 'linear-gradient(90deg,#ff4455,#ff6677)' : distanceToFloor < 1000 ? 'linear-gradient(90deg,#f0a020,#f0c040)' : 'linear-gradient(90deg,#00aa55,#00ff88)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontWeight: '700' }}>
            {distanceToFloor.toFixed(2)}$ de marge
          </div>
        </div>
      </div>

      {/* Payout eligibility */}
      <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '18px' }}>
        <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>💰 ÉLIGIBILITÉ AU PAYOUT</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { ok: !accountLost && !dailyLossBreached, label: 'Compte actif', desc: dailyLossBreached ? `Limite journalière dépassée (pire jour: ${fmt(worstDay)})` : accountLost ? 'Drawdown maximum atteint' : 'Aucune règle violée' },
            { ok: qualifiedDays >= MIN_PAYOUT_DAYS, label: `Jours qualifiés — profit ≥ ${MIN_DAILY_PROFIT}$ (min ${MIN_PAYOUT_DAYS})`, desc: `${qualifiedDays} jour${qualifiedDays > 1 ? 's' : ''} qualifié${qualifiedDays > 1 ? 's' : ''} sur ${tradingDays} tradé${tradingDays > 1 ? 's' : ''}` },
            { ok: totalNet >= MIN_PAYOUT_AMOUNT, label: `Profit net minimum (${MIN_PAYOUT_AMOUNT}$)`, desc: `P&L net: ${fmt(totalNet, true)}` },
          ].map(({ ok, label, desc }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: ok ? 'rgba(0,255,136,0.04)' : 'rgba(10,28,18,0.4)', border: `1px solid ${ok ? 'rgba(0,255,136,0.12)' : 'rgba(0,255,136,0.06)'}`, borderRadius: '6px' }}>
              <span style={{ fontSize: '18px' }}>{ok ? '✅' : '⏳'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#c8d8c8', fontWeight: '600' }}>{label}</div>
                <div style={{ fontSize: '12px', color: '#4a7a5a', marginTop: '2px' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {payoutEligible && (
          <div style={{ marginTop: '14px', background: 'rgba(0,255,136,0.08)', border: '2px solid rgba(0,255,136,0.3)', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#4a7a5a', marginBottom: '6px' }}>Montant disponible au payout ({PROFIT_SPLIT}% · plafonné à {MAX_PAYOUT_AMOUNT}$)</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#00ff88' }}>{fmt(payoutAmount, true)}</div>
            <div style={{ fontSize: '12px', color: '#3a6a4a', marginTop: '4px' }}>sur {fmt(cycleNetProfit, true)} de P&L net · brut: {fmt(rawPayout, true)}</div>
          </div>
        )}
      </div>

      {/* Suivi journalier Funded */}
      {allDays.length > 0 && (
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>📅 SUIVI JOURNALIER — Budget: -{MAX_DAILY_LOSS.toLocaleString()}$/jour · Qualifié si ≥+{MIN_DAILY_PROFIT}$</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
            {allDays.slice().reverse().map(([date, pnl]) => {
              const isQualified = pnl >= MIN_DAILY_PROFIT;
              const isBreached  = pnl < -MAX_DAILY_LOSS;
              const isWarning   = pnl < -MAX_DAILY_LOSS * 0.6;
              const usedBudget  = pnl < 0 ? Math.min(Math.abs(pnl) / MAX_DAILY_LOSS * 100, 100) : 0;
              const rowColor    = isBreached ? '#ff4455' : isQualified ? '#00ff88' : pnl > 0 ? '#8aaa90' : isWarning ? '#f0a020' : '#8aaa90';
              return (
                <div key={date} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 120px', gap: '10px', alignItems: 'center', padding: '7px 10px', background: isBreached ? 'rgba(255,68,85,0.06)' : isQualified ? 'rgba(0,255,136,0.04)' : 'rgba(10,28,18,0.3)', borderRadius: '4px', border: `1px solid ${isBreached ? 'rgba(255,68,85,0.2)' : isQualified ? 'rgba(0,255,136,0.1)' : 'rgba(0,255,136,0.04)'}` }}>
                  <span style={{ fontSize: '11px', color: '#4a7a5a' }}>{date}</span>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    {pnl < 0 && <div style={{ height: '100%', width: `${usedBudget}%`, background: isBreached ? '#ff4455' : '#f0a020', borderRadius: '3px' }} />}
                    {pnl > 0 && <div style={{ height: '100%', width: `${Math.min(pnl/MAX_DAILY_LOSS*100,100)}%`, background: isQualified ? '#00ff88' : '#00aa55', borderRadius: '3px' }} />}
                  </div>
                  <span style={{ fontSize: '10px', color: '#4a7a5a', textAlign: 'right' }}>
                    {isQualified ? '✓ qualifié' : pnl < 0 ? `${usedBudget.toFixed(0)}%` : ''}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: rowColor, textAlign: 'right' }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}$
                    {isBreached && <span style={{ fontSize: '9px', marginLeft: '4px' }}>⚠</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginTop: '12px' }}>
            {[
              { label: 'JOURS QUALIFIÉS', value: `${qualifiedDays}/${MIN_PAYOUT_DAYS}`, color: qualifiedDays >= MIN_PAYOUT_DAYS ? '#00ff88' : '#f0a020' },
              { label: 'MOY. P&L/JOUR', value: tradingDays > 0 ? `${totalNet >= 0 ? '+' : ''}${(totalNet / tradingDays).toFixed(2)}$` : '—', color: pnlColor(totalNet / Math.max(tradingDays, 1)) },
              { label: 'MEILLEUR JOUR', value: allDays.length > 0 ? `+${Math.max(...Object.values(byDay)).toFixed(2)}$` : '—', color: '#00ff88' },
              { label: 'PIRE JOUR', value: allDays.length > 0 ? `${Math.min(...Object.values(byDay)).toFixed(2)}$` : '—', color: '#ff4455' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '4px', padding: '8px 10px' }}>
                <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '0.5px', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
        <MetricCard label="BALANCE NETTE" value={`${currentBalance.toFixed(2)}$`} color={pnlColor(totalNet)} sub={manualBalance > 0 ? 'Manuelle' : 'Estimée'} />
        <MetricCard label="P&L NET" value={fmt(totalNet, true)} color={pnlColor(totalNet)} sub={`Ta part: ${fmt(payoutAmount, true)}`} />
        <MetricCard label="FLOOR DRAWDOWN" value={`${floor.toFixed(2)}$`} color="#ff4455" alert={distanceToFloor < 500} sub={`Marge: ${distanceToFloor.toFixed(2)}$`} />
        <MetricCard label="JOURS QUALIFIÉS" value={`${qualifiedDays}/${MIN_PAYOUT_DAYS}`} color={qualifiedDays >= MIN_PAYOUT_DAYS ? '#00ff88' : '#f0a020'} sub={`Profit ≥ ${MIN_DAILY_PROFIT}$ · ${tradingDays} tradés`} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>COURBE CAPITAL (NET) + FLOOR</div>
          {equityPoints.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={equityPoints} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs><linearGradient id="lfG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00ff88" stopOpacity={0.15}/><stop offset="95%" stopColor="#00ff88" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} domain={['auto','auto']} />
                <Tooltip content={<CTooltip />} />
                <Area type="monotone" dataKey="balance" name="Capital net" stroke="#00ff88" strokeWidth={2} fill="url(#lfG)" dot={false} />
                <Area type="monotone" dataKey="floor" name="Floor" stroke="#ff4455" strokeWidth={1.5} fill="none" strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '13px' }}>Aucun trade</div>}
        </div>
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>P&L NET PAR JOUR</div>
          {dailyArr.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyArr} margin={{ top: 5, right: 5, bottom: 0, left: 5 }} barCategoryGap="35%">
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <ReferenceLine y={-MAX_DAILY_LOSS} stroke="#ff4455" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `Limite -${MAX_DAILY_LOSS}$`, fill: '#ff4455', fontSize: 10, position: 'right' }} />
                <Bar dataKey="pnl" name="P&L net" radius={[3,3,0,0]} fill="#00ff88" isAnimationActive maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '13px' }}>Aucun trade</div>}
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function Lucid() {
  const [tab, setTab]     = useState(() => localStorage.getItem('lucid_tab') || 'eval');
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [evalBalance, setEvalBalance]   = useState(() => parseFloat(localStorage.getItem('lucid_eval_balance') || '0') || 0);
  const [fundedBalance, setFundedBalance] = useState(() => parseFloat(localStorage.getItem('lucid_funded_balance') || '0') || 0);
  const [balanceInput, setBalanceInput] = useState('');

  useEffect(() => {
    (async () => {
      const [accRes, tradesRes] = await Promise.all([window.accounts.getActive(), window.db.getAllTrades()]);
      if (accRes.ok && accRes.data) setAccount(accRes.data);
      if (tradesRes.ok) setTrades(tradesRes.data);
      setLoading(false);
    })();
  }, []);

  const accountType = account?.type ?? 'lucid_eval_50k';
  // Auto-switcher : si le compte est funded, afficher l'onglet funded par défaut
  useEffect(() => {
    if (account?.type?.startsWith('lucid_funded')) setTab('funded');
    else if (account?.type?.startsWith('lucid_eval') || account?.type === 'tradovate_live') setTab('eval');
  }, [account?.type]);

  function switchTab(t) { setTab(t); localStorage.setItem('lucid_tab', t); setBalanceInput(''); }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3a6a4a', fontSize: '13px', letterSpacing: '2px' }}>CHARGEMENT...</div>
  );

  const typeInfo = account?.typeInfo?.label ?? account?.type ?? '—';
  const sizeLabel = LUCID_EVAL_MAP[accountType] || LUCID_FUNDED_MAP[accountType]
    ? `${(LUCID_EVAL_MAP[accountType] ?? LUCID_FUNDED_MAP[accountType])?.ACCOUNT_SIZE?.toLocaleString()}K`
    : '50K';

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1100px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>LUCID TRADING</div>
          <h1 style={{ fontSize: '23px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>
            {tab === 'eval' ? `🎯 LucidFlex Eval — ${sizeLabel}` : `💰 LucidFlex Funded — ${sizeLabel}`}
          </h1>
        </div>
        <div style={{ background: 'rgba(0,170,255,0.08)', border: '1px solid rgba(0,170,255,0.2)', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', color: '#00aaff', fontWeight: '700', letterSpacing: '1px' }}>
          PROP FIRM
        </div>
      </div>

      {/* Phase selector */}
      {account && (
        <div style={{ marginBottom: '16px' }}>
          <LucidPhaseSelector account={account} onChanged={newType => {
            setAccount(prev => ({ ...prev, type: newType, typeInfo: { label: newType } }));
          }} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', marginBottom: '20px', background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '8px', padding: '4px' }}>
        {[
          { key: 'eval',   label: '🎯 LucidFlex Eval',   desc: 'Évaluation · Validation' },
          { key: 'funded', label: '💰 LucidFlex Funded', desc: 'Compte live · Payout 90%' },
        ].map(({ key, label, desc }) => (
          <button key={key} onClick={() => switchTab(key)} style={{ flex: 1, padding: '13px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: tab === key ? 'rgba(0,255,136,0.12)' : 'transparent', fontFamily: 'inherit' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: tab === key ? '#00ff88' : '#5a8a6a', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '12px', color: tab === key ? '#3a8a4a' : '#3a5a3a' }}>{desc}</div>
            {tab === key && <div style={{ height: '2px', background: '#00ff88', borderRadius: '2px', marginTop: '8px', boxShadow: '0 0 6px #00ff88' }} />}
          </button>
        ))}
      </div>

      {tab === 'eval' ? (
        <LucidEvalTab trades={trades} manualBalance={evalBalance} setManualBalance={setEvalBalance} balanceInput={balanceInput} setBalanceInput={setBalanceInput} accountType={accountType} />
      ) : (
        <LucidFundedTab trades={trades} manualBalance={fundedBalance} setManualBalance={setFundedBalance} balanceInput={balanceInput} setBalanceInput={setBalanceInput} accountType={accountType} />
      )}
    </div>
  );
}
