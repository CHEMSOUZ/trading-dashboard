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

// ── Redesign tokens (header / summary row / bloc bilan IA) ────
const PT = {
  border:          'rgba(136,153,187,0.14)',
  borderSecondary: 'rgba(136,153,187,0.35)',
  surfSecondary:   'rgba(20,23,34,0.75)',
  textPrimary:     '#dde4ef',
  textSecondary:   '#8898aa',
  textTertiary:    '#5a6a82',
  success:         '#1D9E75',
  danger:          '#E24B4A',
  warn:            '#BA7517',
  radiusLg:        '10px',
  radiusMd:        '8px',
};

const WEEKDAY_LABELS = ['LUN','MAR','MER','JEU','VEN','SAM','DIM'];

// ── Bilan IA hebdomadaire : system prompt JSON structuré ──────
const WEEKLY_SYSTEM_PROMPT = `Tu es un expert en psychologie du trading. Tu reçois les données de trading et états mentaux d'un trader sur une semaine. Génère une synthèse structurée en JSON avec exactement ces clés :
- trend : string, un mot parmi : 'En progression' | 'Stable' | 'En dégradation' | 'Critique'
- verdict_label : string, 1 phrase courte et directe résumant la semaine (max 15 mots)
- patterns : array de 2 strings max, patterns comportementaux identifiés avec chiffres
- recommandation : string, 1 règle concrète et non négociable pour la semaine suivante (max 3 phrases)
- paragraphes : array de 2-3 strings, analyse détaillée découpée en paragraphes courts (max 3 lignes chacun), chiffres inclus
Réponds uniquement en JSON valide, sans markdown, sans backticks, sans préambule.`;

