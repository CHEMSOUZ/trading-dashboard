import { useState, useEffect } from 'react';

// ── Helpers ───────────────────────────────────────────────────
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS_FR   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

function fmt(n, sign = false) {
  if (n == null) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(0)}$`;
}

function pnlColor(v) {
  if (v > 0) return '#00ff88';
  if (v < 0) return '#ff4455';
  return '#8aaa90';
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  // Monday=0
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function getWeekDates(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon); dd.setDate(mon.getDate() + i);
    return dd.toISOString().slice(0, 10);
  });
}

// ── Day Detail Modal ──────────────────────────────────────────
function DayModal({ date, trades, onClose }) {
  const dayTrades = trades.filter(t => t.date === date);
  const totalPnl  = dayTrades.reduce((s, t) => s + (t.result ?? 0), 0);
  const wins      = dayTrades.filter(t => t.outcome === 'WIN').length;
  const losses    = dayTrades.filter(t => t.outcome === 'LOSS').length;
  const be        = dayTrades.filter(t => t.outcome === 'BE').length;
  const avgRR     = dayTrades.length > 0
    ? dayTrades.reduce((s, t) => s + (t.rr ?? 0), 0) / dayTrades.length
    : 0;
  const winrate   = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;

  const dateObj   = new Date(date + 'T12:00:00');
  const dateLabel = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Generate professional report
  const report = generateReport({ date: dateLabel, trades: dayTrades, totalPnl, wins, losses, be, avgRR, winrate });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#070d12',
          border: '1px solid rgba(0,255,136,0.15)',
          borderRadius: '10px',
          width: '100%', maxWidth: '760px',
          maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 0 60px rgba(0,255,136,0.08)',
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid rgba(0,255,136,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: '#070d12', zIndex: 1,
        }}>
          <div>
            <div style={{ fontSize:'12px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '4px' }}>
              COMPTE RENDU JOURNALIER
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#e8f8e8', textTransform: 'capitalize' }}>
              {dateLabel}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #1a3a22',
            color: '#4a7a5a', width: '32px', height: '32px',
            borderRadius: '50%', cursor: 'pointer', fontSize: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff4455'; e.currentTarget.style.color = '#ff4455'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a3a22'; e.currentTarget.style.color = '#4a7a5a'; }}
          >×</button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {dayTrades.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#2a4a30', fontSize:'13px', letterSpacing: '2px' }}>
              Aucun trade ce jour
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px' }}>
                {[
                  { label: 'P&L', value: fmt(totalPnl, true), color: pnlColor(totalPnl) },
                  { label: 'TRADES', value: dayTrades.length, color: '#c8d8c8' },
                  { label: 'WINRATE', value: `${winrate.toFixed(0)}%`, color: winrate >= 50 ? '#00ff88' : '#ff4455' },
                  { label: 'RR MOYEN', value: `1:${avgRR.toFixed(2)}`, color: '#8aaa90' },
                  { label: 'W/L/BE', value: `${wins}/${losses}/${be}`, color: '#c8d8c8' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.08)',
                    borderRadius: '5px', padding: '10px 12px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize:'11px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Trade list */}
              <div>
                <div style={{ fontSize:'12px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>TRADES DU JOUR</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {dayTrades.map((t, i) => {
                    const oc = t.outcome === 'WIN' ? '#00ff88' : t.outcome === 'LOSS' ? '#ff4455' : '#f0a020';
                    return (
                      <div key={t.id ?? i} style={{
                        display: 'grid',
                        gridTemplateColumns: '30px 90px 60px 70px 70px 70px 60px 80px 1fr',
                        gap: '8px', alignItems: 'center',
                        padding: '10px 12px',
                        background: 'rgba(10,28,18,0.4)',
                        border: '1px solid rgba(0,255,136,0.06)',
                        borderLeft: `2px solid ${oc}`,
                        borderRadius: '4px', fontSize:'13px',
                      }}>
                        <span style={{ fontSize:'12px', color: '#3a6a4a' }}>#{i+1}</span>
                        <span style={{ color: '#c8d8c8', fontWeight: '600' }}>{t.pair}</span>
                        <span style={{
                          fontSize:'12px', color: t.direction === 'LONG' ? '#00ff88' : '#ff4455',
                          background: `rgba(${t.direction==='LONG'?'0,255,136':'255,68,85'},0.08)`,
                          border: `1px solid rgba(${t.direction==='LONG'?'0,255,136':'255,68,85'},0.2)`,
                          padding: '2px 5px', borderRadius: '3px', textAlign: 'center',
                        }}>{t.direction}</span>
                        <span style={{ color: '#8aaa90' }}>{t.entry}</span>
                        <span style={{ color: '#ff4455' }}>{t.stop}</span>
                        <span style={{ color: '#00ff88' }}>{t.tp}</span>
                        <span style={{ color: '#c8d8c8' }}>{t.rr ? `1:${t.rr}` : '—'}</span>
                        <span style={{ color: oc, fontWeight: '700' }}>{fmt(t.result, true)}</span>
                        <span style={{ color: '#4a7a5a', fontSize:'12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.emotion ?? '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Professional report */}
              <div>
                <div style={{ fontSize:'12px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>
                  COMPTE RENDU PROFESSIONNEL
                </div>
                <div style={{
                  background: 'rgba(6,15,10,0.8)',
                  border: '1px solid rgba(0,255,136,0.08)',
                  borderRadius: '6px', padding: '18px 20px',
                  fontSize:'13px', lineHeight: '1.8', color: '#a0c0a8',
                  whiteSpace: 'pre-wrap',
                }}>
                  {report}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Report generator ──────────────────────────────────────────
function generateReport({ date, trades, totalPnl, wins, losses, be, avgRR, winrate }) {
  if (trades.length === 0) return 'Aucun trade enregistré ce jour.';

  const pairs      = [...new Set(trades.map(t => t.pair))].join(', ');
  const emotions   = [...new Set(trades.map(t => t.emotion).filter(Boolean))].join(', ');
  const bestTrade  = trades.reduce((a, b) => (b.result ?? -Infinity) > (a.result ?? -Infinity) ? b : a, trades[0]);
  const worstTrade = trades.reduce((a, b) => (b.result ?? Infinity) < (a.result ?? Infinity) ? b : a, trades[0]);

  const perf = totalPnl > 0 ? 'POSITIVE' : totalPnl < 0 ? 'NÉGATIVE' : 'NEUTRE';
  const discipline = winrate >= 60 ? 'excellente' : winrate >= 40 ? 'correcte' : 'à améliorer';

  let analysis = '';

  if (totalPnl > 0) {
    analysis = `La séance s'est conclue sur une performance positive avec un gain net de ${totalPnl.toFixed(0)}$. `;
    if (winrate >= 60) analysis += `Le winrate de ${winrate.toFixed(0)}% reflète une lecture de marché efficace et une bonne sélection des setups. `;
    else analysis += `Malgré un winrate de ${winrate.toFixed(0)}%, la gestion du risque a permis de dégager un résultat positif. `;
  } else if (totalPnl < 0) {
    analysis = `La séance s'est soldée par une perte nette de ${Math.abs(totalPnl).toFixed(0)}$. `;
    if (winrate < 40) analysis += `Le winrate faible (${winrate.toFixed(0)}%) suggère des difficultés de lecture du marché ou une prise de position prématurée. `;
    else analysis += `Les trades perdants ont eu un impact significatif malgré un winrate acceptable. Revoir la gestion du stop et du sizing. `;
  } else {
    analysis = `La séance se termine à l'équilibre. `;
  }

  const notes = trades.filter(t => t.notes).map(t => `— ${t.pair} (${t.direction}): ${t.notes}`).join('\n');

  return `═══════════════════════════════════════
RAPPORT DE TRADING — ${date.toUpperCase()}
═══════════════════════════════════════

RÉSUMÉ DE SÉANCE
────────────────
Performance globale  : ${perf}
P&L net              : ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)}$
Nombre de trades     : ${trades.length}
Winrate              : ${winrate.toFixed(1)}% (${wins}W / ${losses}L / ${be}BE)
RR moyen             : 1:${avgRR.toFixed(2)}
Instruments tradés   : ${pairs}
État émotionnel      : ${emotions || 'Non renseigné'}

MEILLEUR TRADE
────────────────
${bestTrade.pair} ${bestTrade.direction} — Entrée: ${bestTrade.entry} / Stop: ${bestTrade.stop} / TP: ${bestTrade.tp}
Résultat : ${bestTrade.result != null ? (bestTrade.result >= 0 ? '+' : '') + bestTrade.result.toFixed(0) + '$' : '—'} | RR: 1:${bestTrade.rr ?? '—'}

PIRE TRADE
────────────────
${worstTrade.pair} ${worstTrade.direction} — Entrée: ${worstTrade.entry} / Stop: ${worstTrade.stop} / TP: ${worstTrade.tp}
Résultat : ${worstTrade.result != null ? (worstTrade.result >= 0 ? '+' : '') + worstTrade.result.toFixed(0) + '$' : '—'} | RR: 1:${worstTrade.rr ?? '—'}

ANALYSE
────────────────
${analysis}
RR moyen de 1:${avgRR.toFixed(2)} — discipline ${discipline}.
${avgRR >= 2 ? 'Le ratio risque/rendement est solide. Maintenir cette rigueur.' : avgRR >= 1 ? 'Le RR est acceptable mais peut être optimisé en élargissant les cibles.' : 'Le RR est insuffisant. Revoir le placement des TP pour améliorer la rentabilité.'}

${notes ? `NOTES DES TRADES\n────────────────\n${notes}\n` : ''}
RECOMMANDATIONS
────────────────
${totalPnl > 0 && winrate >= 60
  ? '✅ Excellente séance. Conserver cette approche méthodique.\n✅ Respecter les mêmes critères d\'entrée demain.\n✅ Ne pas surtrader après une bonne journée.'
  : totalPnl > 0
  ? '✅ Séance rentable. Analyser les trades perdants pour les éviter.\n⚠️  Travailler la sélection des setups pour améliorer le winrate.\n✅ Maintenir la discipline sur le stop.'
  : totalPnl < 0 && losses >= 2
  ? '❌ Séance difficile. Analyser chaque trade perdant individuellement.\n⚠️  Vérifier si les règles de la checklist ont été respectées.\n⚠️  Envisager de réduire la taille de position demain.\n❌ Ne pas chercher à rattraper les pertes.'
  : '⚠️  Séance négative. Rester discipliné et ne pas revenge trader.\n✅ Le nombre de trades est maîtrisé.\n⚠️  Revoir les niveaux d\'entrée sur les trades perdants.'}

═══════════════════════════════════════`;
}

