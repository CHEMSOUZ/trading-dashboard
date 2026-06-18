import { useState, useEffect } from 'react';
import { EMOTION_COLORS, emotionTone, emotionRgb, ToneIcon } from '../shared/emotionTraits';

const P = {
  bg:      'rgba(14,15,22,',
  border:  'rgba(136,153,187,',
  text1:   '#dde4ef',
  text2:   '#8898aa',
  text3:   '#4a5a72',
  text4:   '#2c3c54',
  green:   '#00cc77',
  amber:   '#f59e0b',
  red:     '#ff3344',
};

const WEEKDAY_LABELS = ['LUN','MAR','MER','JEU','VEN','SAM','DIM'];

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getPreviousTradingDay() {
  const d = new Date();
  do { d.setDate(d.getDate() - 1); } while ([0, 6].includes(d.getDay()));
  return d.toISOString().slice(0, 10);
}

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Accroche statique affichée sous le nom du trait dans le bandeau-badge.
const EMOTION_TAGLINE = {
  'Discipliné':  'Exécution rigoureuse, plan respecté à la lettre.',
  'Serein':      'Calme et lucidité tout au long de la séance.',
  'Focalisé':    'Concentration totale sur le plan de trading.',
  'Stressé':     'Tension perceptible, décisions sous pression.',
  'Fragile':     'Confiance ébranlée, vigilance recommandée.',
  'Surconfiant': 'Excès de confiance après une bonne série.',
  'Impulsif':    'Décisions prises dans l\'urgence, sans plan clair.',
  'Vengeur':     'Tentative de compenser une perte par la précipitation.',
};

function buildPrompt(trades, date) {
  const pnl    = trades.reduce((s, t) => s + (t.result_net ?? t.result ?? 0), 0);
  const wins   = trades.filter(t => (t.result_net ?? t.result ?? 0) > 0);
  const losses = trades.filter(t => (t.result_net ?? t.result ?? 0) < 0);
  const wr     = trades.length > 0 ? Math.round(wins.length / trades.length * 100) : 0;
  const maxW   = wins.length   > 0 ? Math.max(...wins.map(t => t.result_net ?? t.result ?? 0))   : 0;
  const maxL   = losses.length > 0 ? Math.min(...losses.map(t => t.result_net ?? t.result ?? 0)) : 0;
  const pairs  = [...new Set(trades.map(t => t.pair).filter(Boolean))];

  const sorted = [...trades].sort((a, b) =>
    (a.entered_at ?? a.date ?? '').localeCompare(b.entered_at ?? b.date ?? ''));
  const seq = sorted.map(t => {
    const p = t.result_net ?? t.result ?? 0;
    return `${t.pair} ${t.direction} ${p >= 0 ? '+' : ''}${p.toFixed(2)}$`;
  }).join(' → ');

  return `Tu es un expert en psychologie du trading. Analyse la journée de trading du ${fmtDate(date)}.

DONNÉES:
- Total trades: ${trades.length}
- PnL net: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}$
- Winrate: ${wr}% (${wins.length} gagnants / ${losses.length} perdants)
- Meilleur trade: +${maxW.toFixed(2)}$ | Pire: ${maxL.toFixed(2)}$
- Instruments: ${pairs.join(', ') || '—'}
- Séquence: ${seq || '—'}

Génère une analyse psychologique en 3 blocs bien séparés par une ligne vide:

ÉTAT ÉMOTIONNEL
[2-3 phrases décrivant l'état émotionnel probable pendant la séance, basé sur la séquence des trades et les résultats]

PATTERNS IDENTIFIÉS
[2 phrases identifiant les comportements psychologiques visibles : discipline, peur, avidité, revenge trading, overtrading, etc.]

FOCUS POUR DEMAIN
[1 phrase actionnable et concrète pour la prochaine séance]

Réponds en JSON pur sans markdown :
{"emotion":"[UN SEUL MOT parmi: Discipliné|Serein|Focalisé|Stressé|Fragile|Surconfiant|Impulsif|Vengeur]","description":"[texte complet avec les 3 blocs séparés par \\n\\n]"}`;
}

const SK_AI = 'mental_ai_reports';
const MIGRATION_FLAG = 'mental_reports_migrated_v1';

// Ancien format localStorage — conservé uniquement pour la migration ponctuelle
// vers la table SQLite mental_reports (jamais supprimé, sert de sauvegarde).
function loadAI() { try { return JSON.parse(localStorage.getItem(SK_AI) ?? '[]'); } catch { return []; } }

