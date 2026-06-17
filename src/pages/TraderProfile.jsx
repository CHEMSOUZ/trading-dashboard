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
const CAL_MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// ── Calendrier — même structure que TradingCalendar (GlobalView.jsx) :
// navigation mois, grille 7 colonnes + colonne résumé de semaine, tooltip au
// survol — mais sur des traits psychologiques (un par jour) plutôt que du P&L.
function TraitCalendar({ calendar, referenceDay, onMonthChange }) {
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
              if (!day) return <div key={`e-${wi}-${di}`} style={{ minHeight:'56px', borderRadius:'6px', background:'rgba(14,15,22,0.15)', border:'1px solid rgba(136,153,187,0.03)' }} />;
              const date    = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const emotion = byDay[date];
              const color   = emotion ? (EMOTION_COLORS[emotion] ?? P.text2) : null;
              const cellRgb = color ? emotionRgb(color) : null;
              const isRef   = date === referenceDay;
              const isHov   = hovered === date;
              return (
                <div key={date}
                  onMouseEnter={() => setHovered(date)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    minHeight:'56px', borderRadius:'6px', padding:'5px 6px',
                    display:'flex', flexDirection:'column', justifyContent:'space-between',
                    background: isHov && emotion ? `rgba(${cellRgb},0.18)` : cellRgb ? `rgba(${cellRgb},0.10)` : 'transparent',
                    border: isRef ? `1.5px solid ${color ?? 'rgba(0,170,255,0.60)'}` : `1px solid ${P.border}0.07)`,
                    cursor: emotion ? 'pointer' : 'default', transition:'all 0.12s',
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
                </div>
              );
            }),
            <div key={`w-${wi}`} style={{ background:'rgba(14,15,22,0.55)', border:`1px solid ${P.border}0.09)`, borderRadius:'6px', minHeight:'56px', padding:'6px 8px', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', gap:'4px' }}>
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
        return (
          <div style={{ position:'fixed', bottom:'22px', right:'22px', background:'rgba(8,9,16,0.97)', border:'1px solid rgba(136,153,187,0.22)', borderRadius:'8px', padding:'12px 16px', boxShadow:'0 8px 32px rgba(0,0,0,0.65)', zIndex:9999, minWidth:'200px', pointerEvents:'none', display:'flex', alignItems:'center', gap:'10px' }}>
            <ToneIcon tone={emotionTone(emotion)} color={color} size={20} />
            <div>
              <div style={{ fontSize:'13px', fontWeight:'700', color:P.text1, marginBottom:'2px' }}>{hovered}</div>
              <div style={{ fontSize:'12px', color, fontWeight:'600' }}>{emotion}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function TraderProfile() {
  const [loading,      setLoading]      = useState(true);
  const [isDemoMode,   setIsDemoMode]   = useState(false);
  const [calendar,     setCalendar]     = useState([]); // [{ date, emotion }] — historique complet
  const [referenceDay, setReferenceDay] = useState(null);
  const [viewYear,     setViewYear]     = useState(new Date().getFullYear());
  const [viewMonth,    setViewMonth]    = useState(new Date().getMonth());

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
        // Utilisateur réel : historique complet chargé une fois (comme Vue Globale charge
        // tous les trades), filtré par mois affiché directement dans le calendrier.
        const today = new Date().toISOString().slice(0, 10);
        const rangeRes = await window.db.getMentalReportsRange('2000-01-01', '2100-01-01');
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

  // Stats du bandeau (trait dominant + légende) scopées au mois affiché dans le calendrier.
  const monthPfx = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthEntries = calendar.filter(e => e.date.startsWith(monthPfx));

  const counts = {};
  for (const e of monthEntries) counts[e.emotion] = (counts[e.emotion] ?? 0) + 1;
  const legend   = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const dominant = legend[0]?.[0] ?? null;

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
  const dominantRgb    = emotionRgb(dominantColor);

  return (
    <div style={{ padding:'24px 28px' }}>
      <div style={{ marginBottom:'24px' }}>
        <div style={{ fontSize:'11px', color:P.text3, letterSpacing:'3px', marginBottom:'5px' }}>TRADER PROFILE</div>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:P.text1, margin:'0 0 3px', letterSpacing:'-0.5px' }}>Profil Trader</h1>
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
      <div style={{ marginBottom:'16px' }}>
        <TraitCalendar calendar={calendar} referenceDay={referenceDay} onMonthChange={(y, m) => { setViewYear(y); setViewMonth(m); }} />
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
