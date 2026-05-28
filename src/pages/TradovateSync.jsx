import { useState, useEffect, useCallback } from 'react';

const S = {
  page:    { padding: '28px 32px', maxWidth: '700px', margin: '0 auto' },
  title:   { fontSize: '20px', fontWeight: '700', color: '#e8f8e8', letterSpacing: '1px', marginBottom: '4px' },
  sub:     { fontSize: '13px', color: '#3a6a4a', marginBottom: '28px' },
  card:    { background: '#0a1520', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '8px', padding: '20px 24px', marginBottom: '16px' },
  label:   { fontSize: '12px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '6px', display: 'block' },
  input:   {
    width: '100%', padding: '9px 12px', background: '#070d12',
    border: '1px solid rgba(0,255,136,0.15)', borderRadius: '5px',
    color: '#c8d8c8', fontSize: '13px', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  },
  row:     { display: 'flex', gap: '12px', marginBottom: '14px' },
  col:     { flex: 1, display: 'flex', flexDirection: 'column' },
  btn:     (variant) => ({
    padding: '10px 20px', borderRadius: '5px', cursor: 'pointer',
    fontSize: '13px', fontFamily: 'inherit', letterSpacing: '1px', fontWeight: '600',
    border: 'none', transition: 'all 0.15s',
    ...(variant === 'primary' ? {
      background: 'linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,170,85,0.15))',
      border: '1px solid rgba(0,255,136,0.35)', color: '#00ff88',
    } : variant === 'danger' ? {
      background: 'rgba(255,68,85,0.1)', border: '1px solid rgba(255,68,85,0.3)', color: '#ff4455',
    } : {
      background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.15)', color: '#5a8a6a',
    }),
  }),
  statusDot: (st) => ({
    display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', marginRight: '8px',
    background: st === 'connected' ? '#00ff88' : st === 'syncing' ? '#ffcc00' : st === 'error' ? '#ff4455' : '#3a5a4a',
    boxShadow:  st === 'connected' ? '0 0 6px #00ff88' : st === 'syncing' ? '0 0 6px #ffcc00' : st === 'error' ? '0 0 6px #ff4455' : 'none',
  }),
};

function StatusLabel({ st }) {
  const labels = { connected: 'Connecté', syncing: 'Synchronisation…', error: 'Erreur', disconnected: 'Déconnecté' };
  const colors = { connected: '#00ff88', syncing: '#ffcc00', error: '#ff4455', disconnected: '#3a5a4a' };
  return (
    <span style={{ color: colors[st] ?? '#3a5a4a', fontSize: '13px' }}>
      <span style={S.statusDot(st)} />
      {labels[st] ?? st}
    </span>
  );
}

