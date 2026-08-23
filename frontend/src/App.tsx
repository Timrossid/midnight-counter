import { Buffer } from 'buffer';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useCounter } from './useCounter';
import { CounterManager, type CounterDeployment } from './counterManager';
import pino from 'pino';
import { DEFAULT_CONTRACT, NETWORK_ID } from './constants';

type WalletState = 'detecting' | 'no-wallet' | 'ready' | 'connecting' | 'connected';

function findWallet(): InitialAPI | undefined {
  const midnight = (window as any).midnight;
  if (!midnight) return undefined;
  return Object.values(midnight).find(
    (w): w is InitialAPI => !!w && typeof w === 'object' && 'apiVersion' in w,
  );
}

function truncAddr(addr: string): string {
  return addr.length <= 24 ? addr : `${addr.slice(0, 14)}...${addr.slice(-8)}`;
}

function extractErrorMessage(e: any): string {
  if (!e) return '';
  if (e.message && e.message !== '') return e.message;
  const failure = e?.cause?.failure;
  if (failure?.message) return failure.message;
  if (failure?.cause?.message) return failure.cause.message;
  if (e?.cause?.message) return e.cause.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function friendlyError(e: any): string {
  const msg = extractErrorMessage(e);
  if (msg.includes('User rejected')) return 'Transaction cancelled.';
  if (msg.includes('Only the current owner')) return 'Your wallet is not the counter owner.';
  if (msg.includes('Failed to fetch') || msg.includes('Proof Server'))
    return 'Could not reach the proof server. Is it running on http://127.0.0.1:6300?';
  if (msg.includes('mismatched verifier keys'))
    return 'Contract version mismatch. Redeploy or update VITE_DEFAULT_CONTRACT.';
  return msg || 'An unexpected error occurred. Check the browser console.';
}

export default function App() {
  const [walletState, setWalletState] = useState<WalletState>('detecting');
  const [walletAPI, setWalletAPI] = useState<InitialAPI | undefined>();
  const [wallet, setWallet] = useState<ConnectedAPI | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);
  const [joinInput, setJoinInput] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [newSecretKey, setNewSecretKey] = useState('');
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const managerRef = useRef<CounterManager | null>(null);
  const getManager = useCallback(() => {
    if (!managerRef.current) {
      const logger = pino({ level: 'warn', browser: { asObject: true } });
      managerRef.current = new CounterManager(logger);
    }
    return managerRef.current;
  }, []);

  const { state, loading, error: stateError, refresh } = useCounter(contractAddress || null);
  const [deployedStatus, setDeployedStatus] = useState<CounterDeployment | null>(null);

  useEffect(() => {
    const found = findWallet();
    if (found) {
      setWalletAPI(found);
      setWalletState('ready');
      return;
    }
    let elapsed = 0;
    const t = setInterval(() => {
      elapsed += 100;
      const w = findWallet();
      if (w) {
        setWalletAPI(w);
        setWalletState('ready');
        clearInterval(t);
      } else if (elapsed >= 5000) {
        setWalletState('no-wallet');
        clearInterval(t);
      }
    }, 100);
    return () => clearInterval(t);
  }, []);

  const connect = useCallback(async () => {
    if (!walletAPI) return;
    setWalletState('connecting');
    setError(null);
    try {
      const c = await walletAPI.connect(NETWORK_ID);
      setWallet(c);
      const { unshieldedAddress } = await c.getUnshieldedAddress();
      setAddress(unshieldedAddress);
      setWalletState('connected');
    } catch (e) {
      setError(friendlyError(e));
      setWalletState('ready');
    }
  }, [walletAPI]);

  const resolveContract = useCallback(
    async (addr?: string) => {
      const manager = getManager();
      const deployment$ = manager.resolve(addr as any);
      return new Promise<Extract<CounterDeployment, { status: 'deployed' }>>((resolve, reject) => {
        const sub = deployment$.subscribe((d) => {
          if (d.status === 'deployed') {
            setDeployedStatus(d);
            sub.unsubscribe();
            resolve(d);
          } else if (d.status === 'failed') {
            sub.unsubscribe();
            reject(d.error);
          }
        });
      });
    },
    [getManager],
  );

  const deployContract = useCallback(async () => {
    if (!wallet) return;
    setDeploying(true);
    setError(null);
    try {
      const result = await resolveContract();
      setContractAddress(result.address);
      setShowJoin(false);
      await refresh();
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setDeploying(false);
    }
  }, [wallet, resolveContract, refresh]);

  const joinContract = useCallback(() => {
    const addr = joinInput.trim();
    if (!addr || !/^[0-9a-fA-F]{64}$/.test(addr)) {
      setError('Invalid contract address (must be 64 hex characters).');
      return;
    }
    setContractAddress(addr);
    setShowJoin(false);
    setJoinInput('');
  }, [joinInput]);

  const runAction = useCallback(
    async (fn: (api: any) => Promise<unknown>, label: string) => {
      if (!wallet) {
        setError('Connect your Lace wallet first.');
        return;
      }
      setActionStatus(`${label}...`);
      setError(null);
      try {
        const result = await resolveContract(contractAddress);
        await fn(result.api);
        setActionStatus(`${label} done.`);
        await refresh();
      } catch (e: any) {
        setActionStatus(null);
        setError(friendlyError(e));
      }
    },
    [wallet, contractAddress, resolveContract, refresh],
  );

  const isConnected = walletState === 'connected';
  const isOwner = state != null;

  return (
    <div className="app">
      <header>
        <h1>Midnight Counter</h1>
        <p className="subtitle">
          A privacy-preserving on-chain counter. The owner is a <em>commitment</em> on-chain; the
          secret key never leaves your browser.
        </p>
      </header>

      <section className="card">
        <h2>Wallet</h2>
        {walletState === 'no-wallet' ? (
          <a
            className="button"
            href="https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk"
            target="_blank"
            rel="noopener noreferrer"
          >
            Install Lace Wallet
          </a>
        ) : isConnected && address ? (
          <p className="connected">
            Connected: <code>{truncAddr(address)}</code>
          </p>
        ) : (
          <button className="button" onClick={connect} disabled={walletState !== 'ready'}>
            Connect Wallet
          </button>
        )}
      </section>

      <section className="card">
        <h2>Contract</h2>
        <p className="mono">
          {contractAddress ? (
            <code>{truncAddr(contractAddress)}</code>
          ) : (
            <em>No contract selected</em>
          )}
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
            <button className="button" onClick={joinContract} disabled={!joinInput.trim()}>
              Join
            </button>
            {isConnected ? (
              <button className="button" onClick={deployContract} disabled={deploying}>
                {deploying ? 'Deploying...' : 'Deploy New'}
              </button>
            ) : (
              <button className="button" onClick={connect} disabled={walletState !== 'ready'}>
                Connect to Deploy
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Counter State</h2>
        {loading && <p className="muted">Reading from indexer...</p>}
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
          !loading && <p className="muted">No state yet — initialize the counter.</p>
        )}
      </section>

      <section className="card">
        <h2>Actions</h2>
        <div className="actions">
          <button
            className="button primary"
            disabled={!isConnected}
            onClick={() => runAction((api) => api.callTx.initialize(), 'Initializing')}
          >
            Initialize
          </button>
          <button
            className="button primary"
            disabled={!isConnected}
            onClick={() => runAction((api) => api.callTx.increment(), 'Incrementing')}
          >
            Increment
          </button>
        </div>

        <div className="handover">
          <input
            type="text"
            placeholder="New owner secret key (64 hex chars)"
            value={newSecretKey}
            onChange={(e) => setNewSecretKey(e.target.value.trim())}
          />
          <button
            className="button"
            disabled={!isConnected || !/^[0-9a-fA-F]{64}$/.test(newSecretKey)}
            onClick={() =>
              runAction(
                (api) =>
                  api.callTx.handOver(new Uint8Array(Buffer.from(newSecretKey, 'hex'))),
                'Handing over',
              )
            }
          >
            Hand Over
          </button>
        </div>

        {actionStatus && <p className="status">{actionStatus}</p>}
      </section>

      {error && (
        <p className="error banner" onClick={() => setError(null)}>
          {error} <span className="dismiss">dismiss</span>
        </p>
      )}

      <footer className="muted">
        Network: {NETWORK_ID} · Privacy: owner key stays local; only its hash is disclosed on-chain.
      </footer>
    </div>
  );
}
