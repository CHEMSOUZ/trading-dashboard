import { useState, useMemo } from 'react';

const C = {
  accent:    '#c41230',
  strength:  '#f97316',
  cardio:    '#38bdf8',
  nutrition: '#4ade80',
  suppl:     '#a78bfa',
  warn:      '#f0a020',
};

// Free exercise images — yuhonas/free-exercise-db (MIT licence)
const IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

// ── Helpers ────────────────────────────────────────────────────
function getImcLabel(imc) {
  if (imc < 18.5) return { text: 'Insuffisance pondérale', color: '#38bdf8' };
  if (imc < 25)   return { text: 'Poids normal',           color: '#c41230' };
  if (imc < 30)   return { text: 'Surpoids',               color: '#f0a020' };
  if (imc < 35)   return { text: 'Obésité modérée',        color: '#f97316' };
  if (imc < 40)   return { text: 'Obésité sévère',         color: '#ff4455' };
  return           { text: 'Obésité morbide',              color: '#ff2244' };
}

function computeProgram(taille, poids, objectif) {
  const t = parseFloat(taille);
  const p = parseFloat(poids);
  const o = parseFloat(objectif);
  if (!t || !p || !o || p <= o || t < 130 || t > 230 || p < 30 || p > 300 || o < 30) return null;
  const imc = p / Math.pow(t / 100, 2);
  const totalLoss = p - o;
  let p1from = p, p1to, p2from, p2to = o;
  if (p > 100 && o < 100)    { p1to = 100; p2from = 100; }
  else if (totalLoss <= 10)  { p1to = p - Math.ceil(totalLoss * 0.6); p2from = p1to; }
  else                       { p1to = Math.round(p - totalLoss * 0.55); p2from = p1to; }
  const phase1Loss = p1from - p1to;
  const phase2Loss = p2from - p2to;
  const rate1 = p > 115 ? 0.8 : p > 95 ? 0.65 : 0.55;
  const rate2 = 0.45;
  const weeks1 = Math.max(4, Math.ceil(phase1Loss / rate1));
  const weeks2 = Math.max(4, Math.ceil(phase2Loss / rate2));
  const bmr1 = 10 * p + 6.25 * t - 5 * 35 + 5;
  const tdee = Math.round(bmr1 * 1.375);
  const cal1 = Math.max(1500, Math.round(tdee - 600));
  const midW = (p1to + p2to) / 2;
  const cal2 = Math.max(1500, Math.round((10 * midW + 6.25 * t - 5 * 35 + 5) * 1.375 - 450));
  const protein = Math.round(p * 1.8);
  const cardioMin = p > 115 ? 20 : p > 95 ? 30 : 45;
  const intensity = p > 110
    ? { sets: 3, reps: '12-15', rest: 90, note: 'Charges légères, focus technique' }
    : p > 90
    ? { sets: 3, reps: '10-12', rest: 75, note: 'Charges modérées, tempo contrôlé' }
    : { sets: 4, reps: '8-10',  rest: 60, note: 'Charges progressives' };
  function lossAtWeeks(w) {
    if (w <= weeks1) return (phase1Loss / weeks1) * w;
    return phase1Loss + Math.min(phase2Loss, ((w - weeks1) * phase2Loss) / weeks2);
  }
  const projections = [13, 26, 52].map((w, i) => {
    const loss = Math.min(totalLoss, lossAtWeeks(w));
    const nw = p - loss;
    return { months: [3,6,12][i], weight: nw.toFixed(1), imc: (nw / Math.pow(t/100,2)).toFixed(1), loss: loss.toFixed(1) };
  });
  return { imc: imc.toFixed(1), imcLabel: getImcLabel(imc), totalLoss, p1from, p1to, p2from, p2to, phase1Loss, phase2Loss, weeks1, weeks2, tdee, cal1, cal2, protein, cardioMin, intensity, projections };
}

// ── UI atoms ───────────────────────────────────────────────────
function ProgressBar({ value, max, color = '#c41230', height = 6 }) {
  const pct = Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0);
  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', height }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.8s ease', boxShadow: `0 0 6px ${color}55` }} />
    </div>
  );
}

