import { useState, useEffect, useRef } from 'react';

// ── Palette ───────────────────────────────────────────────────
const P = {
  bg:      'rgba(14,15,22,',
  border:  'rgba(136,153,187,',
  text1:   '#dde4ef',
  text2:   '#8898aa',
  text3:   '#4a5a72',
  text4:   '#2c3c54',
  accent:  '#7c3aed',
  accentL: '#a78bfa',
  green:   '#00cc77',
  amber:   '#f59e0b',
  red:     '#ff3344',
};

// ── Questions ─────────────────────────────────────────────────
const DEFAULT_QUESTIONS = [
  { id:'q1', text:"J'ai bien dormi cette nuit (7h+)",          type:'yn',    positive:true  },
  { id:'q2', text:'Je me sens concentré et reposé',            type:'yn',    positive:true  },
  { id:'q3', text:"J'ai respecté mon plan de trading hier",    type:'yn',    positive:true  },
  { id:'q4', text:'Je ressens de la peur ou du stress',        type:'yn',    positive:false },
  { id:'q5', text:'Je veux trader pour récupérer des pertes',  type:'yn',    positive:false },
  { id:'q6', text:'Mon niveau de confiance aujourd\'hui',      type:'scale', positive:true  },
  { id:'q7', text:'Mon niveau de stress',                      type:'scale', positive:false },
  { id:'q8', text:"J'ai fait de l'exercice ce matin",          type:'yn',    positive:true  },
];

// ── Storage ───────────────────────────────────────────────────
const SK_Q   = 'emotional_custom_questions';
const SK_H   = 'emotional_history';
const SK_AI  = 'mental_ai_reports';   // [{ date, text, emotion, generatedAt }]

function loadQ()  { try { return JSON.parse(localStorage.getItem(SK_Q)  ?? 'null') ?? DEFAULT_QUESTIONS; } catch { return DEFAULT_QUESTIONS; } }
function loadH()  { try { return JSON.parse(localStorage.getItem(SK_H)  ?? '[]'); }  catch { return []; } }
function loadAI() { try { return JSON.parse(localStorage.getItem(SK_AI) ?? '[]'); }  catch { return []; } }
function saveQ(v) { localStorage.setItem(SK_Q,  JSON.stringify(v)); }
function saveH(v) { localStorage.setItem(SK_H,  JSON.stringify(v.slice(0,60))); }
function saveAI(v){ localStorage.setItem(SK_AI, JSON.stringify(v.slice(0,60))); }

// ── Helpers ───────────────────────────────────────────────────
function computeScore(questions, answers) {
  let s=0, max=0;
  questions.forEach(q => {
    if (q.type==='yn')    { max+=10; const v=answers[q.id]; s+=v==='yes'?(q.positive?10:0):v==='no'?(q.positive?0:10):0; }
    if (q.type==='scale') { max+=10; const v=parseInt(answers[q.id]??5); s+=q.positive?v:10-v; }
  });
  return max>0 ? Math.round((s/max)*100) : 0;
}

function getAdvice(score) {
  if (score>=85) return { emoji:'🔥', label:'État optimal',   color:P.green,  text:'Tu es dans les meilleures conditions. Fais confiance à ton plan.' };
  if (score>=70) return { emoji:'✅', label:'Bon état',       color:'#00aa66', text:'Conditions favorables. Reste vigilant et respecte tes niveaux.' };
  if (score>=50) return { emoji:'⚡', label:'État moyen',     color:P.amber,   text:'Quelques signaux d\'alerte. Réduis ta taille de position.' };
  if (score>=30) return { emoji:'⚠️', label:'État fragile',  color:'#e07010', text:'Plusieurs facteurs négatifs. Envisage la simulation.' };
  return            { emoji:'🛑', label:'Ne pas trader',      color:P.red,     text:'Ton état n\'est pas propice au trading. Prends une pause.' };
}

function getPreviousTradingDay() {
  const d = new Date();
  do { d.setDate(d.getDate()-1); } while ([0,6].includes(d.getDay())); // skip weekend
  return d.toISOString().slice(0,10);
}

function isWeekday() { const d = new Date().getDay(); return d>=1 && d<=5; }

