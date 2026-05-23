import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

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

const DOW_LABELS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const HOUR_SESSIONS = [
  { label: 'Asie',        start: 0,  end: 9,  color: '#aa88ff' },
  { label: 'Londres',     start: 8,  end: 15, color: '#00aaff' },
  { label: 'New York',    start: 13, end: 22, color: '#00ff88' },
  { label: 'Hors séance', start: 22, end: 24, color: '#f0a020' },
];
function getSession(h) {
  if (h >= 13 && h < 22) return HOUR_SESSIONS[2];
  if (h >= 8  && h < 15) return HOUR_SESSIONS[1];
  if (h >= 0  && h < 9)  return HOUR_SESSIONS[0];
  return HOUR_SESSIONS[3];
}

// ── Tooltip ───────────────────────────────────────────────────
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

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#c8d8c8' }) {
  return (
    <div style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.08)', borderTop: `2px solid ${color}`, borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#4a7a5a', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', fontWeight: '700' }}>{title}</div>
      {children}
    </div>
  );
}

// ── Insight Card (clickable) ──────────────────────────────────
function InsightCard({ icon, title, value, desc, color, onClick }) {
  const rgb = color === '#00ff88' ? '0,255,136'
    : color === '#ff4455' ? '255,68,85'
    : color === '#00aaff' ? '0,170,255'
    : color === '#aa88ff' ? '170,136,255'
    : '240,160,32';
  return (
    <div onClick={onClick} style={{ background: `rgba(${rgb},0.06)`, border: `1px solid ${color}25`, borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = `rgba(${rgb},0.12)`; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.background = `rgba(${rgb},0.06)`; }}
    >
      <div style={{ fontSize: '28px', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '3px' }}>{title}</div>
        <div style={{ fontSize: '16px', fontWeight: '700', color, marginBottom: '3px' }}>{value}</div>
        <div style={{ fontSize: '11px', color: '#4a7a5a' }}>{desc}</div>
      </div>
      {onClick && <div style={{ fontSize: '16px', color: `${color}80`, flexShrink: 0 }}>›</div>}
    </div>
  );
}

