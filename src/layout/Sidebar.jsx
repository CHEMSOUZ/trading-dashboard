import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/dashboard', label: 'Dashboard',    sub: 'Stats & Journal',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { to: '/stats',     label: 'Statistiques', sub: 'Graphiques & Calendrier',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> },
  { to: '/analysis',  label: 'Analyse',      sub: 'Notes & Screenshots',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
  { to: '/global',    label: 'Vue Globale',  sub: 'Tous les comptes',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  { to: '/topstep',   label: 'Topstep',      sub: 'Combine & Funded', badge: 'LIVE', _for: 'topstep',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg> },
  { to: '/lucid',     label: 'Lucid',        sub: 'Eval & Funded', badge: 'LIVE', _for: 'tradovate',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg> },
  { to: '/emotional', label: 'État Mental',  sub: 'Bilan pré-séance',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
  { to: '/calendar',  label: 'Annonces',     sub: 'Calendrier économique',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="15" r="1" fill="currentColor"/><circle cx="16" cy="15" r="1" fill="currentColor"/></svg> },
  { to: '/plan',      label: 'Règles & Plan', sub: 'Plans Payout · Funded',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
  { to: '/strategie', label: 'Stratégie ICT',  sub: 'Sessions NY · London',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { to: '/payout',    label: 'Payout',        sub: 'Investissements & revenus',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { to: '/fitness',   label: 'Fitness & Santé', sub: 'Sport & Nutrition',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><rect x="2" y="9" width="4" height="6" rx="1"/><rect x="18" y="9" width="4" height="6" rx="1"/></svg> },
];

// -- Status detection ----------------------------------------
const ACCOUNT_RULES = {
  topstep_50k:       { size: 50000,  maxLoss: 2000 },
  topstep_100k:      { size: 100000, maxLoss: 3000 },
  topstep_150k:      { size: 150000, maxLoss: 4500 },
  topstep_ef_50k:    { size: 50000,  maxLoss: 2000 },
  topstep_ef_100k:   { size: 100000, maxLoss: 3000 },
  topstep_ef_150k:   { size: 150000, maxLoss: 4500 },
  tradovate_live:    { size: null,   maxLoss: null  },
  tradovate_demo:    { size: null,   maxLoss: null  },
  perso:             { size: null,   maxLoss: null  },
  autre:             { size: null,   maxLoss: null  },
};

const CHALLENGE_TYPES = new Set(['topstep_50k','topstep_100k','topstep_150k']);
const EXPRESS_FUNDED_TYPES = new Set(['topstep_ef_50k','topstep_ef_100k','topstep_ef_150k']);

async function computeBlownStatus(acc, currentActiveId) {
  const rules = ACCOUNT_RULES[acc.type];
  const isExpressFunded = EXPRESS_FUNDED_TYPES.has(acc.type);
  if (!rules?.size || !rules?.maxLoss) return { isBlown: false, pnl: null, isValidated: false, isExpressFunded };
  try {
    await window.accounts.setActive(acc.id);
    const res = await window.db.getAllTrades();
    if (currentActiveId) await window.accounts.setActive(currentActiveId);
    if (!res.ok) return { isBlown: false, pnl: null, isValidated: false, isExpressFunded };
    const trades = res.data;
    const sorted = [...trades]
      .filter(t => (t.result_net ?? t.result) != null)
      .sort((a, b) => (a.entered_at || a.date || '').localeCompare(b.entered_at || b.date || ''));
    let hwm = rules.size, floor = rules.size - rules.maxLoss, bal = rules.size;
    for (const t of sorted) {
      bal += t.result_net ?? t.result ?? 0;
      if (bal > hwm) { hwm = bal; floor = hwm - rules.maxLoss; }
    }
    const totalPnl = trades.reduce((s, t) => s + (t.result_net ?? t.result ?? 0), 0);

    // Validated: challenge + pnl >= 3000 + first day respected consistency (< 1500)
    let isValidated = false;
    if (CHALLENGE_TYPES.has(acc.type) && sorted.length > 0) {
      const firstDate = sorted[0].entered_at?.slice(0, 10) ?? sorted[0].date ?? '';
      const firstDayPnl = sorted
        .filter(t => (t.entered_at?.slice(0, 10) ?? t.date ?? '') === firstDate)
        .reduce((s, t) => s + (t.result_net ?? t.result ?? 0), 0);
      isValidated = totalPnl >= 3000 && firstDayPnl < 1500;
    }

    return {
      isBlown: rules.size + totalPnl <= floor,
      pnl: Math.round(totalPnl * 100) / 100,
      isValidated,
      isExpressFunded,
    };
  } catch {
    if (currentActiveId) { try { await window.accounts.setActive(currentActiveId); } catch {} }
    return { isBlown: false, pnl: null, isValidated: false, isExpressFunded };
  }
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 220;

export default function Sidebar({ activeAccount, onSwitchAccount, onAccountUpdated, onManageAccounts }) {
  const location = useLocation();
  const [accounts, setAccounts]         = useState([]);
  const [accountStatuses, setAccountStatuses] = useState({});
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [renamingId, setRenamingId]     = useState(null);
  const [renameValue, setRenameValue]   = useState('');
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar_width');
    return saved ? parseInt(saved) : DEFAULT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX    = useRef(0);
  const dragStartWidth = useRef(0);
  const renameInputRef = useRef(null);

  useEffect(() => {
    loadAccounts();
  }, [activeAccount]);

  async function loadAccounts() {
    const res = await window.accounts.getAll();
    if (!res.ok) return;
    const accs = res.data.accounts;
    setAccounts(accs);
    const activeRes = await window.accounts.getActive();
    const currentId = activeRes.ok ? activeRes.data?.id : null;
    const statuses = {};
    for (const acc of accs) {
      statuses[acc.id] = await computeBlownStatus(acc, currentId);
    }
    if (currentId) { try { await window.accounts.setActive(currentId); } catch {} }
    setAccountStatuses(statuses);
  }

  // ── Resize ────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
    setIsDragging(true);
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;
    function onMouseMove(e) {
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + e.clientX - dragStartX.current));
      setWidth(newW);
    }
    function onMouseUp() {
      setIsDragging(false);
      setWidth(w => { localStorage.setItem('sidebar_width', String(w)); return w; });
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [isDragging]);

  // ── Switch account (no redirect) ──────────────────────────
  async function switchTo(id) {
    if (id === activeAccount?.id) { setShowSwitcher(false); return; }
    setShowSwitcher(false);
    await onSwitchAccount(id);
  }

  // ── Rename account ────────────────────────────────────────
  function startRename(acc, e) {
    e.stopPropagation();
    setRenamingId(acc.id);
    setRenameValue(acc.name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }

  async function confirmRename(id) {
    const name = renameValue.trim();
    if (!name) { cancelRename(); return; }
    await window.accounts.update(id, { name });
    setRenamingId(null);
    await loadAccounts();
    if (id === activeAccount?.id) onAccountUpdated?.();
  }

  function cancelRename() { setRenamingId(null); setRenameValue(''); }

  return (
    <aside style={{ width: `${width}px`, flexShrink: 0, background: '#060c10', borderRight: '1px solid rgba(0,255,136,0.08)', display: 'flex', flexDirection: 'column', position: 'relative', userSelect: isDragging ? 'none' : 'auto' }}>

      {/* Account selector */}
      <div style={{ padding: '10px', borderBottom: '1px solid rgba(0,255,136,0.06)' }}>
        <div onClick={() => setShowSwitcher(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 11px', borderRadius: '6px', cursor: 'pointer', background: showSwitcher ? 'rgba(0,255,136,0.06)' : 'transparent', border: `1px solid ${showSwitcher ? 'rgba(0,255,136,0.2)' : 'rgba(0,255,136,0.06)'}`, transition: 'all 0.15s' }}>
          {(() => {
            const st = accountStatuses[activeAccount?.id];
            const dc = st?.isBlown ? '#ff4455' : st?.isExpressFunded ? '#f0c020' : '#00ff88';
            return <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: dc, boxShadow: `0 0 7px ${dc}`, flexShrink: 0 }} />;
          })()}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#e8f8e8', wordBreak: 'break-word', lineHeight: '1.3' }}>{activeAccount?.name ?? 'Aucun compte'}</div>
            <div style={{ fontSize: '12px', color: '#3a6a4a', marginTop: '2px' }}>{activeAccount?.typeInfo?.label ?? '—'}</div>
          </div>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3a6a4a" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <polyline points={showSwitcher ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
          </svg>
        </div>

        {/* Dropdown */}
        {showSwitcher && (
          <div style={{ position: 'absolute', top: '90px', left: '8px', right: '8px', zIndex: 50, background: '#070d12', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px', padding: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>

            {(() => {
              const liveAccts      = accounts.filter(a => !accountStatuses[a.id]?.isBlown && (accountStatuses[a.id]?.isExpressFunded || a.type === 'tradovate_live'));
              const challengeAccts = accounts.filter(a => !accountStatuses[a.id]?.isBlown && !accountStatuses[a.id]?.isExpressFunded && a.type !== 'tradovate_live' && !accountStatuses[a.id]?.isValidated && CHALLENGE_TYPES.has(a.type));
              const validatedAccts = accounts.filter(a => !accountStatuses[a.id]?.isBlown && !accountStatuses[a.id]?.isExpressFunded && a.type !== 'tradovate_live' && accountStatuses[a.id]?.isValidated);
              const regularAccts   = accounts.filter(a => !accountStatuses[a.id]?.isBlown && !accountStatuses[a.id]?.isExpressFunded && a.type !== 'tradovate_live' && !accountStatuses[a.id]?.isValidated && !CHALLENGE_TYPES.has(a.type));
              const blownAccts     = accounts.filter(a => accountStatuses[a.id]?.isBlown);

              function renderAccItem(a) {
                const st = accountStatuses[a.id];
                const isBlown = st?.isBlown ?? false;
                const isActive = a.id === activeAccount?.id;
                const isEF = st?.isExpressFunded ?? false;
                const isVal = st?.isValidated ?? false;
                const dotColor = isBlown ? '#ff4455' : isEF ? '#f0c020' : '#00ff88';
                const bgNormal = isBlown ? 'rgba(255,68,85,0.06)' : isEF ? 'rgba(240,192,32,0.06)' : 'rgba(0,255,136,0.06)';
                const borderAccent = isBlown ? 'rgba(255,68,85,0.4)' : isEF ? 'rgba(240,192,32,0.4)' : 'transparent';
                return (
                  <div key={a.id} style={{ borderRadius: '5px', marginBottom: '2px', overflow: 'hidden' }}>
                    {renamingId === a.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '5px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') confirmRename(a.id); if (e.key === 'Escape') cancelRename(); }}
                          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e8f8e8', fontSize: '13px', fontFamily: 'inherit', caretColor: '#00ff88' }}
                        />
                        <button onClick={() => confirmRename(a.id)} style={{ background: 'rgba(0,255,136,0.15)', border: 'none', color: '#00ff88', padding: '2px 7px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>✓</button>
                        <button onClick={cancelRename} style={{ background: 'none', border: 'none', color: '#4a7a5a', padding: '2px 4px', cursor: 'pointer', fontSize: '13px' }}>✕</button>
                      </div>
                    ) : (
                      <div onClick={() => switchTo(a.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', cursor: 'pointer', background: isActive ? bgNormal : 'transparent', transition: 'background 0.12s', borderRadius: '5px', borderLeft: `2px solid ${isBlown || isEF ? borderAccent : 'transparent'}` }}
                        onMouseEnter={e => e.currentTarget.style.background = bgNormal}
                        onMouseLeave={e => e.currentTarget.style.background = isActive ? bgNormal : 'transparent'}
                      >
                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColor, boxShadow: `0 0 5px ${dotColor}`, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '13px', color: isBlown ? '#ff7777' : isEF ? '#f0c020' : isActive ? a.color : '#c8d8c8', fontWeight: isActive ? '700' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                            {isBlown && <span style={{ fontSize: '8px', background: 'rgba(255,68,85,0.2)', border: '1px solid rgba(255,68,85,0.4)', color: '#ff4455', padding: '1px 4px', borderRadius: '2px', fontWeight: '700', flexShrink: 0 }}>CRAMÉ</span>}
                            {!isBlown && isEF && <span style={{ fontSize: '8px', background: 'rgba(240,192,32,0.2)', border: '1px solid rgba(240,192,32,0.4)', color: '#f0c020', padding: '1px 4px', borderRadius: '2px', fontWeight: '700', flexShrink: 0 }}>FUNDED</span>}
                            {!isBlown && !isEF && isVal && <span style={{ fontSize: '8px', background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', padding: '1px 4px', borderRadius: '2px', fontWeight: '700', flexShrink: 0 }}>VALIDÉ</span>}
                          </div>
                          <div style={{ fontSize: '11px', color: isBlown ? '#6a3a3a' : '#3a6a4a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span>{a.typeInfo?.label}</span>
                            {st?.pnl != null && <span style={{ color: st.pnl >= 0 ? '#00aa55' : '#ff4455' }}>{st.pnl >= 0 ? '+' : ''}{st.pnl.toFixed(0)}$</span>}
                          </div>
                        </div>
                        <button onClick={e => startRename(a, e)} title="Renommer" style={{ background: 'none', border: 'none', color: '#2a5a3a', cursor: 'pointer', fontSize: '13px', padding: '2px 4px', flexShrink: 0, opacity: 0.6, transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#00ff88'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = '#2a5a3a'; }}
                        >✏️</button>
                      </div>
                    )}
                  </div>
                );
              }

              const hasMore = (a, ...rest) => a.length > 0 && rest.some(r => r.length > 0);

              return (
                <>
                  {/* 1. LIVE : Express Funded + Tradovate Live */}
                  {liveAccts.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#f0c020', letterSpacing: '2px', padding: '4px 8px', marginBottom: '2px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f0c020', boxShadow: '0 0 4px #f0c020' }} />
                        LIVE
                      </div>
                      {liveAccts.map(renderAccItem)}
                      {hasMore(liveAccts, challengeAccts, validatedAccts, regularAccts, blownAccts) && <div style={{ borderTop: '1px solid rgba(0,255,136,0.06)', margin: '4px 0 6px' }} />}
                    </>
                  )}

                  {/* 2. CHALLENGE : Topstep actifs non validés */}
                  {challengeAccts.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#00dd77', letterSpacing: '2px', padding: '4px 8px', marginBottom: '2px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00dd77', boxShadow: '0 0 4px #00dd77' }} />
                        CHALLENGE
                      </div>
                      {challengeAccts.map(renderAccItem)}
                      {hasMore(challengeAccts, validatedAccts, regularAccts, blownAccts) && <div style={{ borderTop: '1px solid rgba(0,255,136,0.06)', margin: '4px 0 6px' }} />}
                    </>
                  )}

                  {/* 3. VALIDÉ */}
                  {validatedAccts.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#00ff88', letterSpacing: '2px', padding: '4px 8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '9px' }}>✅</span>
                        VALIDÉ
                      </div>
                      {validatedAccts.map(renderAccItem)}
                      {hasMore(validatedAccts, regularAccts, blownAccts) && <div style={{ borderTop: '1px solid rgba(0,255,136,0.06)', margin: '4px 0 6px' }} />}
                    </>
                  )}

                  {/* 4. AUTRES ACTIFS */}
                  {regularAccts.length > 0 && (
                    <>
                      <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', padding: '4px 8px', marginBottom: '4px' }}>ACTIFS</div>
                      {regularAccts.map(renderAccItem)}
                      {blownAccts.length > 0 && <div style={{ borderTop: '1px solid rgba(0,255,136,0.06)', margin: '4px 0 6px' }} />}
                    </>
                  )}

                  {/* 5. CRAMÉS */}
                  {blownAccts.length > 0 && (
                    <>
                      <div style={{ fontSize: '10px', color: '#ff4455', letterSpacing: '2px', padding: '4px 8px', marginBottom: '2px', opacity: 0.8 }}>CRAMÉS</div>
                      {blownAccts.map(renderAccItem)}
                    </>
                  )}
                </>
              );
            })()}

            <div style={{ borderTop: '1px solid rgba(0,255,136,0.06)', margin: '6px 0' }} />

            {/* Manage accounts */}
            <div onClick={() => { setShowSwitcher(false); onManageAccounts?.(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '5px', cursor: 'pointer', color: '#3a6a4a', fontSize: '12px', transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,255,136,0.04)'; e.currentTarget.style.color = '#00ff88'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3a6a4a'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Gérer les comptes
            </div>
          </div>
        )}
      </div>

      {/* Logo */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(0,255,136,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: '26px', height: '26px', background: 'linear-gradient(135deg,#00ff88,#00aa55)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(0,255,136,0.25)', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#060c10" strokeWidth="2.5" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8f8e8', letterSpacing: '1px' }}>TRADE</div>
            <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px' }}>DASHBOARD</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '6px 0' }}>
        {NAV.filter(item => {
          const isTradovate = ['tradovate_live', 'tradovate_demo'].includes(activeAccount?.type);
          if (item._for === 'tradovate') return isTradovate;
          if (item._for === 'topstep')   return !isTradovate;
          return true;
        }).map(({ to, label, sub, icon, badge }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + '/');
          return (
            <NavLink key={to} to={to} onClick={() => setShowSwitcher(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', margin: '1px 6px', borderRadius: '6px', textDecoration: 'none', color: active ? '#00ff88' : '#5a8a6a', background: active ? 'rgba(0,255,136,0.08)' : 'transparent', borderLeft: `2px solid ${active ? '#00ff88' : 'transparent'}`, transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#8aaa90'; e.currentTarget.style.background = 'rgba(0,255,136,0.04)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#5a8a6a'; e.currentTarget.style.background = 'transparent'; }}}
            >
              <span style={{ flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: active ? '700' : '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                <div style={{ fontSize: '12px', color: active ? '#3a8a4a' : '#3a5a3a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
              </div>
              {badge && <span style={{ fontSize: '11px', letterSpacing: '1px', background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', padding: '2px 5px', borderRadius: '2px', flexShrink: 0 }}>{badge}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* New trade */}
      <div style={{ padding: '10px', borderTop: '1px solid rgba(0,255,136,0.06)' }}>
        <NavLink to="/dashboard/new" style={{ textDecoration: 'none' }} onClick={() => setShowSwitcher(false)}>
          <button style={{ width: '100%', padding: '10px 0', background: 'linear-gradient(135deg,rgba(0,255,136,0.15),rgba(0,170,85,0.1))', border: '1px solid rgba(0,255,136,0.25)', borderRadius: '6px', color: '#00ff88', fontSize: '13px', fontFamily: 'inherit', letterSpacing: '1.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 14px rgba(0,255,136,0.15)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            NOUVEAU TRADE
          </button>
        </NavLink>
      </div>

      <div style={{ padding: '6px', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: '#1a3a22', letterSpacing: '1px' }}>v1.4.0</span>
      </div>

      {/* Resize handle */}
      <div onMouseDown={onMouseDown} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={e => e.currentTarget.querySelector('.hb').style.background = '#00ff88'}
        onMouseLeave={e => { if (!isDragging) e.currentTarget.querySelector('.hb').style.background = 'rgba(0,255,136,0.15)'; }}
      >
        <div className="hb" style={{ width: '2px', height: '40px', borderRadius: '2px', background: isDragging ? '#00ff88' : 'rgba(0,255,136,0.15)', transition: 'background 0.15s' }} />
      </div>
    </aside>
  );
}
