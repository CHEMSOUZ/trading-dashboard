import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV = [
  {
    to: '/dashboard', label: 'Dashboard', sub: 'Stats & Journal',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    to: '/stats', label: 'Statistiques', sub: 'Graphiques & Calendrier',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  },
  {
    to: '/topstep', label: 'Topstep', sub: 'Combine & Funded', badge: 'LIVE',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>,
  },
  {
    to: '/emotional', label: 'État Mental', sub: 'Bilan pré-séance',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  },
];

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 220;

export default function Sidebar({ activeAccount, onSwitchAccount }) {
  const location = useLocation();
  const [accounts, setAccounts] = useState([]);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar_width');
    return saved ? parseInt(saved) : DEFAULT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    (async () => {
      const res = await window.accounts.getAll();
      if (res.ok) setAccounts(res.data.accounts);
    })();
  }, [activeAccount]);

  // ── Resize handlers ──────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
    setIsDragging(true);
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;
    function onMouseMove(e) {
      const delta = e.clientX - dragStartX.current;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta));
      setWidth(newWidth);
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
    await window.accounts.setActive(id);
    setShowSwitcher(false);
    onSwitchAccount();
  }

  return (
    <aside style={{ width: `${width}px`, flexShrink: 0, background: '#060c10', borderRight: '1px solid rgba(0,255,136,0.08)', display: 'flex', flexDirection: 'column', position: 'relative', transition: isDragging ? 'none' : 'width 0.1s ease', userSelect: isDragging ? 'none' : 'auto' }}>

      {/* Account selector */}
      <div style={{ padding: '10px', borderBottom: '1px solid rgba(0,255,136,0.06)' }}>
        <div onClick={() => setShowSwitcher(s => !s)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 11px', borderRadius: '6px', cursor: 'pointer',
          background: showSwitcher ? 'rgba(0,255,136,0.06)' : 'transparent',
          border: `1px solid ${showSwitcher ? 'rgba(0,255,136,0.2)' : 'rgba(0,255,136,0.06)'}`,
          transition: 'all 0.15s',
        }}>
          {/* Color dot */}
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: activeAccount?.color ?? '#00ff88', boxShadow: `0 0 7px ${activeAccount?.color ?? '#00ff88'}`, flexShrink: 0 }} />

          {/* Account name — no overflow hidden so it wraps if needed */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#e8f8e8', wordBreak: 'break-word', lineHeight: '1.3' }}>
              {activeAccount?.name ?? 'Aucun compte'}
            </div>
            <div style={{ fontSize: '12px', color: '#3a6a4a', marginTop: '2px', wordBreak: 'break-word' }}>
              {activeAccount?.typeInfo?.label ?? '—'}
            </div>
          </div>

          {/* Chevron */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3a6a4a" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <polyline points={showSwitcher ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
          </svg>
        </div>

        {/* Dropdown */}
        {showSwitcher && (
          <div style={{ position: 'absolute', top: '90px', left: '8px', right: '8px', zIndex: 50, background: '#070d12', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px', padding: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '12px', color: '#3a6a4a', letterSpacing: '2px', padding: '4px 8px', marginBottom: '4px' }}>COMPTES</div>
            {accounts.map(a => (
              <div key={a.id} onClick={() => switchTo(a.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '5px', cursor: 'pointer', background: a.id === activeAccount?.id ? 'rgba(0,255,136,0.06)' : 'transparent', transition: 'all 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = a.id === activeAccount?.id ? 'rgba(0,255,136,0.06)' : 'transparent'}
              >
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: a.id === activeAccount?.id ? a.color : '#c8d8c8', fontWeight: a.id === activeAccount?.id ? '700' : '400', wordBreak: 'break-word' }}>{a.name}</div>
                  <div style={{ fontSize: '12px', color: '#3a6a4a' }}>{a.typeInfo?.label}</div>
                </div>
                {a.id === activeAccount?.id && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: a.color, flexShrink: 0 }} />}
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(0,255,136,0.06)', margin: '6px 0' }} />
            <div onClick={() => { setShowSwitcher(false); onSwitchAccount(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '5px', cursor: 'pointer', color: '#3a6a4a', fontSize: '13px', transition: 'all 0.12s' }}
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
        {NAV.map(({ to, label, sub, icon, badge }) => {
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

      {/* New trade button */}
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
        <span style={{ fontSize: '12px', color: '#1a3a22', letterSpacing: '1px' }}>v1.1.0</span>
      </div>

      {/* ── RESIZE HANDLE ── */}
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: '6px', cursor: 'col-resize', zIndex: 10,
          background: isDragging ? 'rgba(0,255,136,0.3)' : 'transparent',
          transition: 'background 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.15)'}
        onMouseLeave={e => { if (!isDragging) e.currentTarget.style.background = 'transparent'; }}
        title="Glisser pour redimensionner"
      >
        {/* Visual indicator — 3 dots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {[0,1,2].map(i => <div key={i} style={{ width: '2px', height: '2px', borderRadius: '50%', background: isDragging ? '#00ff88' : 'rgba(0,255,136,0.3)' }} />)}
        </div>
      </div>
    </aside>
  );
}
