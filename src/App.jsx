import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== '/') localStorage.setItem('lastRoute', location.pathname);
  }, [location.pathname]);
  return null;
}
import Sidebar from './layout/Sidebar';
import AccountSelect from './pages/AccountSelect';
import Dashboard from './pages/Dashboard';
import NewTrade from './pages/NewTrade';
import Stats from './pages/Stats';
import PropFirm from './pages/PropFirm';
import EmotionalCheck from './pages/EmotionalCheck';
import Analysis from './pages/Analysis';
import GlobalView from './pages/GlobalView';
import CsvImport from './pages/CsvImport';
import EconomicCalendar from './pages/EconomicCalendar';
import Payout from './pages/Payout';
import TradingPlan from './pages/TradingPlan';
import StrategieDiscipline from './pages/StrategieDiscipline';
import FitnessSante from './pages/FitnessSante';
import Bot from './pages/Bot';

export default function App() {
  const [activeAccount, setActiveAccount] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [showAccountSelect, setShowAccountSelect] = useState(false);
  const [reloadKey, setReloadKey]         = useState(0);
  const [updateReady, setUpdateReady]     = useState(null);

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
  }, []);

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08050a', color: '#6a3a3a', fontSize: '13px', letterSpacing: '2px', fontFamily: 'monospace' }}>
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
      <RouteTracker />
      {updateReady && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, background: '#120508', border: '1px solid rgba(196,18,48,0.40)', borderRadius: '8px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 4px 24px rgba(0,0,0,0.7)' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#c41230', fontWeight: '700', marginBottom: '2px' }}>Mise à jour disponible — v{updateReady.version}</div>
            <div style={{ fontSize: '10px', color: '#6a3a3a' }}>Redémarre pour installer la nouvelle version</div>
          </div>
          <button onClick={() => window.electron.installUpdate()}
            style={{ padding: '7px 14px', background: 'rgba(196,18,48,0.15)', border: '1px solid rgba(196,18,48,0.50)', borderRadius: '5px', color: '#c41230', fontSize: '11px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '1px' }}>
            REDÉMARRER
          </button>
          <button onClick={() => setUpdateReady(null)}
            style={{ padding: '4px 8px', background: 'none', border: 'none', color: '#6a3a3a', fontSize: '14px', cursor: 'pointer', lineHeight: 1 }}>
            ✕
          </button>
        </div>
      )}
      <div style={{ display: 'flex', height: '100vh', background: '#08050a', color: '#e0d0d0', fontFamily: "'JetBrains Mono','Fira Code',monospace", overflow: 'hidden' }}>
        <Sidebar
          activeAccount={activeAccount}
          onSwitchAccount={handleSwitchAccount}
          onAccountUpdated={handleAccountUpdated}
          onManageAccounts={handleManageAccounts}
        />
        <main key={reloadKey} style={{ flex: 1, overflowY: 'auto', background: '#09050c', backgroundImage: 'radial-gradient(ellipse 60% 40% at 80% 0%,rgba(50,6,15,0.35) 0%,transparent 60%)' }}>
          <Routes>
            <Route path="/"              element={<Navigate to={localStorage.getItem('lastRoute') || '/dashboard'} replace />} />
            <Route path="/dashboard"     element={<Dashboard />} />
            <Route path="/dashboard/new" element={<NewTrade />} />
            <Route path="/dashboard/:id" element={<NewTrade />} />
            <Route path="/stats"         element={<Stats />} />
            <Route path="/analysis"      element={<Analysis />} />
            <Route path="/global"        element={<GlobalView />} />
            <Route path="/propfirm"      element={<PropFirm />} />
            <Route path="/topstep"       element={<Navigate to="/propfirm" replace />} />
            <Route path="/lucid"         element={<Navigate to="/propfirm" replace />} />
            <Route path="/emotional"     element={<EmotionalCheck />} />
            <Route path="/calendar"       element={<EconomicCalendar />} />
            <Route path="/import"         element={<CsvImport />} />
            <Route path="/payout"         element={<Payout />} />
            <Route path="/plan"           element={<TradingPlan />} />
            <Route path="/strategie"      element={<StrategieDiscipline />} />
            <Route path="/fitness"        element={<FitnessSante />} />
            <Route path="/bot"            element={<Bot />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