function fmtDate(dateStr) {
  return new Date(dateStr+'T12:00:00').toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' });
}

function buildEmotionPrompt(trades, date) {
  const pnl     = trades.reduce((s,t)=>(s+(t.result_net??t.result??0)),0);
  const wins    = trades.filter(t=>(t.result_net??t.result??0)>0);
  const losses  = trades.filter(t=>(t.result_net??t.result??0)<0);
  const wr      = trades.length>0 ? Math.round(wins.length/trades.length*100) : 0;
  const maxWin  = wins.length>0  ? Math.max(...wins.map(t=>t.result_net??t.result??0))  : 0;
  const maxLoss = losses.length>0 ? Math.min(...losses.map(t=>t.result_net??t.result??0)) : 0;
  const pairs   = [...new Set(trades.map(t=>t.pair).filter(Boolean))];

  // Detect patterns
  let sorted = [...trades].sort((a,b)=>(a.entered_at??a.date??'').localeCompare(b.entered_at??b.date??''));
  let consBefore=0; for (const t of sorted) { if((t.result_net??t.result??0)<0) consBefore++; else consBefore=0; }

  const tradeSummary = sorted.map(t=>{
    const p=t.result_net??t.result??0;
    return `${t.pair} ${t.direction} ${p>=0?'+':''}${p.toFixed(2)}$`;
  }).join(' | ');

  return `Tu es un expert en psychologie du trading. Analyse la journée de trading du ${fmtDate(date)} et génère un portrait émotionnel et psychologique du trader.

DONNÉES DE LA JOURNÉE:
- Date: ${date} (${fmtDate(date)})
- Total trades: ${trades.length}
- PnL net: ${pnl>=0?'+':''}${pnl.toFixed(2)}$
- Winrate: ${wr}% (${wins.length}W / ${losses.length}L)
- Plus gros gain: +${maxWin.toFixed(2)}$
- Plus grosse perte: ${maxLoss.toFixed(2)}$
- Instruments: ${pairs.join(', ')||'—'}
- Séquence des trades: ${tradeSummary||'—'}
- Pertes consécutives fin de séance: ${consBefore}

INSTRUCTIONS:
Génère une analyse psychologique courte en 3 parties:
1. ÉTAT ÉMOTIONNEL probable pendant la séance (2 phrases — describe the emotional journey based on the trade sequence)
2. PATTERNS PSYCHOLOGIQUES identifiés (2 phrases — fear, greed, discipline, revenge trading, overconfidence, etc.)
3. FOCUS POUR AUJOURD'HUI (1 phrase actionnable concrète)

Format de réponse — JSON pur, pas de markdown:
{"emotion":"[UN MOT: Discipliné|Stressé|Surconfiant|Impulsif|Focalisé|Fragile|Serein|Vengeur]","description":"[texte 5-6 phrases]"}

La description doit être empathique, précise et en français.`;
}

// ── AI Report Card ────────────────────────────────────────────
const EMOTION_COLORS = {
  'Discipliné': P.green,  'Serein':     P.green,
  'Focalisé':  '#00aaff', 'Stressé':    P.amber,
  'Fragile':   P.amber,   'Surconfiant':'#e05010',
  'Impulsif':  P.red,     'Vengeur':    P.red,
};
const EMOTION_EMOJI = {
  'Discipliné':'🧘', 'Serein':'😌', 'Focalisé':'🎯',
  'Stressé':'😰',   'Fragile':'⚠️', 'Surconfiant':'😤',
  'Impulsif':'⚡',  'Vengeur':'😡',
};

