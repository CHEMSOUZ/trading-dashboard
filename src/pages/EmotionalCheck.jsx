import { useState, useEffect } from 'react';

// ── Default questions ─────────────────────────────────────────
const DEFAULT_QUESTIONS = [
  { id: 'q1', text: 'J\'ai bien dormi cette nuit (7h+)',             type: 'yn',    positive: true  },
  { id: 'q2', text: 'Je me sens concentré et reposé',               type: 'yn',    positive: true  },
  { id: 'q3', text: 'J\'ai respecté mon plan de trading hier',      type: 'yn',    positive: true  },
  { id: 'q4', text: 'Je ressens de la peur ou du stress',           type: 'yn',    positive: false },
  { id: 'q5', text: 'Je veux trader pour récupérer des pertes',     type: 'yn',    positive: false },
  { id: 'q6', text: 'Mon niveau de confiance aujourd\'hui',         type: 'scale', positive: true  },
  { id: 'q7', text: 'Mon niveau de stress',                         type: 'scale', positive: false },
  { id: 'q8', text: 'J\'ai fait de l\'exercice ou une activité physique ce matin', type: 'yn', positive: true },
];

const STORAGE_KEY_QUESTIONS = 'emotional_custom_questions';
const STORAGE_KEY_HISTORY   = 'emotional_history';

// ── Helpers ───────────────────────────────────────────────────
function loadCustomQuestions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_QUESTIONS) ?? 'null') ?? DEFAULT_QUESTIONS; } catch { return DEFAULT_QUESTIONS; }
}
function saveCustomQuestions(qs) {
  localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(qs));
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) ?? '[]'); } catch { return []; }
}
function saveHistory(h) {
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(h.slice(0, 30))); // keep last 30
}

function computeScore(questions, answers) {
  let score = 0;
  let max   = 0;
  questions.forEach(q => {
    if (q.type === 'yn') {
      max += 10;
      const val = answers[q.id];
      if (val === 'yes') score += q.positive ? 10 : 0;
      else if (val === 'no') score += q.positive ? 0 : 10;
    } else if (q.type === 'scale') {
      max += 10;
      const val = parseInt(answers[q.id] ?? 5);
      score += q.positive ? val : (10 - val);
    }
  });
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

function getAdvice(score) {
  if (score >= 85) return { emoji: '🔥', label: 'État optimal', color: '#00ff88', text: 'Tu es dans les meilleures conditions. Fais confiance à ton plan et trade avec discipline.' };
  if (score >= 70) return { emoji: '✅', label: 'Bon état',     color: '#00cc66', text: 'Conditions favorables. Reste vigilant et respecte tes niveaux de risque.' };
  if (score >= 50) return { emoji: '⚡', label: 'État moyen',   color: '#f0a020', text: 'Quelques signaux d\'alerte. Réduis ta taille de position et sois plus sélectif dans tes setups.' };
  if (score >= 30) return { emoji: '⚠️', label: 'État fragile', color: '#ff8800', text: 'Plusieurs facteurs négatifs. Envisage de trader en simulation uniquement ou de prendre une pause.' };
  return { emoji: '🛑', label: 'Ne pas trader', color: '#ff4455', text: 'Ton état mental n\'est pas propice au trading aujourd\'hui. Prends une pause, protège ton capital.' };
}

// ── Question component ────────────────────────────────────────
function QuestionCard({ q, answer, onChange }) {
  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#c8d8c8', fontSize: '17px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: '60px' };

  return (
    <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ fontSize: '17px', color: '#c8d8c8', marginBottom: '10px', lineHeight: '1.4' }}>{q.text}</div>
      {q.type === 'yn' && (
        <div style={{ display: 'flex', gap: '8px' }}>
          {['yes','no','autre'].map(v => {
            const colors = { yes: '#00ff88', no: '#ff4455', autre: '#f0a020' };
            const labels = { yes: 'Oui', no: 'Non', autre: 'Autre' };
            const c = colors[v];
            return (
              <button key={v} onClick={() => onChange(q.id, answer === v ? null : v)} style={{ padding: '6px 14px', borderRadius: '4px', border: `1px solid ${answer===v?c:'rgba(0,255,136,0.12)'}`, background: answer===v?`rgba(${c==='#00ff88'?'0,255,136':c==='#ff4455'?'255,68,85':'240,160,32'},0.12)`:'rgba(10,28,18,0.6)', color: answer===v?c:'#5a8a6a', fontSize: '15px', fontFamily: 'inherit', fontWeight: answer===v?'700':'400', cursor: 'pointer', transition: 'all 0.15s' }}>{labels[v]}</button>
            );
          })}
        </div>
      )}
      {q.type === 'scale' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', color: '#3a6a4a' }}>
            <span>{q.positive ? 'Faible' : 'Faible'}</span>
            <span style={{ color: '#c8d8c8', fontSize: '17px', fontWeight: '700' }}>{answer ?? 5}/10</span>
            <span>{q.positive ? 'Élevé' : 'Élevé'}</span>
          </div>
          <input type="range" min="1" max="10" value={answer ?? 5} onChange={e => onChange(q.id, e.target.value)}
            style={{ width: '100%', accentColor: '#00ff88', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <span key={n} style={{ fontSize: '17px', color: parseInt(answer??5)===n?'#00ff88':'#2a4a30', fontWeight: parseInt(answer??5)===n?'700':'400' }}>{n}</span>
            ))}
          </div>
        </div>
      )}
      {q.type === 'text' && (
        <textarea placeholder="Réponse libre..." value={answer ?? ''} onChange={e => onChange(q.id, e.target.value)} style={inp} />
      )}
      {/* Champ "autre" si sélectionné */}
      {q.type === 'yn' && answer === 'autre' && (
        <textarea placeholder="Précise ta réponse..." value={answers?.[q.id + '_autre'] ?? ''}
          onChange={e => onChange(q.id + '_autre', e.target.value)}
          style={{ ...inp, marginTop: '8px', minHeight: '50px' }} />
      )}
    </div>
  );
}

