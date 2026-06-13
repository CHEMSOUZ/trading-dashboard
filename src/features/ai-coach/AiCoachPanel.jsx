import { useState, useEffect, useRef, useCallback } from 'react';

// ── Design ────────────────────────────────────────────────────
const C = {
  bg:       '#0a0b14',
  panel:    'rgba(10,11,20,0.97)',
  border:   'rgba(124,58,237,0.25)',
  accent:   '#7c3aed',
  accentL:  '#a78bfa',
  green:    '#00ff88',
  greenD:   '#00cc6a',
  text1:    '#e8edf8',
  text2:    '#9aa5bb',
  text3:    '#5a6a82',
  user:     'rgba(124,58,237,0.15)',
  userBdr:  'rgba(124,58,237,0.35)',
  ai:       'rgba(0,255,136,0.06)',
  aiBdr:    'rgba(0,255,136,0.20)',
};

const QUICK_PROMPTS = [
  { label: 'Analyse du jour',    text: 'Analyse mes trades d\'aujourd\'hui et identifie les points à améliorer.' },
  { label: 'Risk management',    text: 'Évalue mon risk management sur les 30 derniers trades et propose des ajustements.' },
  { label: 'Patterns perdants',  text: 'Détecte mes patterns perdants récurrents (revenge trading, overtrade, mauvaise session).' },
  { label: 'Points forts',       text: 'Quels sont mes meilleurs créneaux, paires et setups selon mes données ?' },
  { label: 'Plan pour demain',   text: 'Basé sur mes performances récentes, que dois-je faire ou éviter demain ?' },
];

// ── Local pattern analysis (offline) ─────────────────────────
function analyzeLocally(trades, stats, account) {
  const insights = [];
  const today    = new Date().toISOString().slice(0, 10);
  const todayT   = trades.filter(t => (t.entered_at || t.date || '').startsWith(today));
  const last7    = trades.filter(t => {
    const d = (t.entered_at || t.date || '').slice(0, 10);
    return d >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  });

  // Streak de pertes
  if (stats?.streak < -2) {
    insights.push({ type: 'danger', text: `Série de ${Math.abs(stats.streak)} pertes consécutives. Risque de revenge trading élevé — envisage une pause.` });
  }

  // Overtrade aujourd'hui
  if (todayT.length > 5) {
    insights.push({ type: 'warning', text: `${todayT.length} trades aujourd'hui — seuil critique. Vérifie si tu respectes ton plan.` });
  }

  // PnL du jour
  const todayPnl = todayT.reduce((s, t) => s + (t.result_net ?? t.result ?? 0), 0);
  if (todayT.length > 0) {
    const sign = todayPnl >= 0 ? '+' : '';
    const col  = todayPnl >= 0 ? 'win' : 'loss';
    insights.push({ type: col, text: `PnL du jour : ${sign}${todayPnl.toFixed(2)}$ sur ${todayT.length} trade${todayT.length > 1 ? 's' : ''}.` });
  }

  // Winrate semaine
  const wins7   = last7.filter(t => (t.result_net ?? t.result ?? 0) > 0).length;
  const wr7     = last7.length > 0 ? Math.round(wins7 / last7.length * 100) : null;
  if (wr7 !== null && last7.length >= 5) {
    if (wr7 < 40) insights.push({ type: 'warning', text: `Winrate 7 jours : ${wr7}% — en dessous de ton niveau habituel (${stats?.winrate?.toFixed(0)}%). Reviens aux bases.` });
    else          insights.push({ type: 'info', text: `Winrate 7 jours : ${wr7}% sur ${last7.length} trades.` });
  }

  // Drawdown warning
  if (stats?.maxDrawdown && account) {
    const rules = getAccountRules(account.type);
    if (rules.maxLoss && stats.maxDrawdown > rules.maxLoss * 0.7) {
      insights.push({ type: 'danger', text: `Drawdown max ${stats.maxDrawdown.toFixed(0)}$ — proche de la limite du compte (${rules.maxLoss}$). Attention !` });
    }
  }

  if (insights.length === 0) {
    insights.push({ type: 'info', text: `Aucun signal d'alerte détecté. Continue sur ta lancée.` });
  }

  return insights;
}

function getAccountRules(type) {
  const RULES = {
    topstep_50k:    { maxLoss: 2000, dailyLoss: 1000 },
    topstep_100k:   { maxLoss: 3000, dailyLoss: 2000 },
    topstep_150k:   { maxLoss: 4500, dailyLoss: 3000 },
    lucid_eval_50k: { maxLoss: 2000, dailyLoss: null },
    lucid_eval_100k:{ maxLoss: 3000, dailyLoss: null },
    lucid_funded_50k:{ maxLoss: 2500, dailyLoss: 2000 },
    lucid_funded_100k:{ maxLoss: 3000, dailyLoss: 3000 },
  };
  return RULES[type] ?? {};
}

