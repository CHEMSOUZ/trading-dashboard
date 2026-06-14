import { useState, useEffect, useMemo } from 'react';
import NQChart from '../components/NQChart';

// ── Helpers ───────────────────────────────────────────────────
function getWeekStart(date) {
  const d = new Date(date + 'T12:00:00Z');
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

function getNextMonday() {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getLastTradeDay() {
  const d = new Date();
  const day = d.getUTCDay();
  if (day === 0) d.setUTCDate(d.getUTCDate() - 2);
  else if (day === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getLastMonday() {
  const d = new Date();
  const day = d.getUTCDay();
  if (day === 6) d.setUTCDate(d.getUTCDate() - 5);
  else if (day === 0) d.setUTCDate(d.getUTCDate() - 6);
  else d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('fr-FR',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtWeek(mondayStr) {
  const d0 = new Date(mondayStr + 'T12:00:00Z');
  const d1 = new Date(mondayStr + 'T12:00:00Z');
  d1.setUTCDate(d1.getUTCDate() + 4);
  return `${d0.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})} – ${d1.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}`;
}

function fmtTs(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ── Markdown renderer ─────────────────────────────────────────
function MdLine({ text }) {
  const html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function MarkdownContent({ content }) {
  if (!content) return null;
  const lines = content.split('\n');
  const els = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      els.push(
        <h2 key={key++} style={{ fontSize:'17px', fontWeight:'700', color:'#e8edf8', margin:'28px 0 10px', borderBottom:'1px solid rgba(136,153,187,0.15)', paddingBottom:'8px', letterSpacing:'0.5px' }}>
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      els.push(
        <h3 key={key++} style={{ fontSize:'13px', fontWeight:'700', color:'#8899bb', margin:'18px 0 6px', letterSpacing:'1px', textTransform:'uppercase' }}>
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('#### ')) {
      els.push(
        <h4 key={key++} style={{ fontSize:'12px', fontWeight:'700', color:'#6677aa', margin:'10px 0 4px' }}>
          {line.slice(5)}
        </h4>
      );
    } else if (/^\*\*.*\*\*:?$/.test(line.trim())) {
      els.push(
        <p key={key++} style={{ margin:'10px 0 4px', fontWeight:'700', color:'#c0cadd', fontSize:'13px' }}>
          <MdLine text={line.trim()} />
        </p>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      els.push(
        <div key={key++} style={{ display:'flex', gap:'8px', margin:'3px 0 3px 8px', color:'#8899bb', fontSize:'13px', lineHeight:'1.6' }}>
          <span style={{ color:'#3a5a72', flexShrink:0, marginTop:'1px' }}>▸</span>
          <span><MdLine text={line.slice(2)} /></span>
        </div>
      );
    } else if (line.trim() === '---') {
      els.push(<hr key={key++} style={{ border:'none', borderTop:'1px solid rgba(136,153,187,0.12)', margin:'14px 0' }} />);
    } else if (line.trim() === '') {
      els.push(<div key={key++} style={{ height:'6px' }} />);
    } else {
      els.push(
        <p key={key++} style={{ margin:'3px 0', color:'#8899bb', fontSize:'13px', lineHeight:'1.7' }}>
          <MdLine text={line} />
        </p>
      );
    }
  }
  return <>{els}</>;
}

// ── Generating spinner ────────────────────────────────────────
function GeneratingCard({ label }) {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ padding:'40px 24px', textAlign:'center', border:'1px solid rgba(136,153,187,0.12)', borderRadius:'10px', background:'rgba(14,15,22,0.5)' }}>
      <div style={{ fontSize:'28px', marginBottom:'14px', opacity:0.8 }}>⚡</div>
      <div style={{ fontSize:'13px', color:'#8899bb', letterSpacing:'2px', marginBottom:'6px' }}>GÉNÉRATION EN COURS{dots}</div>
      <div style={{ fontSize:'11px', color:'#3a4a5a' }}>{label}</div>
      <div style={{ marginTop:'18px', fontSize:'11px', color:'#3a4a5a' }}>Analyse ICT par Claude AI · 15–30 secondes</div>
    </div>
  );
}

// ── Single analysis card ──────────────────────────────────────
function AnalysisCard({ analysis, onRegenerate, onDelete, generating, chartLabel }) {
  const [confirmDel, setConfirmDel] = useState(false);

  const marketData = useMemo(() => {
    if (!analysis?.market_data) return {};
    try { return JSON.parse(analysis.market_data); } catch(_) { return {}; }
  }, [analysis?.market_data]);

  if (generating) return <GeneratingCard label={generating} />;
  if (!analysis) return (
    <div style={{ padding:'40px 24px', textAlign:'center', border:'1px dashed rgba(136,153,187,0.15)', borderRadius:'10px' }}>
      <div style={{ fontSize:'11px', color:'#3a4a5a', letterSpacing:'2px', marginBottom:'16px' }}>AUCUNE ANALYSE DISPONIBLE</div>
      <button onClick={onRegenerate}
        style={{ padding:'9px 20px', background:'rgba(136,153,187,0.10)', border:'1px solid rgba(136,153,187,0.30)', borderRadius:'6px', color:'#8899bb', fontSize:'12px', fontFamily:'inherit', cursor:'pointer', letterSpacing:'1px', fontWeight:'700' }}>
        ⚡ GÉNÉRER L'ANALYSE
      </button>
    </div>
  );

  return (
    <div>
      {/* Header bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px', paddingBottom:'12px', borderBottom:'1px solid rgba(136,153,187,0.10)' }}>
        <div style={{ fontSize:'11px', color:'#3a4a5a', letterSpacing:'1px' }}>
          Généré le {fmtTs(analysis.generated_at)} · NQ/MNQ
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={onRegenerate}
            style={{ padding:'5px 12px', background:'rgba(136,153,187,0.08)', border:'1px solid rgba(136,153,187,0.20)', borderRadius:'5px', color:'#5a6a82', fontSize:'11px', fontFamily:'inherit', cursor:'pointer', letterSpacing:'1px' }}>
            ↻ Régénérer
          </button>
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)}
              style={{ padding:'5px 12px', background:'rgba(255,68,85,0.07)', border:'1px solid rgba(255,68,85,0.18)', borderRadius:'5px', color:'#884455', fontSize:'11px', fontFamily:'inherit', cursor:'pointer' }}>
              ✕
            </button>
          ) : (
            <button onClick={() => { setConfirmDel(false); onDelete(); }}
              style={{ padding:'5px 12px', background:'rgba(255,68,85,0.15)', border:'1px solid rgba(255,68,85,0.40)', borderRadius:'5px', color:'#ff4455', fontSize:'11px', fontFamily:'inherit', cursor:'pointer', fontWeight:'700' }}>
              CONFIRMER
            </button>
          )}
        </div>
      </div>
      {/* Chart */}
      {marketData.candles?.length > 0 && (
        <NQChart candles={marketData.candles} zones={marketData.zones} label={chartLabel} />
      )}
      {/* Content */}
      <div style={{ lineHeight:'1.7' }}>
        <MarkdownContent content={analysis.content} />
      </div>
    </div>
  );
}

// ── Date selector for archive ─────────────────────────────────
function DateSelector({ analyses, type, selected, onSelect }) {
  const options = analyses.filter(a => a.type === type);
  if (options.length <= 1) return null;
  return (
    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'18px' }}>
      {options.map(a => {
        const label = type === 'daily' ? new Date(a.date + 'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : `Sem. ${new Date(a.date+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}`;
        const isActive = a.date === selected;
        return (
          <button key={a.date} onClick={() => onSelect(a.date)}
            style={{ padding:'4px 10px', background: isActive ? 'rgba(136,153,187,0.15)' : 'transparent', border:`1px solid ${isActive?'rgba(136,153,187,0.40)':'rgba(136,153,187,0.12)'}`, borderRadius:'5px', color: isActive ? '#8899bb' : '#3a4a5a', fontSize:'11px', fontFamily:'inherit', cursor:'pointer', letterSpacing:'0.5px' }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Analysis() {
  const [tab, setTab]             = useState('daily');
  const [analyses, setAnalyses]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState({}); // { 'daily:2026-06-12': true, ... }
  const [selectedDates, setSelectedDates] = useState({});
  const [noKey, setNoKey]         = useState(false);

  useEffect(() => {
    loadAndAutoGenerate();
    if (window.market?.onAnalysisGenerated) {
      window.market.onAnalysisGenerated(({ type, date }) => {
        refreshAnalyses();
        setGenerating(g => { const n = {...g}; delete n[`${type}:${date}`]; return n; });
      });
    }
  }, []);

  async function refreshAnalyses() {
    const res = await window.market.getAiAnalyses();
    if (res.ok) setAnalyses(res.data);
  }

  async function loadAndAutoGenerate() {
    setLoading(true);
    const res = await window.market.getAiAnalyses();
    const existing = res.ok ? res.data : [];
    setAnalyses(existing);
    setLoading(false);

    const today = new Date();
    const todayUtcDay = today.getUTCDay(); // 0=Sun,6=Sat

    // Auto-generate: June 12 daily (user request)
    const key12 = '2026-06-12';
    if (!existing.some(a => a.type === 'daily' && a.date === key12)) {
      generate('daily', key12);
    }

    // Auto-generate: week of June 8 (user request)
    const keyW8 = '2026-06-08';
    if (!existing.some(a => a.type === 'weekly' && a.date === keyW8)) {
      generate('weekly', keyW8);
    }

    // Auto-generate: next week June 15 (user request)
    const keyNW = '2026-06-15';
    if (!existing.some(a => a.type === 'next_week' && a.date === keyNW)) {
      generate('next_week', keyNW);
    }

    // Auto-generate: last trading day if Sat or Sun
    if (todayUtcDay === 6 || todayUtcDay === 0) {
      const lastTrade = getLastTradeDay();
      if (!existing.some(a => a.type === 'daily' && a.date === lastTrade) && lastTrade !== key12) {
        generate('daily', lastTrade);
      }
    }
  }

  async function generate(type, date) {
    const gKey = `${type}:${date}`;
    setGenerating(g => ({ ...g, [gKey]: true }));
    const res = await window.market.generateAiAnalysis(type, date);
    setGenerating(g => { const n = {...g}; delete n[gKey]; return n; });
    if (!res.ok) {
      if (res.error === 'no_api_key') setNoKey(true);
      return;
    }
    setAnalyses(prev => {
      const filtered = prev.filter(a => !(a.type === type && a.date === date));
      return [res.data, ...filtered];
    });
  }

  async function deleteAnalysis(id, type, date) {
    await window.market.deleteAiAnalysis(id);
    setAnalyses(prev => prev.filter(a => a.id !== id));
  }

  // Derive what to show for each tab
  const dailyAnalyses    = useMemo(() => analyses.filter(a => a.type === 'daily').sort((a,b) => b.date.localeCompare(a.date)), [analyses]);
  const weeklyAnalyses   = useMemo(() => analyses.filter(a => a.type === 'weekly').sort((a,b) => b.date.localeCompare(a.date)), [analyses]);
  const nextWeekAnalyses = useMemo(() => analyses.filter(a => a.type === 'next_week').sort((a,b) => b.date.localeCompare(a.date)), [analyses]);

  const selDaily    = selectedDates.daily    ?? dailyAnalyses[0]?.date;
  const selWeekly   = selectedDates.weekly   ?? weeklyAnalyses[0]?.date;
  const selNextWeek = selectedDates.next_week ?? nextWeekAnalyses[0]?.date;

  const curDaily    = dailyAnalyses.find(a => a.date === selDaily) ?? null;
  const curWeekly   = weeklyAnalyses.find(a => a.date === selWeekly) ?? null;
  const curNextWeek = nextWeekAnalyses.find(a => a.date === selNextWeek) ?? null;

  // Keys for generating state
  const genKeyDaily    = selDaily    ? `daily:${selDaily}`         : null;
  const genKeyWeekly   = selWeekly   ? `weekly:${selWeekly}`       : null;
  const genKeyNextWeek = selNextWeek ? `next_week:${selNextWeek}`  : null;
  const anyDaily       = Object.keys(generating).some(k => k.startsWith('daily:'));
  const anyWeekly      = Object.keys(generating).some(k => k.startsWith('weekly:'));
  const anyNextWeek    = Object.keys(generating).some(k => k.startsWith('next_week:'));
  const isGenDaily     = genKeyDaily    ? !!generating[genKeyDaily]    : anyDaily;
  const isGenWeekly    = genKeyWeekly   ? !!generating[genKeyWeekly]   : anyWeekly;
  const isGenNextWeek  = genKeyNextWeek ? !!generating[genKeyNextWeek] : anyNextWeek;

  const TABS = [
    { id:'daily',     label:'📊 Journalier',      sub:'Résumé ICT du jour' },
    { id:'weekly',    label:'📈 Bilan Semaine',    sub:'Analyse hebdomadaire' },
    { id:'next_week', label:'🔭 Semaine Suivante', sub:'Plan et scénarios ICT' },
  ];

  if (loading) return (
    <div style={{ padding:'40px', display:'flex', alignItems:'center', justifyContent:'center', color:'#3a4a5a', fontSize:'12px', letterSpacing:'2px', fontFamily:"'JetBrains Mono','Fira Code',monospace" }}>
      CHARGEMENT...
    </div>
  );

  return (
    <div style={{ padding:'24px 28px', width:'100%', boxSizing:'border-box', fontFamily:"'JetBrains Mono','Fira Code',monospace" }}>
      {/* Header */}
      <div style={{ marginBottom:'24px' }}>
        <div style={{ fontSize:'11px', color:'#3a4a5a', letterSpacing:'3px', marginBottom:'4px' }}>IA MARCHÉ · NQ/MNQ</div>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#e8edf8', margin:'0 0 4px' }}>Analyse de Marché</h1>
        <div style={{ fontSize:'12px', color:'#3a4a5a' }}>Résumés ICT automatiques · Claude AI · Yahoo Finance</div>
      </div>

      {/* No API key banner */}
      {noKey && (
        <div style={{ marginBottom:'18px', padding:'12px 16px', background:'rgba(255,160,32,0.08)', border:'1px solid rgba(255,160,32,0.25)', borderRadius:'8px', fontSize:'12px', color:'#f0a020', display:'flex', gap:'10px', alignItems:'center' }}>
          <span>⚠</span>
          <span>Clé API Anthropic non configurée. Configure-la dans le chat IA (icône robot dans la sidebar) pour activer les analyses automatiques.</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'24px', background:'rgba(14,15,22,0.4)', padding:'5px', borderRadius:'8px', border:'1px solid rgba(136,153,187,0.07)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:'10px 8px', borderRadius:'5px', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
              border:    tab===t.id ? '1px solid rgba(136,153,187,0.30)' : '1px solid transparent',
              background:tab===t.id ? 'rgba(136,153,187,0.10)'          : 'transparent',
              color:     tab===t.id ? '#8899bb'                          : '#3a4a5a',
            }}>
            <div style={{ fontSize:'13px', marginBottom:'2px', fontWeight: tab===t.id?'700':'400' }}>{t.label}</div>
            <div style={{ fontSize:'10px', opacity:0.7, letterSpacing:'0.5px' }}>{t.sub}</div>
          </button>
        ))}
      </div>

      {/* DAILY TAB */}
      {tab === 'daily' && (
        <div>
          {/* Date nav + generate */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px', flexWrap:'wrap', gap:'10px' }}>
            <DateSelector analyses={dailyAnalyses} type="daily" selected={selDaily} onSelect={d => setSelectedDates(s => ({...s, daily:d}))} />
            <div style={{ display:'flex', gap:'8px', alignItems:'center', marginLeft:'auto' }}>
              {/* Date input */}
              <input type="date" defaultValue={selDaily ?? getLastTradeDay()}
                id="daily-date-input"
                style={{ padding:'5px 8px', background:'rgba(14,15,22,0.6)', border:'1px solid rgba(136,153,187,0.18)', borderRadius:'5px', color:'#8899bb', fontSize:'11px', fontFamily:'inherit' }} />
              <button onClick={() => {
                const v = document.getElementById('daily-date-input')?.value;
                if (v) { generate('daily', v); setSelectedDates(s => ({...s, daily:v})); }
              }} style={{ padding:'5px 14px', background:'rgba(136,153,187,0.10)', border:'1px solid rgba(136,153,187,0.25)', borderRadius:'5px', color:'#8899bb', fontSize:'11px', fontFamily:'inherit', cursor:'pointer', letterSpacing:'1px', whiteSpace:'nowrap' }}>
                ⚡ Générer
              </button>
            </div>
          </div>
          {/* Title */}
          {selDaily && (
            <div style={{ marginBottom:'16px', fontSize:'12px', color:'#5a6a82', letterSpacing:'1px' }}>
              {fmtDate(selDaily)}
            </div>
          )}
          <AnalysisCard
            analysis={curDaily}
            generating={isGenDaily ? 'Analyse ICT de la journée en cours…' : null}
            chartLabel="1H · ICT SESSIONS"
            onRegenerate={() => {
              const d = selDaily ?? getLastTradeDay();
              generate('daily', d);
            }}
            onDelete={() => curDaily && deleteAnalysis(curDaily.id, 'daily', selDaily)}
          />
        </div>
      )}

      {/* WEEKLY TAB */}
      {tab === 'weekly' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px', flexWrap:'wrap', gap:'10px' }}>
            <DateSelector analyses={weeklyAnalyses} type="weekly" selected={selWeekly} onSelect={d => setSelectedDates(s => ({...s, weekly:d}))} />
            <div style={{ display:'flex', gap:'8px', alignItems:'center', marginLeft:'auto' }}>
              <input type="date" defaultValue={selWeekly ?? getLastMonday()} id="weekly-date-input"
                style={{ padding:'5px 8px', background:'rgba(14,15,22,0.6)', border:'1px solid rgba(136,153,187,0.18)', borderRadius:'5px', color:'#8899bb', fontSize:'11px', fontFamily:'inherit' }} />
              <button onClick={() => {
                const raw = document.getElementById('weekly-date-input')?.value;
                if (raw) { const v = getWeekStart(raw); generate('weekly', v); setSelectedDates(s => ({...s, weekly:v})); }
              }} style={{ padding:'5px 14px', background:'rgba(136,153,187,0.10)', border:'1px solid rgba(136,153,187,0.25)', borderRadius:'5px', color:'#8899bb', fontSize:'11px', fontFamily:'inherit', cursor:'pointer', letterSpacing:'1px', whiteSpace:'nowrap' }}>
                ⚡ Générer
              </button>
            </div>
          </div>
          {selWeekly && (
            <div style={{ marginBottom:'16px', fontSize:'12px', color:'#5a6a82', letterSpacing:'1px' }}>
              Semaine du {fmtWeek(selWeekly)}
            </div>
          )}
          <AnalysisCard
            analysis={curWeekly}
            generating={isGenWeekly ? 'Bilan hebdomadaire ICT en cours…' : null}
            chartLabel="1D · BILAN HEBDO"
            onRegenerate={() => {
              const d = selWeekly ?? getLastMonday();
              generate('weekly', d);
            }}
            onDelete={() => curWeekly && deleteAnalysis(curWeekly.id, 'weekly', selWeekly)}
          />
        </div>
      )}

      {/* NEXT WEEK TAB */}
      {tab === 'next_week' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px', flexWrap:'wrap', gap:'10px' }}>
            <DateSelector analyses={nextWeekAnalyses} type="next_week" selected={selNextWeek} onSelect={d => setSelectedDates(s => ({...s, next_week:d}))} />
            <div style={{ display:'flex', gap:'8px', alignItems:'center', marginLeft:'auto' }}>
              <button onClick={() => {
                const d = getNextMonday();
                generate('next_week', d);
                setSelectedDates(s => ({...s, next_week:d}));
              }} style={{ padding:'5px 14px', background:'rgba(136,153,187,0.10)', border:'1px solid rgba(136,153,187,0.25)', borderRadius:'5px', color:'#8899bb', fontSize:'11px', fontFamily:'inherit', cursor:'pointer', letterSpacing:'1px', whiteSpace:'nowrap' }}>
                ⚡ Générer (semaine suivante)
              </button>
            </div>
          </div>
          {selNextWeek && (
            <div style={{ marginBottom:'16px', fontSize:'12px', color:'#5a6a82', letterSpacing:'1px' }}>
              Plan semaine du {fmtWeek(selNextWeek)}
            </div>
          )}
          <AnalysisCard
            analysis={curNextWeek}
            generating={isGenNextWeek ? 'Plan ICT semaine suivante en cours…' : null}
            chartLabel="1D · PLAN SEMAINE"
            onRegenerate={() => {
              const d = selNextWeek ?? getNextMonday();
              generate('next_week', d);
            }}
            onDelete={() => curNextWeek && deleteAnalysis(curNextWeek.id, 'next_week', selNextWeek)}
          />
        </div>
      )}

      {/* Footer info */}
      <div style={{ marginTop:'32px', paddingTop:'16px', borderTop:'1px solid rgba(136,153,187,0.08)', display:'flex', gap:'20px', flexWrap:'wrap' }}>
        <div style={{ fontSize:'10px', color:'#2a3a4a', letterSpacing:'1px' }}>
          ⏱ Résumé journalier : Lun–Ven à 22h00 (Paris)
        </div>
        <div style={{ fontSize:'10px', color:'#2a3a4a', letterSpacing:'1px' }}>
          ⏱ Bilan hebdo + plan : Samedi à 08h00 (Paris)
        </div>
        <div style={{ fontSize:'10px', color:'#2a3a4a', letterSpacing:'1px' }}>
          📡 Données : Yahoo Finance (NQ=F · 15 min délai)
        </div>
      </div>
    </div>
  );
}
