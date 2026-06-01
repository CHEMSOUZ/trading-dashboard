import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const OUTCOME_COLOR = { WIN: '#00ff88', LOSS: '#ff4455', BE: '#f0a020' };

// ── Net P&L : result_net si dispo, sinon result ───────────────
function getDisplayPnl(trade) {
  if (trade.result_net != null) return trade.result_net;
  if (trade.result     != null) return trade.result;
  return null;
}

function fmtPnl(n) {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}$`;
}

// ── Frais Cell — affichage + édition inline ──────────────────
function FraisCell({ trade, onUpdate }) {
  const [editing, setEditing]         = useState(false);
  const [feesVal, setFeesVal]         = useState('');
  const [commissionsVal, setCommissionsVal] = useState('');
  const [hover, setHover]             = useState(false);
  const [saving, setSaving]           = useState(false);

  const fees        = trade.fees ?? 0;
  const commissions = trade.commissions ?? 0;
  const total       = fees + commissions;

  function startEdit(e) {
    e.stopPropagation();
    setFeesVal(fees > 0 ? String(fees) : '');
    setCommissionsVal(commissions > 0 ? String(commissions) : '');
    setEditing(true);
  }

  async function saveEdit(e) {
    e?.stopPropagation();
    setSaving(true);
    const newFees  = parseFloat(feesVal)        || 0;
    const newComms = parseFloat(commissionsVal) || 0;
    const newNet   = (trade.result ?? 0) - newFees - newComms;
    await window.db.updateTrade(trade.id, {
      ...trade,
      fees:        newFees,
      commissions: newComms,
      result_net:  Math.round(newNet * 100) / 100,
    });
    onUpdate(trade.id, { fees: newFees, commissions: newComms, result_net: Math.round(newNet * 100) / 100 });
    setSaving(false);
    setEditing(false);
  }

  function cancelEdit(e) { e?.stopPropagation(); setEditing(false); }

  if (editing) {
    return (
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
        <input
          autoFocus type="number" placeholder="Frais" value={feesVal}
          onChange={e => setFeesVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(e); if (e.key === 'Escape') cancelEdit(e); }}
          style={{ width: '100%', background: 'rgba(10,28,18,0.8)', border: '1px solid rgba(240,160,32,0.4)', borderRadius: '3px', padding: '3px 6px', color: '#f0a020', fontSize: '10px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
        <input
          type="number" placeholder="Commissions" value={commissionsVal}
          onChange={e => setCommissionsVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(e); if (e.key === 'Escape') cancelEdit(e); }}
          style={{ width: '100%', background: 'rgba(10,28,18,0.8)', border: '1px solid rgba(240,160,32,0.3)', borderRadius: '3px', padding: '3px 6px', color: '#f0a020', fontSize: '10px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: '3px' }}>
          <button onClick={saveEdit} disabled={saving} style={{ flex: 1, background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', borderRadius: '3px', padding: '2px', fontSize: '9px', cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
          <button onClick={cancelEdit} style={{ flex: 1, background: 'transparent', border: '1px solid #1a3a22', color: '#4a7a5a', borderRadius: '3px', padding: '2px', fontSize: '9px', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
      onClick={startEdit}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Cliquer pour modifier les frais"
    >
      <span style={{ fontSize: '11px', fontWeight: '600', color: total > 0 ? '#f0a020' : '#2a4a30' }}>
        {total > 0 ? `-${total.toFixed(2)}$` : '—'}
      </span>
      <span style={{ fontSize: '8px', color: hover ? '#00ff88' : '#2a5a32', transition: 'color 0.15s' }}>✎</span>

      {hover && total > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: '6px', zIndex: 100,
          background: 'rgba(6,18,12,0.98)',
          border: '1px solid rgba(240,160,32,0.25)',
          borderRadius: '5px', padding: '10px 12px',
          minWidth: '160px', pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: '8px', color: '#5a4a20', letterSpacing: '1px', marginBottom: '8px' }}>DÉTAIL — clic pour modifier</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {commissions > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '10px', color: '#8aaa90' }}>Commissions</span>
                <span style={{ fontSize: '10px', color: '#f0a020' }}>-{commissions.toFixed(2)}$</span>
              </div>
            )}
            {fees > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '10px', color: '#8aaa90' }}>Frais</span>
                <span style={{ fontSize: '10px', color: '#f0a020' }}>-{fees.toFixed(2)}$</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid rgba(240,160,32,0.15)', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ fontSize: '10px', color: '#c8d8c8', fontWeight: '600' }}>Total</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#f0a020' }}>-{total.toFixed(2)}$</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── P&L Cell avec tooltip frais ───────────────────────────────
function PnlCell({ trade }) {
  const [hover, setHover] = useState(false);
  const netPnl   = getDisplayPnl(trade);
  const hasFees  = (trade.fees ?? 0) > 0 || (trade.commissions ?? 0) > 0;
  const totalFees = (trade.fees ?? 0) + (trade.commissions ?? 0);
  const color    = netPnl == null ? '#8aaa90' : netPnl > 0 ? '#00ff88' : netPnl < 0 ? '#ff4455' : '#8aaa90';

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ fontSize: '12px', fontWeight: '700', color, cursor: hasFees ? 'help' : 'default' }}>
        {fmtPnl(netPnl)}
        {hasFees && <span style={{ fontSize: '8px', color: '#3a6a4a', marginLeft: '3px' }}>net</span>}
      </span>

      {/* Tooltip détail frais */}
      {hover && hasFees && (
        <div style={{
          position: 'absolute', bottom: '100%', right: 0,
          marginBottom: '6px', zIndex: 100,
          background: 'rgba(6,18,12,0.98)',
          border: '1px solid rgba(0,255,136,0.2)',
          borderRadius: '5px', padding: '10px 12px',
          minWidth: '180px', pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '8px' }}>DÉTAIL P&L</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ fontSize: '10px', color: '#8aaa90' }}>P&L brut</span>
              <span style={{ fontSize: '10px', fontWeight: '700', color: (trade.result ?? 0) >= 0 ? '#00ff88' : '#ff4455' }}>
                {fmtPnl(trade.result)}
              </span>
            </div>
            {(trade.commissions ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '10px', color: '#8aaa90' }}>Commissions</span>
                <span style={{ fontSize: '10px', color: '#ff4455' }}>-{trade.commissions.toFixed(2)}$</span>
              </div>
            )}
            {(trade.fees ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '10px', color: '#8aaa90' }}>Frais</span>
                <span style={{ fontSize: '10px', color: '#ff4455' }}>-{trade.fees.toFixed(2)}$</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid rgba(0,255,136,0.1)', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ fontSize: '10px', color: '#c8d8c8', fontWeight: '600' }}>P&L net</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color }}>
                {fmtPnl(netPnl)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ fontSize: '9px', color: '#3a6a4a' }}>Total frais</span>
              <span style={{ fontSize: '9px', color: '#f0a020' }}>-{totalFees.toFixed(2)}$</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Journal() {
  const [trades, setTrades]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('ALL');
  const navigate = useNavigate();

  useEffect(() => { loadTrades(); }, []);

  async function loadTrades() {
    setLoading(true);
    const res = await window.db.getAllTrades();
    if (res.ok) setTrades(res.data);
    setLoading(false);
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce trade ?')) return;
    await window.db.deleteTrade(id);
    setTrades(prev => prev.filter(t => t.id !== id));
  }

  function handleFeeUpdate(id, patch) {
    setTrades(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  // Filter based on net P&L outcome
  const filtered = trades.filter(t => {
    if (filter === 'ALL') return true;
    const net = getDisplayPnl(t);
    if (filter === 'WIN')  return net != null && net > 0;
    if (filter === 'LOSS') return net != null && net < 0;
    if (filter === 'BE')   return net != null && net === 0;
    return true;
  });

  // Summary stats
  const totalNet = filtered.reduce((s, t) => s + (getDisplayPnl(t) ?? 0), 0);
  const totalFees = filtered.reduce((s, t) => s + (t.fees ?? 0) + (t.commissions ?? 0), 0);
  const wins   = filtered.filter(t => (getDisplayPnl(t) ?? 0) > 0).length;
  const losses = filtered.filter(t => (getDisplayPnl(t) ?? 0) < 0).length;

  return (
    <div style={{ padding: '28px 32px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>TRADING</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Journal de Trades</h1>
          <div style={{ fontSize: '11px', color: '#3a6a4a', marginTop: '4px' }}>
            {filtered.length} trade{filtered.length > 1 ? 's' : ''} ·{' '}
            <span style={{ color: totalNet >= 0 ? '#00ff88' : '#ff4455', fontWeight: '700' }}>
              {totalNet >= 0 ? '+' : ''}{totalNet.toFixed(2)}$ net
            </span>
            {totalFees > 0 && (
              <span style={{ color: '#f0a020', marginLeft: '8px' }}>· -{totalFees.toFixed(2)}$ frais</span>
            )}
          </div>
        </div>
        <button onClick={() => navigate('/journal/new')} style={{
          background: 'linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,170,85,0.1))',
          border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88',
          padding: '9px 18px', borderRadius: '6px', fontSize: '10px',
          fontFamily: 'inherit', letterSpacing: '1.5px', cursor: 'pointer',
          fontWeight: '700', transition: 'all 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px rgba(0,255,136,0.2)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >+ NOUVEAU TRADE</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {['ALL','WIN','LOSS','BE'].map(f => {
          const fColor = f === 'WIN' ? '#00ff88' : f === 'LOSS' ? '#ff4455' : f === 'BE' ? '#f0a020' : '#00ff88';
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '4px 12px', borderRadius: '4px',
              border: `1px solid ${filter === f ? fColor : '#1a3a22'}`,
              background: filter === f ? `rgba(${f==='WIN'?'0,255,136':f==='LOSS'?'255,68,85':f==='BE'?'240,160,32':'0,255,136'},0.1)` : 'transparent',
              color: filter === f ? fColor : '#3a6a4a',
              fontSize: '9px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer',
            }}>{f}</button>
          );
        })}
        <div style={{ marginLeft: 'auto', fontSize: '9px', color: '#2a4a30', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>💡</span>
          <span>Survolez le P&L pour voir le détail des frais</span>
        </div>
      </div>

      {/* Stats bar */}
      {filtered.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '14px',
        }}>
          {[
            { label: 'P&L NET', value: `${totalNet >= 0 ? '+' : ''}${totalNet.toFixed(2)}$`, color: totalNet >= 0 ? '#00ff88' : '#ff4455' },
            { label: 'FRAIS TOTAUX', value: `-${totalFees.toFixed(2)}$`, color: '#f0a020' },
            { label: 'WIN / LOSS', value: `${wins}W / ${losses}L`, color: '#c8d8c8' },
            { label: 'WINRATE', value: `${filtered.length > 0 ? Math.round((wins / filtered.length) * 100) : 0}%`, color: wins / Math.max(filtered.length, 1) >= 0.5 ? '#00ff88' : '#ff4455' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '4px', padding: '8px 12px' }}>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '3px' }}>{label}</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table header */}
      {filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '90px 90px 70px 90px 90px 60px 120px 90px 80px 1fr 40px',
          gap: '8px', padding: '6px 14px',
          fontSize: '8px', color: '#2a5a32', letterSpacing: '1.5px',
          borderBottom: '1px solid rgba(0,255,136,0.06)', marginBottom: '4px',
        }}>
          <span>DATE</span><span>PAIRE</span><span>DIR.</span>
          <span>ENTRÉE</span><span>SORTIE</span><span>TAILLE</span>
          <span>P&L NET ▼</span>
          <span style={{ color: '#5a4a20' }}>FRAIS</span>
          <span>DURÉE</span><span>NOTES</span><span></span>
        </div>
      )}

      {/* Rows */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#3a6a4a', fontSize: '11px', letterSpacing: '2px' }}>CHARGEMENT...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', border: '1px dashed #1a3a22', borderRadius: '6px', color: '#2a4a30', fontSize: '11px', letterSpacing: '2px' }}>
          {filter === 'ALL' ? 'Aucun trade — commencez à journaliser !' : `Aucun trade ${filter}`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {filtered.map(t => {
            const netPnl  = getDisplayPnl(t);
            const oc      = netPnl == null ? '#8aaa90' : netPnl > 0 ? '#00ff88' : netPnl < 0 ? '#ff4455' : '#8aaa90';
            return (
              <div key={t.id}
                onClick={() => navigate(`/journal/${t.id}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 90px 70px 90px 90px 60px 120px 90px 80px 1fr 40px',
                  gap: '8px', alignItems: 'center',
                  padding: '10px 14px',
                  background: 'rgba(10,28,18,0.4)',
                  border: '1px solid rgba(0,255,136,0.05)',
                  borderLeft: `2px solid ${oc}`,
                  borderRadius: '4px', cursor: 'pointer',
                  transition: 'all 0.15s', fontSize: '11px',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(10,28,18,0.4)'}
              >
                <span style={{ color: '#4a7a5a', fontSize: '10px' }}>{t.date}</span>
                <span style={{ color: '#c8d8c8', fontWeight: '600' }}>{t.pair}</span>
                <span style={{
                  color: t.direction === 'LONG' ? '#00ff88' : '#ff4455',
                  fontSize: '9px', letterSpacing: '1px',
                  background: `rgba(${t.direction==='LONG'?'0,255,136':'255,68,85'},0.08)`,
                  border: `1px solid rgba(${t.direction==='LONG'?'0,255,136':'255,68,85'},0.2)`,
                  padding: '2px 5px', borderRadius: '3px', textAlign: 'center',
                }}>{t.direction}</span>
                <span style={{ color: '#8aaa90' }}>{t.entry ?? '—'}</span>
                <span style={{ color: '#8aaa90' }}>{t.exit_price ?? '—'}</span>
                <span style={{ color: '#8aaa90' }}>{t.size ?? '—'}</span>

                {/* P&L net avec tooltip */}
                <div onClick={e => e.stopPropagation()}>
                  <PnlCell trade={t} />
                </div>

                {/* Frais éditables */}
                <div onClick={e => e.stopPropagation()}>
                  <FraisCell trade={t} onUpdate={handleFeeUpdate} />
                </div>

                <span style={{ color: '#4a7a5a', fontSize: '10px' }}>{t.duration ?? '—'}</span>
                <span style={{ color: '#4a7a5a', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.notes ?? '—'}
                </span>
                <button onClick={e => handleDelete(t.id, e)} style={{
                  background: 'none', border: 'none', color: '#1a3a20',
                  cursor: 'pointer', fontSize: '16px', padding: '0', transition: 'color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ff4455'}
                  onMouseLeave={e => e.currentTarget.style.color = '#1a3a20'}
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
