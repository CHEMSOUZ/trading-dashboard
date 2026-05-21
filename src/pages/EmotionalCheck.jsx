import { useState, useEffect } from 'react';

const QUESTIONS = [
  { key: 'slept_ok',       label: 'As-tu bien dormi ?',              goodAnswer: 1, icon: '🌙' },
  { key: 'frustrated',     label: 'Es-tu frustré ou en colère ?',    goodAnswer: 0, icon: '😤' },
  { key: 'respected_plan', label: 'As-tu respecté ton plan hier ?',   goodAnswer: 1, icon: '📋' },
  { key: 'revenge',        label: 'As-tu envie de revenge trade ?',   goodAnswer: 0, icon: '⚠️' },
];

export default function EmotionalCheck() {
  const [answers, setAnswers]       = useState({});
  const [submitted, setSubmitted]   = useState(false);
  const [todayCheck, setTodayCheck] = useState(null);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    (async () => {
      const res = await window.db.getTodayEmotionalCheck();
      if (res.ok && res.data) setTodayCheck(res.data);
    })();
  }, []);

  const allAnswered = QUESTIONS.every(q => answers[q.key] !== undefined);
  const score       = QUESTIONS.filter(q => answers[q.key] === q.goodAnswer).length;
  const allowed     = score === QUESTIONS.length;

  async function handleSubmit() {
    if (!allAnswered) return;
    setSaving(true);
    const payload = {
      date:           new Date().toISOString().slice(0, 10),
      slept_ok:       answers.slept_ok       ?? 0,
      frustrated:     answers.frustrated     ?? 0,
      respected_plan: answers.respected_plan ?? 0,
      revenge:        answers.revenge        ?? 0,
      allowed:        allowed ? 1 : 0,
    };
    const res = await window.db.insertEmotionalCheck(payload);
    setSaving(false);
    if (res.ok) {
      setTodayCheck({ ...payload, ...res.data });
      setSubmitted(true);
    }
  }

  // Déjà complété aujourd'hui
  if (todayCheck && !submitted) {
    const wasAllowed = todayCheck.allowed === 1;
    return (
      <div style={{ padding: '28px 32px', maxWidth: '580px' }}>
        <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>ÉTAT MENTAL</div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: '0 0 24px' }}>Bilan du jour</h1>
        <div style={{
          background: wasAllowed ? 'rgba(0,255,136,0.06)' : 'rgba(255,68,85,0.06)',
          border: `2px solid ${wasAllowed ? '#00ff88' : '#ff4455'}`,
          borderRadius: '8px', padding: '36px', textAlign: 'center',
          boxShadow: wasAllowed ? '0 0 40px rgba(0,255,136,0.08)' : '0 0 40px rgba(255,68,85,0.08)',
        }}>
          <div style={{ fontSize: '52px', marginBottom: '12px' }}>{wasAllowed ? '✅' : '🚫'}</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: wasAllowed ? '#00ff88' : '#ff4455', letterSpacing: '2px', marginBottom: '8px' }}>
            {wasAllowed ? 'TRADING AUTORISÉ' : 'TRADING DÉCONSEILLÉ'}
          </div>
          <div style={{ fontSize: '11px', color: '#5a8a6a', marginBottom: '20px' }}>
            Bilan déjà complété aujourd'hui.
          </div>
          <button onClick={() => setTodayCheck(null)} style={{
            background: 'transparent', border: '1px solid #1a3a22',
            color: '#4a7a5a', padding: '8px 16px', borderRadius: '5px',
            fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px',
          }}>REFAIRE LE BILAN</button>
        </div>
      </div>
    );
  }

  // Après soumission
  if (submitted) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: '580px' }}>
        <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>ÉTAT MENTAL</div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: '0 0 24px' }}>Résultat</h1>
        <div style={{
          background: allowed ? 'rgba(0,255,136,0.07)' : 'rgba(255,68,85,0.07)',
          border: `2px solid ${allowed ? '#00ff88' : '#ff4455'}`,
          borderRadius: '8px', padding: '36px', textAlign: 'center',
          boxShadow: allowed ? '0 0 40px rgba(0,255,136,0.1)' : '0 0 40px rgba(255,68,85,0.1)',
        }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>{allowed ? '🟢' : '🔴'}</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: allowed ? '#00ff88' : '#ff4455', letterSpacing: '2px', marginBottom: '10px' }}>
            {allowed ? 'TRADE AUTORISÉ' : 'NE TRADEZ PAS'}
          </div>
          <div style={{ fontSize: '12px', color: '#5a8a6a', marginBottom: '20px' }}>
            Score : {score}/{QUESTIONS.length}
          </div>
          {!allowed && (
            <div style={{
              background: 'rgba(255,68,85,0.1)', border: '1px solid rgba(255,68,85,0.2)',
              borderRadius: '6px', padding: '14px', fontSize: '11px',
              color: '#ff8888', lineHeight: '1.6',
            }}>
              Votre état émotionnel n'est pas optimal.<br />
              Reposez-vous et revenez demain.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Formulaire
  return (
    <div style={{ padding: '28px 32px', maxWidth: '580px' }}>
      <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>ÉTAT MENTAL</div>
      <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: '0 0 6px' }}>Bilan Pré-Séance</h1>
      <div style={{ fontSize: '11px', color: '#3a6a4a', marginBottom: '28px' }}>Répondez honnêtement avant de trader.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {QUESTIONS.map(q => {
          const answered = answers[q.key] !== undefined;
          const isGood   = answered && answers[q.key] === q.goodAnswer;
          return (
            <div key={q.key} style={{
              background: answered ? (isGood ? 'rgba(0,255,136,0.06)' : 'rgba(255,68,85,0.06)') : 'rgba(10,28,18,0.5)',
              border: `1px solid ${answered ? (isGood ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,85,0.2)') : 'rgba(0,255,136,0.08)'}`,
              borderRadius: '6px', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              transition: 'all 0.2s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>{q.icon}</span>
                <span style={{ fontSize: '12px', color: '#c8d8c8' }}>{q.label}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {[{ v: 1, label: 'OUI' }, { v: 0, label: 'NON' }].map(({ v, label }) => (
                  <button key={v} onClick={() => setAnswers(prev => ({ ...prev, [q.key]: v }))} style={{
                    padding: '6px 14px', borderRadius: '4px',
                    border: `1px solid ${answers[q.key]===v ? '#00ff88' : 'rgba(0,255,136,0.15)'}`,
                    background: answers[q.key]===v ? 'rgba(0,255,136,0.15)' : 'transparent',
                    color: answers[q.key]===v ? '#00ff88' : '#5a8a6a',
                    fontSize: '10px', fontFamily: 'inherit', fontWeight: '700',
                    letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s',
                  }}>{label}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Barre de progression */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ height: '3px', background: 'rgba(0,255,136,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(Object.keys(answers).length / QUESTIONS.length) * 100}%`,
            background: 'linear-gradient(90deg, #00aa55, #00ff88)',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ fontSize: '9px', color: '#3a6a4a', marginTop: '6px', textAlign: 'right' }}>
          {Object.keys(answers).length}/{QUESTIONS.length} réponses
        </div>
      </div>

      <button onClick={handleSubmit} disabled={!allAnswered || saving} style={{
        width: '100%', padding: '13px', borderRadius: '6px',
        border: `1px solid ${allAnswered ? 'rgba(0,255,136,0.35)' : 'rgba(0,255,136,0.1)'}`,
        background: allAnswered ? 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,170,85,0.1))' : 'rgba(10,28,18,0.3)',
        color: allAnswered ? '#00ff88' : '#2a4a30',
        fontSize: '11px', fontFamily: 'inherit', fontWeight: '700',
        letterSpacing: '2px', cursor: allAnswered ? 'pointer' : 'not-allowed',
        transition: 'all 0.2s ease',
      }}>
        {saving ? 'ENREGISTREMENT...' : 'VALIDER MON ÉTAT MENTAL'}
      </button>
    </div>
  );
}