import { useState, useEffect } from 'react';
import { EMOTION_COLORS, emotionTone, emotionRgb, ToneIcon } from '../shared/emotionTraits';

// ── Palette ───────────────────────────────────────────────────
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
  accent:  '#7c3aed',
  accentL: '#a78bfa',
};

const EMOTION_EMOJI = {
  'Discipliné':'🧘', 'Serein':'😌', 'Focalisé':'🎯',
  'Stressé':'😰',   'Fragile':'⚠️','Surconfiant':'😤',
  'Impulsif':'⚡',  'Vengeur':'😡',
};

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

// Mini-case compacte pour la rangée d'indicateurs sous le bandeau.
function MiniStat({ label, value }) {
  return (
    <div style={{ flex:1, background:'rgba(136,153,187,0.06)', border:'1px solid rgba(136,153,187,0.14)', borderRadius:'7px', padding:'9px 12px', textAlign:'center' }}>
      <div style={{ fontSize:'9px', color:'#4a5a72', letterSpacing:'1.5px', marginBottom:'4px' }}>{label}</div>
      <div style={{ fontSize:'16px', fontWeight:'700', color:'#dde4ef' }}>{value}</div>
    </div>
  );
}

const SK_AI = 'mental_ai_reports';
const MIGRATION_FLAG = 'mental_reports_migrated_v1';

// Ancien format localStorage — conservé uniquement pour la migration ponctuelle
// vers la table SQLite mental_reports (jamais supprimé, sert de sauvegarde).
function loadAI() { try { return JSON.parse(localStorage.getItem(SK_AI) ?? '[]'); } catch { return []; } }

// Migration unique localStorage -> SQLite, exécutée une seule fois (utilisateurs non-démo).
// mental_ai_reports n'est jamais effacé : il reste en place comme sauvegarde de sécurité.
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

// Retourne le dernier jour de trading (passe le week-end)
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

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

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

