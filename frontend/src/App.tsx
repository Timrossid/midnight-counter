import { useState } from 'react';
import { MidnightProvider, useMidnight } from './hooks/useMidnight';
import WalletConnect from './components/WalletConnect';
import CircuitCall from './components/CircuitCall';
import { useCounter } from './useCounter';
import { NETWORK_ID } from './constants';

function trunc(addr: string): string {
  return addr.length <= 24 ? addr : `${addr.slice(0, 14)}…${addr.slice(-8)}`;
}

function Dashboard() {
  const { contractAddress, setContractAddress, deploy, status } = useMidnight();
  const { state, loading, error: stateError, refresh } = useCounter(contractAddress || null);

  const [joinInput, setJoinInput] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  const join = () => {
    const addr = joinInput.trim();
    if (!addr || !/^[0-9a-fA-F]{64}$/.test(addr)) {
      setDeployError('Invalid contract address (must be 64 hex characters).');
      return;
    }
    setContractAddress(addr);
    setShowJoin(false);
    setJoinInput('');
    setDeployError(null);
  };

  const doDeploy = async () => {
    setDeploying(true);
    setDeployError(null);
    try {
      const addr = await deploy();
      setContractAddress(addr);
      await refresh();
    } catch (e) {
      setDeployError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Midnight Counter</h1>
        <p className="subtitle">
          A privacy-preserving on-chain counter. The owner is a <em>commitment</em> on-chain; the
          secret key never leaves your browser.
        </p>
      </header>

      <WalletConnect />

      <section className="card">
        <h2>Contract</h2>
        <p className="mono">
          {contractAddress ? <code>{trunc(contractAddress)}</code> : <em>No contract selected</em>}
        </p>
        <button className="link" onClick={() => setShowJoin(!showJoin)}>
          {showJoin ? 'Cancel' : 'Switch Contract'}
        </button>
        {showJoin && (
          <div className="join">
            <input
              type="text"
              placeholder="Contract address (64 hex chars)"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
            />
            <button className="button" onClick={join} disabled={!joinInput.trim()}>
              Join
            </button>
            <button className="button" onClick={doDeploy} disabled={deploying || status !== 'connected'}>
              {deploying ? 'Deploying…' : 'Deploy New'}
            </button>
          </div>
        )}
        {deployError && <p className="error">{deployError}</p>}
      </section>

      <section className="card">
        <h2>Counter State</h2>
        {loading && <p className="muted">Reading from indexer…</p>}
        {stateError && <p className="error">{stateError}</p>}
        {state ? (
          <dl className="state">
            <div>
              <dt>Count</dt>
              <dd className="count">{state.count.toString()}</dd>
            </div>
            <div>
              <dt>Owner commitment</dt>
              <dd className="mono">0x{state.owner}</dd>
            </div>
            <div>
              <dt>Round</dt>
              <dd>{state.round}</dd>
            </div>
          </dl>
        ) : (
          !loading && <p className="muted">No state yet — deploy or join a counter.</p>
        )}
      </section>

      <CircuitCall onSuccess={refresh} />

      <footer className="muted">
        Network: {NETWORK_ID} · Privacy: owner key stays local; only its hash is disclosed on-chain.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <MidnightProvider>
      <Dashboard />
    </MidnightProvider>
  );
}