// ── Build system prompt ───────────────────────────────────────
function buildSystemPrompt(trades, stats, account) {
  const today   = new Date().toISOString().slice(0, 10);
  const todayT  = trades.filter(t => (t.entered_at || t.date || '').startsWith(today));
  const last30  = trades.slice(0, 50);

  function tradeSummary(t) {
    const pnl = t.result_net ?? t.result ?? 0;
    const sign = pnl >= 0 ? '+' : '';
    return `${t.pair} ${t.direction} ${sign}${pnl.toFixed(2)}$ ${t.outcome ?? ''}`.trim();
  }

  const todaySummary = todayT.length > 0
    ? todayT.map(tradeSummary).join(' | ')
    : 'Aucun trade aujourd\'hui';

  const recentSummary = last30.slice(0, 20).map(tradeSummary).join('\n');

  const rules = getAccountRules(account?.type);
  const rulesStr = rules.maxLoss
    ? `Max drawdown: ${rules.maxLoss}$ | Daily loss: ${rules.dailyLoss ?? 'N/A'}$`
    : 'Compte sans règles strictes';

  return `Tu es un AI Coach trading professionnel intégré dans Trading Dashboard.
Tu analyses les trades du trader pour identifier des patterns, comportements problématiques et opportunités d'amélioration.

COMPTE ACTIF: ${account?.name ?? 'Inconnu'} (${account?.typeInfo?.label ?? account?.type ?? '?'})
RÈGLES: ${rulesStr}

STATISTIQUES GLOBALES:
- Total: ${stats?.total ?? 0} trades | Winrate: ${stats?.winrate?.toFixed(1) ?? 0}% | PnL: ${stats?.totalPnl?.toFixed(2) ?? 0}$
- Profit Factor: ${stats?.profitFactor?.toFixed(2) ?? 0} | Avg Win: ${stats?.avgWin?.toFixed(2) ?? 0}$ | Avg Loss: ${stats?.avgLoss?.toFixed(2) ?? 0}$
- Max Drawdown: ${stats?.maxDrawdown?.toFixed(2) ?? 0}$ | Streak: ${stats?.streak ?? 0}

TRADES AUJOURD'HUI (${today}):
${todaySummary}

TRADES RÉCENTS (50 derniers):
${recentSummary}

Réponds TOUJOURS en français. Sois concis, précis et actionnable (3-5 phrases max par réponse sauf si demandé autrement).
Si tu détectes revenge trading, overtrade ou déviation du plan: dis-le clairement et propose une action concrète.`;
}