// ── History entry ─────────────────────────────────────────────
function HistoryCard({ entry, questions }) {
  const [open, setOpen] = useState(false);
  const advice = getAdvice(entry.score);
  return (
    <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '6px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '19px' }}>{advice.emoji}</span>
          <div>
            <div style={{ fontSize: '17px', color: '#c8d8c8', fontWeight: '600' }}>{new Date(entry.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <div style={{ fontSize: '17px', color: advice.color }}>{advice.label}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '19px', fontWeight: '700', color: advice.color }}>{entry.score}%</div>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3a6a4a" strokeWidth="2" strokeLinecap="round">
            <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
          </svg>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(0,255,136,0.06)' }}>
          <div style={{ fontSize: '15px', color: '#4a7a5a', margin: '10px 0' }}>{advice.text}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {questions.map(q => {
              const ans = entry.answers?.[q.id];
              if (!ans) return null;
              return (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', padding: '4px 8px', background: 'rgba(10,28,18,0.4)', borderRadius: '4px' }}>
                  <span style={{ color: '#8aaa90' }}>{q.text}</span>
                  <span style={{ color: '#c8d8c8', fontWeight: '700', marginLeft: '12px' }}>{q.type==='scale'?`${ans}/10`:ans==='yes'?'Oui':ans==='no'?'Non':ans}</span>
                </div>
              );
            })}
            {entry.notes && (
              <div style={{ marginTop: '6px', padding: '8px', background: 'rgba(10,28,18,0.4)', borderRadius: '4px', fontSize: '15px', color: '#8aaa90' }}>
                📝 {entry.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function EmotionalCheck() {
  const [tab, setTab]           = useState('check');
  const [questions, setQuestions] = useState(loadCustomQuestions);
  const [answers, setAnswers]   = useState({});
  const [notes, setNotes]       = useState('');
  const [history, setHistory]   = useState(loadHistory);
  const [saved, setSaved]       = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [newQ, setNewQ]         = useState({ text: '', type: 'yn', positive: true });

  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = history.find(h => h.date === today);
  const score = computeScore(questions, answers);
  const advice = getAdvice(score);
  const answered = questions.filter(q => answers[q.id] != null).length;

  function setAnswer(id, val) { setAnswers(prev => ({ ...prev, [id]: val })); }

  function handleSave() {
    const entry = { date: today, score, answers: { ...answers }, notes, savedAt: new Date().toISOString() };
    const newHistory = [entry, ...history.filter(h => h.date !== today)];
    saveHistory(newHistory);
    setHistory(newHistory);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function addQuestion() {
    if (!newQ.text.trim()) return;
    const q = { id: `custom_${Date.now()}`, ...newQ };
    const updated = [...questions, q];
    setQuestions(updated);
    saveCustomQuestions(updated);
    setNewQ({ text: '', type: 'yn', positive: true });
  }

  function removeQuestion(id) {
    const updated = questions.filter(q => q.id !== id);
    setQuestions(updated);
    saveCustomQuestions(updated);
  }

  function resetQuestions() {
    setQuestions(DEFAULT_QUESTIONS);
    saveCustomQuestions(DEFAULT_QUESTIONS);
  }

  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#c8d8c8', fontSize: '17px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '800px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '15px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>TRADING PSYCHOLOGY</div>
          <h1 style={{ fontSize: '23px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>État Mental</h1>
          <div style={{ fontSize: '15px', color: '#3a6a4a', marginTop: '3px' }}>Bilan pré-séance · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        {todayEntry && (
          <div style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '6px', padding: '8px 14px', fontSize: '15px', color: '#00ff88' }}>
            ✓ Bilan complété aujourd'hui — Score: {todayEntry.score}%
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '8px', padding: '4px' }}>
        {[
          { key: 'check',   label: '🧠 Bilan du jour' },
          { key: 'history', label: '📅 Historique' },
          { key: 'edit',    label: '⚙️ Personnaliser' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: tab===key?'rgba(0,255,136,0.12)':'transparent', color: tab===key?'#00ff88':'#5a8a6a', fontSize: '17px', fontFamily: 'inherit', fontWeight: tab===key?'700':'400', transition: 'all 0.2s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── BILAN TAB ── */}
      {tab === 'check' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Score banner */}
          <div style={{ background: `rgba(${advice.color==='#00ff88'?'0,255,136':advice.color==='#ff4455'?'255,68,85':advice.color==='#f0a020'?'240,160,32':'255,136,0'},0.08)`, border: `1px solid ${advice.color}30`, borderRadius: '8px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '36px', flexShrink: 0 }}>{advice.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <span style={{ fontSize: '17px', fontWeight: '700', color: advice.color }}>{advice.label}</span>
                <span style={{ fontSize: '21px', fontWeight: '700', color: advice.color }}>{score}%</span>
              </div>
              <div style={{ fontSize: '15px', color: '#8aaa90', lineHeight: '1.5' }}>{advice.text}</div>
              <div style={{ marginTop: '8px', height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${score}%`, background: `linear-gradient(90deg,${advice.color}80,${advice.color})`, borderRadius: '3px', transition: 'width 0.5s ease' }} />
              </div>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '15px', color: '#3a6a4a', marginBottom: '2px' }}>{answered}/{questions.length}</div>
              <div style={{ fontSize: '17px', color: '#3a6a4a' }}>réponses</div>
            </div>
          </div>

          {/* Questions */}
          {questions.map(q => (
            <QuestionCard key={q.id} q={q} answer={answers[q.id]} onChange={setAnswer} answers={answers} />
          ))}

          {/* Notes libres */}
          <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '14px 16px' }}>
            <div style={{ fontSize: '17px', color: '#c8d8c8', marginBottom: '8px' }}>📝 Notes libres (optionnel)</div>
            <textarea
              placeholder="Comment tu te sens aujourd'hui ? Des événements particuliers à noter ?"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ ...inp, width: '100%', resize: 'vertical', minHeight: '80px' }}
            />
          </div>

          {/* Save button */}
          <button onClick={handleSave} style={{
            padding: '13px', borderRadius: '6px',
            background: saved ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,170,85,0.1))',
            border: `1px solid rgba(0,255,136,${saved?'0.5':'0.3'})`,
            color: '#00ff88', fontSize: '17px', fontFamily: 'inherit', fontWeight: '700',
            letterSpacing: '1.5px', cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {saved ? '✅ BILAN ENREGISTRÉ !' : '💾 ENREGISTRER MON BILAN'}
          </button>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {history.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', border: '1px dashed #1a3a22', borderRadius: '6px', color: '#2a4a30', fontSize: '17px' }}>
              Aucun bilan enregistré — complétez votre premier bilan
            </div>
          ) : (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '8px' }}>
                {[
                  { label: 'BILANS TOTAL', value: history.length, color: '#c8d8c8' },
                  { label: 'SCORE MOYEN', value: `${Math.round(history.reduce((s,h) => s + h.score, 0) / history.length)}%`, color: '#00ff88' },
                  { label: 'SCORE MAX', value: `${Math.max(...history.map(h => h.score))}%`, color: '#00ff88' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '5px', padding: '10px 14px' }}>
                    <div style={{ fontSize: '17px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '19px', fontWeight: '700', color }}>{value}</div>
                  </div>
                ))}
              </div>
              {history.map(entry => (
                <HistoryCard key={entry.date} entry={entry} questions={questions} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── EDIT TAB ── */}
      {tab === 'edit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '15px', color: '#4a7a5a', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '6px', padding: '10px 14px' }}>
            ℹ️ Personnalisez vos questions. Les modifications sont sauvegardées automatiquement.
          </div>

          {/* Question list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {questions.map((q, i) => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '5px', padding: '10px 14px' }}>
                <span style={{ fontSize: '15px', color: '#3a6a4a', width: '20px', flexShrink: 0 }}>#{i+1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '17px', color: '#c8d8c8' }}>{q.text}</div>
                  <div style={{ fontSize: '17px', color: '#3a6a4a', marginTop: '2px' }}>
                    {q.type === 'yn' ? 'Oui/Non' : q.type === 'scale' ? 'Échelle 1-10' : 'Texte libre'} ·
                    {q.positive ? ' Positif ↑' : ' Négatif ↓'}
                  </div>
                </div>
                <button onClick={() => removeQuestion(q.id)} style={{ background: 'none', border: 'none', color: '#1a3a20', cursor: 'pointer', fontSize: '17px', padding: '0', transition: 'color 0.15s', flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ff4455'}
                  onMouseLeave={e => e.currentTarget.style.color = '#1a3a20'}
                >×</button>
              </div>
            ))}
          </div>

          {/* Add question */}
          <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '17px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>+ AJOUTER UNE QUESTION</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                placeholder="Texte de la question..."
                value={newQ.text}
                onChange={e => setNewQ(p => ({ ...p, text: e.target.value }))}
                style={{ ...inp, width: '100%' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '17px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>TYPE DE RÉPONSE</div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {[['yn','Oui/Non'],['scale','Échelle'],['text','Texte']].map(([v,l]) => (
                      <button key={v} onClick={() => setNewQ(p => ({ ...p, type: v }))} style={{ flex: 1, padding: '6px 4px', borderRadius: '4px', border: `1px solid ${newQ.type===v?'#00ff88':'rgba(0,255,136,0.12)'}`, background: newQ.type===v?'rgba(0,255,136,0.12)':'rgba(10,28,18,0.6)', color: newQ.type===v?'#00ff88':'#5a8a6a', fontSize: '17px', fontFamily: 'inherit', cursor: 'pointer' }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '17px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>IMPACT</div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {[[true,'✅ Positif'],[false,'⚠️ Négatif']].map(([v,l]) => (
                      <button key={String(v)} onClick={() => setNewQ(p => ({ ...p, positive: v }))} style={{ flex: 1, padding: '6px 4px', borderRadius: '4px', border: `1px solid ${newQ.positive===v?(v?'#00ff88':'#ff4455'):'rgba(0,255,136,0.12)'}`, background: newQ.positive===v?`rgba(${v?'0,255,136':'255,68,85'},0.12)`:'rgba(10,28,18,0.6)', color: newQ.positive===v?(v?'#00ff88':'#ff4455'):'#5a8a6a', fontSize: '17px', fontFamily: 'inherit', cursor: 'pointer' }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={addQuestion} disabled={!newQ.text.trim()} style={{ padding: '10px', borderRadius: '5px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', fontSize: '17px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer' }}>
                + AJOUTER LA QUESTION
              </button>
            </div>
          </div>

          {/* Reset */}
          <button onClick={() => { if (window.confirm('Remettre les questions par défaut ?')) resetQuestions(); }}
            style={{ padding: '9px', borderRadius: '5px', background: 'transparent', border: '1px solid #1a3a22', color: '#3a6a4a', fontSize: '15px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px' }}>
            Remettre les questions par défaut
          </button>
        </div>
      )}
    </div>
  );
}
