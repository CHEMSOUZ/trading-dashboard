import { useState, useEffect } from 'react';
import { EMOTION_COLORS, emotionTone, emotionRgb, ToneIcon } from '../shared/emotionTraits';

const P = {
  bg:     'rgba(14,15,22,',
  border: 'rgba(136,153,187,',
  text1:  '#dde4ef',
  text2:  '#8898aa',
  text3:  '#4a5a72',
  text4:  '#2c3c54',
};

const WEEKDAY_LABELS = ['LUN','MAR','MER','JEU','VEN','SAM','DIM'];

function monthLabel(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// Grille de semaines (lundi-dimanche) pour le mois "YYYY-MM" donné.
function buildMonthGrid(yearMonth) {
  const [y, m]       = yearMonth.split('-').map(Number);
  const daysInMonth  = new Date(y, m, 0).getDate();
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 0 = lundi

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${yearMonth}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function TraderProfile() {
  const [loading,      setLoading]      = useState(true);
  const [isDemoMode,   setIsDemoMode]   = useState(false);
  const [calendar,     setCalendar]     = useState([]); // [{ date, emotion }]
  const [referenceDay, setReferenceDay] = useState(null);

  useEffect(() => {
    (async () => {
      const sessionRes = await window.auth.getSession();
      const demoMode = !!sessionRes.data?.user && sessionRes.data.user.subscription_status !== 'active';
      setIsDemoMode(demoMode);

      if (demoMode) {
        const [calRes, tradesRes] = await Promise.all([
          window.demo.getTraitCalendar(),
          window.db.getAllTrades(),
        ]);
        const trades = tradesRes.ok ? (tradesRes.data ?? []) : [];
        setCalendar(calRes.ok ? (calRes.data ?? []) : []);
        setReferenceDay(trades.reduce((max, t) => (t.date && t.date > max ? t.date : max), trades[0]?.date ?? null));
      } else {
        // Utilisateur réel : mois civil courant, données issues de mental_reports (SQLite).
        const today      = new Date().toISOString().slice(0, 10);
        const yearMonth  = today.slice(0, 7);
        const [y, m]     = yearMonth.split('-').map(Number);
        const monthStart = `${yearMonth}-01`;
        const monthEnd   = `${yearMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
        const rangeRes = await window.db.getMentalReportsRange(monthStart, monthEnd);
        const rows = rangeRes.ok ? (rangeRes.data ?? []) : [];
        setCalendar(rows.map(r => ({ date: r.date, emotion: r.emotion })));
        setReferenceDay(today);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div style={{ padding:'24px 28px', color:P.text3, fontSize:'13px' }}>Chargement...</div>;
  }

  const byDate = {};
  for (const e of calendar) byDate[e.date] = e.emotion;

  const counts = {};
  for (const e of calendar) counts[e.emotion] = (counts[e.emotion] ?? 0) + 1;
  const legend    = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const dominant  = legend[0]?.[0] ?? null;

  const sortedAsc = [...calendar].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  if (sortedAsc.length > 0) {
    const lastEmotion = sortedAsc[sortedAsc.length - 1].emotion;
    for (let i = sortedAsc.length - 1; i >= 0; i--) {
      if (sortedAsc[i].emotion === lastEmotion) streak++; else break;
    }
  }

  const month = (referenceDay ?? sortedAsc[sortedAsc.length - 1]?.date ?? '').slice(0, 7);
  const weeks = month ? buildMonthGrid(month) : [];

  const dominantColor = dominant ? (EMOTION_COLORS[dominant] ?? P.text2) : P.text2;
  const dominantRgb    = emotionRgb(dominantColor);

  return (
    <div style={{ padding:'24px 28px' }}>
      <div style={{ marginBottom:'24px' }}>
        <div style={{ fontSize:'11px', color:P.text3, letterSpacing:'3px', marginBottom:'5px' }}>TRADER PROFILE</div>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:P.text1, margin:'0 0 3px', letterSpacing:'-0.5px' }}>Profil Trader</h1>
        <div style={{ fontSize:'13px', color:P.text3 }}>{month ? monthLabel(month) : ''}</div>
      </div>

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
      <div style={{ background:`${P.bg}0.4)`, border:`1px solid ${P.border}0.10)`, borderRadius:'12px', padding:'14px 16px', marginBottom:'16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'6px' }}>
          {WEEKDAY_LABELS.map(d => (
            <div key={d} style={{ fontSize:'10px', color:P.text3, letterSpacing:'1px', textAlign:'center' }}>{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'4px' }}>
            {week.map((date, di) => {
              if (!date) return <div key={di} />;
              const emotion = byDate[date];
              const color   = emotion ? (EMOTION_COLORS[emotion] ?? P.text2) : null;
              const cellRgb = color ? emotionRgb(color) : null;
              const isRef   = date === referenceDay;
              const dayNum  = parseInt(date.slice(-2), 10);
              return (
                <div key={di} style={{
                  height: '40px', borderRadius: '6px',
                  border: isRef ? `2px solid ${color ?? '#8899bb'}` : `1px solid ${P.border}0.08)`,
                  background: cellRgb ? `rgba(${cellRgb},0.08)` : 'transparent',
                  display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'center', gap:'4px',
                }}>
                  <span style={{ fontSize:'10px', color: emotion ? P.text2 : P.text4 }}>{dayNum}</span>
                  {emotion && <ToneIcon tone={emotionTone(emotion)} color={color} size={11} />}
                </div>
              );
            })}
          </div>
        ))}
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
    </div>
  );
}
