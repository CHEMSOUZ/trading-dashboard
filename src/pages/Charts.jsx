import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(6,18,12,0.97)',
      border: '1px solid rgba(0,255,136,0.2)',
      borderRadius: '4px', padding: '8px 12px',
      fontSize: '11px', fontFamily: 'inherit',
    }}>
      <div style={{ color: '#3a6a4a', marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: (p.value ?? 0) >= 0 ? '#00ff88' : '#ff4455', fontWeight: '700' }}>
          {p.name}: {(p.value ?? 0) >= 0 ? '+' : ''}{(p.value ?? 0).toFixed(0)}$
        </div>
      ))}
    </div>
  );
}

export default function Charts() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('ALL');

  useEffect(() => {
    (async () => {
      const res = await window.db.getAllTrades();
      if (res.ok) setTrades(res.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3a6a4a', fontSize: '11px', letterSpacing: '2px' }}>
      CHARGEMENT...
    </div>
  );

  // Filter by period
  const now = new Date();
  const filtered = trades.filter(t => {
    if (period === 'ALL') return true;
    const d = new Date(t.date);
    if (period === '7D')  return (now - d) <= 7  * 86400000;
    if (period === '30D') return (now - d) <= 30 * 86400000;
    if (period === '3M')  return (now - d) <= 90 * 86400000;
    return true;
  });

  // Equity curve
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0;
  const equityData = [{ date: 'Départ', equity: 0, trade: '' }];
  sorted.forEach(t => {
    cum += t.result ?? 0;
    equityData.push({
      date: t.date.slice(5),
      equity: Math.round(cum * 100) / 100,
      trade: t.pair,
    });
  });

  // Daily P&L
  const byDay = filtered.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = 0;
    acc[t.date] += t.result ?? 0;
    return acc;
  }, {});
  const dailyData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date: date.slice(5), pnl: Math.round(pnl * 100) / 100 }));

  // Outcome distribution for pie
  const wins   = filtered.filter(t => t.outcome === 'WIN').length;
  const losses = filtered.filter(t => t.outcome === 'LOSS').length;
  const be     = filtered.filter(t => t.outcome === 'BE').length;
  const pieData = [
    { name: 'WIN',  value: wins,   color: '#00ff88' },
    { name: 'LOSS', value: losses, color: '#ff4455' },
    { name: 'BE',   value: be,     color: '#f0a020' },
  ].filter(d => d.value > 0);

  // P&L by pair
  const byPair = filtered.reduce((acc, t) => {
    if (!acc[t.pair]) acc[t.pair] = 0;
    acc[t.pair] += t.result ?? 0;
    return acc;
  }, {});
  const pairData = Object.entries(byPair)
    .sort(([,a],[,b]) => b - a)
    .map(([pair, pnl]) => ({ pair, pnl: Math.round(pnl * 100) / 100 }));

  const totalPnl = filtered.reduce((s, t) => s + (t.result ?? 0), 0);

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>ANALYSE</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Graphiques P&L</h1>
          <div style={{ fontSize: '11px', color: '#3a6a4a', marginTop: '4px' }}>
            {filtered.length} trade{filtered.length > 1 ? 's' : ''} ·{' '}
            <span style={{ color: totalPnl >= 0 ? '#00ff88' : '#ff4455', fontWeight: '700' }}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(0)}$
            </span>
          </div>
        </div>

        {/* Period filter */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {['7D','30D','3M','ALL'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '5px 12px', borderRadius: '4px',
              border: `1px solid ${period === p ? '#00ff88' : '#1a3a22'}`,
              background: period === p ? 'rgba(0,255,136,0.1)' : 'transparent',
              color: period === p ? '#00ff88' : '#3a6a4a',
              fontSize: '10px', fontFamily: 'inherit',
              letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s',
            }}>{p}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Equity curve — full width */}
        <div style={{
          background: 'rgba(10,28,18,0.4)',
          border: '1px solid rgba(0,255,136,0.08)',
          borderRadius: '6px', padding: '20px',
        }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '16px' }}>
            COURBE DE CAPITAL (P&L CUMULÉ)
          </div>
          {equityData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={equityData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={totalPnl >= 0 ? '#00ff88' : '#ff4455'} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={totalPnl >= 0 ? '#00ff88' : '#ff4455'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(0,255,136,0.05)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#3a6a4a', fontSize: 9 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}$`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.2)" />
                <Area
                  type="monotone" dataKey="equity" name="P&L cumulé"
                  stroke={totalPnl >= 0 ? '#00ff88' : '#ff4455'} strokeWidth={2}
                  fill="url(#pnlGrad)"
                  dot={false} activeDot={{ r: 4, fill: totalPnl >= 0 ? '#00ff88' : '#ff4455' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '11px', letterSpacing: '2px' }}>
              Enregistrez des trades pour voir la courbe
            </div>
          )}
        </div>

        {/* Row 2: Daily bars + Pie + By pair */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 1fr', gap: '20px' }}>

          {/* Daily P&L */}
          <div style={{
            background: 'rgba(10,28,18,0.4)',
            border: '1px solid rgba(0,255,136,0.08)',
            borderRadius: '6px', padding: '20px',
          }}>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '16px' }}>P&L PAR JOUR</div>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="rgba(0,255,136,0.05)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#3a6a4a', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(0,255,136,0.2)" />
                  <Bar dataKey="pnl" name="P&L" radius={[3,3,0,0]}
                    fill="#00ff88"
                    isAnimationActive
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>
                Aucune donnée
              </div>
            )}
          </div>

          {/* Pie chart */}
          <div style={{
            background: 'rgba(10,28,18,0.4)',
            border: '1px solid rgba(0,255,136,0.08)',
            borderRadius: '6px', padding: '20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px', alignSelf: 'flex-start' }}>
              RÉSULTATS
            </div>
            {pieData.length > 0 ? (
              <>
                <PieChart width={120} height={120}>
                  <Pie data={pieData} cx={55} cy={55} innerRadius={35} outerRadius={55}
                    dataKey="value" strokeWidth={0}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: '8px' }}>
                  {pieData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '9px', color: '#8aaa90' }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize: '10px', color: d.color, fontWeight: '700' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>
                Aucune donnée
              </div>
            )}
          </div>

          {/* By pair */}
          <div style={{
            background: 'rgba(10,28,18,0.4)',
            border: '1px solid rgba(0,255,136,0.08)',
            borderRadius: '6px', padding: '20px',
          }}>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '16px' }}>P&L PAR PAIRE</div>
            {pairData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pairData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 10 }}>
                  <CartesianGrid stroke="rgba(0,255,136,0.05)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#3a6a4a', fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}$`} />
                  <YAxis type="category" dataKey="pair" tick={{ fill: '#8aaa90', fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine x={0} stroke="rgba(0,255,136,0.2)" />
                  <Bar dataKey="pnl" name="P&L" radius={[0,3,3,0]} fill="#00ff88" isAnimationActive />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>
                Aucune donnée
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