// Migration unique localStorage -> SQLite, exécutée une seule fois (utilisateurs non-démo).
async function migrateLocalReportsToSqlite() {
  if (localStorage.getItem(MIGRATION_FLAG)) return;
  try {
    const old = loadAI();
    for (const r of old) {
      if (r?.date && r?.emotion && r?.text != null) {
        await window.db.saveMentalReport(r.date, r.emotion, r.text);
      }
    }
  } catch (e) {
    console.error('Migration mental_ai_reports -> SQLite échouée:', e);
  } finally {
    localStorage.setItem(MIGRATION_FLAG, '1');
  }
}

// Mini-case compacte pour la rangée d'indicateurs sous le bandeau-badge.
function MiniStat({ label, value }) {
  return (
    <div style={{ flex:1, background:'rgba(136,153,187,0.06)', border:'1px solid rgba(136,153,187,0.14)', borderRadius:'7px', padding:'9px 12px', textAlign:'center' }}>
      <div style={{ fontSize:'9px', color:'#4a5a72', letterSpacing:'1.5px', marginBottom:'4px' }}>{label}</div>
      <div style={{ fontSize:'16px', fontWeight:'700', color:'#dde4ef' }}>{value}</div>
    </div>
  );
}

// Trait le plus fréquent sur un ensemble d'entrées calendar — utilisé pour le
// bandeau "trait dominant ce mois" et pour la synthèse pleine période (jour sans trade).
function dominantTrait(entries) {
  const counts = {};
  for (const e of entries) counts[e.emotion] = (counts[e.emotion] ?? 0) + 1;
  const legend = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { legend, dominant: legend[0]?.[0] ?? null };
}

// Synthèse locale (aucun appel IA) affichée quand le jour cliqué n'a pas de trade :
// trait dominant sur toute la période dispo + tendance 1ère moitié vs 2nde moitié.
function computeNoTradeSynthesis(calendar) {
  if (calendar.length === 0) return null;
  const sorted = [...calendar].sort((a, b) => a.date.localeCompare(b.date));
  const totalDays = sorted.length;
  const { dominant: dominantOverall } = dominantTrait(sorted);

  const mid = Math.ceil(totalDays / 2);
  const { dominant: firstDom }  = dominantTrait(sorted.slice(0, mid));
  const { dominant: secondDom } = dominantTrait(sorted.slice(mid));
  const firstTone  = firstDom  ? emotionTone(firstDom)  : 'neutral';
  const secondTone = secondDom ? emotionTone(secondDom) : 'neutral';

  let trend = 'stable';
  if (firstTone === 'negative' && secondTone === 'positive') trend = 'amelioration';
  else if (firstTone === 'positive' && secondTone === 'negative') trend = 'degradation';

  return { dominantOverall, trend, totalDays };
}

// Formatte le texte d'un rapport en blocs (ÉTAT ÉMOTIONNEL / PATTERNS / FOCUS).
function renderBlocks(text, color) {
  if (!text) return <div style={{ fontSize:'13px', color:P.text3 }}>Aucun détail disponible pour ce jour.</div>;
  const blocks = text.split(/\n\n+/);
  return blocks.map((block, i) => {
    const lines = block.trim().split('\n');
    const title = lines[0].trim().toUpperCase();
    const isTitleLine = ['ÉTAT ÉMOTIONNEL','PATTERNS IDENTIFIÉS','FOCUS POUR DEMAIN'].some(t => title.includes(t));
    if (isTitleLine) {
      return (
        <div key={i} style={{ marginBottom: i < blocks.length - 1 ? '16px' : 0 }}>
          <div style={{ fontSize:'10px', color, letterSpacing:'2px', fontWeight:'700', marginBottom:'6px', opacity:0.8 }}>{lines[0]}</div>
          <div style={{ fontSize:'14px', color:P.text1, lineHeight:'1.8' }}>{lines.slice(1).join('\n')}</div>
        </div>
      );
    }
    return (
      <div key={i} style={{ fontSize:'14px', color:P.text1, lineHeight:'1.8', marginBottom: i < blocks.length - 1 ? '16px' : 0 }}>
        {block.trim()}
      </div>
    );
  });
}