// ── Main ──────────────────────────────────────────────────────
export default function EmotionalCheck() {
  const [report,     setReport]     = useState(null); // { date, emotion, text, generatedAt }
  const [pastReports,setPastReports]= useState([]);   // historique (utilisateurs non-démo uniquement)
  const [generating, setGenerating] = useState(false);
  const [authError,      setAuthError]      = useState(null); // null | 'unauthenticated' | 'subscription_inactive' | 'quota_exceeded'
  const [quotaResetDate, setQuotaResetDate]  = useState(null);
  const [noTrades,   setNoTrades]   = useState(false);
  const [showHistory,setShowHistory]= useState(false);
  // Jour analysé : la date système réelle (hier, jour ouvré) en temps normal,
  // mais figée sur le dernier trade du dataset démo en mode démo — pour que le
  // rapport affiché reste cohérent indéfiniment, peu importe quand on teste la démo.
  const [referenceDay, setReferenceDay] = useState(getPreviousTradingDay());
  const [ready,        setReady]        = useState(false);
  const [isDemoMode,   setIsDemoMode]   = useState(false);
  const [stats,        setStats]        = useState(null); // winrate/profitFactor/streak pour la rangée compacte

  // Résout referenceDay (détecte le mode démo via la session + les trades) avant
  // toute auto-génération, pour éviter un flash avec la mauvaise date/le mauvais jour.
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
      setReferenceDay(day);
      setStats(statsRes.ok ? statsRes.data : null);

      // Le mode démo n'utilise jamais SQLite : dataset fictif géré entièrement par generate().
      if (!demoMode) {
        await migrateLocalReportsToSqlite();
        const [reportRes, historyRes] = await Promise.all([
          window.db.getMentalReport(day),
          window.db.getMentalReportsRange(addDaysStr(day, -60), day),
        ]);
        if (reportRes.ok && reportRes.data) {
          setReport({
            date:        reportRes.data.date,
            emotion:     reportRes.data.emotion,
            text:        reportRes.data.description,
            generatedAt: reportRes.data.generated_at,
          });
        }
        const hist = historyRes.ok ? (historyRes.data ?? []) : [];
        setPastReports(hist.filter(r => r.date !== day).map(r => ({
          date: r.date, emotion: r.emotion, text: r.description, generatedAt: r.generated_at,
        })));
      }

      setReady(true);
    })();
  }, []);

  // Auto-génération au montage, une fois referenceDay résolu (et le rapport éventuel chargé)
  useEffect(() => {
    if (!ready) return;
    if (report) return;
    generate(false);
  }, [ready]);

  async function generate(force = false) {
    if (generating) return;
    if (!force && report) return;

    setGenerating(true);
    setNoTrades(false);
    setAuthError(null);
    setQuotaResetDate(null);

    // Mode démo : jamais d'appel facturé à window.ai.chat() — un rapport fictif
    // statique (cohérent avec le profil agrégé du dataset démo) sert de contenu,
    // affiché comme un rapport normal, sans aucun message de limitation. Jamais
    // persisté (ni SQLite, ni localStorage) : recalculé à chaque ouverture, à
    // coût nul, pour ne jamais se mélanger avec les vraies données.
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

      setReport({
        date:        referenceDay,
        emotion:     saved?.emotion     ?? emotion,
        text:        saved?.description ?? description,
        generatedAt: saved?.generated_at ?? new Date().toISOString(),
      });
    } catch (e) {
      console.error('AI report error:', e);
    } finally {
      setGenerating(false);
    }
  }

  const color = report ? (EMOTION_COLORS[report.emotion] ?? P.text2) : P.text3;

  const rgb = emotionRgb(color);

  // Formatte le texte en blocs
  function renderDescription(text) {
    if (!text) return null;
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

  const recentReports = pastReports.slice(0, 10);

  return (
    <div style={{ padding:'24px 28px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.35}50%{opacity:.9}}`}</style>

      {/* Header */}
      <div style={{ marginBottom:'28px' }}>
        <div style={{ fontSize:'11px', color:P.text3, letterSpacing:'3px', marginBottom:'5px' }}>TRADING PSYCHOLOGY</div>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:P.text1, margin:'0 0 3px', letterSpacing:'-0.5px' }}>État Mental</h1>
        <div style={{ fontSize:'13px', color:P.text3 }}>
          Bilan IA · {fmtDate(referenceDay)}
        </div>
      </div>

      {/* ── Auth / abonnement / quota ── */}
      {authError && (
        <div style={{ padding:'20px', background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.22)', borderRadius:'10px', fontSize:'13px', color:'#f59e0b', lineHeight:'1.7' }}>
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

      {/* ── Aucun trade hier ── */}
      {noTrades && !authError && !generating && (
        <div style={{ padding:'20px', background:`${P.bg}0.40)`, border:`1px solid ${P.border}0.10)`, borderRadius:'10px', textAlign:'center' }}>
          <div style={{ fontSize:'28px', marginBottom:'10px' }}>📊</div>
          <div style={{ fontSize:'14px', color:P.text2 }}>Aucun trade enregistré le {fmtDate(referenceDay)}.</div>
          <div style={{ fontSize:'12px', color:P.text3, marginTop:'4px' }}>Pas d'analyse disponible pour ce jour.</div>
        </div>
      )}

      {/* ── Skeleton chargement ── */}
      {generating && !report && (
        <div style={{ borderRadius:'12px', border:`1px solid ${P.border}0.12)`, background:`${P.bg}0.40)`, padding:'24px' }}>
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

      {/* ── Portrait IA ── */}
      {report && (
        <div style={{ borderRadius:'14px', overflow:'hidden', border:`1px solid rgba(${rgb},0.30)`, background:'rgba(14,15,22,0.5)' }}>
          {/* Bandeau-badge */}
          <div style={{ padding:'20px 24px', background:`linear-gradient(135deg, rgba(${rgb},0.22), rgba(${rgb},0.05))`, borderBottom:`1px solid rgba(${rgb},0.25)` }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                <div style={{ width:'52px', height:'52px', borderRadius:'12px', background:`rgba(${rgb},0.18)`, border:`1px solid rgba(${rgb},0.45)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <ToneIcon tone={emotionTone(report.emotion)} color={color} />
                </div>
                <div>
                  <div style={{ fontSize:'22px', fontWeight:'800', color, letterSpacing:'-0.3px', lineHeight:1.15 }}>{report.emotion}</div>
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
            {/* Indicateurs compacts */}
            {stats && (
              <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
                <MiniStat label="WIN RATE" value={`${stats.winrate.toFixed(0)}%`} />
                <MiniStat label="PROFIT FACTOR" value={stats.profitFactor === 999 ? '∞' : stats.profitFactor.toFixed(2)} />
                <MiniStat label="SÉRIE" value={stats.streak > 0 ? `${stats.streak} 🟢` : stats.streak < 0 ? `${Math.abs(stats.streak)} 🔴` : '—'} />
              </div>
            )}

            {/* Contenu analyse */}
            <div>{renderDescription(report.text)}</div>

            {/* Pied */}
            <div style={{ marginTop:'22px', paddingTop:'14px', borderTop:`1px solid ${P.border}0.08)`, display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:color, boxShadow:`0 0 5px ${color}` }} />
              <span style={{ fontSize:'11px', color:P.text4 }}>
                Généré par Claude · {fmtDate(report.date)} · {new Date(report.generatedAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Historique IA ── */}
      {recentReports.length > 0 && (
        <div style={{ marginTop:'24px' }}>
          <button onClick={() => setShowHistory(h => !h)}
            style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'0', background:'none', border:'none', cursor:'pointer', marginBottom:'10px' }}>
            <div style={{ height:'1px', flex:1, background:`${P.border}0.10)` }} />
            <span style={{ fontSize:'10px', color:P.text3, letterSpacing:'2.5px', fontWeight:'700', whiteSpace:'nowrap' }}>
              {showHistory ? '▲' : '▼'} ANALYSES PRÉCÉDENTES ({recentReports.length})
            </span>
            <div style={{ height:'1px', flex:1, background:`${P.border}0.10)` }} />
          </button>

          {showHistory && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {recentReports.map(r => {
                const c  = EMOTION_COLORS[r.emotion] ?? P.text2;
                const em = EMOTION_EMOJI[r.emotion]  ?? '🧠';
                return <PastCard key={r.date} report={r} color={c} emoji={em} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Carte historique ──────────────────────────────────────────
function PastCard({ report, color, emoji }) {
  const [open, setOpen] = useState(false);
  const rgb = color==='#00cc77'?'0,204,119':color==='#f59e0b'?'245,158,11':color==='#ff3344'?'255,51,68':'136,153,187';

  function renderBlocks(text) {
    if (!text) return null;
    return text.split(/\n\n+/).map((block, i) => {
      const lines    = block.trim().split('\n');
      const isTitle  = ['ÉTAT ÉMOTIONNEL','PATTERNS','FOCUS'].some(t => lines[0]?.toUpperCase().includes(t));
      if (isTitle) return (
        <div key={i} style={{ marginBottom:'10px' }}>
          <div style={{ fontSize:'9px', color, letterSpacing:'2px', fontWeight:'700', marginBottom:'4px', opacity:0.7 }}>{lines[0]}</div>
          <div style={{ fontSize:'12px', color:'#dde4ef', lineHeight:'1.7' }}>{lines.slice(1).join('\n')}</div>
        </div>
      );
      return <div key={i} style={{ fontSize:'12px', color:'#dde4ef', lineHeight:'1.7', marginBottom:'10px' }}>{block.trim()}</div>;
    });
  }

  return (
    <div style={{ background:`rgba(14,15,22,0.40)`, border:`1px solid rgba(${rgb},0.14)`, borderRadius:'8px', overflow:'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', cursor:'pointer' }}>
        <span style={{ fontSize:'16px', flexShrink:0 }}>{emoji}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'12px', color:'#dde4ef', fontWeight:'600' }}>
            {new Date(report.date+'T12:00:00').toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' })}
          </div>
          <div style={{ fontSize:'11px', color, fontWeight:'600', marginTop:'1px' }}>{report.emotion}</div>
        </div>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4a5a72" strokeWidth="2">
          <polyline points={open?'18 15 12 9 6 15':'6 9 12 15 18 9'}/>
        </svg>
      </div>
      {open && (
        <div style={{ padding:'0 16px 14px', borderTop:'1px solid rgba(136,153,187,0.08)' }}>
          <div style={{ paddingTop:'12px' }}>{renderBlocks(report.text)}</div>
          <div style={{ fontSize:'10px', color:'#2c3c54', marginTop:'8px' }}>
            Généré · {new Date(report.generatedAt).toLocaleTimeString('fr-FR',{ hour:'2-digit', minute:'2-digit' })}
          </div>
        </div>
      )}
    </div>
  );
}
