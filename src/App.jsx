import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

function PageLoader() {
  return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a4a5a', fontSize: '11px', letterSpacing: '2px' }}>...</div>;
}

import Sidebar from './layout/Sidebar';
import AccountSelect from './pages/AccountSelect';
import Journal from './pages/Journal';
import NewTrade from './pages/NewTrade';

const Dashboard         = lazy(() => import('./pages/Dashboard'));
const Stats             = lazy(() => import('./pages/Stats'));
const PropFirm          = lazy(() => import('./pages/PropFirm'));
const EmotionalCheck    = lazy(() => import('./pages/EmotionalCheck'));
const Analysis          = lazy(() => import('./pages/Analysis'));
const GlobalView        = lazy(() => import('./pages/GlobalView'));
const EconomicCalendar  = lazy(() => import('./pages/EconomicCalendar'));
const Payout            = lazy(() => import('./pages/Payout'));
const TradingPlan       = lazy(() => import('./pages/TradingPlan'));
const StrategieDiscipline = lazy(() => import('./pages/StrategieDiscipline'));
const FitnessSante      = lazy(() => import('./pages/FitnessSante'));
const Bot               = lazy(() => import('./pages/Bot'));
const AiCoachPanel      = lazy(() => import('./features/ai-coach/AiCoachPanel'));
const Goals             = lazy(() => import('./features/goals/Goals'));
const CsvImport         = lazy(() => import('./pages/CsvImport'));

const SHORTCUTS = [
  { section: 'Navigation', items: [
    { key: 'J', desc: 'Journal des trades' },
    { key: 'G', desc: 'Vue globale (comptes)' },
    { key: 'N', desc: 'Nouveau trade' },
    { key: 'E', desc: 'Bilan émotionnel' },
  ]},
  { section: 'Journal', items: [
    { key: '▶', desc: 'Replay du trade (bouton ligne)' },
    { key: 'Ctrl+F', desc: 'Focus barre de recherche' },
  ]},
  { section: 'Replay modal', items: [
    { key: 'Space', desc: 'Play / Pause' },
    { key: '← →', desc: 'Bougie précédente / suivante' },
    { key: 'Escape', desc: 'Fermer le modal' },
  ]},
  { section: 'Global', items: [
    { key: '?', desc: 'Afficher / masquer ce panneau' },
    { key: 'Escape', desc: 'Fermer fenêtre ouverte' },
  ]},
];

