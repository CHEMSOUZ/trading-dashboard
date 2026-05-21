import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './layout/Sidebar';
import AccountSelect from './pages/AccountSelect';
import Dashboard from './pages/Dashboard';
import NewTrade from './pages/NewTrade';
import Stats from './pages/Stats';
import Topstep from './pages/Topstep';
import EmotionalCheck from './pages/EmotionalCheck';

export default function App() {
  const [activeAccount, setActiveAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await window.accounts.getActive();
      if (res.ok && res.data) setActiveAccount(res.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060c10', color: '#3a6a4a', fontSize: '11px', letterSpacing: '2px', fontFamily: 'monospace' }}>
      CHARGEMENT...
    </div>
  );

  if (!activeAccount) {
    return <AccountSelect onSelect={acc => setActiveAccount(acc)} />;
  }

  return (
    <Router>
      <div style={{ display: 'flex', height: '100vh', background: '#060c10', color: '#c8d8c8', fontFamily: "'JetBrains Mono','Fira Code',monospace", overflow: 'hidden' }}>
        <Sidebar activeAccount={activeAccount} onSwitchAccount={() => setActiveAccount(null)} />
        <main style={{ flex: 1, overflowY: 'auto', background: '#070d12', backgroundImage: 'radial-gradient(ellipse 60% 40% at 80% 0%,rgba(0,40,20,0.4) 0%,transparent 60%)' }}>
          <Routes>
            <Route path="/"              element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"     element={<Dashboard />} />
            <Route path="/dashboard/new" element={<NewTrade />} />
            <Route path="/dashboard/:id" element={<NewTrade />} />
            <Route path="/stats"         element={<Stats />} />
            <Route path="/topstep"       element={<Topstep />} />
            <Route path="/emotional"     element={<EmotionalCheck />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