function SectionTitle({ icon, title, color = '#c41230' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${color}30, transparent)` }} />
    </div>
  );
}

function ExerciseCard({ ex, sessionColor, isDone, onToggle }) {
  const [imgErr, setImgErr] = useState(false);
  const imgUrl = ex.imgKey ? `${IMG}/${ex.imgKey}/0.jpg` : null;
  return (
    <div style={{ background: isDone ? `${sessionColor}0a` : 'rgba(10,20,14,0.5)', border: `1px solid ${isDone ? sessionColor + '30' : 'rgba(255,255,255,0.05)'}`, borderRadius: 8, overflow: 'hidden', transition: 'all 0.2s', display: 'flex', flexDirection: 'column' }}>
      {/* Image zone */}
      <div style={{ height: 110, background: 'rgba(0,0,0,0.4)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
        {imgUrl && !imgErr ? (
          <img src={imgUrl} alt={ex.name} onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isDone ? 0.4 : 0.82, transition: 'opacity 0.2s' }} />
        ) : (
          <span style={{ fontSize: 40, opacity: isDone ? 0.4 : 1 }}>{ex.emoji}</span>
        )}
        {/* Sets×reps badge */}
        <div style={{ position: 'absolute', top: 7, left: 7, background: 'rgba(0,0,0,0.82)', border: `1px solid ${sessionColor}50`, borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: sessionColor, letterSpacing: '0.5px' }}>
          {ex.sets}×{ex.reps}
        </div>
        {/* Done overlay */}
        {isDone && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,255,136,0.2)', border: '2px solid rgba(0,255,136,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>✓</div>
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '10px 11px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: isDone ? '#5a8a5a' : '#c8d8c8', marginBottom: 2, lineHeight: 1.3 }}>{ex.name}</div>
        <div style={{ fontSize: 10, color: sessionColor, marginBottom: 5, opacity: isDone ? 0.6 : 1 }}>{ex.muscle}</div>
        <div style={{ fontSize: 10, color: '#2a5a3a', lineHeight: 1.4, flex: 1 }}>💡 {ex.tip}</div>
        <button onClick={onToggle} style={{ marginTop: 8, width: '100%', padding: '6px 0', background: isDone ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isDone ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 4, color: isDone ? '#c41230' : '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          onMouseEnter={e => { if (!isDone) { e.currentTarget.style.background = 'rgba(0,255,136,0.06)'; e.currentTarget.style.color = '#991020'; }}}
          onMouseLeave={e => { if (!isDone) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#3a6a4a'; }}}
        >
          {isDone ? '✓ Fait' : '○ Marquer comme fait'}
        </button>
      </div>
    </div>
  );
}

// ── Static data ────────────────────────────────────────────────
const WEEKLY_PLAN = [
  { day: 'Lundi',    label: '💪 Haut du corps',  sub: 'Poitrine · Dos · Épaules', color: C.strength },
  { day: 'Mardi',   label: '🚶 Marche active',   sub: 'LISS 30-45 min · Zone 2',  color: C.cardio   },
  { day: 'Mercredi',label: '💪 Bas du corps',    sub: 'Quadris · Ischio · Fessiers',color: C.strength },
  { day: 'Jeudi',   label: '🧘 Repos actif',     sub: 'Étirements · Mobilité',    color: '#4a8a5a'  },
  { day: 'Vendredi',label: '💪 Full body',        sub: 'Compound mouvements',      color: C.strength },
  { day: 'Samedi',  label: '🏃 Cardio modéré',   sub: 'Vélo · Natation · Marche', color: C.cardio   },
  { day: 'Dimanche',label: '😴 Repos total',     sub: 'Récupération & Sommeil',   color: '#3a5a4a'  },
];

const SESSIONS = [
  {
    id: 'upper', title: 'Haut du corps', emoji: '💪', color: C.strength, day: 'Lundi',
    warmup: '10 min de marche rapide ou vélo',
    muscles: ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Core'],
    exercises: [
      { name: 'Développé couché machine / pompes inclinées', muscle: 'Pectoraux',  sets: 3, reps: '10',  emoji: '🏋️', imgKey: 'Barbell_Bench_Press_-_Medium_Grip',        tip: 'Coudes à 45°, descente lente et contrôlée' },
      { name: 'Tirage horizontal poulie',                    muscle: 'Dos',        sets: 3, reps: '12',  emoji: '↔️', imgKey: 'Cable_Seated_Row',                         tip: 'Omoplates serrées en fin de mouvement' },
      { name: 'Développé épaules machine',                   muscle: 'Épaules',    sets: 3, reps: '10',  emoji: '⬆️', imgKey: 'Barbell_Seated_Behind_Head_Military_Press',  tip: 'Gainage abdominal, pas de cambre lombaire' },
      { name: 'Tirage vertical poitrine',                    muscle: 'Dos',        sets: 3, reps: '12',  emoji: '⬇️', imgKey: 'Wide-Grip_Lat_Pulldown',                   tip: 'Tirez les coudes vers les hanches' },
      { name: 'Curl biceps haltères',                        muscle: 'Biceps',     sets: 3, reps: '12',  emoji: '💪', imgKey: 'Dumbbell_Alternate_Bicep_Curl',             tip: 'Coudes fixes, supination complète en haut' },
      { name: 'Extension triceps poulie',                    muscle: 'Triceps',    sets: 3, reps: '12',  emoji: '🔁', imgKey: 'Cable_Pushdown',                           tip: 'Coudes fixes contre le corps' },
      { name: 'Gainage planche',                             muscle: 'Core',       sets: 3, reps: '30s', emoji: '━', imgKey: null,                                       tip: 'Corps aligné, respiration régulière et lente' },
    ],
  },
  {
    id: 'lower', title: 'Bas du corps', emoji: '🦵', color: '#22d3ee', day: 'Mercredi',
    warmup: '10 min vélo',
    muscles: ['Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Mollets', 'Core'],
    exercises: [
      { name: 'Presse à cuisses',                       muscle: 'Quadris / Fessiers',  sets: 4, reps: '12',      emoji: '↘️', imgKey: 'Leg_Press',               tip: 'Pieds écartés largeur épaules, descente à 90°' },
      { name: 'Squat poids du corps / goblet squat',    muscle: 'Quadris / Fessiers',  sets: 3, reps: '10',      emoji: '🏋️', imgKey: 'Bodyweight_Squat',         tip: 'Genoux dans l\'axe des pieds, dos droit' },
      { name: 'Leg curl couché',                        muscle: 'Ischio-jambiers',     sets: 3, reps: '12',      emoji: '🔄', imgKey: 'Lying_Leg_Curls',          tip: 'Tempo lent, contraction maximale' },
      { name: 'Mollets machine',                        muscle: 'Mollets',             sets: 3, reps: '15',      emoji: '⬆️', imgKey: 'Standing_Calf_Raises',     tip: 'Descente maximale, montée explosive' },
      { name: 'Fentes assistées',                       muscle: 'Fessiers / Quadris',  sets: 2, reps: '10/jambe',emoji: '🚶', imgKey: 'Barbell_Lunge',            tip: 'Grand pas, genou avant ≤ pointe du pied' },
      { name: 'Crunch machine / relevés de genoux',     muscle: 'Core',                sets: 3, reps: '15',      emoji: '🔄', imgKey: 'Crunch',                   tip: 'Contraction abdominale à chaque répétition' },
    ],
  },
  {
    id: 'fullbody', title: 'Full body', emoji: '🔥', color: C.warn, day: 'Vendredi',
    warmup: null,
    muscles: ['Corps entier', 'Compound', 'Core'],
    exercises: [
      { name: 'Presse à cuisses',           muscle: 'Quadris / Fessiers',    sets: 3, reps: '12',  emoji: '↘️', imgKey: 'Leg_Press',                        tip: 'Pieds écartés largeur épaules' },
      { name: 'Développé couché machine',   muscle: 'Pectoraux',             sets: 3, reps: '10',  emoji: '🏋️', imgKey: 'Barbell_Bench_Press_-_Medium_Grip', tip: 'Amplitude complète, descente lente' },
      { name: 'Tirage horizontal',          muscle: 'Dos',                   sets: 3, reps: '12',  emoji: '↔️', imgKey: 'Cable_Seated_Row',                 tip: 'Omoplates serrées en fin de mouvement' },
      { name: 'Élévations latérales',       muscle: 'Épaules',               sets: 3, reps: '15',  emoji: '↔️', imgKey: 'Dumbbell_Lateral_Raise',           tip: 'Bras légèrement fléchis, montée à hauteur épaule' },
      { name: 'Curl biceps',                muscle: 'Biceps',                sets: 3, reps: '12',  emoji: '💪', imgKey: 'Dumbbell_Alternate_Bicep_Curl',     tip: 'Coudes fixes, supination complète' },
      { name: 'Triceps poulie',             muscle: 'Triceps',               sets: 3, reps: '12',  emoji: '🔁', imgKey: 'Cable_Pushdown',                   tip: 'Coudes fixes, extension complète' },
      { name: 'Gainage planche',            muscle: 'Core',                  sets: 3, reps: '40s', emoji: '━', imgKey: null,                               tip: 'Corps aligné de la tête aux talons' },
    ],
  },
];

const SUPPLEMENTS = [
  { name: 'Whey Protéine',         dose: '25-30g',       timing: 'Post-workout', emoji: '🥤', color: C.strength, benefit: 'Récupération musculaire · Synthèse protéique' },
  { name: 'Créatine monohydrate',  dose: '3-5g/jour',    timing: 'Avec repas',   emoji: '⚡', color: C.warn,     benefit: 'Force, puissance, récupération cellulaire' },
  { name: 'Oméga-3',              dose: '2-3g/jour',     timing: 'Au repas',     emoji: '🐟', color: C.cardio,   benefit: 'Anti-inflammatoire · Santé cardiovasculaire' },
  { name: 'Vitamine D3',           dose: '2000-4000 UI', timing: 'Le matin',     emoji: '☀️', color: C.warn,     benefit: 'Testostérone · Immunité · Humeur' },
  { name: 'Magnésium',             dose: '300-400mg',    timing: 'Le soir',      emoji: '💊', color: C.suppl,    benefit: 'Qualité du sommeil · Crampes · Récupération' },
  { name: 'Caféine (pré-workout)', dose: '100-200mg',    timing: '30 min avant', emoji: '☕', color: '#f97316',  benefit: 'Focus · Endurance · Oxydation des graisses' },
];

const MEALS = [
  { time: '🌅 Matin',   label: 'Petit-déjeuner', items: ['Flocons d\'avoine 80g', 'Blancs d\'œufs ×3', 'Banane', 'Café noir'],               cal: 420, prot: 28 },
  { time: '☀️ 13h00',  label: 'Déjeuner',        items: ['Poulet grillé 180g', 'Riz complet 80g', 'Brocolis 200g', 'Huile olive 1cc'],        cal: 550, prot: 45 },
  { time: '🌤️ 16h30', label: 'Collation',        items: ['Fromage blanc 0% 200g', 'Noix 20g', 'Pomme'],                                      cal: 260, prot: 20 },
  { time: '🌙 19h30',  label: 'Dîner',            items: ['Saumon 160g', 'Patate douce 200g', 'Épinards', 'Citron'],                          cal: 490, prot: 38 },
  { time: '🏋️ Post',   label: 'Post-workout',    items: ['Whey 30g', 'Lait d\'amande 300ml', '½ banane'],                                    cal: 280, prot: 32 },
];

const WALK_STEPS = [
  { label: 'Semaine 1',   steps: 5000,  desc: 'Commencez doucement, chaque pas compte' },
  { label: 'Semaine 2-3', steps: 7000,  desc: 'Augmentez progressivement la durée' },
  { label: 'Semaine 4-5', steps: 8000,  desc: 'Ajoutez quelques côtes ou inclinaisons' },
  { label: 'Semaine 6+',  steps: 10000, desc: 'Objectif maintenu sur le long terme' },
];

// ── Main component ─────────────────────────────────────────────
export default function FitnessSante() {
  const [taille, setTaille]     = useState('');
  const [poids, setPoids]       = useState('');
  const [objectif, setObjectif] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [walkStep, setWalkStep] = useState(0);
  const [doneExercises, setDoneExercises] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('fitness_done') ?? '[]')); }
    catch { return new Set(); }
  });

  const prog = useMemo(() => computeProgram(taille, poids, objectif), [taille, poids, objectif]);

  function toggleDone(key) {
    setDoneExercises(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem('fitness_done', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function resetSession(sessionId) {
    setDoneExercises(prev => {
      const next = new Set(prev);
      SESSIONS.find(s => s.id === sessionId)?.exercises.forEach((_, i) => next.delete(`${sessionId}-${i}`));
      try { localStorage.setItem('fitness_done', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const card = { background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: 8, padding: '16px 18px' };
  const inputBase = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.12)', borderRadius: 4, padding: '8px 10px', color: '#c8d8c8', fontSize: '12px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s' };

  const p1from     = prog?.p1from     ?? 120;
  const p1to       = prog?.p1to       ?? 100;
  const p2from     = prog?.p2from     ?? 100;
  const p2to       = prog?.p2to       ?? 85;
  const phase1Loss = prog?.phase1Loss ?? 20;
  const phase2Loss = prog?.phase2Loss ?? 15;
  const totalLoss  = prog?.totalLoss  ?? 35;
  const weeks1     = prog?.weeks1     ?? 25;
  const weeks2     = prog?.weeks2     ?? 34;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#f97316,#f0a020)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 0 14px rgba(249,115,22,0.3)', flexShrink: 0 }}>
          🏋️
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#e8f8e8', letterSpacing: '1px' }}>FITNESS & SANTÉ</div>
          <div style={{ fontSize: 11, color: '#3a6a4a', letterSpacing: '2px', marginTop: 1 }}>Programme personnalisé · Sport & Nutrition</div>
        </div>
      </div>

      {/* ── Form ── */}
      <div style={{ ...card, marginBottom: 20, borderColor: 'rgba(0,255,136,0.15)', background: 'rgba(10,28,18,0.55)' }}>
        <div style={{ fontSize: 10, color: '#c41230', letterSpacing: '2px', marginBottom: 12, fontWeight: 700 }}>📊 VOS DONNÉES PERSONNELLES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: prog ? 14 : 0 }}>
          {[
            { label: 'Taille (cm)',       val: taille,   set: setTaille,   ph: 'ex: 180' },
            { label: 'Poids actuel (kg)', val: poids,    set: setPoids,    ph: 'ex: 120' },
            { label: 'Objectif (kg)',     val: objectif, set: setObjectif, ph: 'ex: 85'  },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 10, color: '#3a6a4a', marginBottom: 5, letterSpacing: '1px' }}>{f.label}</div>
              <input type="number" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputBase}
                onFocus={e => e.target.style.borderColor = 'rgba(0,255,136,0.35)'}
                onBlur={e => e.target.style.borderColor = 'rgba(0,255,136,0.12)'}
              />
            </div>
          ))}
        </div>
        {prog ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { label: 'IMC',         val: prog.imc,              sub: prog.imcLabel.text,                color: prog.imcLabel.color },
              { label: 'À perdre',    val: `${prog.totalLoss} kg`,sub: `~${prog.weeks1+prog.weeks2} sem`, color: C.warn   },
              { label: 'Calories/j', val: `${prog.cal1} kcal`,   sub: `Déficit ~${prog.tdee-prog.cal1} kcal`, color: C.accent  },
              { label: 'Protéines/j',val: `${prog.protein} g`,   sub: '1.8 g · kg de poids',             color: C.strength},
            ].map(m => (
              <div key={m.label} style={{ background: 'rgba(6,12,16,0.5)', border: `1px solid ${m.color}22`, borderRadius: 6, padding: '10px 12px', borderTop: `2px solid ${m.color}` }}>
                <div style={{ fontSize: 10, color: '#3a6a4a', letterSpacing: '1px', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.val}</div>
                <div style={{ fontSize: 10, color: '#3a5a4a', marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#2a5a3a', textAlign: 'center', padding: '6px 0' }}>
            Renseignez vos données pour personnaliser le programme ↑
          </div>
        )}
      </div>

      {/* ── Phases ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <SectionTitle icon="📈" title="Phases de Progression" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'Phase 1', from: p1from, to: p1to, loss: phase1Loss, weeks: weeks1, cal: prog?.cal1 ?? 1900, color: '#f97316', desc: 'Perte de masse grasse — Déficit calorique élevé, cardio progressif, 3 séances/sem' },
            { label: 'Phase 2', from: p2from, to: p2to, loss: phase2Loss, weeks: weeks2, cal: prog?.cal2 ?? 2050, color: C.accent,  desc: 'Recomposition corporelle — Maintien musculaire, cardio ciblé, intensité accrue' },
          ].map(ph => (
            <div key={ph.label} style={{ background: 'rgba(6,12,16,0.5)', border: `1px solid ${ph.color}15`, borderRadius: 8, padding: '14px 16px', borderTop: `2px solid ${ph.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: ph.color }}>{ph.label}</span>
                <span style={{ fontSize: 10, color: '#3a6a4a', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 99 }}>~{ph.weeks} semaines</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#c8d8c8' }}>{ph.from} kg</span>
                <div style={{ flex: 1, height: 2, background: `linear-gradient(to right, ${ph.color}, ${ph.color}30)`, borderRadius: 1 }} />
                <span style={{ color: ph.color, fontSize: 14 }}>→</span>
                <div style={{ flex: 1, height: 2, background: `linear-gradient(to right, ${ph.color}30, ${ph.color})`, borderRadius: 1 }} />
                <span style={{ fontSize: 17, fontWeight: 700, color: ph.color }}>{ph.to} kg</span>
              </div>
              <ProgressBar value={ph.loss} max={totalLoss} color={ph.color} height={7} />
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 10, color: '#4a7a5a' }}>−{ph.loss} kg</span>
                <span style={{ fontSize: 10, color: ph.color, fontWeight: 700 }}>{ph.cal} kcal/j</span>
              </div>
              <div style={{ fontSize: 10, color: '#3a5a4a', marginTop: 6, lineHeight: 1.5 }}>{ph.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Projections ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <SectionTitle icon="🎯" title="Résultats Attendus" color={C.warn} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {(prog?.projections ?? [
            { months: 3,  weight: '106.5', imc: '32.9', loss: '13.5' },
            { months: 6,  weight: '93.5',  imc: '29.0', loss: '26.5' },
            { months: 12, weight: '85.0',  imc: '26.4', loss: '35.0' },
          ]).map((p, i) => {
            const medals  = ['🥉','🥈','🏆'];
            const colors  = ['#f97316', C.warn, C.accent];
            const targets = [
              '1er tour de taille · Énergie améliorée · Habitudes installées',
              'Corps recomposé · Posture améliorée · Endurance +40%',
              'Objectif atteint · Performance sportive · Transformation complète',
            ];
            const pct = Math.min(100, Math.round((parseFloat(p.loss) / totalLoss) * 100));
            return (
              <div key={p.months} style={{ background: 'rgba(6,12,16,0.5)', border: `1px solid ${colors[i]}15`, borderRadius: 8, padding: '14px 16px', textAlign: 'center', borderTop: `2px solid ${colors[i]}` }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{medals[i]}</div>
                <div style={{ fontSize: 10, color: colors[i], letterSpacing: '2px', fontWeight: 700, marginBottom: 8 }}>{p.months} MOIS</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#e8f8e8', marginBottom: 2 }}>{p.weight} kg</div>
                <div style={{ fontSize: 10, color: '#3a6a4a', marginBottom: 10 }}>−{p.loss} kg · IMC {p.imc}</div>
                <ProgressBar value={pct} max={100} color={colors[i]} height={5} />
                <div style={{ fontSize: 9, color: '#2a4a2a', marginTop: 3, marginBottom: 8 }}>{pct}% de l'objectif</div>
                <div style={{ fontSize: 10, color: '#3a5a4a', lineHeight: 1.5 }}>{targets[i]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Planning hebdomadaire ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <SectionTitle icon="📅" title="Planning Hebdomadaire" color={C.cardio} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
          {WEEKLY_PLAN.map(day => {
            const emoji = day.label.split(' ')[0];
            const name  = day.label.replace(/^\S+ /, '');
            return (
              <div key={day.day} style={{ background: 'rgba(6,12,16,0.5)', border: `1px solid ${day.color}15`, borderRadius: 8, padding: '12px 8px', textAlign: 'center', borderTop: `2px solid ${day.color}` }}>
                <div style={{ fontSize: 9, color: '#3a6a4a', letterSpacing: '1px', marginBottom: 6 }}>{day.day.toUpperCase().slice(0,3)}</div>
                <div style={{ fontSize: 18, marginBottom: 5 }}>{emoji}</div>
                <div style={{ fontSize: 9, color: day.color, fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>{name}</div>
                <div style={{ fontSize: 9, color: '#2a5a3a', lineHeight: 1.3 }}>{day.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Séances de Musculation ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <SectionTitle icon="💪" title="Séances de Musculation" color={C.strength} />

        {/* Session tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {SESSIONS.map(s => {
            const doneCount = s.exercises.filter((_, i) => doneExercises.has(`${s.id}-${i}`)).length;
            const isActive  = activeSession === s.id;
            return (
              <button key={s.id} onClick={() => setActiveSession(isActive ? null : s.id)}
                style={{ background: isActive ? `${s.color}18` : 'rgba(6,12,16,0.5)', border: `1px solid ${isActive ? s.color : 'rgba(255,255,255,0.06)'}`, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', color: isActive ? s.color : '#5a8a6a', fontSize: '12px', fontFamily: 'inherit', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#8aaa90'; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(6,12,16,0.5)'; e.currentTarget.style.color = '#5a8a6a'; }}}
              >
                <span>{s.emoji}</span>
                <span>{s.title}</span>
                <span style={{ fontSize: 9, color: '#3a6a4a' }}>({s.day})</span>
                {doneCount > 0 && (
                  <span style={{ fontSize: 9, background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.25)', color: '#c41230', padding: '1px 5px', borderRadius: 99, fontWeight: 700 }}>{doneCount}/{s.exercises.length}</span>
                )}
              </button>
            );
          })}
          {!activeSession && <span style={{ fontSize: 11, color: '#2a5a3a', paddingLeft: 8 }}>← Sélectionnez une séance</span>}
        </div>

        {/* Session detail */}
        {SESSIONS.map(s => activeSession !== s.id ? null : (
          <div key={s.id} style={{ background: 'rgba(6,12,16,0.6)', border: `1px solid ${s.color}15`, borderRadius: 8, padding: '14px 16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20 }}>{s.emoji}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.title}</div>
                <div style={{ fontSize: 10, color: '#3a6a4a' }}>{s.muscles.join(' · ')}</div>
              </div>
              {prog && (
                <div style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.3)', border: `1px solid ${s.color}20`, borderRadius: 6, padding: '6px 12px', fontSize: 10, color: '#4a7a5a', textAlign: 'right' }}>
                  <div style={{ color: s.color, fontWeight: 700 }}>{prog.intensity.sets} séries × {prog.intensity.reps} reps</div>
                  <div>Repos {prog.intensity.rest}s · {prog.intensity.note}</div>
                </div>
              )}
              <button onClick={() => resetSession(s.id)}
                style={{ background: 'rgba(255,68,85,0.06)', border: '1px solid rgba(255,68,85,0.2)', borderRadius: 5, padding: '5px 10px', cursor: 'pointer', color: '#ff4455', fontSize: '10px', fontFamily: 'inherit', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,68,85,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,68,85,0.06)'}
                title="Réinitialiser les cases cochées"
              >↺ Reset</button>
            </div>

            {/* Warmup */}
            {s.warmup && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 12px', background: `${s.color}08`, border: `1px solid ${s.color}15`, borderRadius: 6 }}>
                <span style={{ fontSize: 14 }}>🔥</span>
                <div>
                  <span style={{ fontSize: 10, color: s.color, fontWeight: 700 }}>ÉCHAUFFEMENT · </span>
                  <span style={{ fontSize: 10, color: '#8a9a8a' }}>{s.warmup}</span>
                </div>
              </div>
            )}

            {/* Exercise grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {s.exercises.map((ex, i) => (
                <ExerciseCard
                  key={i}
                  ex={ex}
                  sessionColor={s.color}
                  isDone={doneExercises.has(`${s.id}-${i}`)}
                  onToggle={() => toggleDone(`${s.id}-${i}`)}
                />
              ))}
            </div>

            {/* Progress bar for session */}
            {(() => {
              const done = s.exercises.filter((_, i) => doneExercises.has(`${s.id}-${i}`)).length;
              const pct  = Math.round((done / s.exercises.length) * 100);
              return done > 0 ? (
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, color: '#3a6a4a', flexShrink: 0 }}>Progression séance</span>
                  <div style={{ flex: 1 }}><ProgressBar value={done} max={s.exercises.length} color={s.color} height={5} /></div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.color, flexShrink: 0 }}>{done}/{s.exercises.length} · {pct}%</span>
                  {done === s.exercises.length && <span style={{ fontSize: 14 }}>🎉</span>}
                </div>
              ) : null;
            })()}
          </div>
        ))}
      </div>

      {/* ── Cardio & Marche ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <SectionTitle icon="🏃" title="Cardio & Marche" color={C.cardio} />

        {/* Phase débutant banner */}
        <div style={{ background: `${C.cardio}08`, border: `1px solid ${C.cardio}20`, borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.cardio }}>Phase Débutant</div>
            <div style={{ fontSize: 10, background: `${C.cardio}18`, border: `1px solid ${C.cardio}25`, color: C.cardio, padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>3 à 5 fois / semaine</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
            {[
              { act: 'Marche rapide',       emoji: '🚶', detail: 'Terrain plat ou légère pente' },
              { act: 'Vélo stationnaire',   emoji: '🚴', detail: 'Faible impact articulaire' },
              { act: 'Rameur léger',        emoji: '🚣', detail: 'Cardio complet haut/bas' },
              { act: 'Natation',            emoji: '🏊', detail: 'Idéal pour poids élevé' },
            ].map((a, i) => (
              <div key={i} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${C.cardio}15`, borderRadius: 6, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 5 }}>{a.emoji}</div>
                <div style={{ fontSize: 10, color: C.cardio, fontWeight: 700, marginBottom: 3 }}>{a.act}</div>
                <div style={{ fontSize: 9, color: '#2a5a6a' }}>{a.detail}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#4a8a8a', lineHeight: 1.5 }}>
            <span style={{ color: C.cardio, fontWeight: 700 }}>Objectif : </span>
            30 à 45 minutes à rythme modéré — vous devez pouvoir parler sans être essoufflé <span style={{ color: '#3a7a7a' }}>(Zone 2 cardio · 60-70% FCmax)</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Walk progression stepper */}
          <div style={{ background: 'rgba(6,12,16,0.5)', border: `1px solid ${C.cardio}15`, borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.cardio, marginBottom: 14 }}>🚶 Progression Marche Quotidienne</div>
            {WALK_STEPS.map((step, i) => {
              const isActive = walkStep === i;
              const isPast   = walkStep > i;
              return (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < 3 ? 4 : 0, cursor: 'pointer', opacity: (!isActive && !isPast) ? 0.55 : 1, transition: 'opacity 0.2s' }}
                  onClick={() => setWalkStep(i)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isActive ? C.cardio : isPast ? `${C.cardio}25` : 'rgba(0,0,0,0.3)', border: `2px solid ${isActive ? C.cardio : isPast ? `${C.cardio}50` : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isPast ? 13 : 11, color: isActive ? '#060c10' : C.cardio, fontWeight: 700, transition: 'all 0.2s', flexShrink: 0 }}>
                      {isPast ? '✓' : i + 1}
                    </div>
                    {i < 3 && <div style={{ width: 2, height: 18, background: isPast ? `${C.cardio}35` : 'rgba(255,255,255,0.05)', marginTop: 2 }} />}
                  </div>
                  <div style={{ flex: 1, paddingTop: 3, paddingBottom: i < 3 ? 16 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: isActive ? '#e8f8e8' : '#8a9a8a' }}>{step.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? C.cardio : isPast ? `${C.cardio}aa` : '#3a6a4a' }}>{step.steps.toLocaleString('fr-FR')} pas</span>
                    </div>
                    <ProgressBar value={step.steps} max={10000} color={isActive ? C.cardio : isPast ? `${C.cardio}55` : 'rgba(255,255,255,0.08)'} height={4} />
                    {isActive && <div style={{ fontSize: 10, color: '#2a6a7a', marginTop: 4 }}>{step.desc}</div>}
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 12, padding: '9px 11px', background: `${C.cardio}07`, border: `1px solid ${C.cardio}15`, borderRadius: 6, fontSize: 10, color: '#3a7a8a', fontStyle: 'italic', lineHeight: 1.5 }}>
              💡 À poids élevé, la marche brûle déjà beaucoup de calories — c'est l'outil le plus sous-estimé.
            </div>
          </div>

          {/* Cardio modéré */}
          <div style={{ background: 'rgba(6,12,16,0.5)', border: `1px solid ${C.cardio}15`, borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.cardio, marginBottom: 12 }}>🚴 Cardio Modéré (Samedi)</div>
            {[
              { type: '🚴 Vélo / Elliptique', detail: 'Zone 2 · 60-70% FCmax · 30-45 min',          top: true  },
              { type: '🏊 Natation',          detail: 'Impact zéro · idéal pour articulations',       top: true  },
              { type: '🚶 Marche rapide',     detail: 'Extérieur · >6 000 pas · 45-60 min',           top: false },
              { type: '🏃 Jogging/marche',    detail: 'Méthode Galloway · alterner course/marche',    top: false },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, padding: '9px 10px', background: item.top ? `${C.cardio}06` : 'transparent', borderRadius: 6, border: item.top ? `1px solid ${C.cardio}12` : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: item.top ? C.cardio : '#c8d8c8', fontWeight: item.top ? 700 : 400 }}>{item.type}</div>
                  <div style={{ fontSize: 10, color: '#2a5a3a', marginTop: 2 }}>{item.detail}</div>
                </div>
                {item.top && <span style={{ fontSize: 9, background: `${C.cardio}18`, border: `1px solid ${C.cardio}25`, color: C.cardio, padding: '2px 5px', borderRadius: 3, fontWeight: 700, flexShrink: 0 }}>TOP</span>}
              </div>
            ))}
            <div style={{ marginTop: 10, padding: '9px 11px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: 6, fontSize: 10, color: '#3a7a4a', lineHeight: 1.5 }}>
              📌 Durée minimale : <span style={{ color: C.cardio, fontWeight: 700 }}>{prog?.cardioMin ?? 30} min</span> au départ
              {prog && (prog.cardioMin < 45) && <span style={{ color: '#3a6a4a' }}> → augmenter jusqu'à 45 min sur 8 semaines</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Nutrition ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <SectionTitle icon="🥗" title="Plan Nutritionnel" color={C.nutrition} />
        {prog && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'Cal. Phase 1', val: `${prog.cal1} kcal`,                        color: '#f97316'  },
              { label: 'Cal. Phase 2', val: `${prog.cal2} kcal`,                        color: C.nutrition},
              { label: 'Protéines',   val: `${prog.protein} g/j`,                       color: C.strength },
              { label: 'Glucides',    val: `${Math.round(prog.cal1 * 0.4 / 4)} g/j`,   color: C.warn     },
              { label: 'Lipides',     val: `${Math.round(prog.cal1 * 0.28 / 9)} g/j`,  color: C.cardio   },
            ].map(m => (
              <div key={m.label} style={{ background: `${m.color}0c`, border: `1px solid ${m.color}20`, borderRadius: 6, padding: '5px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#4a7a5a' }}>{m.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: m.color }}>{m.val}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {MEALS.map(meal => (
            <div key={meal.label} style={{ background: 'rgba(6,12,16,0.5)', border: `1px solid ${C.nutrition}12`, borderRadius: 8, padding: '12px' }}>
              <div style={{ fontSize: 9, color: '#3a6a4a', marginBottom: 3 }}>{meal.time}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.nutrition, marginBottom: 8 }}>{meal.label}</div>
              {meal.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <div style={{ width: 3, height: 3, borderRadius: '50%', background: C.nutrition, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: '#6a9a7a' }}>{item}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: C.warn }}>🔥 {meal.cal}</span>
                <span style={{ fontSize: 10, color: C.strength }}>💪 {meal.prot}g</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Suppléments ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <SectionTitle icon="💊" title="Suppléments Recommandés" color={C.suppl} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
          {SUPPLEMENTS.map(s => (
            <div key={s.name} style={{ background: 'rgba(6,12,16,0.5)', border: `1px solid ${s.color}12`, borderRadius: 8, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${s.color}12`, border: `1px solid ${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.emoji}</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.name}</div>
                <div style={{ display: 'flex', gap: 5, marginBottom: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, background: `${s.color}15`, border: `1px solid ${s.color}20`, color: s.color, padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>{s.dose}</span>
                  <span style={{ fontSize: 9, color: '#3a6a4a', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 3 }}>⏰ {s.timing}</span>
                </div>
                <div style={{ fontSize: 10, color: '#4a7a5a', lineHeight: 1.4 }}>{s.benefit}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 12px', background: 'rgba(240,160,32,0.05)', border: '1px solid rgba(240,160,32,0.12)', borderRadius: 6, fontSize: 10, color: '#5a6a3a' }}>
          ⚠️ Consulter un médecin avant supplémentation. Whey & créatine = preuves scientifiques solides. Les autres sont optionnels.
        </div>
      </div>

      {/* ── Règle d'or ── */}
      <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: 8, padding: '14px 18px', fontSize: 11, color: '#3a7a4a', lineHeight: 1.7 }}>
        <span style={{ color: '#c41230', fontWeight: 700 }}>💡 RÈGLE D'OR : </span>
        La constance prime sur l'intensité. 3 séances/sem pendant 12 mois valent bien plus que 6 séances pendant 2 semaines. Pèse-toi chaque matin à jeun, ajuste les calories toutes les 4 semaines si la perte stagne, et vise 7-8h de sommeil — le meilleur anabolisant naturel.
      </div>
    </div>
  );
}