export default function App() {
  const [activeAccount, setActiveAccount] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [showAccountSelect, setShowAccountSelect] = useState(false);
  const [reloadKey, setReloadKey]         = useState(0);
  const [updateReady, setUpdateReady]     = useState(null);
  const [aiCoachOpen, setAiCoachOpen]     = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toast, setToast]                 = useState(null); // { msg, type: 'success'|'info'|'error' }

  useEffect(() => {
    (async () => {
      const res = await window.accounts.getActive();
      if (res.ok && res.data) setActiveAccount(res.data);
      else setShowAccountSelect(true);
      setLoading(false);
    })();
    if (window.electron?.onUpdateDownloaded) {
      window.electron.onUpdateDownloaded(info => setUpdateReady(info));
    }

    function onToast(e) {
      setToast(e.detail);
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => setToast(null), e.detail.duration ?? 2600);
    }
    window.addEventListener('toast', onToast);

    function onGlobalKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(s => !s); return; }
      if (e.key === 'j' || e.key === 'J') { window.location.hash = '#/journal'; }
      if (e.key === 'g' || e.key === 'G') { window.location.hash = '#/global'; }
      if (e.key === 'n' || e.key === 'N') { window.location.hash = '#/journal/new'; }
      if (e.key === 'e' || e.key === 'E') { window.location.hash = '#/emotional'; }
    }
    window.addEventListener('keydown', onGlobalKey);
    return () => {
      window.removeEventListener('keydown', onGlobalKey);
      window.removeEventListener('toast', onToast);
    };
  }, []);

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090a10', color: '#5a6a82', fontSize: '13px', letterSpacing: '2px', fontFamily: 'monospace' }}>
      CHARGEMENT...
    </div>
  );

  // First launch — no account yet
  if (showAccountSelect && !activeAccount) {
    return (
      <AccountSelect onSelect={acc => {
        setActiveAccount(acc);
        setShowAccountSelect(false);
      }} />
    );
  }

  async function handleSwitchAccount(id) {
    await window.accounts.setActive(id);
    const res = await window.accounts.getActive();
    if (res.ok && res.data) {
      setActiveAccount(res.data);
      setReloadKey(k => k + 1);
    }
  }

  async function handleAccountUpdated() {
    // Refresh active account after rename
    const res = await window.accounts.getActive();
    if (res.ok && res.data) setActiveAccount(res.data);
  }

  function handleManageAccounts() {
    // Show account select screen
    setShowAccountSelect(true);
  }

  if (showAccountSelect) {
    return (
      <AccountSelect
        onSelect={acc => {
          setActiveAccount(acc);
          setShowAccountSelect(false);
        }}
        onBack={activeAccount ? () => setShowAccountSelect(false) : null}
      />
    );
  }

  return (
    <Router>
      {updateReady && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, background: '#101018', border: '1px solid rgba(136,153,187,0.40)', borderRadius: '8px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 4px 24px rgba(0,0,0,0.7)' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#8899bb', fontWeight: '700', marginBottom: '2px' }}>Mise à jour disponible — v{updateReady.version}</div>
            <div style={{ fontSize: '10px', color: '#5a6a82' }}>Redémarre pour installer la nouvelle version</div>
          </div>
          <button onClick={() => window.electron.installUpdate()}
            style={{ padding: '7px 14px', background: 'rgba(136,153,187,0.15)', border: '1px solid rgba(136,153,187,0.50)', borderRadius: '5px', color: '#8899bb', fontSize: '11px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '1px' }}>
            REDÉMARRER
          </button>
          <button onClick={() => setUpdateReady(null)}
            style={{ padding: '4px 8px', background: 'none', border: 'none', color: '#5a6a82', fontSize: '14px', cursor: 'pointer', lineHeight: 1 }}>
            ✕
          </button>
        </div>
      )}
      <div style={{ display: 'flex', height: '100vh', background: '#090a10', color: '#dde4ef', fontFamily: "'JetBrains Mono','Fira Code',monospace", overflow: 'hidden' }}>
        <Sidebar
          activeAccount={activeAccount}
          onSwitchAccount={handleSwitchAccount}
          onAccountUpdated={handleAccountUpdated}
          onManageAccounts={handleManageAccounts}
          onToggleAiCoach={() => setAiCoachOpen(o => !o)}
          aiCoachOpen={aiCoachOpen}
        />
        <main key={reloadKey} style={{ flex: 1, overflowY: 'auto', background: '#0c0d16', backgroundImage: 'radial-gradient(ellipse 60% 40% at 80% 0%,rgba(18,20,32,0.35) 0%,transparent 60%)' }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"              element={<Navigate to="/journal" replace />} />
              <Route path="/dashboard"     element={<Navigate to="/journal" replace />} />
              <Route path="/dashboard/new" element={<NewTrade />} />
              <Route path="/dashboard/:id" element={<NewTrade />} />
              <Route path="/stats"         element={<Navigate to="/journal?tab=graphiques" replace />} />
              <Route path="/analysis"      element={<Analysis />} />
              <Route path="/global"        element={<GlobalView />} />
              <Route path="/propfirm"      element={<PropFirm />} />
              <Route path="/topstep"       element={<Navigate to="/propfirm" replace />} />
              <Route path="/lucid"         element={<Navigate to="/propfirm" replace />} />
              <Route path="/emotional"     element={<EmotionalCheck />} />
              <Route path="/calendar"      element={<EconomicCalendar />} />
              <Route path="/payout"        element={<Payout />} />
              <Route path="/plan"          element={<TradingPlan />} />
              <Route path="/strategie"     element={<StrategieDiscipline />} />
              <Route path="/fitness"       element={<FitnessSante />} />
              <Route path="/bot"           element={<Bot />} />
              <Route path="/journal"       element={<Journal />} />
              <Route path="/journal/new"   element={<NewTrade />} />
              <Route path="/journal/:id"   element={<NewTrade />} />
              <Route path="/goals"         element={<Goals />} />
              <Route path="/import"        element={<CsvImport />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      <Suspense fallback={null}>
        <AiCoachPanel
          open={aiCoachOpen}
          onClose={() => setAiCoachOpen(false)}
          activeAccount={activeAccount}
        />
      </Suspense>

      {/* ── Toast ── */}
      {toast && (() => {
        const col = toast.type==='error' ? '#ff3344' : toast.type==='warn' ? '#f59e0b' : '#00cc77';
        const bg  = toast.type==='error' ? 'rgba(255,51,68,0.10)' : toast.type==='warn' ? 'rgba(245,158,11,0.10)' : 'rgba(0,204,119,0.10)';
        return (
          <div style={{ position:'fixed', bottom:'24px', right:'24px', zIndex:9500, background:bg, border:`1px solid ${col}40`, borderRadius:'8px', padding:'10px 18px', color:col, fontSize:'13px', fontFamily:'inherit', pointerEvents:'none', display:'flex', alignItems:'center', gap:'8px', boxShadow:'0 4px 20px rgba(0,0,0,0.5)', animation:'fadeInUp 0.2s ease' }}>
            <span>{toast.type==='error'?'✕':toast.type==='warn'?'⚠':toast.icon||'✓'}</span>
            <span>{toast.msg}</span>
          </div>
        );
      })()}

      {/* ── Keyboard shortcuts overlay ── */}
      {showShortcuts && (
        <>
          <div onClick={() => setShowShortcuts(false)} style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:8001, background:'#0b0c16', border:'1px solid rgba(136,153,187,0.20)', borderRadius:'14px', padding:'24px 28px', minWidth:'420px', boxShadow:'0 24px 64px rgba(0,0,0,0.85)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
              <div style={{ fontSize:'13px', fontWeight:'700', color:'#e8edf8', letterSpacing:'2px' }}>RACCOURCIS CLAVIER</div>
              <button onClick={() => setShowShortcuts(false)} style={{ background:'transparent', border:'none', color:'#5a6a82', cursor:'pointer', fontSize:'16px', padding:'0', lineHeight:1 }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
              {SHORTCUTS.map(({ section, items }) => (
                <div key={section}>
                  <div style={{ fontSize:'10px', color:'#3a4a5a', letterSpacing:'2px', marginBottom:'8px' }}>{section.toUpperCase()}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {items.map(({ key, desc }) => (
                      <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px' }}>
                        <kbd style={{ background:'rgba(136,153,187,0.10)', border:'1px solid rgba(136,153,187,0.22)', borderBottom:'2px solid rgba(136,153,187,0.22)', borderRadius:'4px', padding:'3px 8px', fontSize:'12px', color:'#8899bb', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0 }}>{key}</kbd>
                        <span style={{ fontSize:'12px', color:'#5a6a82', textAlign:'right' }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:'20px', paddingTop:'14px', borderTop:'1px solid rgba(136,153,187,0.10)', fontSize:'11px', color:'#3a4a5a', textAlign:'center' }}>
              Appuie sur <kbd style={{ background:'rgba(136,153,187,0.10)', border:'1px solid rgba(136,153,187,0.18)', borderRadius:'3px', padding:'1px 5px', fontSize:'11px', color:'#5a6a82', fontFamily:'inherit' }}>?</kbd> pour fermer
            </div>
          </div>
        </>
      )}
    </Router>
  );
}