// ── Main Calendar Page ────────────────────────────────────────
export default function Calendar() {
  const [trades, setTrades]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await window.db.getAllTrades();
      if (res.ok) setTrades(res.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3a6a4a', fontSize:'13px', letterSpacing: '2px' }}>
      CHARGEMENT...
    </div>
  );

  // ── Build day data ────────────────────────────────────────
  const byDay = trades.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = { pnl: 0, count: 0, trades: [] };
    acc[t.date].pnl += t.result ?? 0;
    acc[t.date].count++;
    acc[t.date].trades.push(t);
    return acc;
  }, {});

  // ── Month navigation ──────────────────────────────────────
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date().toISOString().slice(0, 10);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevWeek  = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextWeek  = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };

  // ── Month view cells ──────────────────────────────────────
  const daysInMonth  = getDaysInMonth(year, month);
  const firstDay     = getFirstDayOfMonth(year, month);
  const monthCells   = [];
  for (let i = 0; i < firstDay; i++) monthCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) monthCells.push(d);

  // ── Week view dates ───────────────────────────────────────
  const weekDates = getWeekDates(currentDate);

  // ── Month summary ─────────────────────────────────────────
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthTrades = trades.filter(t => t.date.startsWith(monthPrefix));
  const monthPnl    = monthTrades.reduce((s, t) => s + (t.result ?? 0), 0);
  const monthWins   = Object.entries(byDay).filter(([d, v]) => d.startsWith(monthPrefix) && v.pnl > 0).length;
  const monthLoss   = Object.entries(byDay).filter(([d, v]) => d.startsWith(monthPrefix) && v.pnl < 0).length;

  // ── Day cell renderer ─────────────────────────────────────
  function DayCell({ dateStr, dayNum, compact = false }) {
    if (!dateStr) return <div style={{ background: 'transparent' }} />;
    const data    = byDay[dateStr];
    const isToday = dateStr === today;
    const hasTrades = data && data.count > 0;
    const pnl     = data?.pnl ?? 0;
    const color   = pnlColor(pnl);

    return (
      <div
        onClick={() => hasTrades && setSelectedDay(dateStr)}
        style={{
          background: hasTrades
            ? pnl > 0 ? 'rgba(0,255,136,0.06)' : 'rgba(255,68,85,0.06)'
            : 'rgba(10,28,18,0.3)',
          border: isToday
            ? '1px solid rgba(0,255,136,0.4)'
            : hasTrades
            ? `1px solid ${pnl > 0 ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,85,0.15)'}`
            : '1px solid rgba(0,255,136,0.04)',
          borderRadius: '5px',
          padding: compact ? '6px 8px' : '10px',
          cursor: hasTrades ? 'pointer' : 'default',
          minHeight: compact ? '60px' : '80px',
          display: 'flex', flexDirection: 'column', gap: '3px',
          transition: 'all 0.15s ease',
          position: 'relative',
        }}
        onMouseEnter={e => { if (hasTrades) e.currentTarget.style.background = pnl > 0 ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,85,0.1)'; }}
        onMouseLeave={e => { if (hasTrades) e.currentTarget.style.background = pnl > 0 ? 'rgba(0,255,136,0.06)' : 'rgba(255,68,85,0.06)'; }}
      >
        {/* Day number */}
        <div style={{
          fontSize: compact ? '10px' : '11px',
          color: isToday ? '#00ff88' : '#5a8a6a',
          fontWeight: isToday ? '700' : '400',
        }}>{dayNum}</div>

        {hasTrades && (
          <>
            {/* P&L */}
            <div style={{ fontSize: compact ? '13px' : '15px', fontWeight: '700', color, lineHeight: 1 }}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}$
            </div>
            {/* Trade count */}
            <div style={{ fontSize:'12px', color: '#3a6a4a' }}>
              {data.count} trade{data.count > 1 ? 's' : ''}
            </div>
          </>
        )}

        {isToday && (
          <div style={{
            position: 'absolute', top: '4px', right: '6px',
            width: '5px', height: '5px', borderRadius: '50%',
            background: '#00ff88', boxShadow: '0 0 6px #00ff88',
          }} />
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 'none' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize:'12px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>TRADING</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Calendrier</h1>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {['month','week'].map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              padding: '6px 14px', borderRadius: '4px',
              border: `1px solid ${viewMode === v ? '#00ff88' : '#1a3a22'}`,
              background: viewMode === v ? 'rgba(0,255,136,0.1)' : 'transparent',
              color: viewMode === v ? '#00ff88' : '#3a6a4a',
              fontSize:'12px', fontFamily: 'inherit', letterSpacing: '1px',
              cursor: 'pointer', transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}>{v === 'month' ? 'Mois' : 'Semaine'}</button>
          ))}
        </div>
      </div>

      {/* Month summary strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '10px',
        marginBottom: '20px',
      }}>
        {[
          { label: 'P&L DU MOIS', value: fmt(monthPnl, true), color: pnlColor(monthPnl) },
          { label: 'TRADES', value: monthTrades.length, color: '#c8d8c8' },
          { label: 'JOURS +', value: monthWins, color: '#00ff88' },
          { label: 'JOURS -', value: monthLoss, color: '#ff4455' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.08)',
            borderRadius: '5px', padding: '10px 14px',
          }}>
            <div style={{ fontSize:'11px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button onClick={viewMode === 'month' ? prevMonth : prevWeek} style={{
          background: 'transparent', border: '1px solid #1a3a22', color: '#4a7a5a',
          padding: '6px 14px', borderRadius: '4px', fontSize: '14px',
          fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.borderColor = '#00ff88'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#4a7a5a'; e.currentTarget.style.borderColor = '#1a3a22'; }}
        >←</button>

        <div style={{ fontSize: '14px', fontWeight: '700', color: '#e8f8e8', letterSpacing: '1px' }}>
          {viewMode === 'month'
            ? `${MONTHS_FR[month]} ${year}`
            : (() => {
                const start = new Date(weekDates[0] + 'T12:00:00');
                const end   = new Date(weekDates[6] + 'T12:00:00');
                return `${start.getDate()} — ${end.getDate()} ${MONTHS_FR[end.getMonth()]} ${end.getFullYear()}`;
              })()
          }
        </div>

        <button onClick={viewMode === 'month' ? nextMonth : nextWeek} style={{
          background: 'transparent', border: '1px solid #1a3a22', color: '#4a7a5a',
          padding: '6px 14px', borderRadius: '4px', fontSize: '14px',
          fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.borderColor = '#00ff88'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#4a7a5a'; e.currentTarget.style.borderColor = '#1a3a22'; }}
        >→</button>
      </div>

      {/* ── MONTH VIEW ── */}
      {viewMode === 'month' && (
        <div style={{
          background: 'rgba(10,28,18,0.3)',
          border: '1px solid rgba(0,255,136,0.08)',
          borderRadius: '8px', padding: '16px',
        }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px', marginBottom: '8px' }}>
            {DAYS_FR.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize:'12px', color: '#3a6a4a', letterSpacing: '1px', padding: '4px' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
            {monthCells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} style={{ minHeight: '80px' }} />;
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              return <DayCell key={dateStr} dateStr={dateStr} dayNum={day} />;
            })}
          </div>
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {viewMode === 'week' && (
        <div style={{
          background: 'rgba(10,28,18,0.3)',
          border: '1px solid rgba(0,255,136,0.08)',
          borderRadius: '8px', padding: '16px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '10px' }}>
            {weekDates.map((dateStr, i) => {
              const d    = new Date(dateStr + 'T12:00:00');
              const dayN = d.getDate();
              const dayLabel = DAYS_FR[i];
              const isToday  = dateStr === today;
              return (
                <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ textAlign: 'center', fontSize:'12px', color: isToday ? '#00ff88' : '#3a6a4a', letterSpacing: '1px', fontWeight: isToday ? '700' : '400' }}>
                    {dayLabel}
                  </div>
                  <DayCell dateStr={dateStr} dayNum={dayN} compact={false} />
                </div>
              );
            })}
          </div>

          {/* Week summary */}
          <div style={{
            marginTop: '16px', padding: '12px 16px',
            background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)',
            borderRadius: '5px', display: 'flex', gap: '24px',
          }}>
            {(() => {
              const weekTrades = trades.filter(t => weekDates.includes(t.date));
              const weekPnl    = weekTrades.reduce((s, t) => s + (t.result ?? 0), 0);
              const weekWinD   = weekDates.filter(d => byDay[d]?.pnl > 0).length;
              return (
                <>
                  <div>
                    <div style={{ fontSize:'11px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '2px' }}>P&L SEMAINE</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: pnlColor(weekPnl) }}>{fmt(weekPnl, true)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:'11px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '2px' }}>TRADES</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#c8d8c8' }}>{weekTrades.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:'11px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '2px' }}>JOURS +</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#00ff88' }}>{weekWinD}</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
        {[
          { color: 'rgba(0,255,136,0.3)', label: 'Jour gagnant' },
          { color: 'rgba(255,68,85,0.3)', label: 'Jour perdant' },
          { color: 'rgba(0,255,136,0.4)', label: "Aujourd'hui" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: color }} />
            <span style={{ fontSize:'12px', color: '#3a6a4a' }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize:'12px', color: '#2a4a30', marginLeft: '8px' }}>
          Cliquer sur un jour pour voir le détail
        </span>
      </div>

      {/* Modal */}
      {selectedDay && (
        <DayModal
          date={selectedDay}
          trades={byDay[selectedDay]?.trades ?? []}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
