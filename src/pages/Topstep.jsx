import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Constants ─────────────────────────────────────────────────
const FUNDED = {
  ACCOUNT_SIZE:  50000,
  MAX_LOSS:      2000,
  FLOOR_INITIAL: 48000,
  LOCK_LEVEL:    52000,
};

const COMBINE = {
  ACCOUNT_SIZE:       50000,
  MAX_LOSS:           2000,
  FLOOR_INITIAL:      48000,
  BASE_PROFIT_TARGET: 3000,
  MIN_DAYS:           2,
  CONSISTENCY_PCT:    0.50,
};

// ── Helpers ───────────────────────────────────────────────────

// Topstep utilise toujours le P&L net (après frais)
// result_net = PnL brut - commissions - frais
function getNet(trade) {
  if (trade.result_net != null) return trade.result_net;
  if (trade.result     != null) return trade.result;
  return 0;
}

function fmt(n, sign = false) {
  if (n == null || isNaN(n)) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}$`;
}
function pnlColor(v) {
  if (v > 0) return '#00ff88';
  if (v < 0) return '#ff4455';
  return '#8aaa90';
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(6,18,12,0.97)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', padding: '8px 12px', fontSize: '11px', fontFamily: 'inherit' }}>
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
    <div style={{
      background: alert ? 'rgba(255,68,85,0.06)' : 'rgba(10,28,18,0.5)',
      border: `1px solid ${alert ? 'rgba(255,68,85,0.3)' : 'rgba(0,255,136,0.08)'}`,
      borderTop: `2px solid ${color}`,
      borderRadius: '6px', padding: '14px 16px',
    }}>
      <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '9px', color: alert ? '#ff8888' : '#3a6a4a', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ label, current, max, color, displayText }) {
  const pct = Math.min((current / Math.max(max, 1)) * 100, 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label !== null && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {label && <span style={{ fontSize: '10px', color: '#8aaa90' }}>{label}</span>}
          <span style={{ fontSize: '10px', color, fontWeight: '700' }}>{displayText}</span>
        </div>
      )}
      <div style={{ height: '5px', background: 'rgba(0,255,136,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease', boxShadow: `0 0 6px ${color}60` }} />
      </div>
    </div>
  );
}

function DayDot({ date, pnl }) {
  const isWin = pnl > 0;
  return (
    <div title={`${date}: ${fmt(pnl, true)} (net)`} style={{
      width: '30px', height: '30px', borderRadius: '50%',
      background: isWin ? 'rgba(0,255,136,0.12)' : 'rgba(255,68,85,0.12)',
      border: `1.5px solid ${isWin ? '#00ff88' : '#ff4455'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '9px', color: isWin ? '#00ff88' : '#ff4455', fontWeight: '700',
      cursor: 'default',
    }}>
      {isWin ? '✓' : '✗'}
    </div>
  );
}

// ── Compute trailing drawdown from trades (using NET P&L) ─────
function computeTrailing(trades, manualBalance, accountSize, maxLoss) {
  const sorted = [...trades]
    .filter(t => getNet(t) !== 0 || t.result != null)
    .sort((a, b) => (a.entered_at || a.date).localeCompare(b.entered_at || b.date));

  let runBal = manualBalance > 0 ? manualBalance - trades.reduce((s,t) => s + getNet(t), 0) : accountSize;
  let hwm    = runBal;
  let floor  = runBal - maxLoss;

  // Group by day
  const byDayArr = sorted.reduce((acc, t) => {
    const last = acc[acc.length - 1];
    if (last && last.date === t.date) last.pnl += getNet(t);
    else acc.push({ date: t.date, pnl: getNet(t) });
    return acc;
  }, []);

  const points = [{ date: 'Start', balance: runBal, floor }];
  byDayArr.forEach(({ date, pnl }) => {
    runBal += pnl;
    if (runBal > hwm) { hwm = runBal; floor = hwm - maxLoss; }
    points.push({ date: date.slice(5), balance: Math.round(runBal * 100) / 100, floor: Math.round(floor * 100) / 100 });
  });

  return { points, hwm, floor, byDayArr };
}

