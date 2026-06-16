import { useState, useEffect, useMemo, useRef } from 'react';
import NQChart from '../components/NQChart';

// ── Futures assets ────────────────────────────────────────────
const FUTURES_ASSETS = [
  { key:'MNQ', label:'MNQ', name:'Micro NASDAQ-100' },
  { key:'NQ',  label:'NQ',  name:'E-mini NASDAQ-100' },
  { key:'MES', label:'MES', name:'Micro S&P 500' },
  { key:'ES',  label:'ES',  name:'E-mini S&P 500' },
  { key:'MGC', label:'MGC', name:'Micro Gold' },
  { key:'GC',  label:'GC',  name:'Gold Futures' },
  { key:'MCL', label:'MCL', name:'Micro Crude Oil' },
  { key:'CL',  label:'CL',  name:'Crude Oil' },
  { key:'M2K', label:'M2K', name:'Micro Russell 2K' },
  { key:'RTY', label:'RTY', name:'Russell 2000' },
  { key:'MYM', label:'MYM', name:'Micro Dow Jones' },
  { key:'YM',  label:'YM',  name:'E-mini Dow Jones' },
  { key:'SI',  label:'SI',  name:'Silver' },
];

const ASSET_YAHOO = {
  MNQ:'MNQ%3DF', NQ:'NQ%3DF', MES:'MES%3DF', ES:'ES%3DF',
  MGC:'MGC%3DF', GC:'GC%3DF', MCL:'MCL%3DF', CL:'CL%3DF',
  M2K:'M2K%3DF', RTY:'RTY%3DF', MYM:'MYM%3DF', YM:'YM%3DF', SI:'SI%3DF',
};

function getTypeKey(baseType, asset) {
  return asset === 'MNQ' ? baseType : `${baseType}_${asset}`;
}

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


