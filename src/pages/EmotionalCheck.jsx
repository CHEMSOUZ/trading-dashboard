import { useState, useEffect } from 'react';

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

const EMOTION_COLORS = {
  'Discipliné':'#00cc77', 'Serein':'#00cc77',
  'Focalisé':  '#00aaff', 'Stressé':'#f59e0b',
  'Fragile':   '#f59e0b', 'Surconfiant':'#e07010',
  'Impulsif':  '#ff3344', 'Vengeur':'#ff3344',
};
const EMOTION_EMOJI = {
  'Discipliné':'🧘', 'Serein':'😌', 'Focalisé':'🎯',
  'Stressé':'😰',   'Fragile':'⚠️','Surconfiant':'😤',
  'Impulsif':'⚡',  'Vengeur':'😡',
};

const SK_AI = 'mental_ai_reports';

function loadAI() { try { return JSON.parse(localStorage.getItem(SK_AI) ?? '[]'); } catch { return []; } }
function saveAI(v){ localStorage.setItem(SK_AI, JSON.stringify(v.slice(0,60))); }

// Retourne le dernier jour de trading (passe le week-end)
function getPreviousTradingDay() {
  const d = new Date();
  do { d.setDate(d.getDate() - 1); } while ([0, 6].includes(d.getDay()));
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
  const [aiReports,  setAiReports]  = useState(loadAI);
  const [generating, setGenerating] = useState(false);
  const [hasKey,     setHasKey]     = useState(true);
  const [noTrades,   setNoTrades]   = useState(false);
  const [showHistory,setShowHistory]= useState(false);

  const prevDay    = getPreviousTradingDay();
  const prevReport = aiReports.find(r => r.date === prevDay);

  // Auto-génération au montage
  useEffect(() => {
    if (prevReport) return;
    generate(false);
  }, []);

  async function generate(force = false) {
    if (generating) return;
    if (!force && prevReport) return;

    setGenerating(true);
    setNoTrades(false);

    try {
      const keyRes = await window.ai.hasKey();
      if (!keyRes.data) { setHasKey(false); setGenerating(false); return; }

      const tradesRes = await window.db.getAllTrades();
      const allTrades = tradesRes.ok ? (tradesRes.data ?? []) : [];
      const dayTrades = allTrades.filter(t => (t.date ?? '').startsWith(prevDay));

      if (dayTrades.length === 0) {
        setNoTrades(true);
        setGenerating(false);
        return;
      }

      const prompt = buildPrompt(dayTrades, prevDay);
      const res    = await window.ai.chat(
        [{ role: 'user', content: prompt }],
        'Tu es un expert en psychologie du trading. Réponds uniquement en JSON valide, sans markdown ni backticks.'
      );

      if (!res.ok) throw new Error(res.error);

      let parsed;
      try {
        const txt = res.data.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
        parsed = JSON.parse(txt);
      } catch {
        const m = res.data.match(/\{[\s\S]*\}/);
        parsed  = m ? JSON.parse(m[0]) : { emotion: 'Analysé', description: res.data };
      }

      const report = {
        date:        prevDay,
        emotion:     parsed.emotion     ?? 'Analysé',
        text:        parsed.description ?? parsed.text ?? res.data,
        generatedAt: new Date().toISOString(),
      };

      setAiReports(prev => {
        const updated = [report, ...prev.filter(r => r.date !== prevDay)];
        saveAI(updated);
        return updated;
      });
    } catch (e) {
      console.error('AI report error:', e);
    } finally {
      setGenerating(false);
    }
  }

  const report = prevReport;
  const color  = report ? (EMOTION_COLORS[report.emotion] ?? P.text2) : P.text3;
  const emoji  = report ? (EMOTION_EMOJI[report.emotion]  ?? '🧠')    : '🧠';

  const rgb = color === '#00cc77' ? '0,204,119'
            : color === '#f59e0b' ? '245,158,11'
            : color === '#ff3344' ? '255,51,68'
            : color === '#00aaff' ? '0,170,255'
            : color === '#e07010' ? '224,112,16'
            : '136,153,187';

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

  const pastReports = aiReports.filter(r => r.date !== prevDay).slice(0, 10);

  return (
    <div style={{ padding:'24px 28px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.35}50%{opacity:.9}}`}</style>

      {/* Header */}
      <div style={{ marginBottom:'28px' }}>
        <div style={{ fontSize:'11px', color:P.text3, letterSpacing:'3px', marginBottom:'5px' }}>TRADING PSYCHOLOGY</div>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:P.text1, margin:'0 0 3px', letterSpacing:'-0.5px' }}>État Mental</h1>
        <div style={{ fontSize:'13px', color:P.text3 }}>
          Bilan IA · {fmtDate(prevDay)}
        </div>
      </div>

      {/* ── Pas de clé API ── */}
      {!hasKey && (
        <div style={{ padding:'20px', background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.22)', borderRadius:'10px', fontSize:'13px', color:'#f59e0b', lineHeight:'1.7' }}>
          <div style={{ fontWeight:'700', marginBottom:'6px' }}>Clé API Anthropic requise</div>
          Configure ta clé dans le chat IA pour activer les portraits psychologiques automatiques.
        </div>
      )}

      {/* ── Aucun trade hier ── */}
      {noTrades && hasKey && !generating && (
        <div style={{ padding:'20px', background:`${P.bg}0.40)`, border:`1px solid ${P.border}0.10)`, borderRadius:'10px', textAlign:'center' }}>
          <div style={{ fontSize:'28px', marginBottom:'10px' }}>📊</div>
          <div style={{ fontSize:'14px', color:P.text2 }}>Aucun trade enregistré le {fmtDate(prevDay)}.</div>
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
            Claude analyse ta journée du {fmtDate(prevDay)}...
          </div>
        </div>
      )}

      {/* ── Portrait IA ── */}
      {report && (
        <div style={{ borderRadius:'14px', overflow:'hidden', border:`1px solid ${color}28`, background:`rgba(${rgb},0.04)` }}>
          {/* Bande supérieure */}
          <div style={{ height:'3px', background:`linear-gradient(90deg,transparent 0%,${color} 40%,${color} 60%,transparent 100%)` }} />

          <div style={{ padding:'24px 26px' }}>
            {/* En-tête émotion */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'22px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                <div style={{ width:'52px', height:'52px', borderRadius:'12px', background:`rgba(${rgb},0.12)`, border:`1px solid ${color}35`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', flexShrink:0 }}>
                  {emoji}
                </div>
                <div>
                  <div style={{ fontSize:'10px', color:P.text3, letterSpacing:'2.5px', marginBottom:'4px' }}>PORTRAIT PSYCHOLOGIQUE</div>
                  <div style={{ fontSize:'20px', fontWeight:'700', color, letterSpacing:'-0.3px' }}>{report.emotion}</div>
                  <div style={{ fontSize:'11px', color:P.text3, marginTop:'2px' }}>{fmtDate(report.date)}</div>
                </div>
              </div>
              <button onClick={() => generate(true)} disabled={generating}
                style={{ padding:'6px 14px', borderRadius:'6px', background:'transparent', border:`1px solid ${P.border}0.15)`, color:P.text3, fontSize:'11px', fontFamily:'inherit', cursor:generating?'wait':'pointer', transition:'all 0.15s', opacity:generating?0.4:1, flexShrink:0 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=`${P.border}0.40)`; e.currentTarget.style.color=P.text1; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=`${P.border}0.15)`; e.currentTarget.style.color=P.text3; }}>
                {generating ? '...' : '↺ Régénérer'}
              </button>
            </div>

            {/* Séparateur */}
            <div style={{ height:'1px', background:`linear-gradient(90deg,${color}30,${P.border}0.05),transparent)`, marginBottom:'22px' }} />

            {/* Contenu analyse */}
            <div>{renderDescription(report.text)}</div>

            {/* Pied */}
            <div style={{ marginTop:'22px', paddingTop:'14px', borderTop:`1px solid ${P.border}0.08)`, display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:color, boxShadow:`0 0 5px ${color}` }} />
              <span style={{ fontSize:'11px', color:P.text4 }}>
                Généré par Claude · {new Date(report.generatedAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Historique IA ── */}
      {pastReports.length > 0 && (
        <div style={{ marginTop:'24px' }}>
          <button onClick={() => setShowHistory(h => !h)}
            style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'0', background:'none', border:'none', cursor:'pointer', marginBottom:'10px' }}>
            <div style={{ height:'1px', flex:1, background:`${P.border}0.10)` }} />
            <span style={{ fontSize:'10px', color:P.text3, letterSpacing:'2.5px', fontWeight:'700', whiteSpace:'nowrap' }}>
              {showHistory ? '▲' : '▼'} ANALYSES PRÉCÉDENTES ({pastReports.length})
            </span>
            <div style={{ height:'1px', flex:1, background:`${P.border}0.10)` }} />
          </button>

          {showHistory && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {pastReports.map(r => {
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