// ── Session Trades Modal ──────────────────────────────────────
function SessionModal({ session, trades, onClose }) {
  const sessionTrades = trades.filter(t => {
    if (!t.entered_at) return false;
    return getSession(new Date(t.entered_at).getHours()) === session;
  }).sort((a,b) => new Date(b.entered_at || b.date) - new Date(a.entered_at || a.date));

  const wins   = sessionTrades.filter(t => getNet(t) > 0);
  const losses = sessionTrades.filter(t => getNet(t) < 0);
  const pnl    = sessionTrades.reduce((s,t) => s + getNet(t), 0);
  const wr     = sessionTrades.length > 0 ? Math.round((wins.length / sessionTrades.length) * 100) : 0;

  const [filter, setFilter] = useState('ALL');
  const filtered = filter === 'WIN' ? wins : filter === 'LOSS' ? losses : sessionTrades;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#070d12', border: `1px solid ${session.color}40`, borderRadius: '10px', width: '100%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,255,136,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: session.color }} />
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#e8f8e8' }}>Session {session.label}</span>
              <span style={{ fontSize: '12px', color: '#4a7a5a' }}>{session.start}h – {session.end}h</span>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span style={{ fontSize: '13px', color: pnlColor(pnl), fontWeight: '700' }}>{fmt(pnl, true)}</span>
              <span style={{ fontSize: '13px', color: wr >= 50 ? '#00ff88' : '#ff4455' }}>{wr}% WR</span>
              <span style={{ fontSize: '13px', color: '#4a7a5a' }}>{sessionTrades.length} trades</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', padding: '14px 24px', borderBottom: '1px solid rgba(0,255,136,0.06)', flexShrink: 0 }}>
          {[
            { label: 'GAGNANTS', value: wins.length, pnl: wins.reduce((s,t) => s+getNet(t),0), color: '#00ff88' },
            { label: 'PERDANTS', value: losses.length, pnl: losses.reduce((s,t) => s+getNet(t),0), color: '#ff4455' },
            { label: 'FRAIS', value: `${sessionTrades.reduce((s,t)=>s+(t.fees??0)+(t.commissions??0),0).toFixed(2)}$`, color: '#f0a020' },
          ].map(({ label, value, pnl: p, color }) => (
            <div key={label} style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '6px', padding: '10px 14px', borderTop: `2px solid ${color}` }}>
              <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '1.5px', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</div>
              {p != null && <div style={{ fontSize: '11px', color, marginTop: '2px' }}>{fmt(p, true)}</div>}
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '6px', padding: '10px 24px', borderBottom: '1px solid rgba(0,255,136,0.06)', flexShrink: 0 }}>
          {['ALL','WIN','LOSS'].map(f => {
            const c = f === 'WIN' ? '#00ff88' : f === 'LOSS' ? '#ff4455' : '#00ff88';
            return (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 12px', borderRadius: '4px', border: `1px solid ${filter===f?c:'#1a3a22'}`, background: filter===f?`rgba(${f==='WIN'?'0,255,136':f==='LOSS'?'255,68,85':'0,255,136'},0.1)`:'transparent', color: filter===f?c:'#3a6a4a', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>{f}</button>
            );
          })}
        </div>

        {/* Trade list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px 24px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#2a4a30', fontSize: '12px' }}>Aucun trade</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 70px 60px 90px 90px 90px 80px 1fr', gap: '8px', padding: '6px 10px', fontSize: '10px', color: '#2a5a32', letterSpacing: '1.5px', borderBottom: '1px solid rgba(0,255,136,0.06)' }}>
                <span>DATE</span><span>PAIRE</span><span>DIR.</span><span>ENTRÉE</span><span>SORTIE</span><span>P&L NET</span><span>DURÉE</span><span>COMPTE</span>
              </div>
              {filtered.map(t => {
                const net = getNet(t);
                return (
                  <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '100px 70px 60px 90px 90px 90px 80px 1fr', gap: '8px', alignItems: 'center', padding: '9px 10px', background: 'rgba(10,28,18,0.4)', borderLeft: `2px solid ${pnlColor(net)}`, borderRadius: '4px', fontSize: '12px' }}>
                    <span style={{ color: '#4a7a5a', fontSize: '11px' }}>{t.date}</span>
                    <span style={{ color: '#c8d8c8', fontWeight: '600' }}>{t.pair}</span>
                    <span style={{ color: t.direction==='LONG'?'#00ff88':'#ff4455', fontSize: '11px', background: `rgba(${t.direction==='LONG'?'0,255,136':'255,68,85'},0.08)`, padding: '1px 4px', borderRadius: '3px', textAlign: 'center' }}>{t.direction}</span>
                    <span style={{ color: '#8aaa90' }}>{t.entry ?? '—'}</span>
                    <span style={{ color: '#8aaa90' }}>{t.exit_price ?? '—'}</span>
                    <span style={{ color: pnlColor(net), fontWeight: '700' }}>{fmt(net, true)}</span>
                    <span style={{ color: '#4a7a5a', fontSize: '11px' }}>{t.duration ?? '—'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: t._accountColor ?? '#3a6a4a', flexShrink: 0 }} />
                      <span style={{ color: '#4a7a5a', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t._accountName ?? '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function GlobalView() {
  const [allTrades, setAllTrades]   = useState([]);
  const [accounts, setAccounts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [sessionModal, setSessionModal] = useState(null); // session object to show in modal
  const [tradeFilter, setTradeFilter]   = useState('ALL');
  const [tradeSearch, setTradeSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const accRes = await window.accounts.getAll();
      if (!accRes.ok) return;
      const accs = accRes.data.accounts;
      setAccounts(accs);

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
      if (currentActiveId) await window.accounts.setActive(currentActiveId);
      setAllTrades(allT);
    } catch (e) { console.error('GlobalView:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const trades = selectedAccounts.length === 0
    ? allTrades
    : allTrades.filter(t => selectedAccounts.includes(t._accountId));

  // ── Global stats ──────────────────────────────────────────
  const total   = trades.length;
  const pnl     = trades.reduce((s, t) => s + getNet(t), 0);
  const wins    = trades.filter(t => getNet(t) > 0).length;
  const losses  = trades.filter(t => getNet(t) < 0).length;
  const winrate = total > 0 ? (wins / total) * 100 : 0;
  const grossW  = trades.filter(t => getNet(t) > 0).reduce((s,t) => s + getNet(t), 0);
  const grossL  = trades.filter(t => getNet(t) < 0).reduce((s,t) => s + Math.abs(getNet(t)), 0);
  const pf      = grossL > 0 ? grossW / grossL : grossW > 0 ? 999 : 0;
  const fees    = trades.reduce((s,t) => s + (t.fees ?? 0) + (t.commissions ?? 0), 0);

  // ── By account (detect blown) ─────────────────────────────
  const TOPSTEP_FLOOR = { topstep_50k: 48000, topstep_100k: 97000, topstep_150k: 145500 };
  const byAccount = accounts.map(acc => {
    const accTrades = allTrades.filter(t => t._accountId === acc.id);
    const accPnl    = accTrades.reduce((s,t) => s + getNet(t), 0);
    const accWins   = accTrades.filter(t => getNet(t) > 0).length;
    const accWR     = accTrades.length > 0 ? (accWins / accTrades.length) * 100 : 0;
    const floor     = TOPSTEP_FLOOR[acc.type] ?? null;
    const balance   = 50000 + accPnl; // estimated
    const isBlown   = floor != null && balance <= floor;
    return { name: acc.name, color: acc.color, type: acc.type, total: accTrades.length, pnl: accPnl, wr: accWR, isBlown, balance };
  }).filter(a => a.total > 0);

  // ── By DOW ────────────────────────────────────────────────
  const byDow = DOW_LABELS.map((label, i) => {
    const dt  = trades.filter(t => new Date(t.date).getDay() === i);
    const dp  = dt.reduce((s,t) => s + getNet(t), 0);
    const dw  = dt.filter(t => getNet(t) > 0).length;
    return { label, pnl: Math.round(dp * 100) / 100, count: dt.length, wr: dt.length > 0 ? Math.round((dw/dt.length)*100) : 0 };
  });

  // ── By hour (all 24h with trades) ────────────────────────
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const ht  = trades.filter(t => t.entered_at && new Date(t.entered_at).getHours() === h);
    const hp  = ht.reduce((s,t) => s + getNet(t), 0);
    const hw  = ht.filter(t => getNet(t) > 0).length;
    const ses = getSession(h);
    return { label: `${h}h`, hour: h, pnl: Math.round(hp*100)/100, count: ht.length, wr: ht.length > 0 ? Math.round((hw/ht.length)*100) : 0, sessionColor: ses.color };
  });
  // Show all hours 0-22 even if empty (for readability), filter out late night empties
  const hourDataFull = byHour.filter(h => h.count > 0 || (h.hour >= 1 && h.hour <= 22));

  // ── By session ────────────────────────────────────────────
  const bySessions = HOUR_SESSIONS.map(session => {
    const st  = trades.filter(t => t.entered_at && getSession(new Date(t.entered_at).getHours()) === session);
    const sp  = st.reduce((s,t) => s + getNet(t), 0);
    const sw  = st.filter(t => getNet(t) > 0).length;
    return { ...session, pnl: sp, count: st.length, wr: st.length > 0 ? Math.round((sw/st.length)*100) : 0 };
  });

  // ── By pair ───────────────────────────────────────────────
  const byPair = trades.reduce((acc, t) => {
    if (!acc[t.pair]) acc[t.pair] = { total: 0, wins: 0, pnl: 0 };
    acc[t.pair].total++;
    if (getNet(t) > 0) acc[t.pair].wins++;
    acc[t.pair].pnl += getNet(t);
    return acc;
  }, {});
  const pairArr = Object.entries(byPair).sort(([,a],[,b]) => b.total - a.total).map(([pair, d]) => ({ pair, ...d, wr: Math.round(d.wins/d.total*100) }));

  // ── By emotion ────────────────────────────────────────────
  const byEmotion = trades.reduce((acc, t) => {
    const em = t.emotion ?? 'Inconnu';
    if (!acc[em]) acc[em] = { total: 0, wins: 0, pnl: 0 };
    acc[em].total++;
    if (getNet(t) > 0) acc[em].wins++;
    acc[em].pnl += getNet(t);
    return acc;
  }, {});
  const emotionArr = Object.entries(byEmotion).sort(([,a],[,b]) => b.total - a.total).map(([em, d]) => ({ em, ...d, wr: Math.round(d.wins/d.total*100) }));

  // ── Insights ──────────────────────────────────────────────
  const bestDow      = [...byDow].filter(d => d.count > 0).sort((a,b) => b.pnl - a.pnl)[0];
  const worstDow     = [...byDow].filter(d => d.count > 0).sort((a,b) => a.pnl - b.pnl)[0];
  const bestSession  = [...bySessions].filter(s => s.count >= 3).sort((a,b) => b.wr - a.wr)[0];
  const worstSession = [...bySessions].filter(s => s.count >= 3).sort((a,b) => a.wr - b.wr)[0];
  const bestHour     = [...byHour].filter(h => h.count >= 2).sort((a,b) => b.pnl - a.pnl)[0];
  const worstHour    = [...byHour].filter(h => h.count >= 2).sort((a,b) => a.pnl - b.pnl)[0];
  const bestPair     = [...pairArr].sort((a,b) => b.pnl - a.pnl)[0];
  const worstPair    = [...pairArr].filter(p => p.total >= 2).sort((a,b) => a.pnl - b.pnl)[0];
  const bestEmotion  = [...emotionArr].filter(e => e.total >= 2).sort((a,b) => b.wr - a.wr)[0];
  const worstEmotion = [...emotionArr].filter(e => e.total >= 2).sort((a,b) => a.wr - b.wr)[0];

  // ── All trades filtered ───────────────────────────────────
  const allTradesFiltered = trades.filter(t => {
    const net = getNet(t);
    if (tradeFilter === 'WIN'  && net <= 0) return false;
    if (tradeFilter === 'LOSS' && net >= 0) return false;
    if (tradeSearch) {
      const q = tradeSearch.toLowerCase();
      return (t.pair ?? '').toLowerCase().includes(q) || (t.date ?? '').includes(q) || (t._accountName ?? '').toLowerCase().includes(q);
    }
    return true;
  }).sort((a,b) => (b.date).localeCompare(a.date));

  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '4px', padding: '5px 10px', color: '#c8d8c8', fontSize: '12px', fontFamily: 'inherit', outline: 'none' };

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
        <button onClick={load} style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88', padding: '8px 14px', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>🔄 Actualiser</button>
      </div>

      {/* Account filter */}
      {accounts.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '1px' }}>FILTRER :</span>
          <button onClick={() => setSelectedAccounts([])} style={{ padding: '5px 12px', borderRadius: '4px', border: `1px solid ${selectedAccounts.length === 0 ? '#00ff88' : '#1a3a22'}`, background: selectedAccounts.length === 0 ? 'rgba(0,255,136,0.1)' : 'transparent', color: selectedAccounts.length === 0 ? '#00ff88' : '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>Tous</button>
          {accounts.map(acc => {
            const active = selectedAccounts.includes(acc.id);
            return (
              <button key={acc.id} onClick={() => setSelectedAccounts(p => active ? p.filter(id => id !== acc.id) : [...p, acc.id])}
                style={{ padding: '5px 12px', borderRadius: '4px', border: `1px solid ${active ? acc.color : '#1a3a22'}`, background: active ? `${acc.color}15` : 'transparent', color: active ? acc.color : '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: acc.color }} />
                {acc.name}
              </button>
            );
          })}
        </div>
      )}

      {total === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', border: '1px dashed #1a3a22', borderRadius: '8px', color: '#2a4a30', fontSize: '13px' }}>Aucun trade trouvé</div>
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

          {/* ── POINTS FORTS ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ height: '1px', flex: 1, background: 'rgba(0,255,136,0.1)' }} />
            <span style={{ fontSize: '11px', color: '#00ff88', letterSpacing: '2px', fontWeight: '700', whiteSpace: 'nowrap' }}>✅ POINTS FORTS</span>
            <div style={{ height: '1px', flex: 1, background: 'rgba(0,255,136,0.1)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
            {bestDow     && <InsightCard icon="📅" title="MEILLEUR JOUR" value={bestDow.label} desc={`${fmt(bestDow.pnl, true)} · ${bestDow.wr}% WR`} color="#00ff88" />}
            {bestSession && <InsightCard icon="⏰" title="MEILLEURE SESSION" value={bestSession.label} desc={`${bestSession.wr}% WR · ${bestSession.count} trades`} color={bestSession.color} onClick={() => setSessionModal(bestSession)} />}
            {bestHour    && <InsightCard icon="🎯" title="HEURE OPTIMALE" value={bestHour.label} desc={`${fmt(bestHour.pnl, true)} · ${bestHour.wr}% WR`} color="#00ff88" />}
            {bestPair    && <InsightCard icon="📈" title="INSTRUMENT PHARE" value={bestPair.pair} desc={`${fmt(bestPair.pnl, true)} · ${bestPair.wr}% WR`} color="#00aaff" />}
            {bestEmotion && <InsightCard icon="🧠" title="MEILLEUR ÉTAT MENTAL" value={bestEmotion.em} desc={`${bestEmotion.wr}% WR sur ${bestEmotion.total} trades`} color="#aa88ff" />}
          </div>

          {/* ── POINTS FAIBLES ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ height: '1px', flex: 1, background: 'rgba(255,68,85,0.1)' }} />
            <span style={{ fontSize: '11px', color: '#ff4455', letterSpacing: '2px', fontWeight: '700', whiteSpace: 'nowrap' }}>❌ POINTS FAIBLES</span>
            <div style={{ height: '1px', flex: 1, background: 'rgba(255,68,85,0.1)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '24px' }}>
            {worstDow     && <InsightCard icon="📅" title="PIRE JOUR" value={worstDow.label} desc={`${fmt(worstDow.pnl, true)} · ${worstDow.wr}% WR`} color="#ff4455" />}
            {worstSession && <InsightCard icon="⏰" title="PIRE SESSION" value={worstSession.label} desc={`${worstSession.wr}% WR · ${worstSession.count} trades`} color="#ff4455" onClick={() => setSessionModal(worstSession)} />}
            {worstHour    && <InsightCard icon="🕐" title="HEURE À ÉVITER" value={worstHour.label} desc={`${fmt(worstHour.pnl, true)} · ${worstHour.wr}% WR`} color="#ff4455" />}
            {worstPair    && <InsightCard icon="📉" title="INSTRUMENT À REVOIR" value={worstPair.pair} desc={`${fmt(worstPair.pnl, true)} · ${worstPair.wr}% WR`} color="#ff4455" />}
            {worstEmotion && <InsightCard icon="😟" title="PIRE ÉTAT MENTAL" value={worstEmotion.em} desc={`${worstEmotion.wr}% WR sur ${worstEmotion.total} trades`} color="#ff4455" />}
          </div>

          {/* ── CHARTS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

            {/* DOW */}
            <Section title="📅 P&L NET PAR JOUR DE LA SEMAINE">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={byDow.filter(d => d.count > 0)} barSize={28} barCategoryGap="35%" margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                  <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} width={55} />
                  <Tooltip content={<CTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                  <Bar dataKey="pnl" name="P&L net" radius={[3,3,0,0]} maxBarSize={32} isAnimationActive>
                    {byDow.filter(d => d.count > 0).map((d, i) => <Cell key={i} fill={pnlColor(d.pnl)} />)}
                  </Bar>
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

            {/* Sessions — cliquable */}
            <Section title="⏰ PERFORMANCE PAR SESSION (cliquer pour voir les trades)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {bySessions.filter(s => s.count > 0).map(s => (
                  <div key={s.label} onClick={() => setSessionModal(s)} style={{ cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                        <span style={{ fontSize: '13px', color: '#c8d8c8', fontWeight: '600' }}>{s.label}</span>
                        <span style={{ fontSize: '11px', color: '#4a7a5a' }}>{s.start}h-{s.end}h</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: pnlColor(s.pnl), fontWeight: '700' }}>{fmt(s.pnl, true)}</span>
                        <span style={{ fontSize: '12px', color: s.wr >= 50 ? '#00ff88' : '#ff4455' }}>{s.wr}% WR</span>
                        <span style={{ fontSize: '11px', color: '#3a6a4a' }}>{s.count}T</span>
                        <span style={{ fontSize: '13px', color: '#3a6a4a' }}>›</span>
                      </div>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.wr}%`, background: s.color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
                {bySessions.every(s => s.count === 0) && (
                  <div style={{ color: '#2a4a30', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Importez via CSV TopstepX pour voir les sessions</div>
                )}
              </div>
            </Section>
          </div>

          {/* By hour */}
          {hourDataFull.filter(h => h.count > 0).length > 0 && (
            <Section title="🕐 P&L NET PAR HEURE D'ENTRÉE">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={hourDataFull} barSize={14} barCategoryGap="20%" margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                  <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} width={55} />
                  <Tooltip content={<CTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                  <Bar dataKey="pnl" name="P&L net" radius={[2,2,0,0]} maxBarSize={16} isAnimationActive>
                    {hourDataFull.map((h, i) => <Cell key={i} fill={h.count > 0 ? h.sessionColor : 'rgba(0,255,136,0.05)'} fillOpacity={h.count > 0 ? 1 : 0.2} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Asie', hours: '0h-9h', color: '#aa88ff' },
                  { label: 'Londres', hours: '8h-15h', color: '#00aaff' },
                  { label: 'New York', hours: '13h-22h', color: '#00ff88' },
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

          {/* By pair + emotion */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
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
                      <div style={{ height: '100%', width: `${p.wr}%`, background: p.pnl >= 0 ? '#00ff88' : '#ff4455', borderRadius: '2px' }} />
                    </div>
                  </div>
                ))}
                {pairArr.length === 0 && <div style={{ color: '#2a4a30', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Aucune donnée</div>}
              </div>
            </Section>

            <Section title="🧠 PERFORMANCE PAR ÉTAT MENTAL">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {emotionArr.length === 0 ? (
                  <div style={{ color: '#2a4a30', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Renseigne ton émotion sur chaque trade</div>
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

          {/* ── BY ACCOUNT (with blown detection) ── */}
          {byAccount.length > 1 && (
            <div style={{ marginTop: '16px' }}>
              <Section title="🏦 PERFORMANCE PAR COMPTE">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '10px' }}>
                  {byAccount.map(acc => (
                    <div key={acc.name} style={{ background: acc.isBlown ? 'rgba(255,68,85,0.06)' : 'rgba(10,28,18,0.5)', border: `1px solid ${acc.isBlown ? 'rgba(255,68,85,0.3)' : acc.color + '25'}`, borderLeft: `3px solid ${acc.isBlown ? '#ff4455' : acc.color}`, borderRadius: '6px', padding: '12px 14px', position: 'relative', opacity: acc.isBlown ? 0.75 : 1 }}>
                      {acc.isBlown && (
                        <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,68,85,0.15)', border: '1px solid rgba(255,68,85,0.4)', borderRadius: '3px', padding: '2px 6px', fontSize: '9px', color: '#ff4455', fontWeight: '700', letterSpacing: '1px' }}>
                          💀 CRAMÉ
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: acc.isBlown ? '#ff4455' : acc.color }} />
                        <span style={{ fontSize: '13px', color: acc.isBlown ? '#8a5a5a' : '#c8d8c8', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</span>
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: acc.isBlown ? '#ff4455' : pnlColor(acc.pnl), marginBottom: '4px' }}>{fmt(acc.pnl, true)}</div>
                      <div style={{ fontSize: '12px', color: acc.isBlown ? '#6a3a3a' : (acc.wr >= 50 ? '#00ff88' : '#ff4455') }}>{acc.wr.toFixed(1)}% WR · {acc.total}T</div>
                      {acc.isBlown && <div style={{ fontSize: '11px', color: '#ff4455', marginTop: '4px' }}>Balance estimée: {acc.balance.toFixed(0)}$</div>}
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ── ALL TRADES ── */}
          <div style={{ marginTop: '16px' }}>
            <Section title={`📋 TOUS LES TRADES (${allTradesFiltered.length}/${total})`}>
              {/* Filters */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input placeholder="Rechercher par paire, date, compte..." value={tradeSearch} onChange={e => setTradeSearch(e.target.value)}
                  style={{ ...inp, width: '240px' }} />
                {['ALL','WIN','LOSS'].map(f => {
                  const c = f === 'WIN' ? '#00ff88' : f === 'LOSS' ? '#ff4455' : '#00ff88';
                  return (
                    <button key={f} onClick={() => setTradeFilter(f)} style={{ padding: '4px 12px', borderRadius: '4px', border: `1px solid ${tradeFilter===f?c:'#1a3a22'}`, background: tradeFilter===f?`rgba(${f==='WIN'?'0,255,136':f==='LOSS'?'255,68,85':'0,255,136'},0.1)`:'transparent', color: tradeFilter===f?c:'#3a6a4a', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>{f}</button>
                  );
                })}
                <span style={{ fontSize: '11px', color: '#3a6a4a', marginLeft: 'auto' }}>
                  P&L filtré: <span style={{ color: pnlColor(allTradesFiltered.reduce((s,t)=>s+getNet(t),0)), fontWeight: '700' }}>{fmt(allTradesFiltered.reduce((s,t)=>s+getNet(t),0), true)}</span>
                </span>
              </div>

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 80px 60px 90px 90px 100px 80px 1fr', gap: '8px', padding: '5px 10px', fontSize: '10px', color: '#2a5a32', letterSpacing: '1.5px', borderBottom: '1px solid rgba(0,255,136,0.06)' }}>
                <span>DATE</span><span>PAIRE</span><span>DIR.</span><span>ENTRÉE</span><span>SORTIE</span><span>P&L NET</span><span>DURÉE</span><span>COMPTE</span>
              </div>

              {/* Rows (max 100 for perf) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '400px', overflowY: 'auto' }}>
                {allTradesFiltered.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#2a4a30', fontSize: '12px' }}>Aucun trade</div>
                ) : allTradesFiltered.slice(0, 200).map(t => {
                  const net = getNet(t);
                  return (
                    <div key={`${t._accountId}-${t.id}`} style={{ display: 'grid', gridTemplateColumns: '100px 80px 60px 90px 90px 100px 80px 1fr', gap: '8px', alignItems: 'center', padding: '8px 10px', background: 'rgba(10,28,18,0.4)', borderLeft: `2px solid ${pnlColor(net)}`, borderRadius: '4px', fontSize: '12px', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(10,28,18,0.4)'}
                    >
                      <span style={{ color: '#4a7a5a', fontSize: '11px' }}>{t.date}</span>
                      <span style={{ color: '#c8d8c8', fontWeight: '600' }}>{t.pair}</span>
                      <span style={{ color: t.direction==='LONG'?'#00ff88':'#ff4455', fontSize: '11px', background: `rgba(${t.direction==='LONG'?'0,255,136':'255,68,85'},0.08)`, padding: '1px 4px', borderRadius: '3px', textAlign: 'center' }}>{t.direction}</span>
                      <span style={{ color: '#8aaa90' }}>{t.entry ?? '—'}</span>
                      <span style={{ color: '#8aaa90' }}>{t.exit_price ?? '—'}</span>
                      <span style={{ color: pnlColor(net), fontWeight: '700' }}>{fmt(net, true)}</span>
                      <span style={{ color: '#4a7a5a', fontSize: '11px' }}>{t.duration ?? '—'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: t._accountColor ?? '#3a6a4a', flexShrink: 0 }} />
                        <span style={{ color: '#4a7a5a', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t._accountName ?? '—'}</span>
                      </div>
                    </div>
                  );
                })}
                {allTradesFiltered.length > 200 && (
                  <div style={{ padding: '10px', textAlign: 'center', color: '#3a6a4a', fontSize: '11px' }}>
                    Affichage limité à 200 trades — utilise les filtres pour affiner
                  </div>
                )}
              </div>
            </Section>
          </div>
        </>
      )}

      {/* Session Modal */}
      {sessionModal && (
        <SessionModal
          session={sessionModal}
          trades={trades}
          onClose={() => setSessionModal(null)}
        />
      )}
    </div>
  );
}