function AiReportCard({ report, onRegenerate, generating }) {
  const color = EMOTION_COLORS[report.emotion] ?? P.text2;
  const emoji = EMOTION_EMOJI[report.emotion] ?? '🧠';
  const rgb   = color==='#00cc77'?'0,204,119':color==='#f59e0b'?'245,158,11':color==='#ff3344'?'255,51,68':'136,153,187';

  return (
    <div style={{ borderRadius:'12px', overflow:'hidden', border:`1px solid ${color}28`, background:`rgba(${rgb},0.04)` }}>
      {/* Top band */}
      <div style={{ height:'3px', background:`linear-gradient(90deg,transparent,${color},transparent)` }} />

      <div style={{ padding:'20px 22px' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'42px', height:'42px', borderRadius:'10px', background:`rgba(${rgb},0.12)`, border:`1px solid ${color}35`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>{emoji}</div>
            <div>
              <div style={{ fontSize:'11px', color:P.text3, letterSpacing:'2px', marginBottom:'2px' }}>PORTRAIT PSYCHOLOGIQUE — {fmtDate(report.date).toUpperCase()}</div>
              <div style={{ fontSize:'17px', fontWeight:'700', color }}>
                {report.emotion ?? 'Analyse IA'}
              </div>
            </div>
          </div>
          <button onClick={onRegenerate} disabled={generating}
            style={{ padding:'5px 12px', borderRadius:'5px', background:'transparent', border:`1px solid ${P.border}0.15)`, color:P.text3, fontSize:'11px', fontFamily:'inherit', cursor:generating?'wait':'pointer', transition:'all 0.15s', opacity:generating?0.5:1 }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=`${P.border}0.40)`; e.currentTarget.style.color=P.text1; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=`${P.border}0.15)`; e.currentTarget.style.color=P.text3; }}>
            {generating ? '...' : '↺ Régénérer'}
          </button>
        </div>

        {/* Description */}
        <div style={{ fontSize:'14px', color:P.text1, lineHeight:'1.8', whiteSpace:'pre-line' }}>
          {report.text}
        </div>

        {/* Footer */}
        <div style={{ marginTop:'14px', paddingTop:'12px', borderTop:`1px solid ${P.border}0.08)`, display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:color, boxShadow:`0 0 6px ${color}` }} />
          <span style={{ fontSize:'11px', color:P.text3 }}>Généré par Claude · {new Date(report.generatedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
        </div>
      </div>
    </div>
  );
}

function AiReportSkeleton() {
  return (
    <div style={{ borderRadius:'12px', border:`1px solid ${P.border}0.12)`, background:`${P.bg}0.40)`, padding:'20px 22px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
        <div style={{ width:'42px', height:'42px', borderRadius:'10px', background:`${P.border}0.08)`, animation:'pulse 1.5s ease infinite' }} />
        <div>
          <div style={{ height:'10px', width:'200px', background:`${P.border}0.08)`, borderRadius:'4px', marginBottom:'8px', animation:'pulse 1.5s ease infinite' }} />
          <div style={{ height:'16px', width:'120px', background:`${P.border}0.08)`, borderRadius:'4px', animation:'pulse 1.5s ease 0.2s infinite' }} />
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {[100,85,95,60].map((w,i) => (
          <div key={i} style={{ height:'12px', width:`${w}%`, background:`${P.border}0.06)`, borderRadius:'4px', animation:`pulse 1.5s ease ${i*0.15}s infinite` }} />
        ))}
      </div>
      <div style={{ marginTop:'16px', fontSize:'12px', color:P.text3, display:'flex', alignItems:'center', gap:'8px' }}>
        <span style={{ display:'inline-block', animation:'pulse 1.5s ease infinite' }}>●</span>
        Génération en cours...
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function EmotionalCheck() {
  const [tab,       setTab]       = useState('today');
  const [questions, setQuestions] = useState(loadQ);
  const [answers,   setAnswers]   = useState({});
  const [notes,     setNotes]     = useState('');
  const [history,   setHistory]   = useState(loadH);
  const [aiReports, setAiReports] = useState(loadAI);
  const [saved,     setSaved]     = useState(false);
  const [generating,setGenerating]= useState(false);
  const [hasKey,    setHasKey]    = useState(true);
  const [newQ,      setNewQ]      = useState({ text:'', type:'yn', positive:true });

  const today     = new Date().toISOString().slice(0,10);
  const prevDay   = getPreviousTradingDay();
  const todayEntry= history.find(h=>h.date===today);
  const prevReport= aiReports.find(r=>r.date===prevDay);
  const score     = computeScore(questions, answers);
  const advice    = getAdvice(score);

  // ── Auto-generate AI report on mount ──────────────────────
  useEffect(() => {
    if (!isWeekday()) return;
    if (prevReport) return; // already exists

    async function generate() {
      const keyRes = await window.ai.hasKey();
      if (!keyRes.data) { setHasKey(false); return; }
      const tradesRes = await window.db.getAllTrades();
      if (!tradesRes.ok) return;
      const prevTrades = (tradesRes.data ?? []).filter(t => (t.date||'').startsWith(prevDay));
      if (prevTrades.length === 0) return; // no trades yesterday, skip
      await generateReport(prevTrades, prevDay);
    }

    generate();
  }, []);

  async function generateReport(trades, date) {
    setGenerating(true);
    try {
      const prompt = buildEmotionPrompt(trades, date);
      const res = await window.ai.chat(
        [{ role:'user', content: prompt }],
        'Tu es un expert en psychologie du trading. Réponds uniquement en JSON valide, sans markdown.'
      );
      if (!res.ok) throw new Error(res.error);
      let parsed;
      try {
        const txt = res.data.trim().replace(/^```json\n?/,'').replace(/\n?```$/,'');
        parsed = JSON.parse(txt);
      } catch {
        // fallback: extract JSON from response
        const match = res.data.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { emotion:'Analysé', description: res.data };
      }
      const report = {
        date,
        emotion: parsed.emotion ?? 'Analysé',
        text:    parsed.description ?? parsed.text ?? res.data,
        generatedAt: new Date().toISOString(),
      };
      setAiReports(prev => {
        const updated = [report, ...prev.filter(r=>r.date!==date)];
        saveAI(updated);
        return updated;
      });
    } catch (e) {
      console.error('AI report error:', e);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    const tradesRes = await window.db.getAllTrades();
    if (!tradesRes.ok) return;
    const prevTrades = (tradesRes.data ?? []).filter(t => (t.date||'').startsWith(prevDay));
    await generateReport(prevTrades, prevDay);
  }

  function setAnswer(id, val) { setAnswers(p => ({ ...p, [id]: val })); }

  function handleSave() {
    const entry = { date:today, score, answers:{...answers}, notes, savedAt:new Date().toISOString() };
    const h = [entry, ...history.filter(h=>h.date!==today)];
    saveH(h); setHistory(h); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function addQuestion() {
    if (!newQ.text.trim()) return;
    const q = { id:`custom_${Date.now()}`, ...newQ };
    const u = [...questions, q]; setQuestions(u); saveQ(u);
    setNewQ({ text:'', type:'yn', positive:true });
  }

  function removeQuestion(id) { const u=questions.filter(q=>q.id!==id); setQuestions(u); saveQ(u); }
  function resetQuestions()   { setQuestions(DEFAULT_QUESTIONS); saveQ(DEFAULT_QUESTIONS); }

  const inp = { background:`${P.bg}0.60)`, border:`1px solid ${P.border}0.14)`, borderRadius:'5px', padding:'8px 10px', color:P.text1, fontSize:'13px', fontFamily:'inherit', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' };

  return (
    <div style={{ padding:'24px 28px', maxWidth:'none' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ fontSize:'11px', color:P.text3, letterSpacing:'3px', marginBottom:'5px' }}>TRADING PSYCHOLOGY</div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:P.text1, margin:0, letterSpacing:'-0.5px' }}>État Mental</h1>
          <div style={{ fontSize:'13px', color:P.text3, marginTop:'3px' }}>
            {new Date().toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' })}
            {todayEntry && <span style={{ color:P.green, marginLeft:'10px' }}>✓ Bilan complété — {todayEntry.score}%</span>}
          </div>
        </div>
        {!hasKey && (
          <div style={{ padding:'8px 14px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:'6px', fontSize:'12px', color:'#f59e0b' }}>
            ⚠ Clé API requise pour l'analyse IA
          </div>
        )}
      </div>

      {/* ── AI Report section (always visible on weekdays) ── */}
      {isWeekday() && (
        <div style={{ marginBottom:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
            <div style={{ height:'1px', flex:1, background:`${P.border}0.10)` }} />
            <span style={{ fontSize:'10px', color:P.text3, letterSpacing:'2.5px', fontWeight:'700' }}>ANALYSE IA — VEILLE</span>
            <div style={{ height:'1px', flex:1, background:`${P.border}0.10)` }} />
          </div>

          {generating && !prevReport && <AiReportSkeleton />}

          {prevReport && (
            <AiReportCard report={prevReport} onRegenerate={handleRegenerate} generating={generating} />
          )}

          {!generating && !prevReport && !hasKey && (
            <div style={{ padding:'16px 20px', background:`${P.bg}0.40)`, border:`1px solid ${P.border}0.10)`, borderRadius:'10px', fontSize:'13px', color:P.text3, textAlign:'center' }}>
              Configure ta clé API Anthropic dans le chat IA pour activer l'analyse psychologique automatique.
            </div>
          )}

          {!generating && !prevReport && hasKey && (
            <div style={{ padding:'16px 20px', background:`${P.bg}0.40)`, border:`1px solid ${P.border}0.10)`, borderRadius:'10px', fontSize:'13px', color:P.text3, textAlign:'center' }}>
              Aucun trade enregistré hier ({fmtDate(prevDay)}) — pas d'analyse disponible.
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'20px', background:`${P.bg}0.50)`, border:`1px solid ${P.border}0.12)`, borderRadius:'8px', padding:'4px' }}>
        {[
          { key:'today',   label:'🧠 Bilan du jour' },
          { key:'history', label:'📅 Historique' },
          { key:'edit',    label:'⚙ Personnaliser' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{ flex:1, padding:'9px', borderRadius:'5px', border:'none', cursor:'pointer', background:tab===key?`${P.border}0.12)`:'transparent', color:tab===key?P.text1:P.text3, fontSize:'13px', fontFamily:'inherit', fontWeight:tab===key?'700':'400', transition:'all 0.15s', letterSpacing:'0.3px' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── BILAN DU JOUR ── */}
      {tab==='today' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>

          {/* Score banner */}
          <div style={{ background:`rgba(${score>=70?'0,204,119':score>=50?'245,158,11':'255,51,68'},0.06)`, border:`1px solid rgba(${score>=70?'0,204,119':score>=50?'245,158,11':'255,51,68'},0.20)`, borderRadius:'10px', padding:'16px 20px', display:'flex', alignItems:'center', gap:'16px' }}>
            <div style={{ fontSize:'32px', flexShrink:0 }}>{advice.emoji}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:'10px', marginBottom:'5px' }}>
                <span style={{ fontSize:'15px', fontWeight:'700', color:advice.color }}>{advice.label}</span>
                <span style={{ fontSize:'22px', fontWeight:'700', color:advice.color }}>{score}%</span>
              </div>
              <div style={{ fontSize:'13px', color:P.text2, lineHeight:'1.5', marginBottom:'8px' }}>{advice.text}</div>
              <div style={{ height:'4px', background:`${P.border}0.08)`, borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${score}%`, background:advice.color, borderRadius:'2px', transition:'width 0.6s ease', boxShadow:`0 0 8px ${advice.color}50` }} />
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontSize:'20px', fontWeight:'700', color:P.text3 }}>{questions.filter(q=>answers[q.id]!=null).length}/{questions.length}</div>
              <div style={{ fontSize:'11px', color:P.text4, letterSpacing:'1px' }}>RÉPONSES</div>
            </div>
          </div>

          {/* Questions */}
          {questions.map(q => (
            <QuestionCard key={q.id} q={q} answer={answers[q.id]} onChange={setAnswer} answers={answers} inp={inp} />
          ))}

          {/* Notes */}
          <div style={{ background:`${P.bg}0.40)`, border:`1px solid ${P.border}0.10)`, borderRadius:'8px', padding:'14px 16px' }}>
            <div style={{ fontSize:'13px', color:P.text2, marginBottom:'8px', fontWeight:'600' }}>📝 Notes libres</div>
            <textarea placeholder="Comment tu te sens ? Événements particuliers ?"
              value={notes} onChange={e=>setNotes(e.target.value)}
              style={{ ...inp, width:'100%', resize:'vertical', minHeight:'72px' }} />
          </div>

          <button onClick={handleSave} style={{ padding:'12px', borderRadius:'6px', background:saved?'rgba(0,204,119,0.12)':'rgba(136,153,187,0.10)', border:`1px solid rgba(${saved?'0,204,119':'136,153,187'},0.30)`, color:saved?P.green:P.text2, fontSize:'13px', fontFamily:'inherit', fontWeight:'700', letterSpacing:'1.5px', cursor:'pointer', transition:'all 0.2s' }}>
            {saved ? '✓ BILAN ENREGISTRÉ' : '💾 ENREGISTRER MON BILAN'}
          </button>
        </div>
      )}

      {/* ── HISTORIQUE ── */}
      {tab==='history' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {history.length===0 && aiReports.length===0 ? (
            <div style={{ padding:'48px', textAlign:'center', border:`1px dashed ${P.border}0.15)`, borderRadius:'8px', color:P.text4, fontSize:'13px', letterSpacing:'2px' }}>
              Aucun bilan enregistré
            </div>
          ) : (
            <>
              {/* Stats */}
              {history.length>0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'8px', marginBottom:'6px' }}>
                  {[
                    { l:'BILANS TOTAL', v:history.length, c:P.text1 },
                    { l:'SCORE MOYEN',  v:`${Math.round(history.reduce((s,h)=>s+h.score,0)/history.length)}%`, c:P.text2 },
                    { l:'SCORE MAX',    v:`${Math.max(...history.map(h=>h.score))}%`, c:P.green },
                    { l:'ANALYSES IA',  v:aiReports.length, c:P.accentL },
                  ].map(({l,v,c}) => (
                    <div key={l} style={{ background:`${P.bg}0.50)`, border:`1px solid ${P.border}0.10)`, borderRadius:'6px', padding:'10px 14px' }}>
                      <div style={{ fontSize:'10px', color:P.text3, letterSpacing:'1.5px', marginBottom:'3px' }}>{l}</div>
                      <div style={{ fontSize:'18px', fontWeight:'700', color:c }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Merged history list */}
              {(() => {
                const allDates = [...new Set([
                  ...history.map(h=>h.date),
                  ...aiReports.map(r=>r.date),
                ])].sort((a,b)=>b.localeCompare(a));

                return allDates.map(date => {
                  const hEntry  = history.find(h=>h.date===date);
                  const aiEntry = aiReports.find(r=>r.date===date);
                  return <HistoryCard key={date} date={date} hEntry={hEntry} aiEntry={aiEntry} questions={questions} />;
                });
              })()}
            </>
          )}
        </div>
      )}

      {/* ── PERSONNALISER ── */}
      {tab==='edit' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ padding:'10px 14px', background:`rgba(124,58,237,0.06)`, border:`1px solid rgba(124,58,237,0.18)`, borderRadius:'6px', fontSize:'12px', color:P.accentL }}>
            ℹ Personnalisez vos questions. Les modifications sont sauvegardées automatiquement.
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            {questions.map((q,i) => (
              <div key={q.id} style={{ display:'flex', alignItems:'center', gap:'10px', background:`${P.bg}0.40)`, border:`1px solid ${P.border}0.08)`, borderRadius:'5px', padding:'10px 14px' }}>
                <span style={{ fontSize:'11px', color:P.text4, width:'20px', flexShrink:0 }}>#{i+1}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', color:P.text1 }}>{q.text}</div>
                  <div style={{ fontSize:'11px', color:P.text3, marginTop:'2px' }}>
                    {q.type==='yn'?'Oui/Non':q.type==='scale'?'Échelle 1-10':'Texte'} · {q.positive?'Positif ↑':'Négatif ↓'}
                  </div>
                </div>
                <button onClick={() => removeQuestion(q.id)} style={{ background:'none', border:'none', color:P.text4, cursor:'pointer', fontSize:'18px', padding:'0', transition:'color 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.color=P.red}
                  onMouseLeave={e=>e.currentTarget.style.color=P.text4}>×</button>
              </div>
            ))}
          </div>
          <div style={{ background:`${P.bg}0.40)`, border:`1px solid ${P.border}0.12)`, borderRadius:'8px', padding:'14px' }}>
            <div style={{ fontSize:'10px', color:P.text3, letterSpacing:'2px', marginBottom:'10px' }}>+ AJOUTER UNE QUESTION</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <input placeholder="Texte de la question..." value={newQ.text} onChange={e=>setNewQ(p=>({...p,text:e.target.value}))} style={{ ...inp, width:'100%' }} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                <div>
                  <div style={{ fontSize:'10px', color:P.text3, marginBottom:'5px', letterSpacing:'1px' }}>TYPE</div>
                  <div style={{ display:'flex', gap:'4px' }}>
                    {[['yn','Oui/Non'],['scale','Échelle'],['text','Texte']].map(([v,l]) => (
                      <button key={v} onClick={() => setNewQ(p=>({...p,type:v}))} style={{ flex:1, padding:'5px 4px', borderRadius:'4px', border:`1px solid ${newQ.type===v?P.border+'0.45)':P.border+'0.12)'}`, background:newQ.type===v?`${P.border}0.12)`:'transparent', color:newQ.type===v?P.text1:P.text3, fontSize:'11px', fontFamily:'inherit', cursor:'pointer' }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:'10px', color:P.text3, marginBottom:'5px', letterSpacing:'1px' }}>IMPACT</div>
                  <div style={{ display:'flex', gap:'4px' }}>
                    {[[true,'✅ Positif'],[false,'⚠ Négatif']].map(([v,l]) => (
                      <button key={String(v)} onClick={() => setNewQ(p=>({...p,positive:v}))} style={{ flex:1, padding:'5px 4px', borderRadius:'4px', border:`1px solid ${newQ.positive===v?(v?'rgba(0,204,119,0.40)':'rgba(255,51,68,0.40)'):P.border+'0.12)'}`, background:newQ.positive===v?`rgba(${v?'0,204,119':'255,51,68'},0.10)`:'transparent', color:newQ.positive===v?(v?P.green:P.red):P.text3, fontSize:'11px', fontFamily:'inherit', cursor:'pointer' }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={addQuestion} disabled={!newQ.text.trim()} style={{ padding:'8px', borderRadius:'5px', background:`${P.border}0.10)`, border:`1px solid ${P.border}0.22)`, color:P.text2, fontSize:'12px', fontFamily:'inherit', fontWeight:'700', cursor:'pointer' }}>
                + AJOUTER
              </button>
            </div>
          </div>
          <button onClick={() => { if(window.confirm('Remettre les questions par défaut ?')) resetQuestions(); }}
            style={{ padding:'8px', borderRadius:'5px', background:'transparent', border:`1px solid ${P.border}0.12)`, color:P.text3, fontSize:'12px', fontFamily:'inherit', cursor:'pointer' }}>
            Remettre les questions par défaut
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────
function QuestionCard({ q, answer, onChange, answers, inp }) {
  return (
    <div style={{ background:`rgba(14,15,22,0.40)`, border:`1px solid rgba(136,153,187,0.10)`, borderRadius:'8px', padding:'14px 16px' }}>
      <div style={{ fontSize:'13px', color:'#dde4ef', marginBottom:'10px', lineHeight:'1.5' }}>{q.text}</div>
      {q.type==='yn' && (
        <div style={{ display:'flex', gap:'6px' }}>
          {['yes','no','autre'].map(v => {
            const c = v==='yes'?'#8899bb':v==='no'?'#ff3344':'#f59e0b';
            const l = { yes:'Oui', no:'Non', autre:'Autre' }[v];
            return (
              <button key={v} onClick={() => onChange(q.id, answer===v?null:v)}
                style={{ padding:'6px 14px', borderRadius:'4px', border:`1px solid ${answer===v?c:'rgba(136,153,187,0.14)'}`, background:answer===v?`rgba(${v==='yes'?'136,153,187':v==='no'?'255,51,68':'245,158,11'},0.12)`:'transparent', color:answer===v?c:'#6878a0', fontSize:'12px', fontFamily:'inherit', fontWeight:answer===v?'700':'400', cursor:'pointer', transition:'all 0.15s' }}>
                {l}
              </button>
            );
          })}
        </div>
      )}
      {q.type==='scale' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#5a6a82' }}>
            <span>Faible</span>
            <span style={{ color:'#dde4ef', fontWeight:'700' }}>{answer??5}/10</span>
            <span>Élevé</span>
          </div>
          <input type="range" min="1" max="10" value={answer??5} onChange={e=>onChange(q.id,e.target.value)}
            style={{ width:'100%', accentColor:'#7c3aed', cursor:'pointer' }} />
        </div>
      )}
      {q.type==='text' && (
        <textarea placeholder="Réponse libre..." value={answer??''} onChange={e=>onChange(q.id,e.target.value)}
          style={{ ...inp, width:'100%', resize:'vertical', minHeight:'60px' }} />
      )}
      {q.type==='yn' && answer==='autre' && (
        <textarea placeholder="Précise ta réponse..." value={answers?.[q.id+'_autre']??''} onChange={e=>onChange(q.id+'_autre',e.target.value)}
          style={{ ...inp, marginTop:'8px', width:'100%', resize:'vertical', minHeight:'50px' }} />
      )}
    </div>
  );
}

function HistoryCard({ date, hEntry, aiEntry, questions }) {
  const [open, setOpen] = useState(false);
  const advice  = hEntry ? getAdvice(hEntry.score) : null;
  const aiColor = aiEntry ? (EMOTION_COLORS[aiEntry.emotion] ?? '#8899bb') : null;
  const aiEmoji = aiEntry ? (EMOTION_EMOJI[aiEntry.emotion] ?? '🧠') : null;

  return (
    <div style={{ background:`rgba(14,15,22,0.40)`, border:`1px solid rgba(136,153,187,0.08)`, borderRadius:'8px', overflow:'hidden' }}>
      <div onClick={() => setOpen(o=>!o)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'16px' }}>{aiEmoji ?? advice?.emoji ?? '📅'}</span>
          <div>
            <div style={{ fontSize:'13px', color:'#dde4ef', fontWeight:'600' }}>{fmtDate(date)}</div>
            <div style={{ display:'flex', gap:'8px', marginTop:'2px' }}>
              {aiEntry  && <span style={{ fontSize:'11px', color:aiColor, fontWeight:'600' }}>{aiEntry.emotion}</span>}
              {hEntry   && <span style={{ fontSize:'11px', color:advice?.color }}>{advice?.label} · {hEntry.score}%</span>}
              {!hEntry  && aiEntry && <span style={{ fontSize:'11px', color:'#3a4a5a' }}>questionnaire non complété</span>}
            </div>
          </div>
        </div>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4a5a72" strokeWidth="2">
          <polyline points={open?'18 15 12 9 6 15':'6 9 12 15 18 9'}/>
        </svg>
      </div>

      {open && (
        <div style={{ padding:'0 16px 14px', borderTop:'1px solid rgba(136,153,187,0.08)' }}>
          {aiEntry && (
            <div style={{ margin:'10px 0 12px', padding:'12px 14px', background:`rgba(${aiColor==='#00cc77'?'0,204,119':aiColor==='#f59e0b'?'245,158,11':'136,153,187'},0.05)`, border:`1px solid ${aiColor}22`, borderRadius:'6px' }}>
              <div style={{ fontSize:'10px', color:'#4a5a72', letterSpacing:'2px', marginBottom:'6px' }}>PORTRAIT IA</div>
              <div style={{ fontSize:'12px', color:'#dde4ef', lineHeight:'1.7', whiteSpace:'pre-line' }}>{aiEntry.text}</div>
            </div>
          )}
          {hEntry && (
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              {questions.map(q => {
                const ans = hEntry.answers?.[q.id];
                if (!ans) return null;
                return (
                  <div key={q.id} style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', padding:'4px 8px', background:'rgba(14,15,22,0.4)', borderRadius:'4px' }}>
                    <span style={{ color:'#4a5a72' }}>{q.text}</span>
                    <span style={{ color:'#dde4ef', fontWeight:'700', marginLeft:'8px' }}>
                      {q.type==='scale'?`${ans}/10`:ans==='yes'?'Oui':ans==='no'?'Non':ans}
                    </span>
                  </div>
                );
              })}
              {hEntry.notes && (
                <div style={{ marginTop:'6px', padding:'8px', background:'rgba(14,15,22,0.4)', borderRadius:'4px', fontSize:'12px', color:'#5a6a82' }}>
                  📝 {hEntry.notes}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