// ── FUNDED TAB ────────────────────────────────────────────────
function FundedTab({ trades, manualBalance, setManualBalance, balanceInput, setBalanceInput }) {
  const { ACCOUNT_SIZE, MAX_LOSS, LOCK_LEVEL } = FUNDED;
  const [localOption, setLocalOption] = useState(localStorage.getItem('ts_payout_option') || 'A');

  const totalNet       = trades.reduce((s, t) => s + getNet(t), 0);
  const currentBalance = manualBalance > 0 ? manualBalance : ACCOUNT_SIZE + totalNet;
  const { points: equityPoints, hwm, floor } = computeTrailing(trades, manualBalance, ACCOUNT_SIZE, MAX_LOSS);

  const distanceToFloor = currentBalance - floor;
  const accountLost     = currentBalance <= floor;
  const isAboveLock     = currentBalance >= LOCK_LEVEL;

  // Daily NET P&L
  const byDay = trades.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = 0;
    acc[t.date] += getNet(t);
    return acc;
  }, {});
  const dailyArr = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b)).map(([date, pnl]) => ({ date: date.slice(5), pnl: Math.round(pnl * 100) / 100 }));
  const allDays  = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b));
  const winDays  = Object.values(byDay).filter(p => p > 0).length;

  // Payout Option B — consistency rule sur net P&L
  const posNetPnl  = trades.filter(t => getNet(t) > 0).reduce((s,t) => s + getNet(t), 0);
  const bestDayNet = Math.max(...Object.values(byDay).filter(p => p > 0), 0);
  const bestDayPct = posNetPnl > 0 ? (bestDayNet / posNetPnl) * 100 : 0;

  const optionAReady = winDays >= 5;
  const optionBReady = winDays >= 3 && bestDayPct <= 40;

  function selectOption(opt) { setLocalOption(opt); localStorage.setItem('ts_payout_option', opt); }

  const status = accountLost ? { label: 'COMPTE PERDU', color: '#ff4455' }
    : isAboveLock ? { label: '🔒 ZONE SÉCURISÉE', color: '#00ff88' }
    : distanceToFloor < 500 ? { label: '⚠️ DANGER', color: '#ff4455' }
    : distanceToFloor < 1000 ? { label: '⚡ ATTENTION', color: '#f0a020' }
    : { label: '✓ EN COURS', color: '#00cc66' };

  function saveBalance() {
    const v = parseFloat(balanceInput);
    if (!isNaN(v) && v > 0) { setManualBalance(v); localStorage.setItem('ts_balance', String(v)); setBalanceInput(''); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Net P&L notice */}
      <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '6px', padding: '10px 14px', fontSize: '10px', color: '#4a7a5a', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>ℹ️</span>
        <span>Tous les calculs utilisent le <strong style={{ color: '#00ff88' }}>P&L net</strong> (après commissions et frais), conformément aux règles Topstep.</span>
      </div>

      {/* Balance + status */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input type="number" placeholder="Balance réelle ($)" value={balanceInput}
            onChange={e => setBalanceInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveBalance()}
            style={{ background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '4px', padding: '6px 10px', color: '#c8d8c8', fontSize: '11px', fontFamily: 'inherit', outline: 'none', width: '160px' }} />
          <button onClick={saveBalance} style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', padding: '6px 12px', borderRadius: '4px', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer' }}>MAJ</button>
        </div>
        <div style={{ background: `rgba(${status.color==='#ff4455'?'255,68,85':status.color==='#f0a020'?'240,160,32':'0,255,136'},0.08)`, border: `1px solid ${status.color}40`, borderRadius: '6px', padding: '7px 14px', fontSize: '11px', fontWeight: '700', color: status.color }}>
          {status.label}
        </div>
        <div style={{ fontSize: '10px', color: '#3a6a4a' }}>
          P&L net total: <span style={{ color: pnlColor(totalNet), fontWeight: '700' }}>{fmt(totalNet, true)}</span>
        </div>
      </div>

      {/* Trailing drawdown */}
      <div style={{ background: accountLost ? 'rgba(255,68,85,0.06)' : 'rgba(10,28,18,0.4)', border: `1px solid ${distanceToFloor < 500 ? 'rgba(255,68,85,0.3)' : 'rgba(0,255,136,0.08)'}`, borderRadius: '8px', padding: '18px' }}>
        <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>⚠️ TRAILING DRAWDOWN (basé sur P&L net)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '14px' }}>
          <MetricCard label="BALANCE" value={`${currentBalance.toFixed(2)}$`} color={currentBalance >= LOCK_LEVEL ? '#00ff88' : '#c8d8c8'} sub={manualBalance > 0 ? 'Manuelle' : 'Estimée (net)'} />
          <MetricCard label="HIGH WATER MARK" value={`${hwm.toFixed(2)}$`} color="#f0a020" sub="Plus haut net atteint" />
          <MetricCard label="FLOOR" value={`${floor.toFixed(2)}$`} color="#ff4455" alert={distanceToFloor < 500} sub="Ne pas descendre sous" />
          <MetricCard label="MARGE" value={`${distanceToFloor.toFixed(2)}$`} color={distanceToFloor < 500 ? '#ff4455' : distanceToFloor < 1000 ? '#f0a020' : '#00ff88'} alert={distanceToFloor < 500} />
        </div>
        <div style={{ height: '18px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', width: `${Math.min((distanceToFloor / MAX_LOSS) * 100, 100)}%`, background: distanceToFloor < 500 ? 'linear-gradient(90deg,#ff4455,#ff6677)' : distanceToFloor < 1000 ? 'linear-gradient(90deg,#f0a020,#f0c040)' : 'linear-gradient(90deg,#00aa55,#00ff88)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>
            {distanceToFloor.toFixed(2)}$ de marge · Floor: {floor.toFixed(2)}$
          </div>
        </div>
        {isAboveLock && <div style={{ marginTop: '10px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', padding: '8px 12px', fontSize: '10px', color: '#00ff88' }}>🔒 Au-dessus de {LOCK_LEVEL}$ — trailing se stabilise.</div>}
      </div>

      {/* Payout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {[
          { key: 'A', title: '💸 PAYOUT STANDARD', desc: '5 jours gagnants minimum (net)', ready: optionAReady,
            body: <>
              <ProgressBar label="Jours gagnants (net > 0)" current={Math.min(winDays,5)} max={5} color={winDays>=5?'#00ff88':'#f0a020'} displayText={`${winDays}/5 jours`} />
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
                {allDays.slice(-7).map(([date,pnl]) => <DayDot key={date} date={date} pnl={pnl}/>)}
              </div>
              <div style={{ fontSize: '10px', color: optionAReady?'#00ff88':'#4a7a5a', marginTop: '8px' }}>
                {optionAReady ? '✅ Éligible au payout.' : `⏳ Encore ${5-winDays} jour(s) net positif requis.`}
              </div>
            </>
          },
          { key: 'B', title: '⚡ PAYOUT CONSISTENCY', desc: '3 jours + règle 40% sur P&L net', ready: optionBReady,
            body: <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <ProgressBar label="Jours gagnants net (min 3)" current={Math.min(winDays,3)} max={3} color={winDays>=3?'#00ff88':'#f0a020'} displayText={`${winDays}/3 jours`} />
                <ProgressBar label="Meilleur jour net / Total net positif" current={Math.min(bestDayPct,40)} max={40} color={bestDayPct<=40?'#00ff88':'#ff4455'} displayText={`${bestDayPct.toFixed(1)}%/40%`} />
              </div>
              <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                <div style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '4px', padding: '6px 8px' }}>
                  <div style={{ fontSize: '8px', color: '#3a6a4a', marginBottom: '2px' }}>MEILLEUR JOUR NET</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#00ff88' }}>{fmt(bestDayNet, true)}</div>
                </div>
                <div style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '4px', padding: '6px 8px' }}>
                  <div style={{ fontSize: '8px', color: '#3a6a4a', marginBottom: '2px' }}>TOTAL NET POSITIF</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#c8d8c8' }}>{fmt(posNetPnl, true)}</div>
                </div>
              </div>
              <div style={{ fontSize: '10px', color: optionBReady?'#00ff88':'#4a7a5a', marginTop: '8px' }}>
                {optionBReady ? '✅ Éligible au payout.' : winDays<3 ? `⏳ Encore ${3-winDays} jour(s) net positif.` : '⚠️ Meilleur jour net trop élevé.'}
              </div>
            </>
          },
        ].map(opt => (
          <div key={opt.key} onClick={() => selectOption(opt.key)} style={{ background: 'rgba(10,28,18,0.4)', border: `2px solid ${localOption===opt.key?'#00ff88':'rgba(0,255,136,0.08)'}`, borderRadius: '8px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${localOption===opt.key?'#00ff88':'#2a5a3a'}`, background: localOption===opt.key?'#00ff88':'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {localOption===opt.key && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#060c10' }} />}
                </div>
                <span style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px' }}>{opt.title}</span>
              </div>
              {opt.ready && localOption===opt.key && <span style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid #00ff88', color: '#00ff88', fontSize: '8px', padding: '2px 7px', borderRadius: '3px', fontWeight: '700' }}>ÉLIGIBLE ✓</span>}
            </div>
            <div style={{ fontSize: '10px', color: '#4a7a5a', marginBottom: '10px' }}>{opt.desc}</div>
            {opt.body}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>COURBE CAPITAL (P&L NET) + FLOOR</div>
          {equityPoints.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={equityPoints} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs><linearGradient id="balG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00ff88" stopOpacity={0.15}/><stop offset="95%" stopColor="#00ff88" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} domain={['auto','auto']} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={LOCK_LEVEL} stroke="#f0a020" strokeDasharray="4 4" strokeOpacity={0.4} />
                <Area type="monotone" dataKey="balance" name="Capital net" stroke="#00ff88" strokeWidth={2} fill="url(#balG)" dot={false} />
                <Area type="monotone" dataKey="floor" name="Floor" stroke="#ff4455" strokeWidth={1.5} fill="none" strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>Aucun trade</div>}
        </div>
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>P&L NET PAR JOUR</div>
          {dailyArr.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dailyArr} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Bar dataKey="pnl" name="P&L net" radius={[3,3,0,0]} fill="#00ff88" isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>Aucun trade</div>}
        </div>
      </div>
    </div>
  );
}

// ── COMBINE TAB ───────────────────────────────────────────────
function CombineTab({ trades, manualBalance, setManualBalance, balanceInput, setBalanceInput }) {
  const { ACCOUNT_SIZE, MAX_LOSS, BASE_PROFIT_TARGET, MIN_DAYS, CONSISTENCY_PCT } = COMBINE;

  // Tout en NET
  const totalNet       = trades.reduce((s, t) => s + getNet(t), 0);
  const currentBalance = manualBalance > 0 ? manualBalance : ACCOUNT_SIZE + totalNet;
  const { points: equityPoints, hwm, floor } = computeTrailing(trades, manualBalance, ACCOUNT_SIZE, MAX_LOSS);

  const distanceToFloor = currentBalance - floor;
  const accountLost     = currentBalance <= floor;

  // Daily NET P&L
  const byDay = trades.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = 0;
    acc[t.date] += getNet(t);
    return acc;
  }, {});
  const tradingDays = Object.keys(byDay).length;
  const allDays     = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b));
  const dailyArr    = allDays.map(([date, pnl]) => ({ date: date.slice(5), pnl: Math.round(pnl * 100) / 100 }));
  const winningDays = Object.values(byDay).filter(p => p > 0).length;

  // ── CONSISTENCY sur NET P&L ───────────────────────────────
  // Best day net = meilleur jour net
  const bestDayNet = Math.max(...Object.values(byDay).filter(p => p > 0), 0);

  // Limite = 50% du profit target actuel
  // Si best day net >= 50% du BASE target → nouveau target = best day / 0.50
  const baseLimit = BASE_PROFIT_TARGET * CONSISTENCY_PCT; // 1 500$
  const isConsistencyBreached = bestDayNet >= baseLimit && bestDayNet > 0;

  // Nouveau profit target dynamique
  const dynamicProfitTarget = isConsistencyBreached
    ? Math.ceil(bestDayNet / CONSISTENCY_PCT)
    : BASE_PROFIT_TARGET;

  const dynamicLimit   = dynamicProfitTarget * CONSISTENCY_PCT;
  const targetAdjusted = dynamicProfitTarget > BASE_PROFIT_TARGET;
  const targetBalance  = ACCOUNT_SIZE + dynamicProfitTarget;

  // Profit net actuel (depuis le début du combine)
  const netProfit   = Math.max(currentBalance - ACCOUNT_SIZE, 0);
  const targetReached = currentBalance >= targetBalance;

  // Validation rules
  const rule1_floor   = !accountLost;
  const rule2_target  = targetReached;
  const rule3_minDays = tradingDays >= MIN_DAYS;
  const allRulesPassed = rule1_floor && rule2_target && rule3_minDays;

  // Pourcentage consistency actuel
  const consistencyPct = dynamicProfitTarget > 0 ? (bestDayNet / dynamicProfitTarget) * 100 : 0;

  const status = accountLost ? { label: 'COMPTE PERDU ❌', color: '#ff4455' }
    : allRulesPassed ? { label: '✅ COMBINE VALIDÉ !', color: '#00ff88' }
    : { label: '⏳ EN COURS', color: '#f0a020' };

  function saveBalance() {
    const v = parseFloat(balanceInput);
    if (!isNaN(v) && v > 0) { setManualBalance(v); localStorage.setItem('ts_combine_balance', String(v)); setBalanceInput(''); }
  }

  const equityWithTarget = equityPoints.map(p => ({ ...p, target: targetBalance }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Net P&L notice */}
      <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '6px', padding: '10px 14px', fontSize: '10px', color: '#4a7a5a', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>ℹ️</span>
        <span>Topstep utilise uniquement le <strong style={{ color: '#00ff88' }}>P&L net</strong> (après frais). La Consistency Target est calculée sur le net profit.</span>
      </div>

      {/* Balance + status */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input type="number" placeholder="Balance réelle ($)" value={balanceInput}
            onChange={e => setBalanceInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveBalance()}
            style={{ background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '4px', padding: '6px 10px', color: '#c8d8c8', fontSize: '11px', fontFamily: 'inherit', outline: 'none', width: '160px' }} />
          <button onClick={saveBalance} style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', padding: '6px 12px', borderRadius: '4px', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer' }}>MAJ</button>
        </div>
        <div style={{ background: `rgba(${status.color==='#ff4455'?'255,68,85':status.color==='#00ff88'?'0,255,136':'240,160,32'},0.08)`, border: `1px solid ${status.color}40`, borderRadius: '6px', padding: '7px 14px', fontSize: '11px', fontWeight: '700', color: status.color }}>
          {status.label}
        </div>
      </div>

      {/* Consistency adjusted alert */}
      {targetAdjusted && (
        <div style={{ background: 'rgba(240,160,32,0.08)', border: '1px solid rgba(240,160,32,0.3)', borderRadius: '8px', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>⚡</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#f0a020', marginBottom: '4px' }}>
              Objectif ajusté — Consistency Target dépassée (sur P&L net)
            </div>
            <div style={{ fontSize: '10px', color: '#8aaa90', lineHeight: '1.6', marginBottom: '8px' }}>
              Ton meilleur jour net ({fmt(bestDayNet)}) dépasse 50% de l'objectif initial.
              Le compte ne fail PAS — l'objectif est recalculé automatiquement :
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { label: 'FORMULE', value: `${fmt(bestDayNet)} ÷ 0.50 = ${fmt(dynamicProfitTarget)}`, color: '#f0a020' },
                { label: 'ANCIEN TARGET', value: `+${BASE_PROFIT_TARGET}$`, color: '#8aaa90', strike: true },
                { label: 'NOUVEAU TARGET', value: `+${dynamicProfitTarget}$`, color: '#f0a020' },
              ].map(({ label, value, color, strike }) => (
                <div key={label} style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '4px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '8px', color: '#3a6a4a', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color, textDecoration: strike ? 'line-through' : 'none' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rules */}
      <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '18px' }}>
        <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>🎯 RÈGLES DU COMBINE (P&L NET)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Rule 1: Floor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: rule1_floor ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,85,0.06)', border: `1px solid ${rule1_floor ? 'rgba(0,255,136,0.12)' : 'rgba(255,68,85,0.3)'}`, borderRadius: '6px' }}>
            <span style={{ fontSize: '18px' }}>{rule1_floor ? '✅' : '❌'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#c8d8c8', fontWeight: '600', marginBottom: '2px' }}>Maximum Loss Limit</div>
              <div style={{ fontSize: '10px', color: '#4a7a5a' }}>Balance nette ≥ {COMBINE.FLOOR_INITIAL.toLocaleString()}$ · Floor actuel: {floor.toFixed(2)}$</div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: rule1_floor ? '#00ff88' : '#ff4455', flexShrink: 0 }}>
              {fmt(distanceToFloor)} de marge
            </div>
          </div>

          {/* Rule 2: Profit target */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: rule2_target ? 'rgba(0,255,136,0.04)' : 'rgba(10,28,18,0.4)', border: `1px solid ${rule2_target ? 'rgba(0,255,136,0.12)' : 'rgba(0,255,136,0.06)'}`, borderRadius: '6px' }}>
            <span style={{ fontSize: '18px' }}>{rule2_target ? '✅' : '⏳'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#c8d8c8', fontWeight: '600', marginBottom: '6px' }}>
                Profit Target (net) — Atteindre +{dynamicProfitTarget.toLocaleString()}$
                {targetAdjusted && <span style={{ fontSize: '9px', color: '#f0a020', marginLeft: '8px' }}>↑ AJUSTÉ</span>}
              </div>
              <ProgressBar
                label={null}
                current={Math.min(netProfit, dynamicProfitTarget)}
                max={dynamicProfitTarget}
                color={rule2_target ? '#00ff88' : '#f0a020'}
                displayText={`${fmt(netProfit, true)} / +${dynamicProfitTarget}$ (net)`}
              />
            </div>
          </div>

          {/* Rule 3: Min days */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: rule3_minDays ? 'rgba(0,255,136,0.04)' : 'rgba(10,28,18,0.4)', border: `1px solid ${rule3_minDays ? 'rgba(0,255,136,0.12)' : 'rgba(0,255,136,0.06)'}`, borderRadius: '6px' }}>
            <span style={{ fontSize: '18px' }}>{rule3_minDays ? '✅' : '⏳'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#c8d8c8', fontWeight: '600', marginBottom: '8px' }}>
                Jours de trading minimum ({MIN_DAYS} jours)
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {allDays.slice(0, 6).map(([date, pnl]) => <DayDot key={date} date={date} pnl={pnl} />)}
                {Array.from({ length: Math.max(0, MIN_DAYS - tradingDays) }).map((_, i) => (
                  <div key={i} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px dashed #1a3a22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#2a4a30' }}>—</div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: rule3_minDays ? '#00ff88' : '#f0a020', flexShrink: 0 }}>
              {tradingDays}/{MIN_DAYS}
            </div>
          </div>

          {/* Rule 4: Consistency (informative — adjusts target, no fail) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(10,28,18,0.3)', border: `1px solid ${isConsistencyBreached ? 'rgba(240,160,32,0.3)' : 'rgba(0,255,136,0.06)'}`, borderRadius: '6px' }}>
            <span style={{ fontSize: '18px' }}>{isConsistencyBreached ? '⚡' : bestDayNet > 0 ? '✅' : '⏳'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#c8d8c8', fontWeight: '600', marginBottom: '4px' }}>
                Consistency Target — Meilleur jour net {'<'} 50% du Profit Target
              </div>
              <div style={{ fontSize: '9px', color: '#4a7a5a', marginBottom: '8px' }}>
                {isConsistencyBreached
                  ? `⚡ Dépassée — l'objectif est ajusté automatiquement (pas de fail)`
                  : `✓ Respectée — meilleur jour net: ${fmt(bestDayNet)} / limite: ${fmt(dynamicLimit)}`}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
                <div style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '4px', padding: '7px', textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', color: '#3a6a4a', marginBottom: '2px' }}>MEILLEUR JOUR NET</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: isConsistencyBreached ? '#f0a020' : '#00ff88' }}>{fmt(bestDayNet, true)}</div>
                </div>
                <div style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '4px', padding: '7px', textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', color: '#3a6a4a', marginBottom: '2px' }}>LIMITE (50% du target)</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#c8d8c8' }}>{fmt(dynamicLimit)}</div>
                </div>
                <div style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '4px', padding: '7px', textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', color: '#3a6a4a', marginBottom: '2px' }}>% DU TARGET NET</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: isConsistencyBreached ? '#f0a020' : '#00ff88' }}>
                    {consistencyPct.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
        <MetricCard label="BALANCE NETTE" value={`${currentBalance.toFixed(2)}$`} color={rule2_target ? '#00ff88' : '#c8d8c8'} sub={manualBalance > 0 ? 'Manuelle' : 'Estimée'} />
        <MetricCard label="PROFIT NET" value={fmt(netProfit, true)} color={pnlColor(netProfit)} sub={`Objectif: +${dynamicProfitTarget}$ ${targetAdjusted ? '(ajusté ⚡)' : ''}`} />
        <MetricCard label="FLOOR" value={`${floor.toFixed(2)}$`} color="#ff4455" alert={distanceToFloor < 500} sub={`Marge nette: ${distanceToFloor.toFixed(2)}$`} />
        <MetricCard label="JOURS TRADÉS" value={`${tradingDays}`} color={rule3_minDays ? '#00ff88' : '#f0a020'} sub={`Min: ${MIN_DAYS} · Gagnants net: ${winningDays}`} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>
            PROGRESSION NETTE — Objectif: +{dynamicProfitTarget}$ {targetAdjusted ? '⚡' : ''}
          </div>
          {equityWithTarget.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={equityWithTarget} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs><linearGradient id="combGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00ff88" stopOpacity={0.15}/><stop offset="95%" stopColor="#00ff88" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} domain={['auto','auto']} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={targetBalance} stroke={targetAdjusted ? '#f0a020' : '#00ff88'} strokeDasharray="4 4" strokeOpacity={0.6}
                  label={{ value: `${(targetBalance/1000).toFixed(1)}K`, fill: targetAdjusted ? '#f0a020' : '#00ff88', fontSize: 8 }} />
                <ReferenceLine y={COMBINE.FLOOR_INITIAL} stroke="#ff4455" strokeDasharray="4 4" strokeOpacity={0.5}
                  label={{ value: '48K', fill: '#ff4455', fontSize: 8 }} />
                <Area type="monotone" dataKey="balance" name="Capital net" stroke="#00ff88" strokeWidth={2} fill="url(#combGrad)" dot={false} />
                <Area type="monotone" dataKey="floor" name="Floor" stroke="#ff4455" strokeWidth={1.5} fill="none" strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>Aucun trade</div>}
        </div>

        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>P&L NET PAR JOUR</div>
          {dailyArr.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dailyArr} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <ReferenceLine y={dynamicLimit} stroke={targetAdjusted ? '#f0a020' : '#3a6a4a'} strokeDasharray="4 4" strokeOpacity={0.6}
                  label={{ value: `Limite ${dynamicLimit.toFixed(0)}$`, fill: targetAdjusted ? '#f0a020' : '#3a6a4a', fontSize: 8, position: 'right' }} />
                <Bar dataKey="pnl" name="P&L net" radius={[3,3,0,0]} fill="#00ff88" isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>Aucun trade</div>}
        </div>
      </div>

      {/* Success */}
      {allRulesPassed && (
        <div style={{ background: 'rgba(0,255,136,0.08)', border: '2px solid #00ff88', borderRadius: '8px', padding: '20px', textAlign: 'center', boxShadow: '0 0 30px rgba(0,255,136,0.1)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#00ff88', marginBottom: '6px' }}>TRADING COMBINE VALIDÉ !</div>
          <div style={{ fontSize: '11px', color: '#4a7a5a' }}>Toutes les règles sont respectées sur P&L net. Tu peux demander ton compte Express Funded.</div>
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function Topstep() {
  const navigate = useNavigate();
  const [tab, setTab]               = useState(() => localStorage.getItem('ts_tab') || 'combine');
  const [trades, setTrades]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fundedBalance, setFundedBalance]   = useState(() => parseFloat(localStorage.getItem('ts_balance') || '0') || 0);
  const [combineBalance, setCombineBalance] = useState(() => parseFloat(localStorage.getItem('ts_combine_balance') || '0') || 0);
  const [balanceInput, setBalanceInput]     = useState('');

  useEffect(() => {
    (async () => {
      const res = await window.db.getAllTrades();
      if (res.ok) setTrades(res.data);
      setLoading(false);
    })();
  }, []);

  function switchTab(t) { setTab(t); localStorage.setItem('ts_tab', t); setBalanceInput(''); }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3a6a4a', fontSize: '11px', letterSpacing: '2px' }}>CHARGEMENT...</div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1100px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>TOPSTEP</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>
            {tab === 'funded' ? '💰 Express Funded — 50K' : '🎯 Trading Combine — 50K'}
          </h1>
        </div>
        <button onClick={() => navigate('/calendar')} style={{ background: 'transparent', border: '1px solid #1a3a22', color: '#4a7a5a', padding: '7px 14px', borderRadius: '5px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.borderColor = '#00ff88'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#4a7a5a'; e.currentTarget.style.borderColor = '#1a3a22'; }}
        >📅 Calendrier</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', marginBottom: '20px', background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '8px', padding: '4px' }}>
        {[
          { key: 'combine', label: '🎯 Trading Combine', desc: 'Compte démo · Validation' },
          { key: 'funded',  label: '💰 Express Funded',  desc: 'Compte live · Payout' },
        ].map(({ key, label, desc }) => (
          <button key={key} onClick={() => switchTab(key)} style={{ flex: 1, padding: '12px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: tab === key ? 'rgba(0,255,136,0.12)' : 'transparent', fontFamily: 'inherit' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: tab === key ? '#00ff88' : '#5a8a6a', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '9px', color: tab === key ? '#3a8a4a' : '#3a5a3a' }}>{desc}</div>
            {tab === key && <div style={{ height: '2px', background: '#00ff88', borderRadius: '2px', marginTop: '8px', boxShadow: '0 0 6px #00ff88' }} />}
          </button>
        ))}
      </div>

      {tab === 'funded' ? (
        <FundedTab trades={trades} manualBalance={fundedBalance} setManualBalance={setFundedBalance} balanceInput={balanceInput} setBalanceInput={setBalanceInput} />
      ) : (
        <CombineTab trades={trades} manualBalance={combineBalance} setManualBalance={setCombineBalance} balanceInput={balanceInput} setBalanceInput={setBalanceInput} />
      )}
    </div>
  );
}