// ── InsightBadge ─────────────────────────────────────────────
function InsightBadge({ insight }) {
  const colors = {
    danger:  { bg: 'rgba(255,51,68,0.10)', border: 'rgba(255,51,68,0.30)', dot: '#ff3344', text: '#ff7788' },
    warning: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', dot: '#f59e0b', text: '#fbbf24' },
    win:     { bg: 'rgba(0,255,136,0.08)', border: 'rgba(0,255,136,0.25)', dot: '#00ff88', text: '#00dd77' },
    loss:    { bg: 'rgba(255,51,68,0.08)', border: 'rgba(255,51,68,0.20)', dot: '#ff3344', text: '#ff6677' },
    info:    { bg: 'rgba(136,153,187,0.08)', border: 'rgba(136,153,187,0.20)', dot: '#8899bb', text: '#9aabcc' },
  };
  const s = colors[insight.type] ?? colors.info;
  return (
    <div style={{ display: 'flex', gap: '8px', padding: '8px 10px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: '6px', marginBottom: '5px' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: '5px', boxShadow: `0 0 5px ${s.dot}` }} />
      <span style={{ fontSize: '12px', color: s.text, lineHeight: '1.5' }}>{insight.text}</span>
    </div>
  );
}

// ── ChatBubble ───────────────────────────────────────────────
function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: '10px' }}>
      <div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px', letterSpacing: '0.5px' }}>
        {isUser ? 'VOUS' : 'AI COACH'}
      </div>
      <div style={{
        maxWidth: '90%', padding: '10px 13px', borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        background: isUser ? C.user : C.ai,
        border: `1px solid ${isUser ? C.userBdr : C.aiBdr}`,
        fontSize: '13px', color: C.text1, lineHeight: '1.6', whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────
export default function AiCoachPanel({ open, onClose, activeAccount }) {
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [hasKey,      setHasKey]      = useState(true);
  const [insights,    setInsights]    = useState([]);
  const [trades,      setTrades]      = useState([]);
  const [stats,       setStats]       = useState(null);
  const [tab,         setTab]         = useState('chat'); // 'chat' | 'insights'
  const [initialised, setInitialised] = useState(false);
  const scrollRef  = useRef(null);
  const inputRef   = useRef(null);

  // Load on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [keyRes, histRes, tradesRes, statsRes] = await Promise.all([
        window.ai.hasKey(),
        window.ai.getMessages(),
        window.db.getAllTrades(),
        window.db.getStats(),
      ]);
      setHasKey(keyRes.data ?? false);
      if (histRes.ok) setMessages(histRes.data ?? []);
      const t = tradesRes.ok ? (tradesRes.data ?? []) : [];
      const s = statsRes.ok  ? (statsRes.data ?? null)  : null;
      setTrades(t);
      setStats(s);
      setInsights(analyzeLocally(t, s, activeAccount));
      setInitialised(true);
    })();
  }, [open, activeAccount]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // Focus input when open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const sendMessage = useCallback(async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput('');
    setLoading(true);

    const userMsg = { role: 'user', content: userText };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    await window.ai.addMessage(userMsg);

    const systemPrompt = buildSystemPrompt(trades, stats, activeAccount);
    const res = await window.ai.chat(newMsgs, systemPrompt);

    if (res.ok) {
      const aiMsg = { role: 'assistant', content: res.data };
      setMessages(m => [...m, aiMsg]);
      await window.ai.addMessage(aiMsg);
    } else if (res.error === 'no_api_key') {
      setHasKey(false);
    } else {
      const errMsg = { role: 'assistant', content: `Erreur: ${res.error}. Vérifie ta connexion ou réessaie.` };
      setMessages(m => [...m, errMsg]);
    }
    setLoading(false);
  }, [input, loading, messages, trades, stats, activeAccount]);

  const clearHistory = useCallback(async () => {
    await window.ai.clearHistory();
    setMessages([]);
  }, []);

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: 'rgba(0,0,0,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.3s ease',
          backdropFilter: open ? 'blur(2px)' : 'none',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 999,
        width: '400px',
        background: C.panel,
        borderLeft: `1px solid ${C.border}`,
        boxShadow: open ? `-20px 0 60px rgba(124,58,237,0.15), -40px 0 100px rgba(0,0,0,0.5)` : 'none',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.35s ease',
      }}>

        {/* Header */}
        <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 1 8 8v4a8 8 0 0 1-16 0v-4a8 8 0 0 1 8-8z"/>
                  <path d="M9 10h.01M15 10h.01M12 16a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: C.text1, letterSpacing: '0.5px' }}>AI COACH</div>
                <div style={{ fontSize: '11px', color: C.accentL }}>claude-sonnet-4-6</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {messages.length > 0 && (
                <button onClick={clearHistory} title="Effacer l'historique"
                  style={{ background: 'none', border: `1px solid rgba(136,153,187,0.2)`, borderRadius: '5px', color: C.text3, padding: '5px 8px', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,51,68,0.4)'; e.currentTarget.style.color = '#ff3344'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(136,153,187,0.2)'; e.currentTarget.style.color = C.text3; }}>
                  Effacer
                </button>
              )}
              <button onClick={onClose}
                style={{ background: 'none', border: `1px solid rgba(136,153,187,0.2)`, borderRadius: '5px', color: C.text3, padding: '5px 9px', cursor: 'pointer', fontSize: '15px', fontFamily: 'inherit', transition: 'all 0.15s', lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(136,153,187,0.5)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(136,153,187,0.2)'}>
                ✕
              </button>
            </div>
          </div>

          {/* Account context bar */}
          {activeAccount && (
            <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: '6px', fontSize: '11px', color: C.accentL, display: 'flex', gap: '12px' }}>
              <span>{activeAccount.name}</span>
              {stats && (
                <>
                  <span style={{ color: C.text3 }}>•</span>
                  <span style={{ color: stats.totalPnl >= 0 ? C.green : '#ff3344' }}>
                    {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl?.toFixed(0)}$
                  </span>
                  <span style={{ color: C.text3 }}>•</span>
                  <span>{stats.winrate?.toFixed(0)}% WR</span>
                </>
              )}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '10px' }}>
            {['chat', 'insights'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex: 1, padding: '6px', background: tab === t ? 'rgba(124,58,237,0.15)' : 'transparent', border: `1px solid ${tab === t ? 'rgba(124,58,237,0.4)' : 'rgba(136,153,187,0.15)'}`, borderRadius: '5px', color: tab === t ? C.accentL : C.text3, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: tab === t ? '700' : '400', letterSpacing: '1px', transition: 'all 0.15s', textTransform: 'uppercase' }}>
                {t === 'chat' ? 'Chat' : 'Analyse Locale'}
              </button>
            ))}
          </div>
        </div>

        {/* No API key warning */}
        {!hasKey && (
          <div style={{ margin: '12px', padding: '12px', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: '8px', fontSize: '12px', color: '#fbbf24', lineHeight: '1.6' }}>
            <div style={{ fontWeight: '700', marginBottom: '4px' }}>Clé API manquante</div>
            Ajoute <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: '3px' }}>ANTHROPIC_API_KEY=sk-ant-...</code> dans le fichier <code>.env</code> à la racine du projet, puis redémarre l'app.
            <br/><br/>
            L'analyse locale (onglet "Analyse Locale") fonctionne sans clé.
          </div>
        )}

        {/* CHAT tab */}
        {tab === 'chat' && (
          <>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
              {messages.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                  <div style={{ fontSize: '28px', marginBottom: '12px' }}>🎯</div>
                  <div style={{ fontSize: '13px', color: C.text2, lineHeight: '1.6', marginBottom: '16px' }}>
                    Pose-moi une question sur tes trades ou utilise un raccourci ci-dessous.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                    {QUICK_PROMPTS.map(qp => (
                      <button key={qp.label} onClick={() => sendMessage(qp.text)}
                        style={{ padding: '6px 12px', background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '20px', color: C.accentL, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.20)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.45)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.10)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.25)'; }}>
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 13px', background: C.ai, border: `1px solid ${C.aiBdr}`, borderRadius: '12px 12px 12px 4px', width: 'fit-content', marginBottom: '10px' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.green, animation: `aiDot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              )}
            </div>

            {/* Quick prompts strip (when has messages) */}
            {messages.length > 0 && (
              <div style={{ padding: '6px 14px', borderTop: `1px solid rgba(136,153,187,0.08)`, display: 'flex', gap: '5px', overflowX: 'auto', flexShrink: 0 }}>
                {QUICK_PROMPTS.slice(0, 3).map(qp => (
                  <button key={qp.label} onClick={() => sendMessage(qp.text)}
                    style={{ padding: '4px 10px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.20)', borderRadius: '14px', color: C.accentL, fontSize: '10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.18)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}>
                    {qp.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{ padding: '10px 14px 14px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={loading}
                  placeholder="Pose ta question... (Entrée pour envoyer)"
                  rows={2}
                  style={{
                    flex: 1, background: 'rgba(14,15,22,0.8)', border: `1px solid ${input ? 'rgba(124,58,237,0.40)' : 'rgba(136,153,187,0.18)'}`, borderRadius: '8px',
                    padding: '10px 12px', color: C.text1, fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                    resize: 'none', lineHeight: '1.5', transition: 'border-color 0.15s',
                  }}
                />
                <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                  style={{
                    width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
                    background: input.trim() && !loading ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(136,153,187,0.10)',
                    border: `1px solid ${input.trim() && !loading ? 'rgba(124,58,237,0.5)' : 'rgba(136,153,187,0.2)'}`,
                    color: input.trim() && !loading ? 'white' : C.text3,
                    cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', boxShadow: input.trim() && !loading ? '0 0 16px rgba(124,58,237,0.35)' : 'none',
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
              <div style={{ fontSize: '10px', color: C.text3, marginTop: '5px', textAlign: 'center' }}>
                Shift+Entrée pour saut de ligne
              </div>
            </div>
          </>
        )}

        {/* INSIGHTS tab */}
        {tab === 'insights' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: C.text3, letterSpacing: '1.5px', marginBottom: '10px', textTransform: 'uppercase' }}>
              Analyse locale — sans IA
            </div>
            {!initialised && (
              <div style={{ color: C.text3, fontSize: '12px' }}>Chargement...</div>
            )}
            {initialised && insights.map((ins, i) => <InsightBadge key={i} insight={ins} />)}

            <div style={{ marginTop: '16px', padding: '10px', background: 'rgba(136,153,187,0.05)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: C.text3, marginBottom: '6px', letterSpacing: '1px' }}>RÉSUMÉ RAPIDE</div>
              {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    ['Total trades', stats.total],
                    ['Winrate', `${stats.winrate?.toFixed(1)}%`],
                    ['PnL net', `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl?.toFixed(2)}$`],
                    ['Profit Factor', stats.profitFactor?.toFixed(2)],
                    ['Moy. Win', `+${stats.avgWin?.toFixed(2)}$`],
                    ['Moy. Loss', `-${stats.avgLoss?.toFixed(2)}$`],
                    ['Streak', stats.streak > 0 ? `+${stats.streak} vert` : `${stats.streak} rouge`],
                    ['Max DD', `${stats.maxDrawdown?.toFixed(2)}$`],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: '10px', color: C.text3 }}>{label}</div>
                      <div style={{ fontSize: '13px', color: C.text1, fontWeight: '600' }}>{val ?? '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Keyframe for loading dots */}
      <style>{`
        @keyframes aiDot {
          0%,80%,100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