// ── Chat panel ────────────────────────────────────────────────
function ChatPanel({ analysisContent, asset, tab }) {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { setMessages([]); setInput(''); }, [tab, asset]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || aiLoading) return;
    const userMsg = { role:'user', content:text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setAiLoading(true);

    const sys = `Tu es un assistant trading expert ICT (Inner Circle Trader). Tu analyses l'actif ${asset}.\nContexte de l'analyse actuelle :\n${analysisContent ? analysisContent.slice(0, 3000) : 'Aucune analyse générée.'}\nRéponds de façon concise, précise et opérationnelle. Utilise les concepts ICT (liquidité, FVG, sessions, DOL, MSS, displacement...).`;

    try {
      const res = await window.ai.chat(updated, sys);
      if (res.ok) {
        setMessages(prev => [...prev, { role:'assistant', content:res.data }]);
      } else {
        const errMsg = res.error === 'no_api_key' ? 'Clé API Anthropic manquante. Configure-la dans le chat IA.' : res.error;
        setMessages(prev => [...prev, { role:'assistant', content:'⚠ ' + errMsg }]);
      }
    } catch(_) {
      setMessages(prev => [...prev, { role:'assistant', content:'⚠ Erreur de connexion.' }]);
    }
    setAiLoading(false);
  }

  const userCount = messages.filter(m => m.role === 'user').length;

  return (
    <div style={{ marginTop:'20px', border:'1px solid rgba(136,153,187,0.12)', borderRadius:'10px', overflow:'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', padding:'10px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(14,15,22,0.5)', border:'none', borderBottom: open ? '1px solid rgba(136,153,187,0.10)' : 'none', fontFamily:'inherit' }}>
        <span style={{ fontSize:'11px', color:'#5a6a82', letterSpacing:'1px' }}>
          💬 CHAT IA — {asset}{userCount > 0 ? ` (${userCount})` : ''}
        </span>
        <span style={{ color:'#3a4a5a', fontSize:'10px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ background:'rgba(10,14,20,0.8)' }}>
          <div style={{ maxHeight:'320px', overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:'10px' }}>
            {messages.length === 0 && (
              <div style={{ fontSize:'11px', color:'#3a4a5a', textAlign:'center', padding:'24px 0' }}>
                Posez une question sur {asset} ou l'analyse ci-dessus
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth:'85%', padding:'8px 12px',
                background: m.role === 'user' ? 'rgba(136,153,187,0.12)' : 'rgba(20,24,32,0.8)',
                border:`1px solid ${m.role === 'user' ? 'rgba(136,153,187,0.20)' : 'rgba(136,153,187,0.10)'}`,
                borderRadius:'8px', fontSize:'12px', color:'#8899bb', lineHeight:'1.6', whiteSpace:'pre-wrap',
              }}>
                {m.content}
              </div>
            ))}
            {aiLoading && (
              <div style={{ alignSelf:'flex-start', fontSize:'11px', color:'#3a4a5a', padding:'8px 12px' }}>
                ⌛ Réflexion…
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(136,153,187,0.08)', display:'flex', gap:'8px', alignItems:'center' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Question sur ${asset}…`}
              style={{ flex:1, padding:'7px 10px', background:'rgba(14,15,22,0.6)', border:'1px solid rgba(136,153,187,0.18)', borderRadius:'5px', color:'#8899bb', fontSize:'12px', fontFamily:'inherit', outline:'none' }}
            />
            <button onClick={send} disabled={aiLoading}
              style={{ padding:'7px 14px', background:'rgba(136,153,187,0.10)', border:'1px solid rgba(136,153,187,0.25)', borderRadius:'5px', color: aiLoading ? '#3a4a5a' : '#8899bb', fontSize:'11px', fontFamily:'inherit', cursor: aiLoading ? 'default' : 'pointer', letterSpacing:'0.5px' }}>
              ↵
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Asset selector ────────────────────────────────────────────
function AssetSelector({ selected, onChange }) {
  return (
    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'20px', padding:'10px 12px', background:'rgba(14,15,22,0.4)', borderRadius:'8px', border:'1px solid rgba(136,153,187,0.07)', alignItems:'center' }}>
      <span style={{ fontSize:'10px', color:'#3a4a5a', letterSpacing:'1px', marginRight:'4px', whiteSpace:'nowrap' }}>ACTIF:</span>
      {FUTURES_ASSETS.map(a => {
        const isActive = a.key === selected;
        return (
          <button key={a.key} onClick={() => onChange(a.key)}
            title={a.name}
            style={{
              padding:'4px 10px',
              background: isActive ? 'rgba(136,153,187,0.15)' : 'transparent',
              border:`1px solid ${isActive ? 'rgba(136,153,187,0.40)' : 'rgba(136,153,187,0.10)'}`,
              borderRadius:'5px',
              color: isActive ? '#8899bb' : '#3a4a5a',
              fontSize:'11px', fontFamily:'inherit', cursor:'pointer', letterSpacing:'0.5px',
              fontWeight: isActive ? '700' : '400',
            }}>
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Single analysis card ──────────────────────────────────────
function AnalysisCard({ analysis, onRegenerate, onDelete, generating, chartLabel, asset }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [d1Data, setD1Data]         = useState(null);
  const [d1Loading, setD1Loading]   = useState(false);

  const marketData = useMemo(() => {
    if (!analysis?.market_data) return {};
    try { return JSON.parse(analysis.market_data); } catch(_) { return {}; }
  }, [analysis?.market_data]);

  const assetDisplay = (marketData.meta?.symbol ?? asset ?? 'MNQ').replace('=F', '');
  const yahooSym     = ASSET_YAHOO[assetDisplay] ?? ASSET_YAHOO[asset] ?? 'MNQ%3DF';

  // Fetch 6-month D1 candles when analysis is available
  useEffect(() => {
    if (!analysis) { setD1Data(null); return; }
    let cancelled = false;
    setD1Data(null);
    setD1Loading(true);
    window.market.getHistoricalCandles(assetDisplay || 'MNQ', 183).then(res => {
      if (!cancelled && res.ok && res.data?.candles?.length) setD1Data(res.data);
      if (!cancelled) setD1Loading(false);
    }).catch(() => { if (!cancelled) setD1Loading(false); });
    return () => { cancelled = true; };
  }, [analysis?.id, assetDisplay]);

  // D1 swings (correctly indexed for D1) + AI liquidity levels (absolute timestamps)
  const mergedZones = useMemo(() => {
    if (!d1Data) return marketData.zones;
    return {
      fvgs: [],
      swings:    d1Data.zones?.swings    ?? [],
      liquidity: marketData.zones?.liquidity ?? d1Data.zones?.liquidity ?? [],
    };
  }, [d1Data, marketData.zones]);

  const chartCandles   = d1Data?.candles?.length ? d1Data.candles : marketData.candles;
  const chartDefaultTf = d1Data ? '1d' : (marketData.meta?.defaultTf ?? '15m');
  // 6 mois pour tous les TF — Yahoo retourne ce qu'il peut selon l'intervalle (M1 max 7j, M5/M15 max 60j, H1+ max 6 mois)
  const chartDateRange = useMemo(() => ({
    from: new Date(Date.now() - 183 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    to:   new Date().toISOString().slice(0, 10),
  }), []);

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
          Généré le {fmtTs(analysis.generated_at)} · {assetDisplay}
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
      {/* Chart — D1 6 mois par défaut, TF analyse (M15/H1) accessibles via les boutons */}
      {d1Loading && (
        <div style={{ height:'80px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#3a4a5a', letterSpacing:'1px', border:'1px solid rgba(136,153,187,0.10)', borderRadius:'10px', marginBottom:'24px', background:'#0a0e14' }}>
          CHARGEMENT GRAPHIQUE {assetDisplay}…
        </div>
      )}
      {!d1Loading && chartCandles?.length > 0 && (
        <NQChart
          key={`${assetDisplay}-${chartDefaultTf}`}
          candles={chartCandles}
          zones={mergedZones}
          label={chartLabel}
          defaultTf={chartDefaultTf}
          dateRange={chartDateRange}
          symbol={assetDisplay}
          yahooSym={yahooSym}
        />
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
        const label = type.startsWith('daily') ? new Date(a.date + 'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : `Sem. ${new Date(a.date+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}`;
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
  const [tab, setTab]               = useState('daily');
  const [analyses, setAnalyses]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState({});
  const [selectedDates, setSelectedDates] = useState({});
  const [selectedAsset, setSelectedAsset] = useState('MNQ');
  const [noKey, setNoKey]           = useState(false);

  useEffect(() => {
    loadAndAutoGenerate();
    if (window.market?.onAnalysisGenerated) {
      window.market.onAnalysisGenerated(({ type, date, asset: evtAsset }) => {
        refreshAnalyses();
        const a = evtAsset || 'MNQ';
        setGenerating(g => { const n = {...g}; delete n[`${type}:${date}:${a}`]; return n; });
      });
    }
  }, []);

  // Reset date selection when switching asset
  useEffect(() => { setSelectedDates({}); }, [selectedAsset]);

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
    const todayUtcDay = today.getUTCDay();

    // Auto-generate for MNQ only
    const key12 = '2026-06-12';
    if (!existing.some(a => a.type === 'daily' && a.date === key12)) {
      generate('daily', key12, 'MNQ');
    }
    const keyW8 = '2026-06-08';
    if (!existing.some(a => a.type === 'weekly' && a.date === keyW8)) {
      generate('weekly', keyW8, 'MNQ');
    }
    const keyNW = '2026-06-15';
    if (!existing.some(a => a.type === 'next_week' && a.date === keyNW)) {
      generate('next_week', keyNW, 'MNQ');
    }

    if (todayUtcDay === 6 || todayUtcDay === 0) {
      const lastTrade = getLastTradeDay();
      if (!existing.some(a => a.type === 'daily' && a.date === lastTrade) && lastTrade !== key12) {
        generate('daily', lastTrade, 'MNQ');
      }
    }
  }

  async function generate(type, date, assetOverride) {
    const asset = assetOverride ?? selectedAsset;
    const gKey  = `${type}:${date}:${asset}`;
    setGenerating(g => ({ ...g, [gKey]: true }));
    const res = await window.market.generateAiAnalysis(type, date, asset);
    setGenerating(g => { const n = {...g}; delete n[gKey]; return n; });
    if (!res.ok) {
      if (res.error === 'no_api_key') setNoKey(true);
      return;
    }
    const storedType = asset === 'MNQ' ? type : `${type}_${asset}`;
    setAnalyses(prev => {
      const filtered = prev.filter(a => !(a.type === storedType && a.date === date));
      return [res.data, ...filtered];
    });
  }

  async function deleteAnalysis(id) {
    await window.market.deleteAiAnalysis(id);
    setAnalyses(prev => prev.filter(a => a.id !== id));
  }

  // Derive filtered analyses per asset
  const typeDaily    = getTypeKey('daily',     selectedAsset);
  const typeWeekly   = getTypeKey('weekly',    selectedAsset);
  const typeNextWeek = getTypeKey('next_week', selectedAsset);

  const dailyAnalyses    = useMemo(() => analyses.filter(a => a.type === typeDaily).sort((a,b) => b.date.localeCompare(a.date)),    [analyses, typeDaily]);
  const weeklyAnalyses   = useMemo(() => analyses.filter(a => a.type === typeWeekly).sort((a,b) => b.date.localeCompare(a.date)),   [analyses, typeWeekly]);
  const nextWeekAnalyses = useMemo(() => analyses.filter(a => a.type === typeNextWeek).sort((a,b) => b.date.localeCompare(a.date)), [analyses, typeNextWeek]);

  const selDaily    = selectedDates.daily    ?? dailyAnalyses[0]?.date;
  const selWeekly   = selectedDates.weekly   ?? weeklyAnalyses[0]?.date;
  const selNextWeek = selectedDates.next_week ?? nextWeekAnalyses[0]?.date;

  const curDaily    = dailyAnalyses.find(a => a.date === selDaily) ?? null;
  const curWeekly   = weeklyAnalyses.find(a => a.date === selWeekly) ?? null;
  const curNextWeek = nextWeekAnalyses.find(a => a.date === selNextWeek) ?? null;

  const isGenDaily    = Object.keys(generating).some(k => k.startsWith(`daily:`) && k.endsWith(`:${selectedAsset}`));
  const isGenWeekly   = Object.keys(generating).some(k => k.startsWith(`weekly:`) && k.endsWith(`:${selectedAsset}`));
  const isGenNextWeek = Object.keys(generating).some(k => k.startsWith(`next_week:`) && k.endsWith(`:${selectedAsset}`));

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
      <div style={{ marginBottom:'20px' }}>
        <div style={{ fontSize:'11px', color:'#3a4a5a', letterSpacing:'3px', marginBottom:'4px' }}>IA MARCHÉ · FUTURES</div>
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

      {/* Asset selector */}
      <AssetSelector selected={selectedAsset} onChange={setSelectedAsset} />

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
            <DateSelector analyses={dailyAnalyses} type={typeDaily} selected={selDaily} onSelect={d => setSelectedDates(s => ({...s, daily:d}))} />
            <div style={{ display:'flex', gap:'8px', alignItems:'center', marginLeft:'auto' }}>
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
          {selDaily && (
            <div style={{ marginBottom:'16px', fontSize:'12px', color:'#5a6a82', letterSpacing:'1px' }}>
              {fmtDate(selDaily)}
            </div>
          )}
          <AnalysisCard
            analysis={curDaily}
            generating={isGenDaily ? 'Analyse ICT de la journée en cours…' : null}
            chartLabel="M15 · ICT SESSIONS"
            asset={selectedAsset}
            onRegenerate={() => generate('daily', selDaily ?? getLastTradeDay())}
            onDelete={() => curDaily && deleteAnalysis(curDaily.id)}
          />
          <ChatPanel analysisContent={curDaily?.content} asset={selectedAsset} tab="daily" />
        </div>
      )}

      {/* WEEKLY TAB */}
      {tab === 'weekly' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px', flexWrap:'wrap', gap:'10px' }}>
            <DateSelector analyses={weeklyAnalyses} type={typeWeekly} selected={selWeekly} onSelect={d => setSelectedDates(s => ({...s, weekly:d}))} />
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
            chartLabel="H1 · BILAN HEBDO"
            asset={selectedAsset}
            onRegenerate={() => generate('weekly', selWeekly ?? getLastMonday())}
            onDelete={() => curWeekly && deleteAnalysis(curWeekly.id)}
          />
          <ChatPanel analysisContent={curWeekly?.content} asset={selectedAsset} tab="weekly" />
        </div>
      )}

      {/* NEXT WEEK TAB */}
      {tab === 'next_week' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px', flexWrap:'wrap', gap:'10px' }}>
            <DateSelector analyses={nextWeekAnalyses} type={typeNextWeek} selected={selNextWeek} onSelect={d => setSelectedDates(s => ({...s, next_week:d}))} />
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
            chartLabel="H1 · PLAN SEMAINE"
            asset={selectedAsset}
            onRegenerate={() => generate('next_week', selNextWeek ?? getNextMonday())}
            onDelete={() => curNextWeek && deleteAnalysis(curNextWeek.id)}
          />
          <ChatPanel analysisContent={curNextWeek?.content} asset={selectedAsset} tab="next_week" />
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop:'32px', paddingTop:'16px', borderTop:'1px solid rgba(136,153,187,0.08)', display:'flex', gap:'20px', flexWrap:'wrap' }}>
        <div style={{ fontSize:'10px', color:'#2a3a4a', letterSpacing:'1px' }}>
          ⏱ Résumé journalier : Lun–Ven à 22h00 (Paris) · MNQ auto
        </div>
        <div style={{ fontSize:'10px', color:'#2a3a4a', letterSpacing:'1px' }}>
          ⏱ Bilan hebdo + plan : Samedi à 08h00 (Paris) · MNQ auto
        </div>
        <div style={{ fontSize:'10px', color:'#2a3a4a', letterSpacing:'1px' }}>
          📡 Données : Yahoo Finance (15 min délai)
        </div>
      </div>
    </div>
  );
}