export default function TradovateSync() {
  const [status,    setStatus]   = useState(null);
  const [form,      setForm]     = useState({ username: '', password: '', appId: '', env: 'live' });
  const [loading,   setLoading]  = useState(false);
  const [msg,       setMsg]      = useState(null); // { type: 'ok'|'err', text }
  const [lastResult,setLastResult] = useState(null);

  const refreshStatus = useCallback(async () => {
    const s = await window.tradovate.getStatus();
    setStatus(s);
  }, []);

  useEffect(() => {
    refreshStatus();
    const unsub = window.tradovate.onSynced(result => {
      setLastResult(result);
      refreshStatus();
    });
    return unsub;
  }, [refreshStatus]);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleConnect() {
    if (!form.username || !form.password) {
      setMsg({ type: 'err', text: 'Identifiants requis' }); return;
    }
    setLoading(true); setMsg(null);
    const res = await window.tradovate.connect(form);
    setLoading(false);
    if (res.ok) {
      setMsg({ type: 'ok', text: `Connecté ! ${res.data?.syncResult ? `${res.data.syncResult.imported} trade(s) importé(s)` : ''}` });
      if (res.data?.syncResult) setLastResult(res.data.syncResult);
      refreshStatus();
    } else {
      setMsg({ type: 'err', text: res.error });
    }
  }

  async function handleSync() {
    setLoading(true); setMsg(null);
    const res = await window.tradovate.sync();
    setLoading(false);
    if (res.ok) {
      setLastResult(res.data);
      setMsg({ type: 'ok', text: `Sync terminée — ${res.data.imported} importé(s), ${res.data.skipped} ignoré(s)` });
      refreshStatus();
    } else {
      setMsg({ type: 'err', text: res.error });
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    await window.tradovate.disconnect();
    setLoading(false);
    setStatus(await window.tradovate.getStatus());
    setMsg(null); setLastResult(null);
    setForm({ username: '', password: '', appId: '', env: 'live' });
  }

  const isConnected = status?.status === 'connected' || status?.status === 'syncing';

  return (
    <div style={S.page}>
      <div style={S.title}>Tradovate — Sync automatique</div>
      <div style={S.sub}>Connectez votre compte Tradovate pour importer vos trades automatiquement (toutes les 60s).</div>

      {/* Status card */}
      {status && (
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '5px' }}>STATUT</div>
              <StatusLabel st={status.status} />
              {status.username && (
                <span style={{ fontSize: '12px', color: '#3a6a4a', marginLeft: '12px' }}>
                  {status.username} · {status.env === 'demo' ? 'DEMO' : 'LIVE'}
                </span>
              )}
            </div>
            {status.lastSync && (
              <div style={{ fontSize: '12px', color: '#3a6a4a', textAlign: 'right' }}>
                Dernière sync<br />
                <span style={{ color: '#5a8a6a' }}>{new Date(status.lastSync).toLocaleTimeString('fr-FR')}</span>
              </div>
            )}
          </div>

          {status.error && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(255,68,85,0.08)', border: '1px solid rgba(255,68,85,0.2)', borderRadius: '5px', fontSize: '13px', color: '#ff7788' }}>
              {status.error}
            </div>
          )}
        </div>
      )}

      {/* Last sync result */}
      {lastResult && (
        <div style={{ ...S.card, display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#00ff88' }}>{lastResult.imported}</div>
            <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '1px' }}>IMPORTÉ</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#5a8a6a' }}>{lastResult.skipped}</div>
            <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '1px' }}>IGNORÉ</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#c8d8c8' }}>{lastResult.total}</div>
            <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '1px' }}>TOTAL TRADES</div>
          </div>
          {lastResult.errors > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#ff4455' }}>{lastResult.errors}</div>
              <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '1px' }}>ERREURS</div>
            </div>
          )}
        </div>
      )}

      {/* Connected actions */}
      {isConnected && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button style={S.btn('primary')} disabled={loading} onClick={handleSync}>
            {loading ? 'Sync en cours…' : 'Synchroniser maintenant'}
          </button>
          <button style={S.btn('danger')} disabled={loading} onClick={handleDisconnect}>
            Déconnecter
          </button>
        </div>
      )}

      {/* Connection form */}
      {!isConnected && (
        <div style={S.card}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#c8d8c8', marginBottom: '16px', letterSpacing: '0.5px' }}>
            Connexion Tradovate
          </div>

          <div style={S.row}>
            <div style={S.col}>
              <label style={S.label}>ENVIRONNEMENT</label>
              <select
                value={form.env}
                onChange={e => setField('env', e.target.value)}
                style={{ ...S.input, cursor: 'pointer' }}
              >
                <option value="live">Live (compte réel)</option>
                <option value="demo">Demo (papier)</option>
              </select>
            </div>
          </div>

          <div style={S.row}>
            <div style={S.col}>
              <label style={S.label}>NOM D'UTILISATEUR</label>
              <input
                style={S.input}
                type="text"
                autoComplete="username"
                placeholder="Votre identifiant Tradovate"
                value={form.username}
                onChange={e => setField('username', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConnect(); }}
              />
            </div>
            <div style={S.col}>
              <label style={S.label}>MOT DE PASSE</label>
              <input
                style={S.input}
                type="password"
                autoComplete="current-password"
                placeholder="Votre mot de passe"
                value={form.password}
                onChange={e => setField('password', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConnect(); }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={S.label}>APP ID (optionnel)</label>
            <input
              style={S.input}
              type="text"
              placeholder="TradingDashboard (laissez vide par défaut)"
              value={form.appId}
              onChange={e => setField('appId', e.target.value)}
            />
            <div style={{ fontSize: '11px', color: '#2a5a3a', marginTop: '5px' }}>
              Nécessite une app enregistrée sur trader.tradovate.com → API si vous avez un CID/Secret.
            </div>
          </div>

          <button style={S.btn('primary')} disabled={loading} onClick={handleConnect}>
            {loading ? 'Connexion…' : 'Connecter et synchroniser'}
          </button>
        </div>
      )}

      {/* Feedback message */}
      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: '5px', fontSize: '13px',
          background: msg.type === 'ok' ? 'rgba(0,255,136,0.07)' : 'rgba(255,68,85,0.08)',
          border: `1px solid ${msg.type === 'ok' ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,85,0.25)'}`,
          color: msg.type === 'ok' ? '#00cc66' : '#ff7788',
        }}>
          {msg.text}
        </div>
      )}

      {/* Info box */}
      <div style={{ ...S.card, marginTop: '20px', borderColor: 'rgba(0,170,255,0.1)' }}>
        <div style={{ fontSize: '12px', color: '#2a5a6a', letterSpacing: '1px', marginBottom: '10px' }}>NOTE TECHNIQUE</div>
        <div style={{ fontSize: '12px', color: '#3a6a7a', lineHeight: '1.7' }}>
          • Les trades sont calculés par <strong style={{ color: '#4a8a9a' }}>appariement FIFO</strong> des fills Tradovate.<br />
          • Le P&L est en <strong style={{ color: '#4a8a9a' }}>points × valeur/point</strong> (MNQ=$2, ES=$50, etc.).<br />
          • Les commissions ne sont pas disponibles via l'API fills — elles apparaissent comme $0.<br />
          • La sync auto s'effectue toutes les <strong style={{ color: '#4a8a9a' }}>60 secondes</strong> en arrière-plan.<br />
          • Les doublons sont ignorés automatiquement grâce à l'<code style={{ color: '#4a8a9a' }}>external_id</code>.
        </div>
      </div>
    </div>
  );
}