// ── Modale — analyse psychologique complète d'un jour (ouverte au clic depuis le calendrier) ──
function ReportModal({ entry, dayStats, onClose }) {
  if (!entry) return null;
  const color = EMOTION_COLORS[entry.emotion] ?? P.text2;
  const rgb   = emotionRgb(color);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#0c0d16', border:`1px solid rgba(${rgb},0.35)`, borderRadius:'14px', width:'100%', maxWidth:'640px', maxHeight:'86vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 24px', background:`linear-gradient(135deg, rgba(${rgb},0.22), rgba(${rgb},0.05))`, borderBottom:`1px solid rgba(${rgb},0.25)`, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'14px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
            <div style={{ width:'48px', height:'48px', borderRadius:'12px', background:`rgba(${rgb},0.18)`, border:`1px solid rgba(${rgb},0.45)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <ToneIcon tone={emotionTone(entry.emotion)} color={color} size={24} />
            </div>
            <div>
              <div style={{ fontSize:'12px', color:P.text2, textTransform:'capitalize', marginBottom:'2px' }}>{fmtDate(entry.date)}</div>
              <div style={{ fontSize:'20px', fontWeight:'800', color, letterSpacing:'-0.3px', lineHeight:1.15 }}>{entry.emotion}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:P.text3, cursor:'pointer', fontSize:'18px', padding:'0', lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:'22px 24px 24px', overflowY:'auto' }}>
          {dayStats && (
            <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
              <MiniStat label="TRADES" value={dayStats.count} />
              <MiniStat label="WIN RATE" value={dayStats.wr != null ? `${dayStats.wr}%` : '—'} />
              <MiniStat label="P&L NET" value={dayStats.count > 0 ? `${dayStats.pnl >= 0 ? '+' : ''}${dayStats.pnl.toFixed(2)}$` : '—'} />
            </div>
          )}
          <div>{renderBlocks(entry.text, color)}</div>
          {entry.generatedAt && (
            <div style={{ marginTop:'20px', paddingTop:'14px', borderTop:`1px solid ${P.border}0.08)`, display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:color, boxShadow:`0 0 5px ${color}` }} />
              <span style={{ fontSize:'11px', color:P.text4 }}>
                Généré par Claude · {new Date(entry.generatedAt).toLocaleDateString('fr-FR')} à {new Date(entry.generatedAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Calendrier — base reprise de TradingCalendar (GlobalView.jsx) : navigation
// mois, grille 7 colonnes + colonne résumé de semaine, tooltip au survol — mais
// avec le trait psychologique du jour comme métrique principale (à la place du
// P&L), enrichi du nombre de trades et du winrate du jour. Clic sur un jour
// avec un rapport existant -> ouvre l'analyse complète (ReportModal).
function TraitCalendar({ calendar, tradeStats, referenceDay, onMonthChange, onDayClick }) {
  const initial = referenceDay ? new Date(referenceDay + 'T12:00:00') : new Date();
  const [year,    setYear]    = useState(initial.getFullYear());
  const [month,   setMonth]   = useState(initial.getMonth());
  const [hovered, setHovered] = useState(null);

  useEffect(() => { onMonthChange?.(year, month); }, [year, month]);

  const byDay = {};
  for (const e of calendar) byDay[e.date] = e.emotion;

  const rawFirst    = new Date(year, month, 1).getDay();
  const firstDay    = rawFirst === 0 ? 6 : rawFirst - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

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

  function weekDominant(wkArr) {
    const firstIdx = wkArr.findIndex(d => d != null);
    if (firstIdx < 0) return { count: 0, dominant: null };
    const mondayDate = new Date(year, month, wkArr[firstIdx] - firstIdx);
    const counts = {};
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayDate); d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const emotion = byDay[key];
      if (emotion) { counts[emotion] = (counts[emotion] ?? 0) + 1; count++; }
    }
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { count, dominant };
  }

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  return (
    <div style={{ background:`${P.bg}0.4)`, border:`1px solid ${P.border}0.10)`, borderRadius:'12px', padding:'16px 18px', position:'relative' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', marginBottom:'14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <button onClick={prevMonth} style={{ background:'none', border:'none', color:P.text2, cursor:'pointer', fontSize:'17px', lineHeight:1 }}>‹</button>
          <span style={{ fontSize:'15px', fontWeight:'700', color:P.text1, minWidth:'160px', textAlign:'center', textTransform:'capitalize' }}>{monthLabel(year, month)}</span>
          <button onClick={nextMonth} style={{ background:'none', border:'none', color:P.text2, cursor:'pointer', fontSize:'17px', lineHeight:1 }}>›</button>
          <button onClick={() => { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth()); }}
            style={{ background:'rgba(136,153,187,0.10)', border:'1px solid rgba(136,153,187,0.18)', color:'#8899bb', padding:'3px 9px', borderRadius:'4px', fontSize:'12px', fontFamily:'inherit', cursor:'pointer' }}>Aujourd'hui</button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr) 80px', gap:'4px' }}>
        {WEEKDAY_LABELS.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:'11px', color:P.text3, padding:'4px 0', letterSpacing:'1px' }}>{d}</div>
        ))}
        <div style={{ textAlign:'center', fontSize:'11px', color:P.text3, padding:'4px 0' }}>SEM.</div>

        {weeks.map((week, wi) => {
          const { count: weekCount, dominant: weekDom } = weekDominant(week);
          const weekColor = weekDom ? (EMOTION_COLORS[weekDom] ?? P.text2) : P.text4;
          return [
            ...week.map((day, di) => {
              if (!day) return <div key={`e-${wi}-${di}`} style={{ minHeight:'64px', borderRadius:'6px', background:'rgba(14,15,22,0.15)', border:'1px solid rgba(136,153,187,0.03)' }} />;
              const date    = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const emotion = byDay[date];
              const color   = emotion ? (EMOTION_COLORS[emotion] ?? P.text2) : null;
              const cellRgb = color ? emotionRgb(color) : null;
              const stats   = tradeStats[date];
              const wr      = stats && stats.count > 0 ? Math.round(stats.wins / stats.count * 100) : null;
              const isRef   = date === referenceDay;
              const isHov   = hovered === date;
              const clickable = !!emotion;
              return (
                <div key={date}
                  onClick={() => clickable && onDayClick?.(date)}
                  onMouseEnter={() => setHovered(date)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    minHeight:'64px', borderRadius:'6px', padding:'5px 6px',
                    display:'flex', flexDirection:'column', justifyContent:'space-between',
                    background: isHov && emotion ? `rgba(${cellRgb},0.18)` : cellRgb ? `rgba(${cellRgb},0.10)` : 'transparent',
                    border: isRef ? `1.5px solid ${color ?? 'rgba(0,170,255,0.60)'}` : `1px solid ${P.border}0.07)`,
                    cursor: clickable ? 'pointer' : 'default', transition:'all 0.12s',
                    transform: isHov && emotion ? 'scale(1.03)' : 'scale(1)',
                    position:'relative', zIndex: isHov ? 3 : 1,
                    boxShadow: isHov && emotion ? '0 4px 16px rgba(0,0,0,0.4)' : 'none',
                  }}>
                  <span style={{ fontSize:'11px', color: emotion ? P.text2 : P.text4, fontWeight: isRef ? '700' : '400' }}>{day}</span>
                  {emotion && (
                    <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                      <ToneIcon tone={emotionTone(emotion)} color={color} size={13} />
                      <span style={{ fontSize:'10px', color, fontWeight:'600', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emotion}</span>
                    </div>
                  )}
                  {stats && (
                    <div style={{ fontSize:'9px', color: wr >= 50 ? '#00cc77' : '#ff3344' }}>
                      {stats.count}T · {wr}%WR
                    </div>
                  )}
                </div>
              );
            }),
            <div key={`w-${wi}`} style={{ background:'rgba(14,15,22,0.55)', border:`1px solid ${P.border}0.09)`, borderRadius:'6px', minHeight:'64px', padding:'6px 8px', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', gap:'4px' }}>
              {weekCount > 0 ? (
                <>
                  <span style={{ fontSize:'10px', color:P.text4 }}>S{wi+1}</span>
                  {weekDom && <ToneIcon tone={emotionTone(weekDom)} color={weekColor} size={14} />}
                  <span style={{ fontSize:'9px', color:weekColor, textAlign:'center', lineHeight:1.2 }}>{weekCount}j</span>
                </>
              ) : (
                <span style={{ fontSize:'10px', color:'#2e3d52' }}>S{wi+1}</span>
              )}
            </div>,
          ];
        })}
      </div>

      {/* Hover tooltip */}
      {hovered && byDay[hovered] && (() => {
        const emotion = byDay[hovered];
        const color   = EMOTION_COLORS[emotion] ?? P.text2;
        const stats   = tradeStats[hovered];
        const wr      = stats && stats.count > 0 ? Math.round(stats.wins / stats.count * 100) : null;
        return (
          <div style={{ position:'fixed', bottom:'22px', right:'22px', background:'rgba(8,9,16,0.97)', border:'1px solid rgba(136,153,187,0.22)', borderRadius:'8px', padding:'12px 16px', boxShadow:'0 8px 32px rgba(0,0,0,0.65)', zIndex:9999, minWidth:'200px', pointerEvents:'none', display:'flex', alignItems:'center', gap:'10px' }}>
            <ToneIcon tone={emotionTone(emotion)} color={color} size={20} />
            <div>
              <div style={{ fontSize:'13px', fontWeight:'700', color:P.text1, marginBottom:'2px' }}>{hovered}</div>
              <div style={{ fontSize:'12px', color, fontWeight:'600' }}>{emotion}</div>
              {stats && <div style={{ fontSize:'11px', color:P.text2, marginTop:'2px' }}>{stats.count} trade{stats.count > 1 ? 's' : ''} · {wr}% WR</div>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function TraderProfile() {
  const [loading,       setLoading]       = useState(true);
  const [isDemoMode,    setIsDemoMode]    = useState(false);
  const [calendar,      setCalendar]      = useState([]); // [{ date, emotion, text, generatedAt }]
  const [tradeStats,    setTradeStats]    = useState({});  // { [date]: { count, wins, losses } } — tous comptes
  const [referenceDay,  setReferenceDay]  = useState(null);
  const [viewYear,      setViewYear]      = useState(new Date().getFullYear());
  const [viewMonth,     setViewMonth]     = useState(new Date().getMonth());
  const [modalDate,     setModalDate]     = useState(null);

  // ── Bilan IA du jour (anciennement État Mental) ──
  const [allTrades,      setAllTrades]      = useState([]); // trades du compte actif (pour mini-stats jour dans ReportModal)
  const [report,         setReport]         = useState(null); // { date, emotion, text, generatedAt }
  const [generating,     setGenerating]     = useState(false);
  const [authError,      setAuthError]      = useState(null); // null | 'unauthenticated' | 'subscription_inactive' | 'quota_exceeded'
  const [quotaResetDate, setQuotaResetDate] = useState(null);
  const [noTrades,       setNoTrades]       = useState(false);
  const [stats,          setStats]          = useState(null); // winrate/profitFactor/streak

  useEffect(() => {
    (async () => {
      const [sessionRes, tradesRes, statsRes] = await Promise.all([
        window.auth.getSession(),
        window.db.getAllTrades(),
        window.db.getStats(),
      ]);
      const demoMode = !!sessionRes.data?.user && sessionRes.data.user.subscription_status !== 'active';
      const trades = tradesRes.ok ? (tradesRes.data ?? []) : [];
      setAllTrades(trades);
      const day = demoMode
        ? trades.reduce((max, t) => (t.date && t.date > max ? t.date : max), trades[0]?.date ?? getPreviousTradingDay())
        : getPreviousTradingDay();
      setIsDemoMode(demoMode);
      setReferenceDay(day);
      setStats(statsRes.ok ? statsRes.data : null);

      // Trades de TOUS les comptes, agrégés par jour — même logique que Vue Globale,
      // pour afficher trades + winrate sur chaque case du calendrier.
      const accRes = await window.accounts.getAll();
      if (accRes.ok) {
        const byDay = {};
        for (const acc of accRes.data.accounts) {
          const tRes = await window.db.getTradesForPath(acc.dbPath);
          if (!tRes.ok) continue;
          for (const t of tRes.data) {
            const net = t.result_net ?? t.result;
            if (net != null && net !== 0 && Math.abs(net) < 10) continue; // micro trades exclus (cf. Vue Globale)
            const d = t.date; if (!d) continue;
            if (!byDay[d]) byDay[d] = { count: 0, wins: 0, losses: 0 };
            byDay[d].count++;
            const val = net ?? 0;
            if (val > 0) byDay[d].wins++; else if (val < 0) byDay[d].losses++;
          }
        }
        setTradeStats(byDay);
      }

      if (demoMode) {
        const [calRes, reportRes] = await Promise.all([
          window.demo.getTraitCalendar(),
          window.demo.getEmotionalReport(),
        ]);
        setCalendar((calRes.ok ? (calRes.data ?? []) : []).map(e => ({ date: e.date, emotion: e.emotion, text: null, generatedAt: null })));
        const demoReport = reportRes.ok ? reportRes.data : null;
        setReport({
          date:        day,
          emotion:     demoReport?.emotion     ?? 'Discipliné',
          text:        demoReport?.description ?? '',
          generatedAt: new Date().toISOString(),
        });
      } else {
        await migrateLocalReportsToSqlite();
        const [reportRes, rangeRes] = await Promise.all([
          window.db.getMentalReport(day),
          window.db.getMentalReportsRange('2000-01-01', '2100-01-01'),
        ]);
        if (reportRes.ok && reportRes.data) {
          setReport({
            date:        reportRes.data.date,
            emotion:     reportRes.data.emotion,
            text:        reportRes.data.description,
            generatedAt: reportRes.data.generated_at,
          });
        }
        const rows = rangeRes.ok ? (rangeRes.data ?? []) : [];
        setCalendar(rows.map(r => ({ date: r.date, emotion: r.emotion, text: r.description, generatedAt: r.generated_at })));
      }
      setLoading(false);
    })();
  }, []);

  // Auto-génération une fois referenceDay résolu, si aucun rapport déjà présent.
  useEffect(() => {
    if (loading) return;
    if (report) return;
    if (isDemoMode) return; // le rapport démo est déjà résolu au chargement
    generate(false);
  }, [loading]);

  async function generate(force = false) {
    if (generating) return;
    if (!force && report) return;

    setGenerating(true);
    setNoTrades(false);
    setAuthError(null);
    setQuotaResetDate(null);

    // Mode démo : jamais d'appel facturé — un rapport fictif statique sert de contenu,
    // jamais persisté, recalculé à chaque ouverture, pour ne jamais se mélanger avec
    // les vraies données.
    if (isDemoMode) {
      try {
        const reportRes  = await window.demo.getEmotionalReport();
        const demoReport = reportRes.ok ? reportRes.data : null;
        setReport({
          date:        referenceDay,
          emotion:     demoReport?.emotion     ?? 'Discipliné',
          text:        demoReport?.description ?? '',
          generatedAt: new Date().toISOString(),
        });
      } finally {
        setGenerating(false);
      }
      return;
    }

    try {
      const tradesRes = await window.db.getAllTrades();
      const allTrades = tradesRes.ok ? (tradesRes.data ?? []) : [];
      const dayTrades = allTrades.filter(t => (t.date ?? '').startsWith(referenceDay));

      if (dayTrades.length === 0) {
        setNoTrades(true);
        setGenerating(false);
        return;
      }

      const prompt = buildPrompt(dayTrades, referenceDay);
      const res    = await window.ai.chat(
        [{ role: 'user', content: prompt }],
        'Tu es un expert en psychologie du trading. Réponds uniquement en JSON valide, sans markdown ni backticks.'
      );

      if (!res.ok) {
        if (['unauthenticated', 'subscription_inactive', 'quota_exceeded'].includes(res.error)) {
          setAuthError(res.error);
          if (res.error === 'quota_exceeded') setQuotaResetDate(res.resetDate ?? null);
          setGenerating(false);
          return;
        }
        throw new Error(res.error);
      }

      let parsed;
      try {
        const txt = res.data.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
        parsed = JSON.parse(txt);
      } catch {
        const m = res.data.match(/\{[\s\S]*\}/);
        parsed  = m ? JSON.parse(m[0]) : { emotion: 'Analysé', description: res.data };
      }

      const emotion     = parsed.emotion     ?? 'Analysé';
      const description = parsed.description ?? parsed.text ?? res.data;

      const saveRes = await window.db.saveMentalReport(referenceDay, emotion, description);
      const saved   = saveRes.ok ? saveRes.data : null;

      const newEntry = {
        date:        referenceDay,
        emotion:     saved?.emotion     ?? emotion,
        text:        saved?.description ?? description,
        generatedAt: saved?.generated_at ?? new Date().toISOString(),
      };
      setReport(newEntry);
      setCalendar(prev => [...prev.filter(e => e.date !== referenceDay), newEntry]);
    } catch (e) {
      console.error('AI report error:', e);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <div style={{ padding:'24px 28px', color:P.text3, fontSize:'13px' }}>Chargement...</div>;
  }

  // Stats du bandeau (trait dominant + légende) scopées au mois affiché dans le calendrier.
  const monthPfx = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthEntries = calendar.filter(e => e.date.startsWith(monthPfx));
  const { legend, dominant } = dominantTrait(monthEntries);

  // Série actuelle : basée sur les entrées les plus récentes, indépendamment du mois affiché.
  const sortedAsc = [...calendar].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  if (sortedAsc.length > 0) {
    const lastEmotion = sortedAsc[sortedAsc.length - 1].emotion;
    for (let i = sortedAsc.length - 1; i >= 0; i--) {
      if (sortedAsc[i].emotion === lastEmotion) streak++; else break;
    }
  }

  const dominantColor = dominant ? (EMOTION_COLORS[dominant] ?? P.text2) : P.text2;
  const dominantRgb   = emotionRgb(dominantColor);

  const badgeColor = report ? (EMOTION_COLORS[report.emotion] ?? P.text2) : P.text3;
  const badgeRgb    = emotionRgb(badgeColor);

  // Mini-stats du jour affichées dans la modale de détail (carte ouverte au clic calendrier).
  const modalEntry = modalDate ? calendar.find(e => e.date === modalDate) : null;
  let modalDayStats = null;
  if (modalEntry) {
    const dayTrades = allTrades.filter(t => (t.date ?? '').startsWith(modalEntry.date));
    const count = dayTrades.length;
    const wins  = dayTrades.filter(t => (t.result_net ?? t.result ?? 0) > 0).length;
    const pnl   = dayTrades.reduce((s, t) => s + (t.result_net ?? t.result ?? 0), 0);
    modalDayStats = { count, wr: count > 0 ? Math.round(wins / count * 100) : null, pnl };
  }

  const noTradeSynthesis = noTrades ? computeNoTradeSynthesis(calendar) : null;

  return (
    <div style={{ padding:'24px 28px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.35}50%{opacity:.9}}`}</style>

      <div style={{ marginBottom:'24px' }}>
        <div style={{ fontSize:'11px', color:P.text3, letterSpacing:'3px', marginBottom:'5px' }}>TRADING PSYCHOLOGY</div>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:P.text1, margin:'0 0 3px', letterSpacing:'-0.5px' }}>Profil Trader</h1>
        <div style={{ fontSize:'13px', color:P.text3 }}>Bilan IA · {fmtDate(referenceDay)}</div>
      </div>

      {/* ── Auth / abonnement / quota ── */}
      {authError && (
        <div style={{ marginBottom:'20px', padding:'20px', background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.22)', borderRadius:'10px', fontSize:'13px', color:'#f59e0b', lineHeight:'1.7' }}>
          <div style={{ fontWeight:'700', marginBottom:'6px' }}>
            {authError === 'unauthenticated'      ? 'Connexion requise'
              : authError === 'subscription_inactive' ? 'Abonnement requis'
              : 'Quota atteint'}
          </div>
          {authError === 'unauthenticated'
            ? 'Connecte-toi pour activer les bilans IA.'
            : authError === 'subscription_inactive'
            ? 'Abonnement requis pour activer les bilans IA.'
            : `Quota IA mensuel atteint${quotaResetDate ? `, réessaie après le ${quotaResetDate}` : ''}.`}
        </div>
      )}

      {/* ── Aucun trade : synthèse locale (sans appel IA) basée sur l'historique mental_reports ── */}
      {noTrades && !authError && !generating && (
        noTradeSynthesis ? (() => {
          const { dominantOverall, trend, totalDays } = noTradeSynthesis;
          const trendLabel = trend === 'amelioration' ? "Ta tendance récente s'améliore"
            : trend === 'degradation' ? 'Ta tendance récente montre des signes de dégradation'
            : 'Ta tendance récente reste stable';
          const trendColor = trend === 'amelioration' ? P.green : trend === 'degradation' ? P.red : P.text2;
          return (
            <div style={{ marginBottom:'20px', padding:'20px', background:`${P.bg}0.40)`, border:`1px solid ${P.border}0.10)`, borderRadius:'10px' }}>
              <div style={{ fontSize:'13px', color:P.text2, marginBottom:'14px' }}>
                Aucun trade enregistré le {fmtDate(referenceDay)} — voici la synthèse de ton évolution récente :
              </div>
              <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
                <MiniStat label="TRAIT DOMINANT" value={dominantOverall ?? '—'} />
                <MiniStat label="JOURS ANALYSÉS" value={totalDays} />
              </div>
              <div style={{ fontSize:'13px', color:trendColor, fontWeight:'700' }}>{trendLabel}.</div>
            </div>
          );
        })() : (
          <div style={{ marginBottom:'20px', padding:'20px', background:`${P.bg}0.40)`, border:`1px solid ${P.border}0.10)`, borderRadius:'10px', textAlign:'center' }}>
            <div style={{ fontSize:'28px', marginBottom:'10px' }}>📊</div>
            <div style={{ fontSize:'14px', color:P.text2 }}>Aucun trade enregistré le {fmtDate(referenceDay)}.</div>
            <div style={{ fontSize:'12px', color:P.text3, marginTop:'4px' }}>Pas d'analyse disponible pour ce jour.</div>
          </div>
        )
      )}

      {/* ── Skeleton chargement ── */}
      {generating && !report && (
        <div style={{ marginBottom:'20px', borderRadius:'12px', border:`1px solid ${P.border}0.12)`, background:`${P.bg}0.40)`, padding:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'20px' }}>
            <div style={{ width:'52px', height:'52px', borderRadius:'12px', background:`${P.border}0.08)`, animation:'pulse 1.5s ease infinite' }} />
            <div>
              <div style={{ height:'10px', width:'220px', background:`${P.border}0.08)`, borderRadius:'4px', marginBottom:'10px', animation:'pulse 1.5s ease infinite' }} />
              <div style={{ height:'18px', width:'130px', background:`${P.border}0.08)`, borderRadius:'4px', animation:'pulse 1.5s ease 0.2s infinite' }} />
            </div>
          </div>
          {[100,88,95,70,82].map((w, i) => (
            <div key={i} style={{ height:'13px', width:`${w}%`, background:`${P.border}0.06)`, borderRadius:'4px', marginBottom:'10px', animation:`pulse 1.5s ease ${i*0.12}s infinite` }} />
          ))}
          <div style={{ marginTop:'18px', fontSize:'12px', color:P.text3, display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ animation:'pulse 1.5s ease infinite', fontSize:'8px' }}>●</span>
            Claude analyse ta journée du {fmtDate(referenceDay)}...
          </div>
        </div>
      )}

      {/* ── Portrait IA du jour ── */}
      {report && (
        <div style={{ marginBottom:'24px', borderRadius:'14px', overflow:'hidden', border:`1px solid rgba(${badgeRgb},0.30)`, background:'rgba(14,15,22,0.5)' }}>
          <div style={{ padding:'20px 24px', background:`linear-gradient(135deg, rgba(${badgeRgb},0.22), rgba(${badgeRgb},0.05))`, borderBottom:`1px solid rgba(${badgeRgb},0.25)` }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                <div style={{ width:'52px', height:'52px', borderRadius:'12px', background:`rgba(${badgeRgb},0.18)`, border:`1px solid rgba(${badgeRgb},0.45)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <ToneIcon tone={emotionTone(report.emotion)} color={badgeColor} />
                </div>
                <div>
                  <div style={{ fontSize:'22px', fontWeight:'800', color:badgeColor, letterSpacing:'-0.3px', lineHeight:1.15 }}>{report.emotion}</div>
                  <div style={{ fontSize:'12px', color:P.text2, marginTop:'3px' }}>{EMOTION_TAGLINE[report.emotion] ?? 'Portrait psychologique du jour.'}</div>
                </div>
              </div>
              <button onClick={() => generate(true)} disabled={generating}
                style={{ padding:'6px 14px', borderRadius:'6px', background:'transparent', border:`1px solid ${P.border}0.15)`, color:P.text3, fontSize:'11px', fontFamily:'inherit', cursor:generating?'wait':'pointer', transition:'all 0.15s', opacity:generating?0.4:1, flexShrink:0 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=`${P.border}0.40)`; e.currentTarget.style.color=P.text1; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=`${P.border}0.15)`; e.currentTarget.style.color=P.text3; }}>
                {generating ? '...' : '↺ Régénérer'}
              </button>
            </div>
          </div>

          <div style={{ padding:'22px 24px 24px' }}>
            {stats && (
              <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
                <MiniStat label="WIN RATE" value={`${stats.winrate.toFixed(0)}%`} />
                <MiniStat label="PROFIT FACTOR" value={stats.profitFactor === 999 ? '∞' : stats.profitFactor.toFixed(2)} />
                <MiniStat label="SÉRIE" value={stats.streak > 0 ? `${stats.streak} 🟢` : stats.streak < 0 ? `${Math.abs(stats.streak)} 🔴` : '—'} />
              </div>
            )}
            <div>{renderBlocks(report.text, badgeColor)}</div>
            <div style={{ marginTop:'22px', paddingTop:'14px', borderTop:`1px solid ${P.border}0.08)`, display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:badgeColor, boxShadow:`0 0 5px ${badgeColor}` }} />
              <span style={{ fontSize:'11px', color:P.text4 }}>
                Généré par Claude · {fmtDate(report.date)} · {new Date(report.generatedAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bandeau */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'24px' }}>
        <div style={{ padding:'18px 20px', borderRadius:'12px', background:`linear-gradient(135deg, rgba(${dominantRgb},0.20), rgba(${dominantRgb},0.05))`, border:`1px solid rgba(${dominantRgb},0.30)`, display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:`rgba(${dominantRgb},0.18)`, border:`1px solid rgba(${dominantRgb},0.45)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {dominant && <ToneIcon tone={emotionTone(dominant)} color={dominantColor} size={22} />}
          </div>
          <div>
            <div style={{ fontSize:'10px', color:P.text3, letterSpacing:'2px', marginBottom:'3px' }}>TRAIT DOMINANT CE MOIS</div>
            <div style={{ fontSize:'18px', fontWeight:'800', color:dominantColor }}>{dominant ?? '—'}</div>
          </div>
        </div>

        <div style={{ padding:'18px 20px', borderRadius:'12px', background:`${P.bg}0.5)`, border:`1px solid ${P.border}0.12)`, display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(136,153,187,0.10)', border:'1px solid rgba(136,153,187,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'18px', fontWeight:'800', color:P.text1 }}>
            {streak}
          </div>
          <div>
            <div style={{ fontSize:'10px', color:P.text3, letterSpacing:'2px', marginBottom:'3px' }}>SÉRIE ACTUELLE</div>
            <div style={{ fontSize:'16px', fontWeight:'700', color:P.text1 }}>{streak} jour{streak > 1 ? 's' : ''} stable{streak > 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Calendrier */}
      <div style={{ marginBottom:'16px' }}>
        <TraitCalendar
          calendar={calendar}
          tradeStats={tradeStats}
          referenceDay={referenceDay}
          onMonthChange={(y, m) => { setViewYear(y); setViewMonth(m); }}
          onDayClick={date => setModalDate(date)}
        />
      </div>

      {/* Légende */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
        {legend.map(([emotion, count]) => {
          const color = EMOTION_COLORS[emotion] ?? P.text2;
          return (
            <div key={emotion} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 10px', borderRadius:'6px', background:'rgba(136,153,187,0.06)', border:'1px solid rgba(136,153,187,0.14)' }}>
              <ToneIcon tone={emotionTone(emotion)} color={color} size={14} />
              <span style={{ fontSize:'12px', color:P.text1 }}>{emotion} ({count}j)</span>
            </div>
          );
        })}
      </div>

      {modalDate && (
        <ReportModal entry={modalEntry} dayStats={modalDayStats} onClose={() => setModalDate(null)} />
      )}
    </div>
  );
}
