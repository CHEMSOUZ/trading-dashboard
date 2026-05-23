import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
} from 'recharts';

// ── Helpers ───────────────────────────────────────────────────
function getNet(trade) {
  return trade.result_net ?? trade.result ?? 0;
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

const DOW_LABELS    = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const HOUR_SESSIONS = [
  { label: 'Asie',     start: 0,  end: 9,  color: '#aa88ff' },
  { label: 'Londres',  start: 8,  end: 15, color: '#00aaff' },
  { label: 'New York', start: 13, end: 22, color: '#00ff88' },
  { label: 'Hors séance', start: 22, end: 24, color: '#f0a020' },
];

function getSession(hour) {
  // Sessions overlap — priority: New York > Londres > Asie > Hors séance
  if (hour >= 13 && hour < 22) return HOUR_SESSIONS[2]; // New York
  if (hour >= 8  && hour < 15) return HOUR_SESSIONS[1]; // Londres
  if (hour >= 0  && hour < 9)  return HOUR_SESSIONS[0]; // Asie
  return HOUR_SESSIONS[3]; // Hors séance
}

// ── Custom Tooltip ────────────────────────────────────────────
function CTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(6,18,12,0.97)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', fontFamily: 'inherit' }}>
      <div style={{ color: '#3a6a4a', marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: (p.value ?? 0) >= 0 ? '#00ff88' : '#ff4455', fontWeight: '700' }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value, true) : p.value}
        </div>
      ))}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#c8d8c8' }) {
  return (
    <div style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.08)', borderTop: `2px solid ${color}`, borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#4a7a5a', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', fontWeight: '700' }}>{title}</div>
      {children}
    </div>
  );
}

