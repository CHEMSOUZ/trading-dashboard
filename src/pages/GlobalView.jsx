import { useState, useEffect, useCallback, useRef } from 'react';
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
  if (v > 0) return '#00cc77';
  if (v < 0) return '#ff3344';
  return '#7888a0';
}

const DOW_LABELS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const HOUR_SESSIONS = [
  { label: 'Asie',        start: 0,  end: 9,  color: '#aa88ff' },
  { label: 'Londres',     start: 8,  end: 15, color: '#00aaff' },
  { label: 'New York',    start: 13, end: 22, color: '#8899bb' },
  { label: 'Hors séance', start: 22, end: 24, color: '#f0a020' },
];
function getSessionLabel(h) {
  if (h >= 13 && h < 22) return 'New York';
  if (h >= 8  && h < 15) return 'Londres';
  if (h >= 0  && h < 9)  return 'Asie';
  return 'Hors séance';
}
function getSessionObj(label) {
  return HOUR_SESSIONS.find(s => s.label === label) ?? HOUR_SESSIONS[3];
}

// ── Tooltip ───────────────────────────────────────────────────
function CTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(8,9,16,0.97)', border: '1px solid rgba(136,153,187,0.22)', borderRadius: '4px', padding: '8px 12px', fontSize:'13px', fontFamily: 'inherit' }}>
      <div style={{ color: '#5a6a82', marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: (p.value ?? 0) >= 0 ? '#00cc77' : '#ff3344', fontWeight: '700' }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value, true) : p.value}
        </div>
      ))}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#dde4ef' }) {
  return (
    <div style={{ background: 'rgba(14,15,22,0.5)', border: '1px solid rgba(136,153,187,0.10)', borderTop: `2px solid ${color}`, borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize:'13px', color: '#5868a0', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(136,153,187,0.10)', borderRadius: '8px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '2px', fontWeight: '700' }}>{title}</div>
      {children}
    </div>
  );
}

// ── Insight Card ──────────────────────────────────────────────
function InsightCard({ icon, title, value, desc, color, onClick }) {
  const rgb = color === '#8899bb' ? '0,255,136'
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
        <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '1px', marginBottom: '3px' }}>{title}</div>
        <div style={{ fontSize: '16px', fontWeight: '700', color, marginBottom: '3px' }}>{value}</div>
        <div style={{ fontSize:'13px', color: '#5868a0' }}>{desc}</div>
      </div>
      {onClick && <div style={{ fontSize: '16px', color: `${color}80`, flexShrink: 0 }}>›</div>}
    </div>
  );
}

// ── Trade Table with resizable cols, sortable headers, entry time ──
const DEFAULT_COL_WIDTHS = { date:95, heure:65, pair:75, dir:58, entry:82, exit:82, pnl:100, dur:72, account:120 };

