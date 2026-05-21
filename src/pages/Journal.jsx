import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const OUTCOME_COLOR = { WIN: '#00ff88', LOSS: '#ff4455', BE: '#f0a020' };

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

  const filtered = filter === 'ALL' ? trades : trades.filter(t => t.outcome === filter);

  return (
    <div style={{ padding: '28px 32px' }}>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>TRADING</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Journal de Trades</h1>
          <div style={{ fontSize: '11px', color: '#3a6a4a', marginTop: '4px' }}>{filtered.length} trade{filtered.length > 1 ? 's' : ''}</div>
        </div>
        <button onClick={() => navigate('/journal/new')} style={{
          background: 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,170,85,0.1))',
          border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88',
          padding: '9px 18px', borderRadius: '6px', fontSize: '10px',
          fontFamily: 'inherit', letterSpacing: '1.5px', cursor: 'pointer',
          fontWeight: '700', transition: 'all 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px rgba(0,255,136,0.2)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >+ NOUVEAU TRADE</button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {['ALL', 'WIN', 'LOSS', 'BE'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 12px', borderRadius: '4px',
            border: `1px solid ${filter === f ? (OUTCOME_COLOR[f] ?? '#00ff88') : '#1a3a22'}`,
            background: filter === f ? `rgba(${f==='WIN'?'0,255,136':f==='LOSS'?'255,68,85':f==='BE'?'240,160,32':'0,255,136'},0.1)` : 'transparent',
            color: filter === f ? (OUTCOME_COLOR[f] ?? '#00ff88') : '#3a6a4a',
            fontSize: '9px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer',
          }}>{f}</button>
        ))}
      </div>

      {/* Header tableau */}
      {filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '90px 90px 70px 80px 80px 80px 60px 90px 1fr 40px',
          gap: '8px', padding: '6px 14px',
          fontSize: '8px', color: '#2a5a32', letterSpacing: '1.5px',
          borderBottom: '1px solid rgba(0,255,136,0.06)', marginBottom: '4px',
        }}>
          <span>DATE</span><span>PAIRE</span><span>DIR.</span>
          <span>ENTRÉE</span><span>STOP</span><span>TP</span>
          <span>RR</span><span>RÉSULTAT</span><span>NOTES</span><span></span>
        </div>
      )}

      {/* Lignes */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#3a6a4a', fontSize: '11px', letterSpacing: '2px' }}>
          CHARGEMENT...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: '48px', textAlign: 'center', border: '1px dashed #1a3a22',
          borderRadius: '6px', color: '#2a4a30', fontSize: '11px', letterSpacing: '2px',
        }}>
          {filter === 'ALL' ? 'Aucun trade — commencez à journaliser !' : `Aucun trade ${filter}`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {filtered.map(t => {
            const oc = OUTCOME_COLOR[t.outcome] ?? '#8aaa90';
            return (
              <div key={t.id}
                onClick={() => navigate(`/journal/${t.id}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 90px 70px 80px 80px 80px 60px 90px 1fr 40px',
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
                <span style={{ color: '#8aaa90' }}>{t.entry}</span>
                <span style={{ color: '#ff4455' }}>{t.stop}</span>
                <span style={{ color: '#00ff88' }}>{t.tp}</span>
                <span style={{ color: '#c8d8c8' }}>{t.rr ? `1:${t.rr}` : '—'}</span>
                <span style={{ color: oc, fontWeight: '700' }}>
                  {t.result != null ? (t.result >= 0 ? '+' : '') + t.result + '$' : '—'}
                </span>
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