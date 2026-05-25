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
  if (v > 0) return '#00ff88';
  if (v < 0) return '#ff4455';
  return '#8aaa90';
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#c8d8c8', glow = false }) {
  return (
    <div style={{
      background: 'rgba(10,28,18,0.6)',
      border: '1px solid rgba(0,255,136,0.08)',
      borderTop: `2px solid ${color}`,
      borderRadius: '6px', padding: '14px 16px',
      boxShadow: glow ? `0 0 20px ${color}15` : 'none',
      transition: 'all 0.2s',
    }}>
      <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '9px', color: '#4a7a5a', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

// ── P&L Cell with tooltip ─────────────────────────────────────
function PnlCell({ trade }) {
  const [hover, setHover] = useState(false);
  const net      = getNet(trade);
  const hasFees  = (trade.fees ?? 0) > 0 || (trade.commissions ?? 0) > 0;
  const totalFees = (trade.fees ?? 0) + (trade.commissions ?? 0);
  const color    = pnlColor(net);

  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ fontSize: '12px', fontWeight: '700', color, cursor: hasFees ? 'help' : 'default' }}>
        {fmt(net, true)}
        {hasFees && <span style={{ fontSize: '8px', color: '#3a6a4a', marginLeft: '2px' }}>net</span>}
      </span>
      {hover && hasFees && (
        <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '6px', zIndex: 100, background: 'rgba(6,18,12,0.98)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '5px', padding: '10px 12px', minWidth: '170px', pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '6px' }}>DÉTAIL P&L</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '10px', color: '#8aaa90' }}>P&L brut</span>
              <span style={{ fontSize: '10px', fontWeight: '700', color: (trade.result ?? 0) >= 0 ? '#00ff88' : '#ff4455' }}>{fmt(trade.result, true)}</span>
            </div>
            {(trade.commissions ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '10px', color: '#8aaa90' }}>Commissions</span>
                <span style={{ fontSize: '10px', color: '#ff4455' }}>-{trade.commissions.toFixed(2)}$</span>
              </div>
            )}
            {(trade.fees ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '10px', color: '#8aaa90' }}>Frais</span>
                <span style={{ fontSize: '10px', color: '#ff4455' }}>-{trade.fees.toFixed(2)}$</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid rgba(0,255,136,0.1)', marginTop: '3px', paddingTop: '3px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: '#c8d8c8', fontWeight: '600' }}>Net</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color }}>{fmt(net, true)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trade Table (resizable cols + sortable headers + HEURE) ───
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
    if (sortCol !== col) return <span style={{ color: '#1a3a22', fontSize: '9px' }}>⇅</span>;
    return <span style={{ color: '#00ff88', fontSize: '9px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  if (sorted.length === 0) return null;

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: templateCols, minWidth: 'max-content', padding: '4px 10px', fontSize: '7px', color: '#2a5a32', letterSpacing: '1.5px', borderBottom: '1px solid rgba(0,255,136,0.06)', marginBottom: '4px', userSelect: 'none' }}>
        {COLS.map((col, idx) => (
          <div key={col.key} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', overflow: 'hidden' }}
            onClick={() => handleSort(col.key)}
            onMouseEnter={e => e.currentTarget.style.color = '#00ff88'}
            onMouseLeave={e => e.currentTarget.style.color = '#2a5a32'}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.label}</span>
            <SortIcon col={col.key} />
            {idx < COLS.length - 1 && (
              <div onMouseDown={e => { e.stopPropagation(); onColMouseDown(e, col.key); }}
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ width: '1px', height: '60%', background: 'rgba(0,255,136,0.2)' }} />
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
          return (
            <div key={t.id}
              onClick={() => onNavigate(t.id)}
              style={{ display: 'grid', gridTemplateColumns: templateCols, alignItems: 'center', padding: '9px 10px', background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.04)', borderLeft: `2px solid ${color}`, borderRadius: '4px', cursor: 'pointer', transition: 'background 0.12s', fontSize: '11px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(10,28,18,0.4)'}
            >
              <span style={{ color: '#4a7a5a', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.date}</span>
              <span style={{ color: '#6a8a7a', fontSize: '9px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span>{entryTime ?? '—'}</span>
                {exitTime && <span style={{ color: '#4a6a5a' }}>↓{exitTime}</span>}
              </span>
              <span style={{ color: '#c8d8c8', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.pair}</span>
              <span style={{ color: t.direction === 'LONG' ? '#00ff88' : '#ff4455', fontSize: '9px', background: `rgba(${t.direction === 'LONG' ? '0,255,136' : '255,68,85'},0.08)`, border: `1px solid rgba(${t.direction === 'LONG' ? '0,255,136' : '255,68,85'},0.2)`, padding: '1px 4px', borderRadius: '3px', textAlign: 'center' }}>{t.direction}</span>
              <span style={{ color: '#8aaa90', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.entry ?? '—'}</span>
              <span style={{ color: '#8aaa90', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.exit_price ?? '—'}</span>
              <span style={{ color: '#8aaa90' }}>{t.size ?? '—'}</span>
              <div onClick={e => e.stopPropagation()}><PnlCell trade={t} /></div>
              <span style={{ color: '#4a7a5a', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.duration ?? '—'}</span>
              <span style={{ color: '#4a7a5a', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes ?? '—'}</span>
              <button onClick={e => onDelete(t.id, e)} style={{ background: 'none', border: 'none', color: '#1a3a20', cursor: 'pointer', fontSize: '15px', padding: '0', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff4455'}
                onMouseLeave={e => e.currentTarget.style.color = '#1a3a20'}
              >×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quick Trade Modal ─────────────────────────────────────────
function QuickTradeModal({ onClose, onAdded }) {
  const PAIRS = ['MNQ','NQ','MES','ES','MGC','GC','M2K','RTY','MCL','CL'];
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    pair: 'MNQ', direction: 'LONG',
    entry: '', exit_price: '', size: '', result: '', outcome: '',
  });
  const [saving, setSaving] = useState(false);
  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#c8d8c8', fontSize: '11px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };

  async function submit() {
    if (!form.result) return;
    setSaving(true);
    const pnl = parseFloat(form.result) || 0;
    await window.db.insertTrade({
      date: form.date, pair: form.pair, direction: form.direction,
      entry: parseFloat(form.entry) || 0,
      exit_price: parseFloat(form.exit_price) || null,
      size: parseFloat(form.size) || null,
      result: pnl, result_net: pnl,
      outcome: form.outcome || (pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BE'),
      source: 'manual_quick', stop: 0, tp: 0,
    });
    setSaving(false);
    onAdded(); onClose();
  }

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#070d12', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '10px', width: '100%', maxWidth: '440px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '4px' }}>SAISIE RAPIDE</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#e8f8e8' }}>⚡ Trade Express</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>DATE</div>
              <input type="date" value={form.date} onChange={set('date')} style={{ ...inp, colorScheme: 'dark' }} />
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>INSTRUMENT</div>
              <select value={form.pair} onChange={set('pair')} style={inp}>
                {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>DIRECTION</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {['LONG','SHORT'].map(d => (
                  <button key={d} onClick={() => setForm(p => ({ ...p, direction: d }))} style={{ flex: 1, padding: '8px 2px', borderRadius: '4px', border: `1px solid ${form.direction===d?(d==='LONG'?'#00ff88':'#ff4455'):'rgba(0,255,136,0.12)'}`, background: form.direction===d?`rgba(${d==='LONG'?'0,255,136':'255,68,85'},0.12)`:'rgba(10,28,18,0.6)', color: form.direction===d?(d==='LONG'?'#00ff88':'#ff4455'):'#5a8a6a', fontSize: '9px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer' }}>{d}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>ENTRÉE</div>
              <input type="number" placeholder="28900" value={form.entry} onChange={set('entry')} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>SORTIE</div>
              <input type="number" placeholder="28920" value={form.exit_price} onChange={set('exit_price')} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>TAILLE</div>
              <input type="number" placeholder="10" value={form.size} onChange={set('size')} style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>P&L NET * ($)</div>
              <input type="number" placeholder="+500 ou -250" value={form.result} onChange={set('result')} style={{ ...inp, color: form.result ? pnlColor(parseFloat(form.result)) : '#c8d8c8' }} />
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>RÉSULTAT</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {['WIN','LOSS','BE'].map(o => {
                  const c = o==='WIN'?'#00ff88':o==='LOSS'?'#ff4455':'#f0a020';
                  return <button key={o} onClick={() => setForm(p => ({ ...p, outcome: o }))} style={{ flex: 1, padding: '8px 2px', borderRadius: '4px', border: `1px solid ${form.outcome===o?c:'rgba(0,255,136,0.12)'}`, background: form.outcome===o?`rgba(${o==='WIN'?'0,255,136':o==='LOSS'?'255,68,85':'240,160,32'},0.12)`:'rgba(10,28,18,0.6)', color: form.outcome===o?c:'#5a8a6a', fontSize: '9px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer' }}>{o}</button>;
                })}
              </div>
            </div>
          </div>
          <button onClick={submit} disabled={saving || !form.result} style={{ padding: '11px', borderRadius: '5px', background: 'linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,170,85,0.1))', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', fontSize: '11px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1.5px', cursor: 'pointer' }}>
            {saving ? 'ENREGISTREMENT...' : '⚡ ENREGISTRER'}
          </button>
        </div>
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
  const [showQuick, setShowQuick] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, tRes] = await Promise.all([window.db.getStats(), window.db.getAllTrades()]);
    if (sRes.ok) setStats(sRes.data);
    if (tRes.ok) setTrades(tRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = stats ?? {};

  // Filter
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3a6a4a', fontSize: '11px', letterSpacing: '2px' }}>CHARGEMENT...</div>
  );

  const streakColor = (s.streak ?? 0) > 0 ? '#00ff88' : (s.streak ?? 0) < 0 ? '#ff4455' : '#8aaa90';
  const streakLabel = (s.streak ?? 0) > 0 ? `🔥 ${s.streak} WIN` : (s.streak ?? 0) < 0 ? `❄️ ${Math.abs(s.streak ?? 0)} LOSS` : '—';

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '4px' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Tableau de bord</h1>
          <div style={{ fontSize: '10px', color: '#3a6a4a', marginTop: '3px' }}>
            {trades.length} trade{trades.length > 1 ? 's' : ''} · P&L net: <span style={{ color: pnlColor(s.totalPnl ?? 0), fontWeight: '700' }}>{fmt(s.totalPnl, true)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => navigate('/import')}
            style={{ background: 'transparent', border: '1px solid #1a3a22', color: '#4a7a5a', padding: '8px 14px', borderRadius: '5px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.borderColor = '#00ff88'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4a7a5a'; e.currentTarget.style.borderColor = '#1a3a22'; }}
          >
            📂 Import CSV
          </button>
          <button onClick={() => setShowQuick(true)} style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', padding: '8px 14px', borderRadius: '5px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', fontWeight: '700' }}>
            ⚡ Trade Express
          </button>
          <button onClick={() => navigate('/dashboard/new')} style={{ background: 'linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,170,85,0.1))', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', padding: '8px 16px', borderRadius: '5px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', fontWeight: '700' }}>
            + NOUVEAU TRADE
          </button>
        </div>
      </div>

      {/* ── STATS GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px', marginBottom: '20px' }}>
        <StatCard label="P&L NET" value={fmt(s.totalPnl, true)} color={pnlColor(s.totalPnl ?? 0)} sub={`Frais: -${fmt(s.totalFees)}`} glow={s.totalPnl > 0} />
        <StatCard label="WINRATE" value={`${s.winrate ?? 0}%`} color={(s.winrate ?? 0) >= 50 ? '#00ff88' : '#ff4455'} sub={`${s.wins ?? 0}W / ${s.losses ?? 0}L`} />
        <StatCard label="PROFIT FACTOR" value={s.profitFactor === 999 ? '∞' : (s.profitFactor ?? 0)} color={(s.profitFactor ?? 0) >= 1.5 ? '#00ff88' : '#f0a020'} />
        <StatCard label="RR MOYEN" value={`1:${s.avgRR ?? 0}`} color="#8aaa90" />
        <StatCard label="MAX DRAWDOWN" value={fmt(-(s.maxDrawdown ?? 0))} color="#ff4455" />
        <StatCard label="STREAK" value={streakLabel} color={streakColor} />
      </div>

      {/* ── JOURNAL SECTION ── */}
      <div style={{ background: 'rgba(10,28,18,0.3)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '16px 18px' }}>

        {/* Journal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px' }}>
            JOURNAL — {filtered.length} trade{filtered.length > 1 ? 's' : ''}
            {totalFees > 0 && <span style={{ color: '#f0a020', marginLeft: '8px' }}>· -{totalFees.toFixed(2)}$ frais</span>}
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '4px', padding: '5px 10px', color: '#c8d8c8', fontSize: '10px', fontFamily: 'inherit', outline: 'none', width: '140px', caretColor: '#00ff88' }}
            />
            {/* Filters */}
            {['ALL','WIN','LOSS','BE'].map(f => {
              const c = f==='WIN'?'#00ff88':f==='LOSS'?'#ff4455':f==='BE'?'#f0a020':'#00ff88';
              return (
                <button key={f} onClick={() => { setFilter(f); localStorage.setItem('dash_filter', f); }} style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${filter===f?c:'#1a3a22'}`, background: filter===f?`rgba(${f==='WIN'?'0,255,136':f==='LOSS'?'255,68,85':f==='BE'?'240,160,32':'0,255,136'},0.1)`:'transparent', color: filter===f?c:'#3a6a4a', fontSize: '9px', fontFamily: 'inherit', cursor: 'pointer' }}>{f}</button>
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
              { label: 'WIN / LOSS', value: `${wins}W / ${losses}L`, color: '#c8d8c8' },
              { label: 'WINRATE', value: `${Math.round((wins / Math.max(filtered.length, 1)) * 100)}%`, color: wins / Math.max(filtered.length, 1) >= 0.5 ? '#00ff88' : '#ff4455' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.05)', borderRadius: '4px', padding: '6px 10px' }}>
                <div style={{ fontSize: '7px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '12px', fontWeight: '700', color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#2a4a30', fontSize: '11px', letterSpacing: '2px', border: '1px dashed #1a3a22', borderRadius: '6px' }}>
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

      {showQuick && <QuickTradeModal onClose={() => setShowQuick(false)} onAdded={load} />}
    </div>
  );
}