function TradeTable({ trades, storageKey = 'global_trade_cols' }) {
  const [filter, setFilter]     = useState('ALL');
  const [sortCol, setSortCol]   = useState('date');
  const [sortDir, setSortDir]   = useState('desc'); // 'asc' | 'desc'
  const [colWidths, setColWidths] = useState(() => {
    try { return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') }; }
    catch { return DEFAULT_COL_WIDTHS; }
  });
  const dragging = useRef(null);
  const startX   = useRef(0);
  const startW   = useRef(0);

  function onColMouseDown(e, col) {
    e.preventDefault();
    dragging.current = col;
    startX.current   = e.clientX;
    startW.current   = colWidths[col];
    function onMove(ev) {
      const newW = Math.max(40, startW.current + ev.clientX - startX.current);
      setColWidths(prev => { const n = { ...prev, [dragging.current]: newW }; localStorage.setItem(storageKey, JSON.stringify(n)); return n; });
    }
    function onUp() { dragging.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  function sortVal(t, col) {
    switch(col) {
      case 'date':    return t.entered_at || t.date || '';
      case 'heure':   return t.entered_at ? new Date(t.entered_at).getHours() * 60 + new Date(t.entered_at).getMinutes() : -1;
      case 'pair':    return t.pair ?? '';
      case 'dir':     return t.direction ?? '';
      case 'entry':   return t.entry ?? 0;
      case 'exit':    return t.exit_price ?? 0;
      case 'pnl':     return getNet(t);
      case 'dur':     return t.duration ?? '';
      case 'account': return t._accountName ?? '';
      default:        return '';
    }
  }

  const filtered = (filter === 'WIN' ? trades.filter(t => getNet(t) > 0)
    : filter === 'LOSS' ? trades.filter(t => getNet(t) < 0) : trades)
    .slice().sort((a, b) => {
      const va = sortVal(a, sortCol), vb = sortVal(b, sortCol);
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const pnl  = filtered.reduce((s,t) => s + getNet(t), 0);
  const wins = filtered.filter(t => getNet(t) > 0).length;
  const wr   = filtered.length > 0 ? Math.round((wins / filtered.length) * 100) : 0;

  const COLS = [
    { key: 'date',    label: 'DATE' },
    { key: 'heure',   label: 'HEURE' },
    { key: 'pair',    label: 'PAIRE' },
    { key: 'dir',     label: 'DIR.' },
    { key: 'entry',   label: 'ENTRÉE' },
    { key: 'exit',    label: 'SORTIE' },
    { key: 'pnl',     label: 'P&L NET' },
    { key: 'dur',     label: 'DURÉE' },
    { key: 'account', label: 'COMPTE' },
  ];

  const templateCols = COLS.map(c => `${colWidths[c.key]}px`).join(' ');

  function SortIcon({ col }) {
    if (sortCol !== col) return <span style={{ color: '#1e2c40', fontSize:'12px' }}>⇅</span>;
    return <span style={{ color: '#8899bb', fontSize:'12px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div>
      {/* Mini stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: 'P&L NET',   value: fmt(pnl, true), color: pnlColor(pnl) },
          { label: 'WIN / LOSS', value: `${trades.filter(t=>getNet(t)>0).length}W / ${trades.filter(t=>getNet(t)<0).length}L`, color: '#dde4ef' },
          { label: 'WINRATE',   value: `${wr}%`, color: wr >= 50 ? '#00cc77' : '#ff3344' },
          { label: 'TRADES',    value: filtered.length, color: '#dde4ef' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(14,15,22,0.5)', borderRadius: '5px', padding: '8px 12px', borderTop: `2px solid ${color}` }}>
            <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '1px', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {['ALL','WIN','LOSS'].map(f => {
          const c = f === 'WIN' ? '#8899bb' : f === 'LOSS' ? '#ff4455' : '#8899bb';
          return <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 12px', borderRadius: '4px', border: `1px solid ${filter===f?c:'#1e2c40'}`, background: filter===f?`rgba(${f==='WIN'?'0,255,136':f==='LOSS'?'255,68,85':'0,255,136'},0.1)`:'transparent', color: filter===f?c:'#5a6a82', fontSize:'13px', fontFamily: 'inherit', cursor: 'pointer' }}>{f}</button>;
        })}
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: templateCols, minWidth: 'max-content', padding: '5px 10px', fontSize:'12px', color: '#3c4c64', letterSpacing: '1.5px', borderBottom: '1px solid rgba(136,153,187,0.08)', marginBottom: '4px', userSelect: 'none' }}>
          {COLS.map((col, idx) => (
            <div key={col.key} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', overflow: 'hidden' }}
              onClick={() => handleSort(col.key)}
              onMouseEnter={e => e.currentTarget.style.color = '#8899bb'}
              onMouseLeave={e => e.currentTarget.style.color = '#3c4c64'}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.label}</span>
              <SortIcon col={col.key} />
              {idx < COLS.length - 1 && (
                <div onMouseDown={e => { e.stopPropagation(); onColMouseDown(e, col.key); }}
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ width: '1px', height: '60%', background: 'rgba(136,153,187,0.22)' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 'max-content' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#3a1818', fontSize:'13px' }}>Aucun trade</div>
          ) : filtered.map(t => {
            const net  = getNet(t);
            const hour = t.entered_at ? new Date(t.entered_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
            const isWin  = t.outcome === 'WIN' || net > 0;
            const isLoss = t.outcome === 'LOSS' || net < 0;
            const exitVal = isWin  ? (t.tp   && t.tp   !== 0 ? t.tp   : t.exit_price)
                          : isLoss ? (t.stop && t.stop !== 0 ? t.stop : t.exit_price)
                          : t.exit_price;
            const exitDisplay = exitVal != null ? exitVal.toFixed(2) : '—';
            return (
              <div key={`${t._accountId}-${t.id}`}
                style={{ display: 'grid', gridTemplateColumns: templateCols, alignItems: 'center', padding: '8px 10px', background: 'rgba(14,15,22,0.4)', borderLeft: `2px solid ${pnlColor(net)}`, borderRadius: '4px', fontSize:'13px', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(136,153,187,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(14,15,22,0.4)'}
              >
                <span style={{ color: '#5868a0', fontSize:'13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.date}</span>
                <span style={{ color: '#6a8a7a', fontSize:'13px' }}>{hour}</span>
                <span style={{ color: '#dde4ef', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.pair}</span>
                <span style={{ color: t.direction==='LONG'?'#00cc77':'#ff3344', fontSize:'13px', background: `rgba(${t.direction==='LONG'?'0,204,119':'255,51,68'},0.08)`, padding: '1px 4px', borderRadius: '3px', textAlign: 'center' }}>{t.direction}</span>
                <span style={{ color: '#7888a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.entry ?? '—'}</span>
                <span style={{ color: '#7888a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exitDisplay}</span>
                <span style={{ color: pnlColor(net), fontWeight: '700' }}>{fmt(net, true)}</span>
                <span style={{ color: '#5868a0', fontSize:'13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.duration ?? '—'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: t._accountColor ?? '#5a6a82', flexShrink: 0 }} />
                  <span style={{ color: '#5868a0', fontSize:'13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t._accountName ?? '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Trading Calendar with Heat Map ───────────────────────────
const CAL_MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CAL_METRICS = [['pnl','PnL','#00cc77'],['winrate','Winrate','#7c3aed'],['count','Trades','#f59e0b']];

function TradingCalendar({ trades, onDayClick }) {
  const [year,    setYear]    = useState(new Date().getFullYear());
  const [month,   setMonth]   = useState(new Date().getMonth());
  const [metric,  setMetric]  = useState('pnl');   // 'pnl' | 'winrate' | 'count'
  const [hovered, setHovered] = useState(null);    // date key

  // ── Build per-day data ──
  const byDay = trades.reduce((acc, t) => {
    const d = t.date; if (!d) return acc;
    if (!acc[d]) acc[d] = { pnl: 0, count: 0, wins: 0, losses: 0, trades: [] };
    const net = getNet(t);
    acc[d].pnl    += net;
    acc[d].count  += 1;
    if (net > 0) acc[d].wins++;
    else if (net < 0) acc[d].losses++;
    acc[d].trades.push(t);
    return acc;
  }, {});

  // ── Monthly stats ──
  const monthPfx = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthEntries = Object.entries(byDay).filter(([d]) => d.startsWith(monthPfx));
  const monthTotal   = monthEntries.reduce((s, [, v]) => s + v.pnl, 0);
  const monthTrades  = monthEntries.reduce((s, [, v]) => s + v.count, 0);
  const monthWins    = monthEntries.reduce((s, [, v]) => s + v.wins, 0);
  const monthWR      = monthTrades > 0 ? Math.round(monthWins / monthTrades * 100) : 0;
  const monthDays    = monthEntries.length;
  const greenDays    = monthEntries.filter(([, v]) => v.pnl > 0).length;
  const bestDayPnl   = monthDays > 0 ? Math.max(...monthEntries.map(([, v]) => v.pnl)) : 0;
  const worstDayPnl  = monthDays > 0 ? Math.min(...monthEntries.map(([, v]) => v.pnl)) : 0;
  const avgDayPnl    = monthDays > 0 ? monthTotal / monthDays : 0;

  // ── Colour scale ──
  const maxAbsPnl  = Math.max(...Object.values(byDay).map(d => Math.abs(d.pnl)), 1);
  const maxCount   = Math.max(...Object.values(byDay).map(d => d.count), 1);

  function cellBg(data) {
    if (!data) return 'rgba(14,15,22,0.28)';
    if (metric === 'pnl') {
      const t = Math.min(0.10 + (Math.abs(data.pnl) / maxAbsPnl) * 0.48, 0.60);
      return data.pnl > 0 ? `rgba(0,204,119,${t.toFixed(2)})` : data.pnl < 0 ? `rgba(255,51,68,${t.toFixed(2)})` : 'rgba(240,160,32,0.08)';
    }
    if (metric === 'winrate') {
      const wr = data.count > 0 ? data.wins / data.count : 0;
      return wr >= 0.5
        ? `rgba(0,204,119,${(0.08 + wr * 0.52).toFixed(2)})`
        : `rgba(255,51,68,${(0.08 + (1 - wr) * 0.52).toFixed(2)})`;
    }
    return `rgba(124,58,237,${(0.08 + (data.count / maxCount) * 0.55).toFixed(2)})`;
  }

  function cellMainVal(data) {
    if (!data) return null;
    if (metric === 'pnl')     return fmt(data.pnl, true);
    if (metric === 'winrate') return `${Math.round(data.wins / data.count * 100)}%`;
    return `${data.count}T`;
  }
  function cellMainColor(data) {
    if (!data) return '#5a6a82';
    if (metric === 'pnl')     return pnlColor(data.pnl);
    if (metric === 'winrate') return (data.wins / data.count) >= 0.5 ? '#00cc77' : '#ff3344';
    return '#aa88ff';
  }
  function cellSub(data) {
    if (!data) return null;
    if (metric === 'pnl')     return `${data.count}T · ${Math.round(data.wins / data.count * 100)}%WR`;
    if (metric === 'winrate') return `${fmt(data.pnl, true)} · ${data.count}T`;
    return fmt(data.pnl, true);
  }

  // ── Calendar grid ──
  // Monday-first
  const rawFirst   = new Date(year, month, 1).getDay();
  const firstDay   = rawFirst === 0 ? 6 : rawFirst - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today      = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const weeks = [];
  let wk = [];
  cells.forEach((day, i) => {
    wk.push(day);
    if (wk.length === 7 || i === cells.length - 1) {
      while (wk.length < 7) wk.push(null);
      weeks.push([...wk]);
      wk = [];
    }
  });

  function weekStats(wkArr) {
    // index 0 = Monday in our layout
    const firstIdx  = wkArr.findIndex(d => d != null);
    if (firstIdx < 0) return { total: 0, count: 0, wins: 0 };
    // date of the Monday of this week
    const mondayDate = new Date(year, month, wkArr[firstIdx] - firstIdx);
    let total = 0, count = 0, wins = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayDate); d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      if (byDay[key]) { total += byDay[key].pnl; count += byDay[key].count; wins += byDay[key].wins; }
    }
    return { total, count, wins, wr: count > 0 ? Math.round(wins / count * 100) : 0 };
  }

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  return (
    <div style={{ background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(136,153,187,0.10)', borderRadius: '8px', padding: '16px 18px', position: 'relative' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '5px' }}>CALENDRIER — HEAT MAP</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#5868a0', cursor: 'pointer', fontSize: '17px', lineHeight:1 }}>‹</button>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#e8edf8', minWidth: '160px', textAlign: 'center' }}>{CAL_MONTHS[month]} {year}</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#5868a0', cursor: 'pointer', fontSize: '17px', lineHeight:1 }}>›</button>
            <button onClick={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }}
              style={{ background: 'rgba(136,153,187,0.10)', border: '1px solid rgba(136,153,187,0.18)', color: '#8899bb', padding: '3px 9px', borderRadius: '4px', fontSize:'12px', fontFamily: 'inherit', cursor: 'pointer' }}>Aujourd'hui</button>
          </div>
        </div>
        {/* Metric toggle */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {CAL_METRICS.map(([k, l, c]) => (
            <button key={k} onClick={() => setMetric(k)} style={{
              padding: '4px 11px', borderRadius: '4px', fontFamily: 'inherit', fontSize: '11px',
              fontWeight: metric === k ? '700' : '400', cursor: 'pointer', transition: 'all 0.15s',
              background: metric === k ? `${c}15` : 'transparent',
              border: `1px solid ${metric === k ? c + '55' : 'rgba(136,153,187,0.15)'}`,
              color: metric === k ? c : '#5a6a82',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Monthly stats ── */}
      {monthDays > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: '6px', marginBottom: '14px' }}>
          {[
            { label:'P&L MENSUEL',   value: fmt(monthTotal, true),                        color: pnlColor(monthTotal) },
            { label:'WINRATE',        value: `${monthWR}%`,                               color: monthWR >= 50 ? '#00cc77' : '#ff3344' },
            { label:'JOURS TRADÉS',   value: `${greenDays}✓ / ${monthDays - greenDays}✗`, color: '#8899bb' },
            { label:'MEILLEUR JOUR',  value: fmt(bestDayPnl, true),                       color: '#00cc77' },
            { label:'PIRE JOUR',      value: fmt(worstDayPnl, true),                      color: '#ff3344' },
            { label:'MOY / JOUR',     value: fmt(avgDayPnl, true),                        color: pnlColor(avgDayPnl) },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(14,15,22,0.60)', borderRadius: '5px', padding: '7px 10px', borderTop: `2px solid ${color}45` }}>
              <div style={{ fontSize:'9px', color: '#3a4a60', letterSpacing: '1.5px', marginBottom: '3px' }}>{label}</div>
              <div style={{ fontSize:'13px', fontWeight: '700', color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr) 96px', gap: '3px' }}>
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize:'11px', color: '#5a6a82', padding: '4px 0', letterSpacing: '1px' }}>{d}</div>
        ))}
        <div style={{ textAlign: 'center', fontSize:'11px', color: '#5a6a82', padding: '4px 0' }}>SEM.</div>

        {weeks.map((wkArr, wi) => {
          const ws = weekStats(wkArr);
          return [
            ...wkArr.map((day, di) => {
              if (!day) return <div key={`e-${wi}-${di}`} style={{ minHeight: '66px', borderRadius: '4px', background: 'rgba(14,15,22,0.15)', border: '1px solid rgba(136,153,187,0.03)' }} />;
              const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const data  = byDay[key];
              const isTod = key === today;
              const isHov = hovered === key;
              return (
                <div key={key}
                  onClick={() => data && onDayClick?.(key, data.trades)}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    minHeight: '66px', borderRadius: '4px', padding: '5px 6px',
                    display: 'flex', flexDirection: 'column', gap: '2px',
                    background: isHov && data ? 'rgba(136,153,187,0.10)' : cellBg(data),
                    border: isTod ? '1.5px solid rgba(0,170,255,0.60)' : isHov && data ? '1px solid rgba(136,153,187,0.30)' : '1px solid rgba(136,153,187,0.07)',
                    cursor: data ? 'pointer' : 'default', transition: 'all 0.12s',
                    transform: isHov && data ? 'scale(1.03)' : 'scale(1)',
                    position: 'relative', zIndex: isHov ? 3 : 1,
                    boxShadow: isHov && data ? '0 4px 16px rgba(0,0,0,0.4)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize:'11px', color: isTod ? '#00aaff' : '#5868a0', fontWeight: isTod ? '700' : '400' }}>{day}</span>
                    {isTod && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00aaff', flexShrink: 0 }} />}
                    {data && metric === 'pnl' && (
                      <span style={{ fontSize:'9px', color: (data.wins / data.count) >= 0.5 ? '#00cc77' : '#ff3344', fontWeight:'700' }}>
                        {Math.round(data.wins / data.count * 100)}%
                      </span>
                    )}
                  </div>
                  {data && (
                    <>
                      <div style={{ fontSize:'13px', fontWeight:'700', color: cellMainColor(data), lineHeight:1, marginTop:'2px' }}>
                        {cellMainVal(data)}
                      </div>
                      <div style={{ fontSize:'10px', color:'#5a6a82', marginTop:'2px' }}>
                        {cellSub(data)}
                      </div>
                    </>
                  )}
                </div>
              );
            }),

            /* Week summary */
            <div key={`w-${wi}`} style={{ background: 'rgba(14,15,22,0.55)', border: '1px solid rgba(136,153,187,0.09)', borderRadius: '4px', minHeight: '66px', padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
              {ws.count > 0 ? (
                <>
                  <div style={{ fontSize:'10px', color:'#3a4a60' }}>S{wi + 1}</div>
                  <div style={{ fontSize:'13px', fontWeight:'700', color: pnlColor(ws.total) }}>{fmt(ws.total, true)}</div>
                  <div style={{ fontSize:'10px', color: ws.wr >= 50 ? '#00cc77' : '#ff3344' }}>{ws.wr}% WR</div>
                  <div style={{ fontSize:'10px', color:'#5a6a82' }}>{ws.count}T</div>
                </>
              ) : (
                <div style={{ fontSize:'10px', color:'#2e3d52' }}>S{wi + 1}</div>
              )}
            </div>,
          ];
        })}
      </div>

      {/* ── Hover tooltip ── */}
      {hovered && byDay[hovered] && (() => {
        const d = byDay[hovered];
        const wr = d.count > 0 ? Math.round(d.wins / d.count * 100) : 0;
        return (
          <div style={{ position: 'fixed', bottom: '22px', right: '22px', background: 'rgba(8,9,16,0.97)', border: '1px solid rgba(136,153,187,0.22)', borderRadius: '8px', padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.65)', zIndex: 9999, minWidth: '200px', pointerEvents: 'none' }}>
            <div style={{ fontSize:'13px', fontWeight:'700', color:'#e8edf8', marginBottom:'8px' }}>{hovered}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[
                ['Trades',     d.count,                          '#dde4ef'],
                ['Winrate',    `${wr}%`,                         wr >= 50 ? '#00cc77' : '#ff3344'],
                ['P&L net',    fmt(d.pnl, true),                 pnlColor(d.pnl)],
                ['Moy./trade', fmt(d.pnl / d.count, true),       pnlColor(d.pnl / d.count)],
                ['Gagnants',   d.wins,                           '#00cc77'],
                ['Perdants',   d.losses,                         '#ff3344'],
              ].map(([l, v, c]) => (
                <div key={l}>
                  <div style={{ fontSize:'9px', color:'#5a6a82', letterSpacing:'1px', marginBottom:'1px' }}>{l}</div>
                  <div style={{ fontSize:'12px', fontWeight:'700', color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Generic Modal ─────────────────────────────────────────────
function TradeModal({ title, subtitle, color, trades, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0d16', border: `1px solid ${color}40`, borderRadius: '10px', width: '100%', maxWidth: '860px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(136,153,187,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#e8edf8' }}>{title}</span>
            </div>
            <span style={{ fontSize:'13px', color: '#5868a0' }}>{subtitle}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1e2c40', color: '#5868a0', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
          <TradeTable trades={trades} />
        </div>
      </div>
    </div>
  );
}

// ── Account Sparkline ─────────────────────────────────────────
function AccountSparkline({ pts }) {
  const W = 160, H = 38;
  if (pts.length < 2) return <div style={{ height:`${H}px`, display:'flex', alignItems:'center', justifyContent:'center', color:'#2e3d52', fontSize:'10px' }}>—</div>;
  const minV = Math.min(...pts, 0);
  const maxV = Math.max(...pts, 0);
  const rng  = maxV - minV || 1;
  const toX  = i => (i / (pts.length - 1)) * (W - 2) + 1;
  const toY  = v => (H - 2) - ((v - minV) / rng) * (H - 2) + 1;
  const path = pts.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const col  = last >= 0 ? '#00cc77' : '#ff3344';
  const zY   = toY(0);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
      {minV < 0 && maxV > 0 && <line x1={1} y1={zY} x2={W-1} y2={zY} stroke="rgba(136,153,187,0.15)" strokeDasharray="3 2" />}
      <polyline points={path} fill="none" stroke={col} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={toX(pts.length-1)} cy={toY(last)} r={2.5} fill={col} />
    </svg>
  );
}

function profitTarget(type) {
  if (!type) return 3000;
  if (type.includes('150k')) return 9000;
  if (type.includes('100k')) return 6000;
  return 3000;
}

// ── MAIN ──────────────────────────────────────────────────────
export default function GlobalView() {
  const [allTrades, setAllTrades]   = useState([]);
  const [accounts, setAccounts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [modal, setModal]           = useState(null); // { title, subtitle, color, trades }
  const [tradeFilter, setTradeFilter] = useState('ALL');
  const [tradeSearch, setTradeSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const accRes = await window.accounts.getAll();
      if (!accRes.ok) return;
      const accs = accRes.data.accounts;
      setAccounts(accs);
      const allT = [];
      for (const acc of accs) {
        const tRes = await window.db.getTradesForPath(acc.dbPath);
        if (tRes.ok) tRes.data.forEach(t => allT.push({ ...t, _accountId: acc.id, _accountName: acc.name, _accountColor: acc.color }));
      }
      setAllTrades(allT);
    } catch(e) { console.error('GlobalView:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isMicro = t => { const n = t.result_net ?? t.result; return n != null && n !== 0 && Math.abs(n) < 10; };
  const trades = (selectedAccounts.length === 0 ? allTrades : allTrades.filter(t => selectedAccounts.includes(t._accountId))).filter(t => !isMicro(t));

  // ── Global stats ──────────────────────────────────────────
  const total   = trades.length;
  const pnl     = trades.reduce((s,t) => s + getNet(t), 0);
  const wins    = trades.filter(t => getNet(t) > 0).length;
  const losses  = trades.filter(t => getNet(t) < 0).length;
  const winrate = total > 0 ? (wins / total) * 100 : 0;
  const grossW  = trades.filter(t => getNet(t) > 0).reduce((s,t) => s+getNet(t), 0);
  const grossL  = trades.filter(t => getNet(t) < 0).reduce((s,t) => s+Math.abs(getNet(t)), 0);
  const pf      = grossL > 0 ? grossW / grossL : grossW > 0 ? 999 : 0;
  const fees    = trades.reduce((s,t) => s+(t.fees??0)+(t.commissions??0), 0);

  // ── By account ────────────────────────────────────────────
  const ACCOUNT_SIZES = { topstep_50k:50000, topstep_100k:100000, topstep_150k:150000, topstep_ef_50k:50000, topstep_ef_100k:100000, topstep_ef_150k:150000, topstep_cons_50k:50000, topstep_cons_100k:100000, topstep_cons_150k:150000 };
  const FLOORS        = { topstep_50k:48000, topstep_100k:97000,  topstep_150k:145500, topstep_ef_50k:48000, topstep_ef_100k:97000,  topstep_ef_150k:145500, topstep_cons_50k:48000, topstep_cons_100k:97000, topstep_cons_150k:145500 };
  const LIVE_T   = new Set(['tradovate_live','topstep_live_50k','topstep_live_100k','topstep_live_150k','lucid_live_50k','lucid_live_100k','lucid_live_150k']);
  const FUNDED_T = new Set(['topstep_ef_50k','topstep_ef_100k','topstep_ef_150k','topstep_cons_50k','topstep_cons_100k','topstep_cons_150k','lucid_funded_25k','lucid_funded_50k','lucid_funded_100k','lucid_funded_150k']);
  const CHALL_T  = new Set(['topstep_50k','topstep_100k','topstep_150k','lucid_eval_25k','lucid_eval_50k','lucid_eval_100k','lucid_eval_150k']);
  function accountSortKey(a) {
    if (a.isBlown) return 5;
    if (LIVE_T.has(a.type))   return 1;
    if (FUNDED_T.has(a.type)) return 2;
    if (CHALL_T.has(a.type))  return 3;
    return 4;
  }
  const byAccount = accounts.map(acc => {
    const at    = allTrades.filter(t => t._accountId === acc.id);
    const ap    = at.reduce((s,t) => s+getNet(t), 0);
    const aw    = at.filter(t => getNet(t) > 0).length;
    const floor = FLOORS[acc.type] ?? null;
    const startBalance = ACCOUNT_SIZES[acc.type] ?? 50000;
    // Simule le trailing drawdown — cramé si balance a JAMAIS touché le floor
    const sorted = [...at].sort((a,b) => (a.entered_at||a.date).localeCompare(b.entered_at||b.date));
    let cum = startBalance, hwm = startBalance, everBlown = false;
    const maxLoss = startBalance - (floor ?? startBalance - 2000);
    for (const t of sorted) {
      cum += getNet(t);
      if (cum > hwm) hwm = cum;
      const trailingFloor = hwm - maxLoss;
      if (floor != null && (cum <= trailingFloor || cum <= floor)) { everBlown = true; break; }
    }
    return { id: acc.id, name: acc.name, color: acc.color, type: acc.type, total: at.length, pnl: ap, wr: at.length > 0 ? (aw/at.length)*100 : 0, isBlown: everBlown, balance: startBalance + ap, floor };
  }).filter(a => a.total > 0).sort((a, b) => accountSortKey(a) - accountSortKey(b));

  // ── Long vs Short ─────────────────────────────────────────
  const dirStats = ['LONG','SHORT'].map(dir => {
    const dt = trades.filter(t => t.direction === dir);
    const dp = dt.reduce((s,t) => s+getNet(t), 0);
    const dw = dt.filter(t => getNet(t) > 0);
    const dl = dt.filter(t => getNet(t) < 0);
    const grossW = dw.reduce((s,t) => s+getNet(t), 0);
    const grossL = Math.abs(dl.reduce((s,t) => s+getNet(t), 0));
    const dpf = grossL > 0 ? grossW/grossL : dw.length > 0 ? 999 : 0;
    const nets = dt.map(t => getNet(t));
    return {
      dir, n:dt.length, pnl:dp,
      wr:  dt.length>0 ? Math.round((dw.length/dt.length)*100) : 0,
      avg: dt.length>0 ? dp/dt.length : 0,
      wins:dw.length, losses:dl.length,
      pf:  dpf,
      avgWin:  dw.length>0 ? grossW/dw.length : 0,
      avgLoss: dl.length>0 ? grossL/dl.length : 0,
      bestT:   nets.length>0 ? Math.max(...nets) : 0,
      worstT:  nets.length>0 ? Math.min(...nets) : 0,
    };
  }).filter(d => d.n > 0);

  // ── By DOW ────────────────────────────────────────────────
  const byDow = DOW_LABELS.map((label, i) => {
    const dt = trades.filter(t => new Date(t.date).getDay() === i);
    const dp = dt.reduce((s,t) => s+getNet(t), 0);
    const dw = dt.filter(t => getNet(t) > 0).length;
    return { label, pnl: Math.round(dp*100)/100, count: dt.length, wr: dt.length > 0 ? Math.round((dw/dt.length)*100) : 0 };
  });

  // ── By hour ───────────────────────────────────────────────
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const ht = trades.filter(t => t.entered_at && new Date(t.entered_at).getHours() === h);
    const hp = ht.reduce((s,t) => s+getNet(t), 0);
    const hw = ht.filter(t => getNet(t) > 0).length;
    const ses = getSessionObj(getSessionLabel(h));
    return { label: `${h}h`, hour: h, pnl: Math.round(hp*100)/100, count: ht.length, wr: ht.length > 0 ? Math.round((hw/ht.length)*100) : 0, sessionColor: ses.color };
  });
  const hourDataFull = byHour.filter(h => h.count > 0 || (h.hour >= 1 && h.hour <= 22));

  // ── By session (by LABEL to avoid object ref issues) ─────
  const bySessions = HOUR_SESSIONS.map(session => {
    // Use label-based matching
    const st = trades.filter(t => t.entered_at && getSessionLabel(new Date(t.entered_at).getHours()) === session.label);
    const sp = st.reduce((s,t) => s+getNet(t), 0);
    const sw = st.filter(t => getNet(t) > 0).length;
    return { ...session, pnl: Math.round(sp*100)/100, count: st.length, wr: st.length > 0 ? Math.round((sw/st.length)*100) : 0 };
  });

  // ── By pair ───────────────────────────────────────────────
  const byPair = trades.reduce((acc, t) => {
    if (!acc[t.pair]) acc[t.pair] = { total:0, wins:0, pnl:0 };
    acc[t.pair].total++;
    if (getNet(t) > 0) acc[t.pair].wins++;
    acc[t.pair].pnl += getNet(t);
    return acc;
  }, {});
  const pairArr = Object.entries(byPair).sort(([,a],[,b]) => b.total - a.total).map(([pair, d]) => ({ pair, ...d, wr: Math.round(d.wins/d.total*100) }));

  // ── By emotion ────────────────────────────────────────────
  const byEmotion = trades.reduce((acc, t) => {
    const em = t.emotion ?? 'Inconnu';
    if (!acc[em]) acc[em] = { total:0, wins:0, pnl:0 };
    acc[em].total++;
    if (getNet(t) > 0) acc[em].wins++;
    acc[em].pnl += getNet(t);
    return acc;
  }, {});
  const emotionArr = Object.entries(byEmotion).sort(([,a],[,b]) => b.total - a.total).map(([em, d]) => ({ em, ...d, wr: Math.round(d.wins/d.total*100) }));

  // ── Insights — sorted by P&L ──────────────────────────────
  const bestDow      = [...byDow].filter(d => d.count > 0).sort((a,b) => b.pnl - a.pnl)[0];
  const worstDow     = [...byDow].filter(d => d.count > 0).sort((a,b) => a.pnl - b.pnl)[0];
  const bestSession  = [...bySessions].filter(s => s.count >= 3).sort((a,b) => b.pnl - a.pnl)[0];
  const worstSession = [...bySessions].filter(s => s.count >= 3).sort((a,b) => a.pnl - b.pnl)[0];
  const bestHour     = [...byHour].filter(h => h.count >= 2).sort((a,b) => b.pnl - a.pnl)[0];
  const worstHour    = [...byHour].filter(h => h.count >= 2).sort((a,b) => a.pnl - b.pnl)[0];
  const bestPair     = [...pairArr].sort((a,b) => b.pnl - a.pnl)[0];
  const worstPair    = [...pairArr].filter(p => p.total >= 2).sort((a,b) => a.pnl - b.pnl)[0];
  const bestEmotion  = [...emotionArr].filter(e => e.total >= 2).sort((a,b) => b.pnl - a.pnl)[0];
  const worstEmotion = [...emotionArr].filter(e => e.total >= 2).sort((a,b) => a.pnl - b.pnl)[0];

  // ── Modal openers ─────────────────────────────────────────
  function openDow(dow) {
    const dowIndex = DOW_LABELS.indexOf(dow.label);
    const t = trades.filter(t => new Date(t.date).getDay() === dowIndex);
    setModal({ title: `Trades du ${dow.label}`, subtitle: `${t.length} trades · ${fmt(dow.pnl, true)} · ${dow.wr}% WR`, color: pnlColor(dow.pnl), trades: t.sort((a,b) => b.date.localeCompare(a.date)) });
  }

  function openSession(session) {
    // Match by label string — fix for object ref issue
    const t = trades.filter(t => t.entered_at && getSessionLabel(new Date(t.entered_at).getHours()) === session.label);
    setModal({ title: `Session ${session.label}`, subtitle: `${session.start}h – ${session.end}h · ${t.length} trades · ${fmt(session.pnl, true)} · ${session.wr}% WR`, color: session.color, trades: t.sort((a,b) => (b.entered_at||b.date).localeCompare(a.entered_at||a.date)) });
  }

  function openHour(hour) {
    const t = trades.filter(t => t.entered_at && new Date(t.entered_at).getHours() === hour.hour);
    setModal({ title: `Trades à ${hour.label}`, subtitle: `Session ${getSessionLabel(hour.hour)} · ${t.length} trades · ${fmt(hour.pnl, true)} · ${hour.wr}% WR`, color: hour.pnl >= 0 ? '#00cc77' : '#ff3344', trades: t.sort((a,b) => (b.entered_at||b.date).localeCompare(a.entered_at||a.date)) });
  }

  // ── All trades filtered list ──────────────────────────────
  const allTradesFiltered = trades.filter(t => {
    const net = getNet(t);
    if (tradeFilter === 'WIN'  && net <= 0) return false;
    if (tradeFilter === 'LOSS' && net >= 0) return false;
    if (tradeSearch) {
      const q = tradeSearch.toLowerCase();
      return (t.pair??'').toLowerCase().includes(q) || (t.date??'').includes(q) || (t._accountName??'').toLowerCase().includes(q);
    }
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date));

  const inp = { background: 'rgba(14,15,22,0.6)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '4px', padding: '5px 10px', color: '#dde4ef', fontSize:'13px', fontFamily: 'inherit', outline: 'none' };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5a6a82', fontSize:'13px', letterSpacing: '2px' }}>CHARGEMENT DE TOUS LES COMPTES...</div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: 'none' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '3px', marginBottom: '6px' }}>ANALYSE GLOBALE</div>
          <h1 style={{ fontSize: '23px', fontWeight: '700', color: '#e8edf8', margin: 0 }}>Vue Globale</h1>
          <div style={{ fontSize:'13px', color: '#5a6a82', marginTop: '3px' }}>
            {accounts.length} compte{accounts.length > 1 ? 's' : ''} · {total} trades · <span style={{ color: pnlColor(pnl), fontWeight: '700' }}>{fmt(pnl, true)}</span>
          </div>
        </div>
        <button onClick={load} style={{ background: 'rgba(136,153,187,0.10)', border: '1px solid rgba(136,153,187,0.22)', color: '#8899bb', padding: '8px 14px', borderRadius: '5px', fontSize:'13px', fontFamily: 'inherit', cursor: 'pointer' }}>🔄 Actualiser</button>
      </div>

      {/* Account filter */}
      {accounts.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '1px' }}>FILTRER :</span>
          <button onClick={() => setSelectedAccounts([])} style={{ padding: '5px 12px', borderRadius: '4px', border: `1px solid ${selectedAccounts.length===0?'#8899bb':'#1e2c40'}`, background: selectedAccounts.length===0?'rgba(136,153,187,0.12)':'transparent', color: selectedAccounts.length===0?'#8899bb':'#5a6a82', fontSize:'13px', fontFamily: 'inherit', cursor: 'pointer' }}>Tous</button>
          {accounts.map(acc => {
            const active = selectedAccounts.includes(acc.id);
            return (
              <button key={acc.id} onClick={() => setSelectedAccounts(p => active ? p.filter(id => id !== acc.id) : [...p, acc.id])}
                style={{ padding: '5px 12px', borderRadius: '4px', border: `1px solid ${active?acc.color:'#1e2c40'}`, background: active?`${acc.color}15`:'transparent', color: active?acc.color:'#5a6a82', fontSize:'13px', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: acc.color }} />
                {acc.name}
              </button>
            );
          })}
        </div>
      )}

      {total === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', border: '1px dashed #1e2c40', borderRadius: '8px', color: '#3a1818', fontSize: '13px' }}>Aucun trade trouvé</div>
      ) : (
        <>
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '20px' }}>
            <StatCard label="P&L NET TOTAL"  value={fmt(pnl, true)}                color={pnlColor(pnl)}                  sub={`Frais: -${fees.toFixed(2)}$`} />
            <StatCard label="WINRATE GLOBAL" value={`${winrate.toFixed(1)}%`}       color={winrate>=50?'#8899bb':'#ff4455'} sub={`${wins}W / ${losses}L`} />
            <StatCard label="PROFIT FACTOR"  value={pf===999?'∞':pf.toFixed(2)}     color={pf>=1.5?'#8899bb':'#f0a020'} />
            <StatCard label="TOTAL TRADES"   value={total}                          color="#dde4ef"                        sub={`${accounts.length} compte${accounts.length>1?'s':''}`} />
            <StatCard label="MOY / TRADE"    value={fmt(pnl/Math.max(total,1),true)} color={pnlColor(pnl/Math.max(total,1))} />
          </div>


          {/* ── LONG vs SHORT ── */}
          {dirStats.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${dirStats.length},1fr)`, gap:'12px', marginBottom:'20px' }}>
              {dirStats.map(({ dir, n, pnl, wr, avg, wins, losses, pf, avgWin, avgLoss, bestT, worstT }) => {
                const isLong = dir === 'LONG';
                const dirCol = isLong ? '#00cc77' : '#ff3344';
                const dirRgb = isLong ? '0,204,119' : '255,51,68';
                const metrics = [
                  { label:'P&L TOTAL',  value:fmt(pnl,true),                              color:pnlColor(pnl) },
                  { label:'MOY./TRADE', value:fmt(avg,true),                              color:pnlColor(avg) },
                  { label:'PF',         value:pf===999?'∞':pf.toFixed(2),                color:pf>=1.5?'#00cc77':pf>=1?'#dde4ef':'#ff3344' },
                  { label:'MOY. WIN',   value:avgWin>0?fmt(avgWin,true):'—',             color:'#00cc77' },
                  { label:'MOY. LOSS',  value:avgLoss>0?`-${avgLoss.toFixed(2)}$`:'—',   color:'#ff3344' },
                  { label:'MEILLEUR',   value:bestT>0?fmt(bestT,true):'—',               color:'#00cc77' },
                  { label:'PIRE',       value:worstT<0?fmt(worstT,true):'—',             color:'#ff3344' },
                ];
                return (
                  <div key={dir} style={{ background:`rgba(${dirRgb},0.04)`, border:`1px solid rgba(${dirRgb},0.20)`, borderRadius:'8px', padding:'14px 18px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
                      <span style={{ fontSize:'22px', lineHeight:1 }}>{isLong ? '↑' : '↓'}</span>
                      <span style={{ fontSize:'14px', fontWeight:'700', color:dirCol, letterSpacing:'2px' }}>{dir}</span>
                      <span style={{ fontSize:'12px', color:'#5a6a82' }}>{n} trade{n>1?'s':''}</span>
                      <span style={{ marginLeft:'auto', fontSize:'13px', fontWeight:'700', color:wr>=50?'#00cc77':'#ff3344' }}>{wr}% WR</span>
                      <span style={{ fontSize:'12px', color:'#5a6a82' }}>{wins}W / {losses}L</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:'6px' }}>
                      {metrics.map(({ label, value, color }) => (
                        <div key={label} style={{ background:'rgba(14,15,22,0.6)', borderRadius:'5px', padding:'6px 8px' }}>
                          <div style={{ fontSize:'10px', color:'#3a4a60', letterSpacing:'1px', marginBottom:'2px' }}>{label}</div>
                          <div style={{ fontSize:'13px', fontWeight:'700', color }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── POINTS FORTS ── */}
          <div style={{ background: 'linear-gradient(90deg,rgba(0,204,119,0.10) 0%,rgba(0,204,119,0.04) 100%)', border: '1px solid rgba(0,204,119,0.25)', borderLeft: '3px solid #00cc77', borderRadius: '6px', padding: '10px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>✅</span>
            <div>
              <div style={{ fontSize:'13px', color: '#00cc77', letterSpacing: '2px', fontWeight: '700' }}>POINTS FORTS</div>
              <div style={{ fontSize:'12px', color: 'rgba(0,204,119,0.6)', marginTop: '1px' }}>Tes atouts — à exploiter davantage</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '10px', marginBottom: '20px' }}>
            {bestDow     && <InsightCard icon="📅" title="MEILLEUR JOUR"          value={bestDow.label}     desc={`${fmt(bestDow.pnl,true)} · ${bestDow.wr}% WR`}        color="#00cc77" onClick={() => openDow(bestDow)} />}
            {bestSession && <InsightCard icon="⏰" title="MEILLEURE SESSION (P&L)" value={bestSession.label} desc={`${fmt(bestSession.pnl,true)} · ${bestSession.wr}% WR · ${bestSession.count}T`} color={bestSession.color} onClick={() => openSession(bestSession)} />}
            {bestHour    && <InsightCard icon="🎯" title="HEURE OPTIMALE"          value={bestHour.label}    desc={`${fmt(bestHour.pnl,true)} · ${bestHour.wr}% WR`}       color="#00cc77" onClick={() => openHour(bestHour)} />}
            {bestPair    && <InsightCard icon="📈" title="INSTRUMENT PHARE"        value={bestPair.pair}     desc={`${fmt(bestPair.pnl,true)} · ${bestPair.wr}% WR`}       color="#00aaff" />}
            {bestEmotion && <InsightCard icon="🧠" title="MEILLEUR ÉTAT MENTAL"    value={bestEmotion.em}    desc={`${fmt(bestEmotion.pnl,true)} · ${bestEmotion.total}T`} color="#aa88ff" />}
          </div>

          {/* ── POINTS FAIBLES ── */}
          <div style={{ background: 'linear-gradient(90deg,rgba(255,68,85,0.10) 0%,rgba(255,68,85,0.04) 100%)', border: '1px solid rgba(255,68,85,0.25)', borderLeft: '3px solid #ff4455', borderRadius: '6px', padding: '10px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>❌</span>
            <div>
              <div style={{ fontSize:'13px', color: '#ff4455', letterSpacing: '2px', fontWeight: '700' }}>POINTS FAIBLES</div>
              <div style={{ fontSize:'12px', color: 'rgba(255,68,85,0.6)', marginTop: '1px' }}>À corriger — pièges récurrents à éviter</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '10px', marginBottom: '24px' }}>
            {worstDow     && <InsightCard icon="📅" title="PIRE JOUR"              value={worstDow.label}     desc={`${fmt(worstDow.pnl,true)} · ${worstDow.wr}% WR`}         color="#ff4455" onClick={() => openDow(worstDow)} />}
            {worstSession && <InsightCard icon="⏰" title="PIRE SESSION (P&L)"      value={worstSession.label} desc={`${fmt(worstSession.pnl,true)} · ${worstSession.wr}% WR · ${worstSession.count}T`} color="#ff4455" onClick={() => openSession(worstSession)} />}
            {worstHour    && <InsightCard icon="🕐" title="HEURE À ÉVITER"          value={worstHour.label}    desc={`${fmt(worstHour.pnl,true)} · ${worstHour.wr}% WR`}        color="#ff4455" onClick={() => openHour(worstHour)} />}
            {worstPair    && <InsightCard icon="📉" title="INSTRUMENT À REVOIR"     value={worstPair.pair}     desc={`${fmt(worstPair.pnl,true)} · ${worstPair.wr}% WR`}        color="#ff4455" />}
            {worstEmotion && <InsightCard icon="😟" title="PIRE ÉTAT MENTAL"        value={worstEmotion.em}    desc={`${fmt(worstEmotion.pnl,true)} · ${worstEmotion.total}T`}  color="#ff4455" />}
          </div>

          {/* ── CHARTS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

            {/* DOW */}
            <Section title="📅 P&L NET PAR JOUR DE LA SEMAINE">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={byDow.filter(d => d.count > 0)} barSize={28} barCategoryGap="35%" margin={{ top:5, right:5, bottom:0, left:5 }}>
                  <CartesianGrid stroke="rgba(136,153,187,0.05)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill:'#5a6a82', fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:'#5a6a82', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}$`} width={55} />
                  <Tooltip content={<CTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(136,153,187,0.18)" />
                  <Bar dataKey="pnl" name="P&L net" radius={[3,3,0,0]} maxBarSize={6} isAnimationActive
                    onClick={(data) => { const d = byDow.find(x => x.label === data.label); if (d) openDow(d); }}
                    style={{ cursor: 'pointer' }}
                  >
                    {byDow.filter(d => d.count > 0).map((d, i) => <Cell key={i} fill={pnlColor(d.pnl)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {byDow.filter(d => d.count > 0).map(d => (
                  <div key={d.label} onClick={() => openDow(d)} style={{ background: 'rgba(14,15,22,0.5)', border: '1px solid rgba(136,153,187,0.08)', borderRadius: '4px', padding: '5px 8px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(136,153,187,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(14,15,22,0.5)'}
                  >
                    <div style={{ fontSize:'13px', color: '#5868a0', marginBottom: '2px' }}>{d.label}</div>
                    <div style={{ fontSize:'13px', fontWeight: '700', color: pnlColor(d.pnl) }}>{fmt(d.pnl, true)}</div>
                    <div style={{ fontSize:'12px', color: d.wr >= 50 ? '#00cc77' : '#ff3344' }}>{d.wr}% WR</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Sessions */}
            <Section title="⏰ PERFORMANCE PAR SESSION (cliquer pour voir les trades)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bySessions.filter(s => s.count > 0).map(s => (
                  <div key={s.label} onClick={() => openSession(s)} style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: '6px', transition: 'background 0.15s', border: '1px solid transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(136,153,187,0.05)'; e.currentTarget.style.borderColor = 'rgba(136,153,187,0.12)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                        <span style={{ fontSize: '13px', color: '#dde4ef', fontWeight: '600' }}>{s.label}</span>
                        <span style={{ fontSize:'13px', color: '#5868a0' }}>{s.start}h-{s.end}h</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize:'13px', color: pnlColor(s.pnl), fontWeight: '700' }}>{fmt(s.pnl, true)}</span>
                        <span style={{ fontSize:'13px', color: s.wr>=50?'#8899bb':'#ff4455' }}>{s.wr}% WR</span>
                        <span style={{ fontSize:'13px', color: '#5a6a82' }}>{s.count}T</span>
                        <span style={{ fontSize: '13px', color: '#5a6a82' }}>›</span>
                      </div>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.wr}%`, background: s.color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
                {bySessions.every(s => s.count === 0) && (
                  <div style={{ color: '#3a1818', fontSize:'13px', textAlign: 'center', padding: '20px 0' }}>Importez via CSV TopstepX pour voir les sessions</div>
                )}
              </div>
            </Section>
          </div>

          {/* By hour */}
          {hourDataFull.filter(h => h.count > 0).length > 0 && (
            <Section title="🕐 P&L NET PAR HEURE D'ENTRÉE (cliquer sur une barre)">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={hourDataFull} barSize={14} barCategoryGap="20%" margin={{ top:5, right:5, bottom:0, left:5 }}>
                  <CartesianGrid stroke="rgba(136,153,187,0.05)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill:'#5a6a82', fontSize:10 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fill:'#5a6a82', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}$`} width={55} />
                  <Tooltip content={<CTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(136,153,187,0.18)" />
                  <Bar dataKey="pnl" name="P&L net" radius={[2,2,0,0]} maxBarSize={6} isAnimationActive
                    onClick={(data) => { const h = byHour.find(x => x.label === data.label); if (h && h.count > 0) openHour(h); }}
                    style={{ cursor: 'pointer' }}
                  >
                    {hourDataFull.map((h, i) => <Cell key={i} fill={h.count > 0 ? h.sessionColor : 'rgba(136,153,187,0.06)'} fillOpacity={h.count > 0 ? 1 : 0.2} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { label:'Asie',        hours:'0h-9h',   color:'#aa88ff' },
                  { label:'Londres',     hours:'8h-15h',  color:'#00aaff' },
                  { label:'New York',    hours:'13h-22h', color:'#8899bb' },
                  { label:'Hors séance', hours:'22h-0h',  color:'#f0a020' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: s.color }} />
                    <span style={{ fontSize:'13px', color: '#5868a0' }}>{s.label} ({s.hours})</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Pair + Emotion */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <Section title="📊 PERFORMANCE PAR INSTRUMENT">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pairArr.slice(0,8).map(p => (
                  <div key={p.pair}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', color: '#dde4ef', fontWeight: '600' }}>{p.pair}</span>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ fontSize:'13px', color: pnlColor(p.pnl), fontWeight: '700' }}>{fmt(p.pnl, true)}</span>
                        <span style={{ fontSize:'13px', color: p.wr>=50?'#8899bb':'#ff4455' }}>{p.wr}% WR</span>
                        <span style={{ fontSize:'13px', color: '#5a6a82' }}>{p.total}T</span>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(136,153,187,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.wr}%`, background: p.pnl>=0?'#8899bb':'#ff4455', borderRadius: '2px' }} />
                    </div>
                  </div>
                ))}
                {pairArr.length === 0 && <div style={{ color: '#3a1818', fontSize:'13px', textAlign: 'center', padding: '20px 0' }}>Aucune donnée</div>}
              </div>
            </Section>

            <Section title="🧠 PERFORMANCE PAR ÉTAT MENTAL">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {emotionArr.length === 0 ? (
                  <div style={{ color: '#3a1818', fontSize:'13px', textAlign: 'center', padding: '20px 0' }}>Renseigne ton émotion sur chaque trade</div>
                ) : emotionArr.map(e => (
                  <div key={e.em} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'rgba(14,15,22,0.4)', borderRadius: '5px', border: '1px solid rgba(136,153,187,0.08)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: '#dde4ef', fontWeight: '600', marginBottom: '2px' }}>{e.em}</div>
                      <div style={{ fontSize:'13px', color: '#5868a0' }}>{e.total} trade{e.total>1?'s':''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: pnlColor(e.pnl) }}>{fmt(e.pnl, true)}</div>
                      <div style={{ fontSize:'13px', color: e.wr>=50?'#8899bb':'#ff4455' }}>{e.wr}% WR</div>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `conic-gradient(${e.wr>=50?'#8899bb':'#ff4455'} ${e.wr*3.6}deg, rgba(14,15,22,0.8) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#090a10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize:'13px', fontWeight: '700', color: e.wr>=50?'#8899bb':'#ff4455' }}>{e.wr}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* ── CALENDAR ── */}
          <div style={{ marginTop: '16px' }}>
            <TradingCalendar
              trades={trades}
              onDayClick={(dateKey, dayTrades) => {
                const dayPnl = dayTrades.reduce((s, t) => s + getNet(t), 0);
                const dateLabel = new Date(dateKey + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                setModal({
                  title: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
                  subtitle: `${dayTrades.length} trade${dayTrades.length > 1 ? 's' : ''} · ${fmt(dayPnl, true)}`,
                  color: pnlColor(dayPnl),
                  trades: dayTrades.sort((a, b) => (a.entered_at || a.date).localeCompare(b.entered_at || b.date)),
                });
              }}
            />
          </div>

          {/* ── ALL TRADES ── */}
          <div style={{ marginTop: '16px' }}>
            <Section title={`📋 TOUS LES TRADES (${allTradesFiltered.length}/${total})`}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input placeholder="Rechercher paire, date, compte..." value={tradeSearch} onChange={e => setTradeSearch(e.target.value)} style={{ ...inp, width: '240px' }} />
                {['ALL','WIN','LOSS'].map(f => {
                  const c = f==='WIN'?'#8899bb':f==='LOSS'?'#ff4455':'#8899bb';
                  return <button key={f} onClick={() => setTradeFilter(f)} style={{ padding: '4px 12px', borderRadius: '4px', border: `1px solid ${tradeFilter===f?c:'#1e2c40'}`, background: tradeFilter===f?`rgba(${f==='WIN'?'0,255,136':f==='LOSS'?'255,68,85':'0,255,136'},0.1)`:'transparent', color: tradeFilter===f?c:'#5a6a82', fontSize:'13px', fontFamily: 'inherit', cursor: 'pointer' }}>{f}</button>;
                })}
                <span style={{ fontSize:'13px', color: '#5a6a82', marginLeft: 'auto' }}>
                  P&L: <span style={{ color: pnlColor(allTradesFiltered.reduce((s,t)=>s+getNet(t),0)), fontWeight: '700' }}>{fmt(allTradesFiltered.reduce((s,t)=>s+getNet(t),0), true)}</span>
                </span>
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <TradeTable trades={allTradesFiltered.slice(0, 200)} />
              </div>
              {allTradesFiltered.length > 200 && <div style={{ textAlign: 'center', color: '#5a6a82', fontSize:'13px', padding: '8px' }}>Limité à 200 — utilisez les filtres</div>}
            </Section>
          </div>
        </>
      )}

      {/* Generic Modal */}
      {modal && (
        <TradeModal
          title={modal.title}
          subtitle={modal.subtitle}
          color={modal.color}
          trades={modal.trades}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