// ── Insight Card ──────────────────────────────────────────────
function InsightCard({ icon, title, value, desc, color }) {
  return (
    <div style={{ background: `rgba(${color === '#00ff88' ? '0,255,136' : color === '#ff4455' ? '255,68,85' : color === '#00aaff' ? '0,170,255' : '240,160,32'},0.06)`, border: `1px solid ${color}25`, borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ fontSize: '28px', flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '3px' }}>{title}</div>
        <div style={{ fontSize: '16px', fontWeight: '700', color, marginBottom: '3px' }}>{value}</div>
        <div style={{ fontSize: '11px', color: '#4a7a5a' }}>{desc}</div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function GlobalView() {
  const [allTrades, setAllTrades]   = useState([]);
  const [accounts, setAccounts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState([]); // empty = all

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load all accounts
      const accRes = await window.accounts.getAll();
      if (!accRes.ok) return;
      const accs = accRes.data.accounts;
      setAccounts(accs);

      // Load trades from ALL accounts by switching temporarily
      const activeRes = await window.accounts.getActive();
      const currentActiveId = activeRes.ok ? activeRes.data?.id : null;

      const allT = [];
      for (const acc of accs) {
        await window.accounts.setActive(acc.id);
        const tRes = await window.db.getAllTrades();
        if (tRes.ok) {
          tRes.data.forEach(t => allT.push({ ...t, _accountId: acc.id, _accountName: acc.name, _accountColor: acc.color }));
        }
      }

      // Restore original active account
      if (currentActiveId) await window.accounts.setActive(currentActiveId);

      setAllTrades(allT);
    } catch (e) {
      console.error('GlobalView load error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter by selected accounts
  const trades = selectedAccounts.length === 0
    ? allTrades
    : allTrades.filter(t => selectedAccounts.includes(t._accountId));

  // ── Global stats ──────────────────────────────────────────
  const total    = trades.length;
  const pnl      = trades.reduce((s, t) => s + getNet(t), 0);
  const wins     = trades.filter(t => getNet(t) > 0).length;
  const losses   = trades.filter(t => getNet(t) < 0).length;
  const winrate  = total > 0 ? (wins / total) * 100 : 0;
  const grossW   = trades.filter(t => getNet(t) > 0).reduce((s,t) => s + getNet(t), 0);
  const grossL   = trades.filter(t => getNet(t) < 0).reduce((s,t) => s + Math.abs(getNet(t)), 0);
  const pf       = grossL > 0 ? grossW / grossL : grossW > 0 ? 999 : 0;
  const fees     = trades.reduce((s,t) => s + (t.fees ?? 0) + (t.commissions ?? 0), 0);

  // ── By account ────────────────────────────────────────────
  const byAccount = accounts.map(acc => {
    const accTrades = trades.filter(t => t._accountId === acc.id);
    const accPnl    = accTrades.reduce((s,t) => s + getNet(t), 0);
    const accWins   = accTrades.filter(t => getNet(t) > 0).length;
    const accWR     = accTrades.length > 0 ? (accWins / accTrades.length) * 100 : 0;
    return { name: acc.name, color: acc.color, total: accTrades.length, pnl: accPnl, wr: accWR };
  }).filter(a => a.total > 0);

  // ── By day of week ────────────────────────────────────────
  const byDow = DOW_LABELS.map((label, i) => {
    const dayTrades = trades.filter(t => new Date(t.date).getDay() === i);
    const dayPnl    = dayTrades.reduce((s,t) => s + getNet(t), 0);
    const dayWins   = dayTrades.filter(t => getNet(t) > 0).length;
    const dayWR     = dayTrades.length > 0 ? Math.round((dayWins / dayTrades.length) * 100) : 0;
    return { label, pnl: Math.round(dayPnl * 100) / 100, count: dayTrades.length, wr: dayWR };
  });

  // ── By hour ───────────────────────────────────────────────
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const hourTrades = trades.filter(t => {
      if (!t.entered_at) return false;
      const hour = new Date(t.entered_at).getHours();
      return hour === h;
    });
    const hourPnl  = hourTrades.reduce((s,t) => s + getNet(t), 0);
    const hourWins = hourTrades.filter(t => getNet(t) > 0).length;
    const hourWR   = hourTrades.length > 0 ? Math.round((hourWins / hourTrades.length) * 100) : 0;
    const session  = getSession(h);
    return { label: `${h}h`, pnl: Math.round(hourPnl * 100) / 100, count: hourTrades.length, wr: hourWR, sessionColor: session.color };
  }).filter(h => h.count > 0);

  // ── By session (chevauchements pris en compte) ───────────
  const bySessions = HOUR_SESSIONS.map(session => {
    const sessionTrades = trades.filter(t => {
      if (!t.entered_at) return false;
      const hour = new Date(t.entered_at).getHours();
      // Assign trade to its dominant session via getSession
      return getSession(hour) === session;
    });
    const sessionPnl  = sessionTrades.reduce((s,t) => s + getNet(t), 0);
    const sessionWins = sessionTrades.filter(t => getNet(t) > 0).length;
    const sessionWR   = sessionTrades.length > 0 ? Math.round((sessionWins / sessionTrades.length) * 100) : 0;
    return { ...session, pnl: sessionPnl, count: sessionTrades.length, wr: sessionWR };
  });

  // ── By pair ───────────────────────────────────────────────
  const byPair = trades.reduce((acc, t) => {
    if (!acc[t.pair]) acc[t.pair] = { total: 0, wins: 0, pnl: 0 };
    acc[t.pair].total++;
    if (getNet(t) > 0) acc[t.pair].wins++;
    acc[t.pair].pnl += getNet(t);
    return acc;
  }, {});
  const pairArr = Object.entries(byPair)
    .sort(([,a],[,b]) => b.total - a.total)
    .map(([pair, d]) => ({ pair, ...d, wr: Math.round(d.wins / d.total * 100) }));

  // ── By emotion ────────────────────────────────────────────
  const byEmotion = trades.reduce((acc, t) => {
    const em = t.emotion ?? 'Inconnu';
    if (!acc[em]) acc[em] = { total: 0, wins: 0, pnl: 0 };
    acc[em].total++;
    if (getNet(t) > 0) acc[em].wins++;
    acc[em].pnl += getNet(t);
    return acc;
  }, {});
  const emotionArr = Object.entries(byEmotion)
    .sort(([,a],[,b]) => b.total - a.total)
    .map(([em, d]) => ({ em, ...d, wr: Math.round(d.wins / d.total * 100) }));

  // ── Key insights ──────────────────────────────────────────
  const bestDow     = [...byDow].filter(d => d.count > 0).sort((a,b) => b.pnl - a.pnl)[0];
  const worstDow    = [...byDow].filter(d => d.count > 0).sort((a,b) => a.pnl - b.pnl)[0];
  const bestSession  = [...bySessions].filter(s => s.count >= 3).sort((a,b) => b.wr - a.wr)[0];
  const worstSession = [...bySessions].filter(s => s.count >= 3).sort((a,b) => a.wr - b.wr)[0];
  const bestPair    = [...pairArr].sort((a,b) => b.pnl - a.pnl)[0];
  const bestEmotion = [...emotionArr].filter(e => e.total >= 2).sort((a,b) => b.wr - a.wr)[0];
  const bestHour    = [...byHour].filter(h => h.count >= 2).sort((a,b) => b.pnl - a.pnl)[0];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3a6a4a', fontSize: '12px', letterSpacing: '2px' }}>CHARGEMENT DE TOUS LES COMPTES...</div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>ANALYSE GLOBALE</div>
          <h1 style={{ fontSize: '23px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Vue Globale</h1>
          <div style={{ fontSize: '12px', color: '#3a6a4a', marginTop: '3px' }}>
            {accounts.length} compte{accounts.length > 1 ? 's' : ''} · {total} trades · P&L net: <span style={{ color: pnlColor(pnl), fontWeight: '700' }}>{fmt(pnl, true)}</span>
          </div>
        </div>
        <button onClick={load} style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88', padding: '8px 14px', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px' }}>
          🔄 Actualiser
        </button>
      </div>

      {/* Account filter */}
      {accounts.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '1px' }}>FILTRER :</span>
          <button onClick={() => setSelectedAccounts([])} style={{ padding: '5px 12px', borderRadius: '4px', border: `1px solid ${selectedAccounts.length === 0 ? '#00ff88' : '#1a3a22'}`, background: selectedAccounts.length === 0 ? 'rgba(0,255,136,0.1)' : 'transparent', color: selectedAccounts.length === 0 ? '#00ff88' : '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>
            Tous
          </button>
          {accounts.map(acc => {
            const active = selectedAccounts.includes(acc.id);
            return (
              <button key={acc.id} onClick={() => setSelectedAccounts(prev => active ? prev.filter(id => id !== acc.id) : [...prev, acc.id])}
                style={{ padding: '5px 12px', borderRadius: '4px', border: `1px solid ${active ? acc.color : '#1a3a22'}`, background: active ? `${acc.color}15` : 'transparent', color: active ? acc.color : '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: acc.color }} />
                {acc.name}
              </button>
            );
          })}
        </div>
      )}

      {total === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', border: '1px dashed #1a3a22', borderRadius: '8px', color: '#2a4a30', fontSize: '13px' }}>
          Aucun trade trouvé sur les comptes sélectionnés
        </div>
      ) : (
        <>
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '20px' }}>
            <StatCard label="P&L NET TOTAL" value={fmt(pnl, true)} color={pnlColor(pnl)} sub={`Frais: -${fees.toFixed(2)}$`} />
            <StatCard label="WINRATE GLOBAL" value={`${winrate.toFixed(1)}%`} color={winrate >= 50 ? '#00ff88' : '#ff4455'} sub={`${wins}W / ${losses}L`} />
            <StatCard label="PROFIT FACTOR" value={pf === 999 ? '∞' : pf.toFixed(2)} color={pf >= 1.5 ? '#00ff88' : '#f0a020'} />
            <StatCard label="TOTAL TRADES" value={total} color="#c8d8c8" sub={`${accounts.length} compte${accounts.length > 1 ? 's' : ''}`} />
            <StatCard label="MOYENNE / TRADE" value={fmt(pnl / Math.max(total, 1), true)} color={pnlColor(pnl / Math.max(total, 1))} />
          </div>

          {/* ── KEY INSIGHTS ── */}
          <div style={{ marginBottom: '20px' }}>

            {/* Points forts */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ height: '1px', flex: 1, background: 'rgba(0,255,136,0.1)' }} />
              <span style={{ fontSize: '11px', color: '#00ff88', letterSpacing: '2px', fontWeight: '700', whiteSpace: 'nowrap' }}>✅ TES POINTS FORTS</span>
              <div style={{ height: '1px', flex: 1, background: 'rgba(0,255,136,0.1)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
              {bestDow     && <InsightCard icon="📅" title="MEILLEUR JOUR"        value={bestDow.label}      desc={`${fmt(bestDow.pnl, true)} · ${bestDow.wr}% WR`}             color="#00ff88" />}
              {bestSession && <InsightCard icon="⏰" title="MEILLEURE SESSION"     value={bestSession.label}  desc={`${bestSession.wr}% WR · ${bestSession.count} trades`}       color={bestSession.color} />}
              {bestHour    && <InsightCard icon="🎯" title="HEURE OPTIMALE"        value={bestHour.label}     desc={`${fmt(bestHour.pnl, true)} · ${bestHour.wr}% WR`}           color="#00ff88" />}
              {bestPair    && <InsightCard icon="📈" title="INSTRUMENT PHARE"      value={bestPair.pair}      desc={`${fmt(bestPair.pnl, true)} · ${bestPair.wr}% WR`}           color="#00aaff" />}
              {bestEmotion && <InsightCard icon="🧠" title="MEILLEUR ÉTAT MENTAL"  value={bestEmotion.em}     desc={`${bestEmotion.wr}% WR sur ${bestEmotion.total} trades`}     color="#aa88ff" />}
            </div>

            {/* Points faibles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ height: '1px', flex: 1, background: 'rgba(255,68,85,0.1)' }} />
              <span style={{ fontSize: '11px', color: '#ff4455', letterSpacing: '2px', fontWeight: '700', whiteSpace: 'nowrap' }}>❌ TES POINTS FAIBLES</span>
              <div style={{ height: '1px', flex: 1, background: 'rgba(255,68,85,0.1)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
              {worstDow     && <InsightCard icon="📅" title="PIRE JOUR"           value={worstDow.label}      desc={`${fmt(worstDow.pnl, true)} · ${worstDow.wr}% WR`}            color="#ff4455" />}
              {worstSession && <InsightCard icon="⏰" title="PIRE SESSION" value={worstSession.label} desc={`${worstSession.wr}% WR · ${worstSession.count} trades`} color="#ff4455" />}
              {(() => {
                const worst = [...byHour].filter(h => h.count >= 2).sort((a,b) => a.pnl - b.pnl)[0];
                return worst ? <InsightCard icon="🕐" title="HEURE À ÉVITER"     value={worst.label}         desc={`${fmt(worst.pnl, true)} · ${worst.wr}% WR`}                 color="#ff4455" /> : null;
              })()}
              {(() => {
                const worst = [...pairArr].filter(p => p.total >= 2).sort((a,b) => a.pnl - b.pnl)[0];
                return worst ? <InsightCard icon="📉" title="INSTRUMENT À REVOIR" value={worst.pair}          desc={`${fmt(worst.pnl, true)} · ${worst.wr}% WR`}                 color="#ff4455" /> : null;
              })()}
              {(() => {
                const worst = [...emotionArr].filter(e => e.total >= 2).sort((a,b) => a.wr - b.wr)[0];
                return worst ? <InsightCard icon="😟" title="PIRE ÉTAT MENTAL"   value={worst.em}            desc={`${worst.wr}% WR sur ${worst.total} trades`}                  color="#ff4455" /> : null;
              })()}
            </div>
          </div>

          {/* ── CHARTS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

            {/* By DOW */}
            <Section title="📅 P&L NET PAR JOUR DE LA SEMAINE">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byDow.filter(d => d.count > 0)} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                  <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                  <Tooltip content={<CTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                  <Bar dataKey="pnl" name="P&L net" radius={[3,3,0,0]} fill="#00ff88" isAnimationActive />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {byDow.filter(d => d.count > 0).map(d => (
                  <div key={d.label} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '4px', padding: '5px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#4a7a5a', marginBottom: '2px' }}>{d.label}</div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: pnlColor(d.pnl) }}>{fmt(d.pnl, true)}</div>
                    <div style={{ fontSize: '10px', color: d.wr >= 50 ? '#00ff88' : '#ff4455' }}>{d.wr}% WR</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* By session */}
            <Section title="⏰ PERFORMANCE PAR SESSION">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {bySessions.filter(s => s.count > 0).map(s => (
                  <div key={s.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                        <span style={{ fontSize: '13px', color: '#c8d8c8', fontWeight: '600' }}>{s.label}</span>
                        <span style={{ fontSize: '11px', color: '#4a7a5a' }}>{s.start}h-{s.end}h</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: pnlColor(s.pnl), fontWeight: '700' }}>{fmt(s.pnl, true)}</span>
                        <span style={{ fontSize: '12px', color: s.wr >= 50 ? '#00ff88' : '#ff4455' }}>{s.wr}% WR</span>
                        <span style={{ fontSize: '11px', color: '#3a6a4a' }}>{s.count}T</span>
                      </div>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.wr}%`, background: s.color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
                {bySessions.every(s => s.count === 0) && (
                  <div style={{ color: '#2a4a30', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Pas assez de données horaires — importez via CSV TopstepX</div>
                )}
              </div>
            </Section>
          </div>

          {/* By hour */}
          {byHour.length > 0 && (
            <Section title="🕐 P&L NET PAR HEURE D'ENTRÉE">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={byHour} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                  <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                  <Tooltip content={<CTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                  <Bar dataKey="pnl" name="P&L net" radius={[3,3,0,0]} isAnimationActive>
                    {byHour.map((h, i) => <Cell key={i} fill={h.sessionColor} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Asie',        hours: '0h-9h',  color: '#aa88ff' },
                  { label: 'Londres',     hours: '8h-15h', color: '#00aaff' },
                  { label: 'New York',    hours: '13h-22h',color: '#00ff88' },
                  { label: 'Hors séance', hours: '22h-0h', color: '#f0a020' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: s.color }} />
                    <span style={{ fontSize: '11px', color: '#4a7a5a' }}>{s.label} ({s.hours})</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>

            {/* By pair */}
            <Section title="📊 PERFORMANCE PAR INSTRUMENT">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pairArr.slice(0, 8).map(p => (
                  <div key={p.pair}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', color: '#c8d8c8', fontWeight: '600' }}>{p.pair}</span>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: pnlColor(p.pnl), fontWeight: '700' }}>{fmt(p.pnl, true)}</span>
                        <span style={{ fontSize: '12px', color: p.wr >= 50 ? '#00ff88' : '#ff4455' }}>{p.wr}% WR</span>
                        <span style={{ fontSize: '11px', color: '#3a6a4a' }}>{p.total}T</span>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(0,255,136,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.wr}%`, background: p.pnl >= 0 ? '#00ff88' : '#ff4455', borderRadius: '2px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
                {pairArr.length === 0 && <div style={{ color: '#2a4a30', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Aucune donnée</div>}
              </div>
            </Section>

            {/* By emotion */}
            <Section title="🧠 PERFORMANCE PAR ÉTAT MENTAL">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {emotionArr.length === 0 ? (
                  <div style={{ color: '#2a4a30', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Renseigne ton émotion sur chaque trade pour voir cette analyse</div>
                ) : emotionArr.map(e => (
                  <div key={e.em} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'rgba(10,28,18,0.4)', borderRadius: '5px', border: '1px solid rgba(0,255,136,0.06)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: '#c8d8c8', fontWeight: '600', marginBottom: '2px' }}>{e.em}</div>
                      <div style={{ fontSize: '11px', color: '#4a7a5a' }}>{e.total} trade{e.total > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: pnlColor(e.pnl) }}>{fmt(e.pnl, true)}</div>
                      <div style={{ fontSize: '12px', color: e.wr >= 50 ? '#00ff88' : '#ff4455' }}>{e.wr}% WR</div>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `conic-gradient(${e.wr >= 50 ? '#00ff88' : '#ff4455'} ${e.wr * 3.6}deg, rgba(10,28,18,0.8) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#060c10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: e.wr >= 50 ? '#00ff88' : '#ff4455' }}>{e.wr}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* By account */}
          {byAccount.length > 1 && (
            <div style={{ marginTop: '16px' }}>
              <Section title="🏦 PERFORMANCE PAR COMPTE">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '10px' }}>
                  {byAccount.map(acc => (
                    <div key={acc.name} style={{ background: 'rgba(10,28,18,0.5)', border: `1px solid ${acc.color}25`, borderLeft: `3px solid ${acc.color}`, borderRadius: '6px', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: acc.color }} />
                        <span style={{ fontSize: '13px', color: '#c8d8c8', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</span>
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: pnlColor(acc.pnl), marginBottom: '4px' }}>{fmt(acc.pnl, true)}</div>
                      <div style={{ fontSize: '12px', color: acc.wr >= 50 ? '#00ff88' : '#ff4455' }}>{acc.wr.toFixed(1)}% WR · {acc.total}T</div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
