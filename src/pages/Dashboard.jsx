import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Helpers ───────────────────────────────────────────────────
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
  if (v > 0) return '#00cc77';
  if (v < 0) return '#ff3344';
  return '#888080';
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#e0d0d0', glow = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(20,7,12,0.80)' : 'rgba(18,6,10,0.65)',
        border: '1px solid rgba(196,18,48,0.10)',
        borderTop: `2px solid ${color}`,
        borderRadius: '7px',
        padding: '14px 16px',
        boxShadow: glow ? `0 0 22px ${color}18, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
    >
      <div style={{ fontSize: '8px', color: '#5a2a2a', letterSpacing: '2px', marginBottom: '7px' }}>{label}</div>
      <div style={{ fontSize: '23px', fontWeight: '700', color, lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: '9px', color: '#4a2525', marginTop: '6px' }}>{sub}</div>}
    </div>
  );
}

// ── P&L Cell with tooltip ─────────────────────────────────────
function PnlCell({ trade }) {
  const [hover, setHover] = useState(false);
  const net       = getNet(trade);
  const hasFees   = (trade.fees ?? 0) > 0 || (trade.commissions ?? 0) > 0;
  const color     = pnlColor(net);

  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ fontSize: '12px', fontWeight: '700', color, cursor: hasFees ? 'help' : 'default' }}>
        {fmt(net, true)}
        {hasFees && <span style={{ fontSize: '8px', color: '#5a2a2a', marginLeft: '2px' }}>net</span>}
      </span>
      {hover && hasFees && (
        <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '6px', zIndex: 100, background: 'rgba(10,3,6,0.98)', border: '1px solid rgba(196,18,48,0.22)', borderRadius: '6px', padding: '10px 12px', minWidth: '170px', pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: '8px', color: '#5a2a2a', letterSpacing: '1px', marginBottom: '6px' }}>DÉTAIL P&L</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '10px', color: '#887070' }}>P&L brut</span>
              <span style={{ fontSize: '10px', fontWeight: '700', color: (trade.result ?? 0) >= 0 ? '#00cc77' : '#ff3344' }}>{fmt(trade.result, true)}</span>
            </div>
            {(trade.commissions ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '10px', color: '#887070' }}>Commissions</span>
                <span style={{ fontSize: '10px', color: '#ff3344' }}>-{trade.commissions.toFixed(2)}$</span>
              </div>
            )}
            {(trade.fees ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '10px', color: '#887070' }}>Frais</span>
                <span style={{ fontSize: '10px', color: '#ff3344' }}>-{trade.fees.toFixed(2)}$</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid rgba(196,18,48,0.12)', marginTop: '3px', paddingTop: '3px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: '#e0d0d0', fontWeight: '600' }}>Net</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color }}>{fmt(net, true)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trade Table (resizable cols + sortable headers) ───────────
const DEFAULT_COL_WIDTHS = { date: 90, heure: 100, pair: 80, dir: 60, entry: 82, exit: 82, size: 55, pnl: 110, dur: 72, notes: 140 };

function TradeTable({ trades, onNavigate, onDelete }) {
  const [sortCol, setSortCol]   = useState('date');
  const [sortDir, setSortDir]   = useState('desc');
  const [colWidths, setColWidths] = useState(() => {
    try { return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(localStorage.getItem('dash_trade_cols') ?? '{}') }; }
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
      const newW = Math.max(36, startW.current + ev.clientX - startX.current);
      setColWidths(prev => { const n = { ...prev, [dragging.current]: newW }; localStorage.setItem('dash_trade_cols', JSON.stringify(n)); return n; });
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
    switch (col) {
      case 'date':  return t.entered_at || t.date || '';
      case 'heure': return t.entered_at ? new Date(t.entered_at).getHours() * 60 + new Date(t.entered_at).getMinutes() : -1;
      case 'pair':  return t.pair ?? '';
      case 'dir':   return t.direction ?? '';
      case 'entry': return t.entry ?? 0;
      case 'exit':  return t.exit_price ?? 0;
      case 'size':  return t.size ?? 0;
      case 'pnl':   return getNet(t);
      case 'dur':   return t.duration ?? '';
      case 'notes': return t.notes ?? '';
      default:      return '';
    }
  }

  const sorted = trades.slice().sort((a, b) => {
    const va = sortVal(a, sortCol), vb = sortVal(b, sortCol);
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const COLS = [
    { key: 'date',  label: 'DATE' },
    { key: 'heure', label: 'H.ENTRÉE / SORTIE' },
    { key: 'pair',  label: 'PAIRE' },
    { key: 'dir',   label: 'DIR.' },
    { key: 'entry', label: 'ENTRÉE' },
    { key: 'exit',  label: 'SORTIE' },
    { key: 'size',  label: 'TAILLE' },
    { key: 'pnl',   label: 'P&L NET' },
    { key: 'dur',   label: 'DURÉE' },
    { key: 'notes', label: 'NOTES' },
  ];

  const templateCols = COLS.map(c => `${colWidths[c.key]}px`).join(' ') + ' 36px';

  function SortIcon({ col }) {
    if (sortCol !== col) return <span style={{ color: '#2a1010', fontSize: '9px' }}>⇅</span>;
    return <span style={{ color: '#c41230', fontSize: '9px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  if (sorted.length === 0) return null;

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: templateCols, minWidth: 'max-content', padding: '4px 10px', fontSize: '7px', color: '#4a2020', letterSpacing: '1.5px', borderBottom: '1px solid rgba(196,18,48,0.08)', marginBottom: '4px', userSelect: 'none' }}>
        {COLS.map((col, idx) => (
          <div key={col.key}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', overflow: 'hidden' }}
            onClick={() => handleSort(col.key)}
            onMouseEnter={e => e.currentTarget.style.color = '#c41230'}
            onMouseLeave={e => e.currentTarget.style.color = '#4a2020'}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.label}</span>
            <SortIcon col={col.key} />
            {idx < COLS.length - 1 && (
              <div onMouseDown={e => { e.stopPropagation(); onColMouseDown(e, col.key); }}
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ width: '1px', height: '60%', background: 'rgba(196,18,48,0.18)' }} />
              </div>
            )}
          </div>
        ))}
        <span />
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 'max-content' }}>
        {sorted.map(t => {
          const net   = getNet(t);
          const color = pnlColor(net);
          const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
          const entryTime = fmtTime(t.entered_at);
          const exitTime  = fmtTime(t.exited_at);
          const isWin  = t.outcome === 'WIN' || net > 0;
          const isLoss = t.outcome === 'LOSS' || net < 0;
          const exitVal = isWin  ? (t.tp   && t.tp   !== 0 ? t.tp   : t.exit_price)
                        : isLoss ? (t.stop && t.stop !== 0 ? t.stop : t.exit_price)
                        : t.exit_price;
          const exitDisplay = exitVal != null ? exitVal.toFixed(2) : '—';
          return (
            <div key={t.id}
              onClick={() => onNavigate(t.id)}
              style={{ display: 'grid', gridTemplateColumns: templateCols, alignItems: 'center', padding: '9px 10px', background: 'rgba(18,6,10,0.45)', border: '1px solid rgba(196,18,48,0.05)', borderLeft: `2px solid ${color}`, borderRadius: '4px', cursor: 'pointer', transition: 'background 0.12s', fontSize: '11px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,18,48,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(18,6,10,0.45)'}
            >
              <span style={{ color: '#5a3030', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.date}</span>
              <span style={{ color: '#7a5050', fontSize: '9px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span>{entryTime ?? '—'}</span>
                {exitTime && <span style={{ color: '#5a3535' }}>↓{exitTime}</span>}
              </span>
              <span style={{ color: '#e0d0d0', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.pair}</span>
              <span style={{ color: t.direction === 'LONG' ? '#00cc77' : '#ff3344', fontSize: '9px', background: `rgba(${t.direction === 'LONG' ? '0,204,119' : '255,51,68'},0.10)`, border: `1px solid rgba(${t.direction === 'LONG' ? '0,204,119' : '255,51,68'},0.22)`, padding: '1px 4px', borderRadius: '3px', textAlign: 'center' }}>{t.direction}</span>
              <span style={{ color: '#887070', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.entry ?? '—'}</span>
              <span style={{ color: '#887070', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exitDisplay}</span>
              <span style={{ color: '#887070' }}>{t.size ?? '—'}</span>
              <div onClick={e => e.stopPropagation()}><PnlCell trade={t} /></div>
              <span style={{ color: '#5a3030', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.duration ?? '—'}</span>
              <span style={{ color: '#5a3030', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes ?? '—'}</span>
              <button onClick={e => onDelete(t.id, e)}
                style={{ background: 'none', border: 'none', color: '#2a1010', cursor: 'pointer', fontSize: '15px', padding: '0', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff3344'}
                onMouseLeave={e => e.currentTarget.style.color = '#2a1010'}
              >×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [trades, setTrades]   = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState(() => localStorage.getItem('dash_filter') || 'ALL');
  const [search, setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, tRes] = await Promise.all([window.db.getStats(), window.db.getAllTrades()]);
    if (sRes.ok) setStats(sRes.data);
    if (tRes.ok) setTrades(tRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = stats ?? {};

  const filtered = trades.filter(t => {
    const net = getNet(t);
    if (filter === 'WIN'  && net <= 0) return false;
    if (filter === 'LOSS' && net >= 0) return false;
    if (filter === 'BE'   && net !== 0) return false;
    if (search) {
      const q = search.toLowerCase();
      return (t.pair ?? '').toLowerCase().includes(q) ||
             (t.notes ?? '').toLowerCase().includes(q) ||
             (t.date ?? '').includes(q);
    }
    return true;
  });

  const totalNet  = filtered.reduce((s, t) => s + getNet(t), 0);
  const totalFees = filtered.reduce((s, t) => s + (t.fees ?? 0) + (t.commissions ?? 0), 0);
  const wins      = filtered.filter(t => getNet(t) > 0).length;
  const losses    = filtered.filter(t => getNet(t) < 0).length;

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce trade ?')) return;
    await window.db.deleteTrade(id);
    setTrades(prev => prev.filter(t => t.id !== id));
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6a3a3a', fontSize: '11px', letterSpacing: '3px' }}>CHARGEMENT...</div>
  );

  const streakColor = (s.streak ?? 0) > 0 ? '#00cc77' : (s.streak ?? 0) < 0 ? '#ff3344' : '#888080';
  const streakLabel = (s.streak ?? 0) > 0 ? `🔥 ${s.streak} WIN` : (s.streak ?? 0) < 0 ? `❄️ ${Math.abs(s.streak ?? 0)} LOSS` : '—';

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#6a3a3a', letterSpacing: '3px', marginBottom: '4px' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#f0e0e2', margin: 0, letterSpacing: '-0.3px' }}>Tableau de bord</h1>
          <div style={{ fontSize: '10px', color: '#5a3030', marginTop: '4px' }}>
            {trades.length} trade{trades.length > 1 ? 's' : ''} · P&L net: <span style={{ color: pnlColor(s.totalPnl ?? 0), fontWeight: '700' }}>{fmt(s.totalPnl, true)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => navigate('/import')}
            style={{ background: 'transparent', border: '1px solid rgba(196,18,48,0.18)', color: '#6a3a3a', padding: '8px 14px', borderRadius: '5px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#c41230'; e.currentTarget.style.borderColor = 'rgba(196,18,48,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6a3a3a'; e.currentTarget.style.borderColor = 'rgba(196,18,48,0.18)'; }}
          >
            📂 Import CSV
          </button>
          <button onClick={() => navigate('/dashboard/new')}
            style={{ background: 'linear-gradient(135deg,rgba(196,18,48,0.20),rgba(130,10,30,0.12))', border: '1px solid rgba(196,18,48,0.35)', color: '#c41230', padding: '8px 16px', borderRadius: '5px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', fontWeight: '700', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 14px rgba(196,18,48,0.20)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            + NOUVEAU TRADE
          </button>
        </div>
      </div>

      {/* ── STATS GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px', marginBottom: '20px' }}>
        <StatCard label="P&L NET" value={fmt(s.totalPnl, true)} color={pnlColor(s.totalPnl ?? 0)} sub={`Frais: -${fmt(s.totalFees)}`} glow={s.totalPnl > 0} />
        <StatCard label="WINRATE" value={`${s.winrate ?? 0}%`} color={(s.winrate ?? 0) >= 50 ? '#00cc77' : '#ff3344'} sub={`${s.wins ?? 0}W / ${s.losses ?? 0}L`} />
        <StatCard label="PROFIT FACTOR" value={s.profitFactor === 999 ? '∞' : (s.profitFactor ?? 0)} color={(s.profitFactor ?? 0) >= 1.5 ? '#00cc77' : '#f0a020'} />
        <StatCard label="RR MOYEN" value={`1:${s.avgRR ?? 0}`} color="#887070" />
        <StatCard label="MAX DRAWDOWN" value={fmt(-(s.maxDrawdown ?? 0))} color="#ff3344" />
        <StatCard label="STREAK" value={streakLabel} color={streakColor} />
      </div>

      {/* ── JOURNAL SECTION ── */}
      <div style={{ background: 'rgba(15,5,8,0.45)', border: '1px solid rgba(196,18,48,0.10)', borderRadius: '8px', padding: '16px 18px' }}>

        {/* Journal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '9px', color: '#6a3a3a', letterSpacing: '2px' }}>
            JOURNAL — {filtered.length} trade{filtered.length > 1 ? 's' : ''}
            {totalFees > 0 && <span style={{ color: '#f0a020', marginLeft: '8px' }}>· -{totalFees.toFixed(2)}$ frais</span>}
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'rgba(18,6,10,0.65)', border: '1px solid rgba(196,18,48,0.12)', borderRadius: '4px', padding: '5px 10px', color: '#e0d0d0', fontSize: '10px', fontFamily: 'inherit', outline: 'none', width: '140px', caretColor: '#c41230', transition: 'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = 'rgba(196,18,48,0.35)'}
              onBlur={e => e.target.style.borderColor = 'rgba(196,18,48,0.12)'}
            />
            {/* Filters */}
            {['ALL','WIN','LOSS','BE'].map(f => {
              const isActive = filter === f;
              const c = f==='WIN'?'#00cc77':f==='LOSS'?'#ff3344':f==='BE'?'#f0a020':'#c41230';
              const bg = f==='WIN'?'rgba(0,204,119,0.10)':f==='LOSS'?'rgba(255,51,68,0.10)':f==='BE'?'rgba(240,160,32,0.10)':'rgba(196,18,48,0.10)';
              return (
                <button key={f}
                  onClick={() => { setFilter(f); localStorage.setItem('dash_filter', f); }}
                  style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${isActive ? c : 'rgba(196,18,48,0.15)'}`, background: isActive ? bg : 'transparent', color: isActive ? c : '#5a3030', fontSize: '9px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', fontWeight: isActive ? '700' : '400' }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = c; e.currentTarget.style.borderColor = c + '44'; }}}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = '#5a3030'; e.currentTarget.style.borderColor = 'rgba(196,18,48,0.15)'; }}}
                >{f}</button>
              );
            })}
          </div>
        </div>

        {/* Mini stats bar */}
        {filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '12px' }}>
            {[
              { label: 'P&L NET', value: fmt(totalNet, true), color: pnlColor(totalNet) },
              { label: 'FRAIS', value: `-${totalFees.toFixed(2)}$`, color: '#f0a020' },
              { label: 'WIN / LOSS', value: `${wins}W / ${losses}L`, color: '#e0d0d0' },
              { label: 'WINRATE', value: `${Math.round((wins / Math.max(filtered.length, 1)) * 100)}%`, color: wins / Math.max(filtered.length, 1) >= 0.5 ? '#00cc77' : '#ff3344' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(18,6,10,0.55)', border: '1px solid rgba(196,18,48,0.07)', borderRadius: '4px', padding: '7px 10px' }}>
                <div style={{ fontSize: '7px', color: '#5a2a2a', letterSpacing: '1px', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#3a1515', fontSize: '11px', letterSpacing: '2px', border: '1px dashed rgba(196,18,48,0.15)', borderRadius: '6px' }}>
            {search ? 'Aucun résultat' : filter !== 'ALL' ? `Aucun trade ${filter}` : 'Aucun trade — ajoutez votre premier trade'}
          </div>
        ) : (
          <TradeTable
            trades={filtered}
            onNavigate={id => navigate(`/dashboard/${id}`)}
            onDelete={handleDelete}
          />
        )}
      </div>

    </div>
  );
}
