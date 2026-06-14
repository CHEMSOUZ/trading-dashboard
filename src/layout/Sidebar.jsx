import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/journal',   label: 'Journal',       sub: 'Synthèse · Trades · Graphiques',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { to: '/goals',     label: 'Objectifs',     sub: 'Goals · Streak · Badges',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg> },
  { to: '/analysis',  label: 'Analyse',       sub: 'Notes & Screenshots',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
  { to: '/global',    label: 'Vue Globale',   sub: 'Tous les comptes',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  { to: '/propfirm',  label: 'PropFirm',      sub: 'Challenge & Funded', badge: 'LIVE',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg> },
  { to: '/emotional', label: 'État Mental',   sub: 'Portrait IA · Psychologie',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
  { to: '/calendar',  label: 'Annonces',      sub: 'Calendrier économique',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="15" r="1" fill="currentColor"/><circle cx="16" cy="15" r="1" fill="currentColor"/></svg> },
  { to: '/plan',      label: 'Règles & Plan', sub: 'Plans Payout · Funded',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
  { to: '/strategie', label: 'Stratégie ICT', sub: 'Sessions NY · London',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { to: '/payout',    label: 'Payout',        sub: 'Investissements & revenus',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { to: '/fitness',   label: 'Fitness & Santé', sub: 'Sport & Nutrition',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><rect x="2" y="9" width="4" height="6" rx="1"/><rect x="18" y="9" width="4" height="6" rx="1"/></svg> },
  { to: '/bot',       label: 'Bot Trading',   sub: 'Signaux MNQ live', badge: 'BOT',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/><line x1="9" y1="17" x2="15" y2="17"/></svg> },
];

// -- Status detection ----------------------------------------
const ACCOUNT_RULES = {
  topstep_50k:         { size: 50000,  maxLoss: 2000, dailyLoss: 1000, profitTarget: 3000, minDays: 2, consistencyPct: 0.50 },
  topstep_100k:        { size: 100000, maxLoss: 3000, dailyLoss: 2000, profitTarget: 6000, minDays: 2, consistencyPct: 0.50 },
  topstep_150k:        { size: 150000, maxLoss: 4500, dailyLoss: 3000, profitTarget: 9000, minDays: 2, consistencyPct: 0.50 },
  topstep_ef_50k:      { size: 50000,  maxLoss: 2000, dailyLoss: 1000 },
  topstep_ef_100k:     { size: 100000, maxLoss: 3000, dailyLoss: 2000 },
  topstep_ef_150k:     { size: 150000, maxLoss: 4500, dailyLoss: 3000 },
  lucid_eval_25k:      { size: 25000,  maxLoss: 1000, dailyLoss: null, profitTarget: 1250, minDays: 0, consistencyPct: 0.50 },
  lucid_eval_50k:      { size: 50000,  maxLoss: 2000, dailyLoss: null, profitTarget: 3000, minDays: 0, consistencyPct: 0.50 },
  lucid_eval_100k:     { size: 100000, maxLoss: 3000, dailyLoss: null, profitTarget: 6000, minDays: 0, consistencyPct: 0.50 },
  lucid_eval_150k:     { size: 150000, maxLoss: 4500, dailyLoss: null, profitTarget: 9000, minDays: 0, consistencyPct: 0.50 },
  lucid_funded_25k:    { size: 25000,  maxLoss: 1000, dailyLoss: 1000 },
  lucid_funded_50k:    { size: 50000,  maxLoss: 2500, dailyLoss: 2000 },
  lucid_funded_100k:   { size: 100000, maxLoss: 3000, dailyLoss: 3000 },
  lucid_funded_150k:   { size: 150000, maxLoss: 4500, dailyLoss: 4500 },
  topstep_cons_50k:    { size: 50000,  maxLoss: 2000, dailyLoss: 1000 },
  topstep_cons_100k:   { size: 100000, maxLoss: 3000, dailyLoss: 2000 },
  topstep_cons_150k:   { size: 150000, maxLoss: 4500, dailyLoss: 3000 },
  topstep_live_50k:    { size: null,   maxLoss: null,  dailyLoss: 1000 },
  topstep_live_100k:   { size: null,   maxLoss: null,  dailyLoss: 2000 },
  topstep_live_150k:   { size: null,   maxLoss: null,  dailyLoss: 3000 },
  lucid_live_50k:      { size: null,   maxLoss: null,  dailyLoss: null },
  lucid_live_100k:     { size: null,   maxLoss: null,  dailyLoss: null },
  lucid_live_150k:     { size: null,   maxLoss: null,  dailyLoss: null },
  tradovate_live:      { size: null,   maxLoss: null,  dailyLoss: null },
  tradovate_demo:      { size: null,   maxLoss: null,  dailyLoss: null },
  perso:               { size: null,   maxLoss: null,  dailyLoss: null },
  autre:               { size: null,   maxLoss: null,  dailyLoss: null },
};

const CHALLENGE_TYPES = new Set([
  'topstep_50k','topstep_100k','topstep_150k',
  'lucid_eval_25k','lucid_eval_50k','lucid_eval_100k','lucid_eval_150k',
]);
const EXPRESS_FUNDED_TYPES = new Set([
  'topstep_ef_50k','topstep_ef_100k','topstep_ef_150k',
  'topstep_cons_50k','topstep_cons_100k','topstep_cons_150k',
  'lucid_funded_25k','lucid_funded_50k','lucid_funded_100k','lucid_funded_150k',
]);
const LIVE_TYPES = new Set([
  'lucid_live_50k','lucid_live_100k','lucid_live_150k',
  'tradovate_live',
  'topstep_live_50k','topstep_live_100k','topstep_live_150k',
]);

async function computeBlownStatus(acc) {
  const rules = ACCOUNT_RULES[acc.type];
  const isExpressFunded = EXPRESS_FUNDED_TYPES.has(acc.type);
  const hasAnyRule = rules?.size || rules?.maxLoss || rules?.dailyLoss;
  if (!hasAnyRule) return { isBlown: false, pnl: null, isValidated: false, isExpressFunded };
  try {
    const res = await window.db.getTradesForPath(acc.dbPath);
    if (!res.ok) return { isBlown: false, pnl: null, isValidated: false, isExpressFunded };
    const trades = res.data;
    const sorted = [...trades]
      .filter(t => (t.result_net ?? t.result) != null)
      .sort((a, b) => (a.entered_at || a.date || '').localeCompare(b.entered_at || b.date || ''));
    const totalPnl = trades.reduce((s, t) => s + (t.result_net ?? t.result ?? 0), 0);

    let isBlownDD = false;
    if (rules.size && rules.maxLoss) {
      if (EXPRESS_FUNDED_TYPES.has(acc.type)) {
        const lockLevel = rules.size + rules.maxLoss;
        let bal = rules.size, maxBal = rules.size;
        for (const t of sorted) {
          bal += t.result_net ?? t.result ?? 0;
          if (bal > maxBal) maxBal = bal;
        }
        const floor = maxBal >= lockLevel ? rules.size : rules.size - rules.maxLoss;
        isBlownDD = rules.size + totalPnl <= floor;
      } else {
        const floor = rules.size - rules.maxLoss;
        isBlownDD = rules.size + totalPnl <= floor;
      }
    }

    let isBlownDaily = false;
    if (rules.dailyLoss) {
      const byDay = {};
      for (const t of sorted) {
        const d = t.entered_at?.slice(0, 10) ?? t.date ?? '';
        if (d) byDay[d] = (byDay[d] ?? 0) + (t.result_net ?? t.result ?? 0);
      }
      const vals = Object.values(byDay);
      if (vals.length > 0) {
        const worstDay = Math.min(...vals);
        isBlownDaily = worstDay <= -rules.dailyLoss;
      }
    }

    let isValidated = false;
    if (CHALLENGE_TYPES.has(acc.type) && sorted.length > 0 && rules.profitTarget) {
      const byDay2 = {};
      for (const t of sorted) {
        const d = t.entered_at?.slice(0, 10) ?? t.date ?? '';
        if (d) byDay2[d] = (byDay2[d] ?? 0) + (t.result_net ?? t.result ?? 0);
      }
      const tradingDays2 = Object.keys(byDay2).length;
      isValidated = totalPnl >= rules.profitTarget && tradingDays2 >= (rules.minDays ?? 2);
    }

    return {
      isBlown: isBlownDD || isBlownDaily,
      dailyLossBreached: isBlownDaily,
      pnl: Math.round(totalPnl * 100) / 100,
      isValidated,
      isExpressFunded,
    };
  } catch {
    return { isBlown: false, pnl: null, isValidated: false, isExpressFunded };
  }
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 220;

export default function Sidebar({ activeAccount, onSwitchAccount, onAccountUpdated, onManageAccounts, onToggleAiCoach, aiCoachOpen }) {
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

  useEffect(() => { loadAccounts(); }, [activeAccount]);

  async function loadAccounts() {
    const res = await window.accounts.getAll();
    if (!res.ok) return;
    const accs = res.data.accounts;
    setAccounts(accs);
    const statuses = {};
    for (const acc of accs) {
      statuses[acc.id] = await computeBlownStatus(acc);
    }
    setAccountStatuses(statuses);
  }

  useEffect(() => {
    window.addEventListener('account-updated', loadAccounts);
    window.addEventListener('trades-changed',  loadAccounts);
    return () => {
      window.removeEventListener('account-updated', loadAccounts);
      window.removeEventListener('trades-changed',  loadAccounts);
    };
  }, []);

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

  async function switchTo(id) {
    if (id === activeAccount?.id) { setShowSwitcher(false); return; }
    setShowSwitcher(false);
    await onSwitchAccount(id);
  }

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
    <aside style={{ width: `${width}px`, flexShrink: 0, background: '#090a10', borderRight: '1px solid rgba(136,153,187,0.10)', display: 'flex', flexDirection: 'column', position: 'relative', userSelect: isDragging ? 'none' : 'auto' }}>

      {/* Account selector */}
      <div style={{ padding: '10px', borderBottom: '1px solid rgba(136,153,187,0.08)' }}>
        <div onClick={() => { setShowSwitcher(s => { if (!s) loadAccounts(); return !s; }); }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 11px', borderRadius: '6px', cursor: 'pointer', background: showSwitcher ? 'rgba(136,153,187,0.08)' : 'transparent', border: `1px solid ${showSwitcher ? 'rgba(136,153,187,0.25)' : 'rgba(136,153,187,0.08)'}`, transition: 'all 0.15s' }}
          onMouseEnter={e => { if (!showSwitcher) { e.currentTarget.style.background = 'rgba(136,153,187,0.05)'; e.currentTarget.style.borderColor = 'rgba(136,153,187,0.18)'; }}}
          onMouseLeave={e => { if (!showSwitcher) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(136,153,187,0.08)'; }}}
        >
          {(() => {
            const st = accountStatuses[activeAccount?.id];
            const isVal = st?.isValidated;
            const dc = st?.isBlown ? '#ff4455' : st?.isExpressFunded ? '#f0c020' : LIVE_TYPES.has(activeAccount?.type) ? '#00ddff' : isVal ? '#00cc77' : '#8899bb';
            return <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: dc, boxShadow: `0 0 6px ${dc}88`, flexShrink: 0 }} />;
          })()}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#e8edf8', wordBreak: 'break-word', lineHeight: '1.3' }}>{activeAccount?.name ?? 'Aucun compte'}</div>
            <div style={{ fontSize: '11px', color: '#5a6a82', marginTop: '2px' }}>{activeAccount?.typeInfo?.label ?? '—'}</div>
          </div>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5a6a82" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <polyline points={showSwitcher ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
          </svg>
        </div>

        {/* Dropdown */}
        {showSwitcher && (
          <div style={{ position: 'absolute', top: '90px', left: '8px', right: '8px', zIndex: 50, background: '#0d060a', border: '1px solid rgba(136,153,187,0.22)', borderRadius: '8px', padding: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>

            {(() => {
              const liveAccts      = accounts.filter(a => !accountStatuses[a.id]?.isBlown && LIVE_TYPES.has(a.type));
              const fundedAccts    = accounts.filter(a => !accountStatuses[a.id]?.isBlown && accountStatuses[a.id]?.isExpressFunded && !LIVE_TYPES.has(a.type));
              const challengeAccts = accounts.filter(a => !accountStatuses[a.id]?.isBlown && !accountStatuses[a.id]?.isExpressFunded && !LIVE_TYPES.has(a.type) && !accountStatuses[a.id]?.isValidated && CHALLENGE_TYPES.has(a.type));
              const validatedAccts = accounts.filter(a => !accountStatuses[a.id]?.isBlown && !accountStatuses[a.id]?.isExpressFunded && !LIVE_TYPES.has(a.type) && accountStatuses[a.id]?.isValidated);
              const blownAccts     = accounts.filter(a => accountStatuses[a.id]?.isBlown);

              function renderAccItem(a) {
                const st = accountStatuses[a.id];
                const isBlown = st?.isBlown ?? false;
                const isActive = a.id === activeAccount?.id;
                const isEF = st?.isExpressFunded ?? false;
                const isVal = st?.isValidated ?? false;
                const isLive = LIVE_TYPES.has(a.type);
                const dotColor = isBlown ? '#ff4455' : isEF ? '#f0c020' : isLive ? '#00ddff' : isVal ? '#00cc77' : '#8899bb';
                const bgNormal = isBlown ? 'rgba(255,68,85,0.06)' : isEF ? 'rgba(240,192,32,0.06)' : isLive ? 'rgba(0,221,255,0.06)' : isVal ? 'rgba(0,200,119,0.06)' : 'rgba(136,153,187,0.06)';
                const borderAccent = isBlown ? 'rgba(255,68,85,0.4)' : isEF ? 'rgba(240,192,32,0.4)' : isLive ? 'rgba(0,221,255,0.4)' : isVal ? 'rgba(0,200,119,0.4)' : 'transparent';
                return (
                  <div key={a.id} style={{ borderRadius: '5px', marginBottom: '2px', overflow: 'hidden' }}>
                    {renamingId === a.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: 'rgba(136,153,187,0.08)', border: '1px solid rgba(136,153,187,0.25)', borderRadius: '5px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') confirmRename(a.id); if (e.key === 'Escape') cancelRename(); }}
                          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e8edf8', fontSize: '13px', fontFamily: 'inherit', caretColor: '#8899bb' }}
                        />
                        <button onClick={() => confirmRename(a.id)} style={{ background: 'rgba(136,153,187,0.15)', border: 'none', color: '#8899bb', padding: '2px 7px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>✓</button>
                        <button onClick={cancelRename} style={{ background: 'none', border: 'none', color: '#7a4a4a', padding: '2px 4px', cursor: 'pointer', fontSize: '13px' }}>✕</button>
                      </div>
                    ) : (
                      <div onClick={() => switchTo(a.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', cursor: 'pointer', background: isActive ? bgNormal : 'transparent', transition: 'background 0.12s', borderRadius: '5px', borderLeft: `2px solid ${isBlown || isEF || isLive || isVal ? borderAccent : isActive ? 'rgba(136,153,187,0.4)' : 'transparent'}` }}
                        onMouseEnter={e => e.currentTarget.style.background = bgNormal}
                        onMouseLeave={e => e.currentTarget.style.background = isActive ? bgNormal : 'transparent'}
                      >
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor, boxShadow: `0 0 4px ${dotColor}88`, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '12px', color: isBlown ? '#ff7777' : isEF ? '#f0c020' : isLive ? '#00ddff' : isActive ? a.color : '#dde4ef', fontWeight: isActive ? '700' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                            {isBlown && <span title={st?.dailyLossBreached ? 'Perte journalière dépassée' : 'Drawdown maximum atteint'} style={{ fontSize: '8px', background: 'rgba(255,68,85,0.2)', border: '1px solid rgba(255,68,85,0.4)', color: '#ff4455', padding: '1px 4px', borderRadius: '2px', fontWeight: '700', flexShrink: 0, cursor: 'help' }}>{st?.dailyLossBreached ? 'DAILY 🔴' : 'CRAMÉ'}</span>}
                            {!isBlown && isLive && <span style={{ fontSize: '8px', background: 'rgba(0,221,255,0.15)', border: '1px solid rgba(0,221,255,0.4)', color: '#00ddff', padding: '1px 4px', borderRadius: '2px', fontWeight: '700', flexShrink: 0 }}>LIVE</span>}
                            {!isBlown && !isLive && isEF && <span style={{ fontSize: '8px', background: 'rgba(240,192,32,0.2)', border: '1px solid rgba(240,192,32,0.4)', color: '#f0c020', padding: '1px 4px', borderRadius: '2px', fontWeight: '700', flexShrink: 0 }}>FUNDED</span>}
                            {!isBlown && !isLive && isVal && <span title="Challenge validé — objectif atteint" style={{ fontSize: '8px', background: 'rgba(0,200,119,0.15)', border: '1px solid rgba(0,200,119,0.3)', color: '#00cc77', padding: '1px 4px', borderRadius: '2px', fontWeight: '700', flexShrink: 0, cursor: 'help' }}>VALIDÉ ✅</span>}
                          </div>
                          <div style={{ fontSize: '10px', color: isBlown ? '#6a3535' : '#5a6a82', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{a.typeInfo?.label}</span>
                            {st?.pnl != null && <span style={{ color: st.pnl >= 0 ? '#00aa55' : '#ff4455' }}>{st.pnl >= 0 ? '+' : ''}{st.pnl.toFixed(0)}$</span>}
                          </div>
                        </div>
                        <button onClick={e => startRename(a, e)} title="Renommer"
                          style={{ background: 'none', border: 'none', color: '#3a4a5a', cursor: 'pointer', fontSize: '13px', padding: '2px 4px', flexShrink: 0, opacity: 0.6, transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#8899bb'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = '#3a4a5a'; }}
                        >✏️</button>
                      </div>
                    )}
                  </div>
                );
              }

              const hasMore = (a, ...rest) => a.length > 0 && rest.some(r => r.length > 0);

              return (
                <>
                  {liveAccts.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#00ddff', letterSpacing: '2px', padding: '4px 8px', marginBottom: '2px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00ddff', boxShadow: '0 0 4px #00ddff' }} />
                        LIVE
                      </div>
                      {liveAccts.map(renderAccItem)}
                      {hasMore(liveAccts, fundedAccts, challengeAccts) && <div style={{ borderTop: '1px solid rgba(136,153,187,0.08)', margin: '2px 0 4px' }} />}
                    </>
                  )}

                  {fundedAccts.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#f0c020', letterSpacing: '2px', padding: '4px 8px', marginBottom: '2px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f0c020', boxShadow: '0 0 4px #f0c020' }} />
                        FUNDED
                      </div>
                      {fundedAccts.map(renderAccItem)}
                      {hasMore(fundedAccts, challengeAccts) && <div style={{ borderTop: '1px solid rgba(136,153,187,0.08)', margin: '2px 0 4px' }} />}
                    </>
                  )}

                  {challengeAccts.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#8899bb', letterSpacing: '2px', padding: '4px 8px', marginBottom: '2px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8899bb', boxShadow: '0 0 4px #8899bb' }} />
                        CHALLENGE
                      </div>
                      {challengeAccts.map(renderAccItem)}
                    </>
                  )}
                </>
              );
            })()}

            <div style={{ borderTop: '1px solid rgba(136,153,187,0.08)', margin: '6px 0' }} />

            <div onClick={() => { setShowSwitcher(false); onManageAccounts?.(); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '5px', cursor: 'pointer', color: '#5a6a82', fontSize: '12px', transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(136,153,187,0.05)'; e.currentTarget.style.color = '#8899bb'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5a6a82'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Gérer les comptes
            </div>
          </div>
        )}
      </div>

      {/* Logo */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(136,153,187,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg,#8899bb,#4a6080)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(136,153,187,0.30)', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e8edf8" strokeWidth="2.5" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1.5px' }}>TRADE</div>
            <div style={{ fontSize: '10px', color: '#5a6a82', letterSpacing: '2.5px' }}>DASHBOARD</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
        {NAV.map(({ to, label, sub, icon, badge }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + '/');
          return (
            <NavLink key={to} to={to} onClick={() => setShowSwitcher(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', margin: '1px 6px', borderRadius: '6px', textDecoration: 'none', color: active ? '#8899bb' : '#5a6a82', background: active ? 'rgba(136,153,187,0.10)' : 'transparent', borderLeft: `2px solid ${active ? '#8899bb' : 'transparent'}`, transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#8899bb'; e.currentTarget.style.background = 'rgba(136,153,187,0.05)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#5a6a82'; e.currentTarget.style.background = 'transparent'; }}}
            >
              <span style={{ flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: active ? '700' : '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                <div style={{ fontSize: '11px', color: active ? '#5a6a82' : '#3a4a5a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
              </div>
              {badge && (() => {
                const bc = badge === 'BOT' ? '#00aaff' : '#8899bb';
                const bg = badge === 'BOT' ? 'rgba(0,170,255,0.12)' : 'rgba(136,153,187,0.12)';
                const br = badge === 'BOT' ? 'rgba(0,170,255,0.3)' : 'rgba(136,153,187,0.30)';
                return <span style={{ fontSize: '10px', letterSpacing: '1px', background: bg, border: `1px solid ${br}`, color: bc, padding: '2px 5px', borderRadius: '3px', flexShrink: 0, fontWeight: '700' }}>{badge}</span>;
              })()}
            </NavLink>
          );
        })}
      </nav>

      {/* AI Coach toggle */}
      <div style={{ padding: '6px 10px 0' }}>
        <button
          onClick={() => { setShowSwitcher(false); onToggleAiCoach?.(); }}
          style={{
            width: '100%', padding: '9px 0',
            background: aiCoachOpen
              ? 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(79,70,229,0.15))'
              : 'rgba(124,58,237,0.08)',
            border: `1px solid ${aiCoachOpen ? 'rgba(124,58,237,0.50)' : 'rgba(124,58,237,0.22)'}`,
            borderRadius: '6px', color: aiCoachOpen ? '#a78bfa' : '#7c3aed',
            fontSize: '11px', fontFamily: 'inherit', letterSpacing: '1.5px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            fontWeight: '700', transition: 'all 0.2s',
            boxShadow: aiCoachOpen ? '0 0 16px rgba(124,58,237,0.25)' : 'none',
          }}
          onMouseEnter={e => { if (!aiCoachOpen) { e.currentTarget.style.background = 'rgba(124,58,237,0.15)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.40)'; }}}
          onMouseLeave={e => { if (!aiCoachOpen) { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.22)'; }}}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a8 8 0 0 1 8 8v4a8 8 0 0 1-16 0v-4a8 8 0 0 1 8-8z"/>
            <path d="M9 10h.01M15 10h.01M12 16a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3z"/>
          </svg>
          {aiCoachOpen ? 'FERMER COACH' : 'AI COACH'}
        </button>
      </div>

      {/* New trade */}
      <div style={{ padding: '10px', borderTop: '1px solid rgba(136,153,187,0.08)' }}>
        <NavLink to="/dashboard/new" style={{ textDecoration: 'none' }} onClick={() => setShowSwitcher(false)}>
          <button
            style={{ width: '100%', padding: '11px 0', background: 'linear-gradient(135deg,rgba(136,153,187,0.18),rgba(74,96,128,0.10))', border: '1px solid rgba(136,153,187,0.30)', borderRadius: '6px', color: '#8899bb', fontSize: '12px', fontFamily: 'inherit', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', transition: 'all 0.2s', fontWeight: '700', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,rgba(136,153,187,0.26),rgba(74,96,128,0.18))'; e.currentTarget.style.boxShadow = '0 0 16px rgba(136,153,187,0.18)'; e.currentTarget.style.borderColor = 'rgba(136,153,187,0.50)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg,rgba(136,153,187,0.18),rgba(74,96,128,0.10))'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(136,153,187,0.30)'; }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            NOUVEAU TRADE
          </button>
        </NavLink>
      </div>

      <div style={{ padding: '5px 0 7px', textAlign: 'center', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
        <span style={{ fontSize: '10px', color: '#3a4a5a', letterSpacing: '1px' }}>v1.5.6</span>
        <span style={{ fontSize: '10px', color: '#2e3d52', letterSpacing: '0.5px' }}>·</span>
        <span title="Afficher les raccourcis clavier (touche ?)" style={{ fontSize: '10px', color: '#2e3d52', letterSpacing: '0.5px', cursor: 'default' }}>? raccourcis</span>
      </div>

      {/* Resize handle */}
      <div onMouseDown={onMouseDown}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={e => e.currentTarget.querySelector('.hb').style.background = '#8899bb'}
        onMouseLeave={e => { if (!isDragging) e.currentTarget.querySelector('.hb').style.background = 'rgba(136,153,187,0.18)'; }}
      >
        <div className="hb" style={{ width: '2px', height: '40px', borderRadius: '2px', background: isDragging ? '#8899bb' : 'rgba(136,153,187,0.18)', transition: 'background 0.15s' }} />
      </div>
    </aside>
  );
}
