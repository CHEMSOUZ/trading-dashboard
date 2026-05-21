import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function StatCard({ label, value, sub, color = '#00ff88' }) {
  return (
    <div style={{
      background: 'rgba(10,28,18,0.6)',
      border: '1px solid rgba(0,255,136,0.1)',
      borderTop: `2px solid ${color}`,
      borderRadius: '6px',
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: '6px',
    }}>
      <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color: '#4a7a5a' }}>{sub}</div>}
    </div>
  );
}

function RecentTrade({ trade }) {
  const color = trade.outcome === 'WIN' ? '#00ff88' : trade.outcome === 'LOSS' ? '#ff4455' : '#8aaa90';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 14px',
      background: 'rgba(10,28,18,0.4)',
      border: '1px solid rgba(0,255,136,0.06)',
      borderLeft: `2px solid ${color}`,
      borderRadius: '4px',
    }}>
      <span style={{ fontSize: '10px', color: '#3a6a4a', width: '90px', flexShrink: 0 }}>{trade.date}</span>
      <span style={{ fontSize: '11px', color: '#c8d8c8', width: '90px', flexShrink: 0, fontWeight: '600' }}>{trade.pair}</span>
      <span style={{
        fontSize: '9px', letterSpacing: '1px', flexShrink: 0,
        color: trade.direction === 'LONG' ? '#00ff88' : '#ff4455',
        background: trade.direction === 'LONG' ? 'rgba(0,255,136,0.08)' : 'rgba(255,68,85,0.08)',
        border: `1px solid ${trade.direction === 'LONG' ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,85,0.2)'}`,
        padding: '2px 6px', borderRadius: '3px',
      }}>{trade.direction}</span>
      <span style={{ flex: 1, fontSize: '10px', color: '#5a8a6a' }}>RR 1:{trade.rr ?? '—'}</span>
      <span style={{ fontSize: '12px', fontWeight: '700', color }}>
        {trade.result != null ? (trade.result >= 0 ? '+' : '') + trade.result + '$' : '—'}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [sRes, tRes] = await Promise.all([
          window.db.getStats(),
          window.db.getAllTrades(),
        ]);
        if (sRes.ok) setStats(sRes.data);
        if (tRes.ok) setTrades(tRes.data.slice(0, 5));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3a6a4a', fontSize: '11px', letterSpacing: '2px' }}>
      CHARGEMENT...
    </div>
  );

  const s = stats ?? {};
  const streakColor = (s.streak ?? 0) > 0 ? '#00ff88' : (s.streak ?? 0) < 0 ? '#ff4455' : '#8aaa90';
  const streakLabel = (s.streak ?? 0) > 0 ? `🔥 ${s.streak} WIN` : (s.streak ?? 0) < 0 ? `❄️ ${Math.abs(s.streak)} LOSS` : '—';

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>

      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>
          Tableau de bord
        </h1>
        <div style={{ fontSize: '11px', color: '#3a6a4a', marginTop: '4px' }}>
          {s.total ?? 0} trade{(s.total ?? 0) > 1 ? 's' : ''} enregistré{(s.total ?? 0) > 1 ? 's' : ''}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '12px', marginBottom: '28px',
      }}>
        <StatCard label="WINRATE" value={`${s.winrate ?? 0}%`}
          sub={`${s.wins ?? 0}W / ${s.losses ?? 0}L`}
          color={(s.winrate ?? 0) >= 50 ? '#00ff88' : '#ff4455'} />
        <StatCard label="P&L TOTAL" value={`${(s.totalPnl ?? 0) >= 0 ? '+' : ''}${s.totalPnl ?? 0}$`}
          color={(s.totalPnl ?? 0) >= 0 ? '#00ff88' : '#ff4455'} />
        <StatCard label="PROFIT FACTOR" value={s.profitFactor ?? 0}
          color={(s.profitFactor ?? 0) >= 1.5 ? '#00ff88' : '#f0a020'} />
        <StatCard label="RR MOYEN" value={`1:${s.avgRR ?? 0}`} color="#8aaa90" />
        <StatCard label="MAX DRAWDOWN" value={`-${s.maxDrawdown ?? 0}$`} color="#ff4455" />
        <StatCard label="STREAK" value={streakLabel} color={streakColor} />
      </div>

      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '12px',
        }}>
          <span style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px' }}>TRADES RÉCENTS</span>
          <button onClick={() => navigate('/journal')} style={{
            background: 'transparent', border: '1px solid #1a3a22',
            color: '#4a7a5a', padding: '3px 10px', borderRadius: '3px',
            fontSize: '9px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.borderColor = '#00ff88'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4a7a5a'; e.currentTarget.style.borderColor = '#1a3a22'; }}
          >VOIR TOUT →</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {trades.length > 0 ? trades.map(t => <RecentTrade key={t.id} trade={t} />) : (
            <div style={{
              padding: '32px', textAlign: 'center', color: '#2a4a30',
              fontSize: '11px', letterSpacing: '2px',
              border: '1px dashed #1a3a22', borderRadius: '6px',
            }}>
              Aucun trade —{' '}
              <span style={{ color: '#00ff88', cursor: 'pointer' }} onClick={() => navigate('/journal/new')}>
                ajouter le premier
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}