function parseJsonArray(raw) {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Met en évidence les chiffres dans un texte libre — même logique que
// gtpHighlightNumbers (GlobalView.jsx), dupliquée localement (pas d'utilitaire partagé entre pages).
function highlightNumbers(text) {
  return text.split(/(\d+[.,]?\d*\s?%?)/g).map((part, i) =>
    /\d/.test(part)
      ? <span key={i} style={{ fontWeight: 500, color: PT.textPrimary }}>{part}</span>
      : <span key={i}>{part}</span>
  );
}

function IconArrowRight({ color, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M13 18l6 -6" />
      <path d="M13 6l6 6" />
    </svg>
  );
}

function IconBrain({ color, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 4a2.5 2.5 0 0 0 -2.5 2.5v.5a2.5 2.5 0 0 0 -1 4.8a2.5 2.5 0 0 0 1.7 4.3a2.5 2.5 0 0 0 4.3 1.4a2.5 2.5 0 0 0 4.3 -1.4a2.5 2.5 0 0 0 1.7 -4.3a2.5 2.5 0 0 0 -1 -4.8v-.5a2.5 2.5 0 0 0 -2.5 -2.5h-5z" />
      <path d="M12 6v13" />
    </svg>
  );
}

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

// Lundi de la semaine calendaire contenant la date donnée (ancré sur "aujourd'hui" réel,
// pas sur referenceDay, pour que "1 appel IA max par semaine" reste stable peu importe
// le dernier jour de trading).
function mondayOf(d) {
  const day  = d.getDay(); // 0=dim..6=sam
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  return m.toISOString().slice(0, 10);
}
function getCurrentWeekStart() { return mondayOf(new Date()); }

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

// Prompt hebdomadaire — volontairement différent de buildPrompt : demande une synthèse
// d'évolution sur plusieurs jours (tendance, patterns récurrents), pas un résumé jour par jour.
function buildWeeklyPrompt(entries, weekStart) {
  const weekEnd = addDaysStr(weekStart, 6);
  const sorted  = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const recap = sorted.map(e => {
    const txt = (e.text ?? '').replace(/\n+/g, ' ').slice(0, 280);
    return `${fmtDate(e.date)} — ${e.emotion} : ${txt || '(pas de détail)'}`;
  }).join('\n');

  return `Tu es un expert en psychologie du trading. Voici les bilans psychologiques quotidiens d'un trader, du ${fmtDate(weekStart)} au ${fmtDate(weekEnd)} (${sorted.length} jour(s) avec activité disponibles) :

${recap}

Génère une SYNTHÈSE D'ÉVOLUTION sur l'ensemble de cette période — PAS un résumé jour par jour mis côte à côte. Identifie la tendance globale, les patterns psychologiques qui se répètent sur plusieurs jours (récurrence de stress, progression de la discipline, cycles émotionnels, revenge trading récurrent, etc.), et termine par une recommandation concrète pour la semaine suivante.

Réponds en JSON pur sans markdown :
{"trend":"[constat global en une courte expression, ex: 'En progression'|'Stable'|'Vigilance requise'|'En dégradation']","description":"[2 à 3 paragraphes de synthèse d'évolution, séparés par une ligne vide]"}`;
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
// Accepte n'importe quel jour ayant des trades, avec ou sans analyse déjà générée
// (entry === null -> bloc "Aucune analyse" + bouton Générer).
function ReportModal({ date, entry, dayStats, generating, isDemoMode, error, onGenerate, onClose }) {
  const color = entry ? (EMOTION_COLORS[entry.emotion] ?? P.text2) : P.text2;
  const rgb   = emotionRgb(color);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#0c0d16', border:`1px solid rgba(${rgb},0.35)`, borderRadius:'14px', width:'100%', maxWidth:'640px', maxHeight:'86vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 24px', background:`linear-gradient(135deg, rgba(${rgb},0.22), rgba(${rgb},0.05))`, borderBottom:`1px solid rgba(${rgb},0.25)`, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'14px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
            {entry && (
              <div style={{ width:'48px', height:'48px', borderRadius:'12px', background:`rgba(${rgb},0.18)`, border:`1px solid rgba(${rgb},0.45)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <ToneIcon tone={emotionTone(entry.emotion)} color={color} size={24} />
              </div>
            )}
            <div>
              <div style={{ fontSize:'12px', color:P.text2, textTransform:'capitalize', marginBottom:'2px' }}>{fmtDate(date)}</div>
              <div style={{ fontSize:'20px', fontWeight:'800', color: entry ? color : P.text3, letterSpacing:'-0.3px', lineHeight:1.15 }}>{entry ? entry.emotion : 'Aucune analyse'}</div>
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

          {entry ? (
            <div>
              <div style={{ marginBottom:'16px' }}>
                <div style={{ fontSize:'11px', color:PT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>ÉTAT ÉMOTIONNEL</div>
                <div style={{ fontSize:'13px', color:PT.textPrimary, lineHeight:'1.7', maxWidth:'560px' }}>{entry.emotionText}</div>
              </div>
              <div style={{ marginBottom:'16px' }}>
                <div style={{ fontSize:'11px', color:PT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>PATTERNS IDENTIFIÉS</div>
                <div style={{ fontSize:'13px', color:PT.textPrimary, lineHeight:'1.7', maxWidth:'560px' }}>{entry.patternsText}</div>
              </div>
              <div style={{ background:'rgba(186,117,23,0.08)', border:'0.5px solid rgba(186,117,23,0.35)', borderRadius:PT.radiusMd, padding:'10px 14px' }}>
                <div style={{ fontSize:'11px', color:PT.warn, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px', display:'flex', alignItems:'center', gap:'5px' }}>
                  <IconArrowRight color={PT.warn} /> FOCUS POUR DEMAIN
                </div>
                <div style={{ fontSize:'13px', color:PT.textPrimary, lineHeight:'1.6', borderLeft:'2px solid #7F77DD', paddingLeft:'10px' }}>{entry.focusText}</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'24px 0' }}>
              <div style={{ fontSize:'13px', color:P.text2, marginBottom:'16px' }}>Aucune analyse générée pour cette journée</div>
              {error && (
                <div style={{ fontSize:'12px', color:'#f59e0b', marginBottom:'12px' }}>
                  {error === 'unauthenticated'      ? 'Connexion requise.'
                    : error === 'subscription_inactive' ? 'Abonnement requis.'
                    : error === 'quota_exceeded'         ? 'Quota IA mensuel atteint.'
                    : error}
                </div>
              )}
              <button
                onClick={onGenerate}
                disabled={generating || isDemoMode}
                title={isDemoMode ? 'Disponible avec un abonnement actif' : undefined}
                style={{
                  padding:'8px 16px', borderRadius:'6px', background:'transparent',
                  border:`1px solid ${P.border}0.30)`, color: isDemoMode ? P.text4 : P.text1,
                  fontSize:'12px', fontFamily:'inherit', cursor: isDemoMode ? 'not-allowed' : generating ? 'wait' : 'pointer',
                  opacity: isDemoMode ? 0.5 : 1,
                }}>
                {generating ? 'Génération en cours…' : 'Générer l\'analyse ↗'}
              </button>
            </div>
          )}

          {entry?.generatedAt && (
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
function TraitCalendar({ calendar, dailyMentalByDate, tradeStats, referenceDay, generatingDates, isDemoMode, onMonthChange, onDayClick, onGenerateDay }) {
  const initial = referenceDay ? new Date(referenceDay + 'T12:00:00') : new Date();
  const [year,    setYear]    = useState(initial.getFullYear());
  const [month,   setMonth]   = useState(initial.getMonth());
  const [hovered, setHovered] = useState(null);

  useEffect(() => { onMonthChange?.(year, month); }, [year, month]);

  // Priorité à daily_mental_reports quand les deux coexistent pour le même jour (cf. Partie 6).
  const byDay = {};
  for (const e of calendar) byDay[e.date] = e.emotion;
  for (const date in dailyMentalByDate) byDay[date] = dailyMentalByDate[date].trait;

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
              const stats   = tradeStats[date];
              const wr      = stats && stats.count > 0 ? Math.round(stats.wins / stats.count * 100) : null;
              const hasTrades = stats?.count > 0;
              // garde : ne jamais afficher un trait si aucun trade n'existe ce jour-là
              const emotion = hasTrades ? byDay[date] : null;
              const color   = emotion ? (EMOTION_COLORS[emotion] ?? P.text2) : null;
              const cellRgb = color ? emotionRgb(color) : null;
              const isRef   = date === referenceDay;
              const isHov   = hovered === date;
              const clickable = hasTrades;
              const isGenerating = generatingDates?.has(date);
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
                    opacity: isGenerating ? 0.45 : 1,
                  }}>
                  {hasTrades && !isDemoMode && (
                    <button
                      onClick={e => { e.stopPropagation(); onGenerateDay?.(date); }}
                      disabled={isGenerating}
                      title={emotion ? 'Régénérer l\'analyse de ce jour' : 'Générer l\'analyse de ce jour'}
                      style={{
                        position:'absolute', top:'3px', right:'3px', zIndex:4,
                        width:'16px', height:'16px', display:'flex', alignItems:'center', justifyContent:'center',
                        background:'rgba(8,9,16,0.55)', border:'none', borderRadius:'4px',
                        opacity: isHov ? 1 : 0, transition:'opacity 0.12s',
                        cursor: isGenerating ? 'wait' : 'pointer', padding:0,
                      }}>
                      <IconBrain color={P.text3} size={11} />
                    </button>
                  )}
                  <span style={{ fontSize:'11px', color: emotion ? P.text2 : P.text4, fontWeight: isRef ? '700' : '400' }}>{day}</span>
                  {emotion && (
                    <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                      <ToneIcon tone={emotionTone(emotion)} color={color} size={13} />
                      <span style={{ fontSize:'10px', color, fontWeight:'600', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emotion}</span>
                    </div>
                  )}
                  {!emotion && hasTrades && !isGenerating && !isDemoMode && (
                    <span style={{ fontSize:'10px', color:P.text3 }}>⚡ Analyser</span>
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
      {hovered && (() => {
        const stats   = tradeStats[hovered];
        const emotion = stats?.count > 0 ? byDay[hovered] : null;
        if (!emotion) return null;
        const color   = EMOTION_COLORS[emotion] ?? P.text2;
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

// Convertit le texte legacy (mental_reports, 3 blocs séparés par \n\n) vers la forme
// unifiée {emotionText, patternsText, focusText} utilisée par la modale de détail.
function splitLegacyBlocks(text) {
  const blocks = (text ?? '').split(/\n\n+/);
  const pick = (titles) => {
    const b = blocks.find(blk => titles.some(t => blk.trim().toUpperCase().startsWith(t)));
    if (!b) return '';
    const lines = b.trim().split('\n');
    return (titles.some(t => lines[0].trim().toUpperCase().includes(t)) ? lines.slice(1) : lines).join(' ').trim();
  };
  return {
    emotionText:  pick(['ÉTAT ÉMOTIONNEL']) || blocks[0]?.trim() || '',
    patternsText: pick(['PATTERNS IDENTIFIÉS']) || blocks[1]?.trim() || '',
    focusText:    pick(['FOCUS POUR DEMAIN']) || blocks[2]?.trim() || '',
  };
}

export default function TraderProfile() {
  const [loading,       setLoading]       = useState(true);
  const [isDemoMode,    setIsDemoMode]    = useState(false);
  const [userId,        setUserId]        = useState(null);
  const [calendar,      setCalendar]      = useState([]); // [{ date, emotion, text, generatedAt }]
  const [dailyMentalByDate, setDailyMentalByDate] = useState({}); // { [date]: row daily_mental_reports }
  const [generatingDates,   setGeneratingDates]   = useState(() => new Set());
  const [modalGenerating,   setModalGenerating]   = useState(false);
  const [modalError,        setModalError]        = useState(null);
  const [tradeStats,    setTradeStats]    = useState({});  // { [date]: { count, wins, losses } } — tous comptes
  const [referenceDay,  setReferenceDay]  = useState(null);
  const [viewYear,      setViewYear]      = useState(new Date().getFullYear());
  const [viewMonth,     setViewMonth]     = useState(new Date().getMonth());
  const [modalDate,     setModalDate]     = useState(null);

  // ── Bilan IA du jour (anciennement État Mental) ──
  const [report,         setReport]         = useState(null); // { date, emotion, text, generatedAt }
  const [generating,     setGenerating]     = useState(false);
  const [authError,      setAuthError]      = useState(null); // null | 'unauthenticated' | 'subscription_inactive' | 'quota_exceeded'
  const [quotaResetDate, setQuotaResetDate] = useState(null);
  const [noTrades,       setNoTrades]       = useState(false);
  const [stats,          setStats]          = useState(null); // winrate/profitFactor/streak

  // ── Bilan IA hebdomadaire (complément du bloc "aucun trade") ──
  const [weeklyReport,       setWeeklyReport]       = useState(null); // { weekStart, trend, verdict_label, patterns[], recommandation, paragraphes[], generatedAt }
  const [weeklyGenerating,   setWeeklyGenerating]   = useState(false);
  const [weeklyAuthError,    setWeeklyAuthError]    = useState(null);
  const [weeklyQuotaReset,   setWeeklyQuotaReset]   = useState(null);
  const [weeklyInsufficient, setWeeklyInsufficient] = useState(false);
  const [weeklyError,        setWeeklyError]        = useState(null); // erreur générique (ex: backend injoignable)

  useEffect(() => {
    (async () => {
      const [sessionRes, tradesRes, statsRes] = await Promise.all([
        window.auth.getSession(),
        window.db.getAllTrades(),
        window.db.getStats(),
      ]);
      const demoMode = !!sessionRes.data?.user && sessionRes.data.user.subscription_status !== 'active';
      const trades = tradesRes.ok ? (tradesRes.data ?? []) : [];
      const day = demoMode
        ? trades.reduce((max, t) => (t.date && t.date > max ? t.date : max), trades[0]?.date ?? getPreviousTradingDay())
        : getPreviousTradingDay();
      setIsDemoMode(demoMode);
      setUserId(sessionRes.data?.user?.id ?? null);
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
            if (!byDay[d]) byDay[d] = { count: 0, wins: 0, losses: 0, pnl: 0 };
            byDay[d].count++;
            const val = net ?? 0;
            if (val > 0) byDay[d].wins++; else if (val < 0) byDay[d].losses++;
            byDay[d].pnl += val;
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

  // Bilan hebdomadaire : déclenché uniquement quand le jour affiché n'a pas de trade.
  // Vérifie d'abord en base (1 appel IA max par semaine calendaire, peu importe le nombre
  // d'ouvertures de la page cette semaine-là) avant d'envisager un nouvel appel.
  useEffect(() => {
    if (loading || !noTrades || isDemoMode) return;
    if (weeklyReport || weeklyGenerating) return;
    loadOrGenerateWeeklyReport();
  }, [loading, noTrades, isDemoMode]);

  // Analyses psychologiques quotidiennes automatiques du mois affiché dans le calendrier
  // (table daily_mental_reports, séparée de mental_reports) — jamais en mode démo, où le
  // calendrier reste sur le dataset statique de demo_data.json.
  useEffect(() => {
    if (loading || isDemoMode || !userId) return;
    (async () => {
      const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
      const res = await window.dailyMental.getForMonth(userId, monthKey);
      if (!res.ok) return;
      const byDate = {};
      for (const row of (res.data ?? [])) byDate[row.date] = row;
      setDailyMentalByDate(prev => ({ ...prev, ...byDate }));
    })();
  }, [loading, isDemoMode, userId, viewYear, viewMonth]);

  async function handleGenerateDay(date, force = true) {
    if (isDemoMode || !userId || generatingDates.has(date)) return;
    setGeneratingDates(prev => new Set(prev).add(date));
    if (modalDate === date) { setModalGenerating(true); setModalError(null); }
    try {
      const res = await window.dailyMental.generate(userId, date, force);
      if (!res.ok) {
        if (modalDate === date) setModalError(res.error || 'Erreur lors de la génération.');
        return;
      }
      if (res.data) setDailyMentalByDate(prev => ({ ...prev, [date]: res.data }));
    } finally {
      setGeneratingDates(prev => { const next = new Set(prev); next.delete(date); return next; });
      if (modalDate === date) setModalGenerating(false);
    }
  }

  async function loadOrGenerateWeeklyReport(force = false) {
    if (isDemoMode) return;
    setWeeklyGenerating(true);
    setWeeklyAuthError(null);
    setWeeklyQuotaReset(null);
    setWeeklyInsufficient(false);
    setWeeklyError(null);

    try {
      const weekStart = getCurrentWeekStart();
      const existingRes = await window.db.getWeeklyReport(weekStart);
      if (!force && existingRes.ok && existingRes.data) {
        const d = existingRes.data;
        const structured = d.paragraphes != null;
        setWeeklyReport({
          weekStart:      d.week_start,
          trend:          d.trend,
          verdict_label:  d.verdict_label ?? '',
          patterns:       structured ? parseJsonArray(d.patterns) : [],
          recommandation: d.recommandation ?? '',
          // Fallback : anciennes entrées sans colonnes structurées — on retrouve le
          // découpage en paragraphes via la colonne description historique.
          paragraphes:    structured ? parseJsonArray(d.paragraphes) : d.description.split(/\n\n+/),
          generatedAt:    d.generated_at,
        });
        return; // déjà généré cette semaine — aucun appel IA
      }

      // Bilans de la semaine calendaire en cours ; si trop peu, fallback sur les derniers
      // jours disponibles au global (historique encore court, ex: 18 jours au total).
      const weekEnd  = addDaysStr(weekStart, 6);
      const withText = calendar.filter(e => e.text);
      let source = withText.filter(e => e.date >= weekStart && e.date <= weekEnd);
      if (source.length < 2) {
        source = [...withText].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
      }
      if (source.length < 2) {
        setWeeklyInsufficient(true);
        return; // historique trop court — pas d'appel IA, rien à sauvegarder
      }

      const prompt = buildWeeklyPrompt(source, weekStart);
      const res    = await window.ai.chat(
        [{ role: 'user', content: prompt }],
        WEEKLY_SYSTEM_PROMPT
      );

      if (!res.ok) {
        if (['unauthenticated', 'subscription_inactive', 'quota_exceeded'].includes(res.error)) {
          setWeeklyAuthError(res.error);
          if (res.error === 'quota_exceeded') setWeeklyQuotaReset(res.resetDate ?? null);
          return;
        }
        setWeeklyError(res.error || 'Erreur de connexion au serveur IA.');
        return;
      }

      let parsed;
      try {
        const txt = res.data.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
        parsed = JSON.parse(txt);
      } catch {
        const m = res.data.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : {
          trend: 'Analysé',
          verdict_label: '',
          patterns: [],
          recommandation: res.data,
          paragraphes: [res.data]
        };
      }

      const trend          = parsed.trend ?? 'Analysé';
      const verdict_label  = parsed.verdict_label ?? '';
      const patterns       = Array.isArray(parsed.patterns) ? parsed.patterns : [];
      const recommandation = parsed.recommandation ?? '';
      const paragraphes    = Array.isArray(parsed.paragraphes) ? parsed.paragraphes : [parsed.description ?? res.data];
      const description    = paragraphes.join('\n\n'); // conservé pour la colonne NOT NULL existante

      const saveRes = await window.db.saveWeeklyReport(weekStart, trend, description, {
        verdict_label,
        patterns:    JSON.stringify(patterns),
        recommandation,
        paragraphes: JSON.stringify(paragraphes),
      });
      const saved = saveRes.ok ? saveRes.data : null;

      setWeeklyReport({
        weekStart:      saved?.week_start      ?? weekStart,
        trend:          saved?.trend           ?? trend,
        verdict_label:  saved?.verdict_label   ?? verdict_label,
        patterns:       saved?.patterns        ? parseJsonArray(saved.patterns) : patterns,
        recommandation: saved?.recommandation  ?? recommandation,
        paragraphes:    saved?.paragraphes     ? parseJsonArray(saved.paragraphes) : paragraphes,
        generatedAt:    saved?.generated_at    ?? new Date().toISOString(),
      });
    } catch (e) {
      console.error('Weekly AI report error:', e);
      setWeeklyError(e.message || 'Erreur lors de la génération du bilan hebdomadaire.');
    } finally {
      setWeeklyGenerating(false);
    }
  }

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

  // Trades/WR agrégés sur les jours du mois où le trait dominant était actif (summary row).
  let domTrades = 0, domWins = 0;
  for (const e of monthEntries) {
    if (e.emotion !== dominant) continue;
    const s = tradeStats[e.date];
    if (s) { domTrades += s.count; domWins += s.wins; }
  }
  const domWR = domTrades > 0 ? Math.round(domWins / domTrades * 100) : null;

  const badgeColor = report ? (EMOTION_COLORS[report.emotion] ?? P.text2) : P.text3;
  const badgeRgb    = emotionRgb(badgeColor);

  // Mini-stats + analyse du jour affichées dans la modale de détail (carte ouverte au clic
  // calendrier) — sourcées de tradeStats (agrégat tous comptes), même scope que les badges du
  // calendrier. La modale s'ouvre pour tout jour ayant des trades, avec ou sans analyse :
  // priorité à daily_mental_reports sur l'ancien mental_reports (cf. Partie 6).
  let modalDayStats = null;
  if (modalDate) {
    const dayStat = tradeStats[modalDate];
    const count = dayStat?.count ?? 0;
    modalDayStats = { count, wr: count > 0 ? Math.round(dayStat.wins / count * 100) : null, pnl: dayStat?.pnl ?? 0 };
  }
  const modalNewReport = modalDate ? dailyMentalByDate[modalDate] : null;
  const modalLegacy     = modalDate ? calendar.find(e => e.date === modalDate) : null;
  const modalEntry = modalNewReport
    ? { emotion: modalNewReport.trait, emotionText: modalNewReport.emotion_text, patternsText: modalNewReport.patterns_text, focusText: modalNewReport.focus_text, generatedAt: modalNewReport.generated_at }
    : modalLegacy
    ? { emotion: modalLegacy.emotion, ...splitLegacyBlocks(modalLegacy.text), generatedAt: modalLegacy.generatedAt }
    : null;

  const noTradeSynthesis = noTrades ? computeNoTradeSynthesis(calendar) : null;

  return (
    <div style={{ padding:'24px 28px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.35}50%{opacity:.9}}`}</style>

      <div style={{ marginBottom:'24px' }}>
        <div style={{ fontSize:'11px', color:PT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>TRADING PSYCHOLOGY</div>
        <h1 style={{ fontSize:'22px', fontWeight:'500', color:P.text1, margin:'0 0 3px' }}>Profil Trader</h1>
        <div style={{ fontSize:'12px', color:PT.textTertiary }}>Bilan IA · {fmtDate(referenceDay)}</div>
      </div>

      {/* ── Summary row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'1.25rem' }}>
        <div style={{ background:'#1a0808', border:'0.5px solid #3a1212', borderLeft:'3px solid #E24B4A', borderRadius:PT.radiusLg, padding:'12px 16px' }}>
          <div style={{ fontSize:'11px', color:'#9a6060', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>TRAIT DOMINANT CE MOIS</div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            {dominant && <ToneIcon tone={emotionTone(dominant)} color="#E24B4A" size={18} />}
            <span style={{ fontSize:'20px', fontWeight:'500', color:'#E24B4A' }}>{dominant ?? '—'}</span>
          </div>
          <div style={{ fontSize:'11px', color:'#9a6060', marginTop:'6px' }}>
            {domTrades > 0 ? `${domTrades} trade${domTrades > 1 ? 's' : ''} · ${domWR}% WR` : 'Aucun trade associé'}
          </div>
        </div>

        <div style={{ background:PT.surfSecondary, border:`1px solid ${PT.border}`, borderRadius:PT.radiusLg, padding:'12px 16px' }}>
          <div style={{ fontSize:'11px', color:PT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>SÉRIE ACTUELLE</div>
          <div style={{ fontSize:'20px', fontWeight:'500', color:PT.textPrimary }}>{streak} jour{streak > 1 ? 's' : ''} stable{streak > 1 ? 's' : ''}</div>
          <div style={{ fontSize:'11px', color:PT.textTertiary, marginTop:'6px' }}>Série N° {streak}</div>
        </div>
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

      {/* ── Aucun trade : bloc bilan IA hebdomadaire (sans appel IA si déjà généré cette semaine) ── */}
      {noTrades && !authError && !generating && (
        noTradeSynthesis ? (() => {
          const trend        = weeklyReport?.trend ?? '';
          const verdictColor = trend === 'En progression'                    ? PT.success
            : trend === 'En dégradation' || trend === 'Critique'             ? PT.danger
            : PT.textSecondary; // 'Stable' ou valeur inconnue
          const verdictBg    = trend === 'Critique' ? '#1a0000' : '#120808';
          return (
            <div style={{ marginBottom:'1.25rem', border:`0.5px solid ${PT.border}`, borderRadius:PT.radiusLg, overflow:'hidden' }}>
              {/* Header */}
              <div style={{ background:PT.surfSecondary, borderBottom:`1px solid ${PT.border}`, padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'6px' }}>
                <span style={{ fontSize:'11px', fontWeight:'500', color:PT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em' }}>BILAN IA HEBDOMADAIRE</span>
                {weeklyReport && (
                  <span style={{ fontSize:'11px', color:PT.textTertiary }}>
                    Semaine du {fmtDate(weeklyReport.weekStart)} · Généré par Claude
                  </span>
                )}
              </div>

              {/* Verdict strip — fallback sur trend si verdict_label absent (anciennes entrées) */}
              {weeklyReport && (weeklyReport.verdict_label || weeklyReport.trend) && (
                <div style={{ padding:'12px 16px', background:verdictBg, borderBottom:'0.5px solid #3a1212' }}>
                  <div style={{ fontSize:'11px', color:'#9a6060', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>VERDICT</div>
                  <div style={{ fontSize:'15px', fontWeight:'500', color:verdictColor }}>{weeklyReport.verdict_label || weeklyReport.trend}</div>
                </div>
              )}

              {/* Patterns identifiés */}
              {weeklyReport && weeklyReport.patterns.length > 0 && (
                <div style={{ background:PT.surfSecondary, borderBottom:`1px solid ${PT.borderSecondary}`, padding:'12px 16px' }}>
                  <div style={{ fontSize:'11px', color:PT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>PATTERNS IDENTIFIÉS</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {weeklyReport.patterns.map((p, i) => (
                      <div key={i} style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
                        <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#7F77DD', marginTop:'5px', flexShrink:0 }} />
                        <span style={{ fontSize:'12px', color:PT.textSecondary, lineHeight:'1.5' }}>{highlightNumbers(p)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Body : analyse détaillée */}
              <div style={{ padding:'16px' }}>
                {weeklyAuthError && (
                  <div style={{ fontSize:'13px', color:'#f59e0b', lineHeight:'1.6' }}>
                    {weeklyAuthError === 'unauthenticated'      ? 'Connecte-toi pour activer le bilan hebdomadaire.'
                      : weeklyAuthError === 'subscription_inactive' ? 'Abonnement requis pour activer le bilan hebdomadaire.'
                      : `Quota IA mensuel atteint${weeklyQuotaReset ? `, réessaie après le ${weeklyQuotaReset}` : ''}.`}
                  </div>
                )}

                {weeklyGenerating && !weeklyReport && (
                  <div style={{ fontSize:'13px', color:PT.textSecondary, display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ animation:'pulse 1.5s ease infinite', fontSize:'8px' }}>●</span>
                    Claude analyse ta semaine...
                  </div>
                )}

                {weeklyInsufficient && !weeklyGenerating && (
                  <div style={{ fontSize:'13px', color:PT.textSecondary }}>Historique encore trop court pour un bilan hebdomadaire.</div>
                )}

                {weeklyError && !weeklyGenerating && (
                  <div style={{ fontSize:'13px', color:PT.danger }}>{weeklyError}</div>
                )}

                {weeklyReport && weeklyReport.paragraphes.map((p, i) => (
                  <p key={i} style={{ fontSize:'13px', color:PT.textSecondary, lineHeight:'1.75', maxWidth:'640px', textAlign:'left', margin:'0 0 12px' }}>{highlightNumbers(p.trim())}</p>
                ))}
              </div>

              {/* Recommandation prioritaire */}
              {weeklyReport && weeklyReport.recommandation && (
                <div style={{ margin:'0 16px 16px', borderRadius:PT.radiusMd, border:'0.5px solid rgba(186,117,23,0.35)', background:'rgba(186,117,23,0.08)', padding:'12px 14px' }}>
                  <div style={{ fontSize:'11px', fontWeight:'500', textTransform:'uppercase', color:PT.warn, display:'flex', alignItems:'center', gap:'5px', marginBottom:'6px' }}>
                    <IconArrowRight color={PT.warn} /> RECOMMANDATION SEMAINE SUIVANTE
                  </div>
                  <div style={{ fontSize:'13px', color:PT.textPrimary, lineHeight:'1.6' }}>{weeklyReport.recommandation}</div>
                </div>
              )}

              {/* Footer */}
              <div style={{ padding:'8px 16px', background:PT.surfSecondary, borderTop:`1px solid ${PT.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px' }}>
                <span style={{ fontSize:'11px', color:PT.textTertiary }}>Aucun trade enregistré le {fmtDate(referenceDay)}.</span>
                <button
                  onClick={() => loadOrGenerateWeeklyReport(true)}
                  disabled={isDemoMode || weeklyGenerating}
                  title={isDemoMode ? 'Disponible avec un abonnement actif' : undefined}
                  style={{
                    background:'transparent', border:`1px solid ${PT.textTertiary}`, color:PT.textTertiary,
                    fontSize:'12px', fontFamily:'inherit', padding:'3px 9px', borderRadius:'5px',
                    cursor: isDemoMode ? 'not-allowed' : weeklyGenerating ? 'wait' : 'pointer',
                    opacity: isDemoMode ? 0.5 : 1, flexShrink:0,
                  }}>
                  Regénérer ↗
                </button>
              </div>
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

      {/* Calendrier */}
      <div style={{ marginBottom:'16px' }}>
        <TraitCalendar
          calendar={calendar}
          dailyMentalByDate={dailyMentalByDate}
          tradeStats={tradeStats}
          referenceDay={referenceDay}
          generatingDates={generatingDates}
          isDemoMode={isDemoMode}
          onMonthChange={(y, m) => { setViewYear(y); setViewMonth(m); }}
          onDayClick={date => { setModalDate(date); setModalError(null); }}
          onGenerateDay={date => handleGenerateDay(date, true)}
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
        <ReportModal
          date={modalDate}
          entry={modalEntry}
          dayStats={modalDayStats}
          generating={modalGenerating || generatingDates.has(modalDate)}
          isDemoMode={isDemoMode}
          error={modalError}
          onGenerate={() => handleGenerateDay(modalDate, true)}
          onClose={() => { setModalDate(null); setModalError(null); }}
        />
      )}
    </div>
  );
}
