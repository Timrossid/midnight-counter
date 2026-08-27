import { useState } from 'react';
import { useMidnight } from '../hooks/useMidnight';

function friendlyCircuitError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? 'Unknown error');
  if (msg.includes('User rejected')) return 'Transaction cancelled in the wallet.';
  if (/only the current owner/i.test(msg)) {
    return 'Your wallet is not the current owner of this counter. Deploy a new counter to become the owner, then increment.';
  }
  if (msg.includes('Failed to fetch') || msg.toLowerCase().includes('proof server')) {
    return 'Could not reach the proof server. Start it with: npm run proof-server:start';
  }
  if (/no account is connected/i.test(msg)) {
    return 'Lace has no account connected for this dApp. Open Lace, remove this site from Connected dApps, then reconnect and select an account.';
  }
  if (msg.includes('mismatched verifier keys')) {
    return 'Contract version mismatch. Point VITE_DEFAULT_CONTRACT at the deployed contract.';
  }
  if (/insufficient|not enough|balance|funds|fee|dust/i.test(msg)) {
    return 'Transaction failed — your Lace account may lack Preprod test tokens for fees. Fund it via the Preprod faucet and retry.';
  }
  return msg || 'The circuit call failed. Check the browser console.';
}

export default function CircuitCall({ onSuccess }: { onSuccess?: () => void }) {
  const { status, api, connect } = useMidnight();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callIncrement = async () => {
    if (status !== 'connected' || !api) {
      setError('Connect your Lace wallet first.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // `increment` is the zero-knowledge circuit. The private owner secret is
      // supplied as a *witness* pulled from local private state — it is never
      // placed in the transaction inputs and never rendered in this UI. The
      // browser generates the proof locally against the proof server.
      const data = await api.callTx.increment();
      // The circuit's return value (the new count) is intentionally public; we
      // read ONLY `.private.result` and never the rest of the (sensitive) call
      // result. The owner secret lives in `.private.input` and is never touched.
      const count = (data as unknown as { private?: { result?: unknown } }).private?.result;
      setResult(count == null ? 'done' : String(count));
      onSuccess?.();
    } catch (e) {
      setError(friendlyCircuitError(e));
    } finally {
      setLoading(false);
    }
  };

  const isConnected = status === 'connected';

  return (
    <section className="card">
      <h2>Call a Circuit</h2>
      <p className="muted">
        Runs the <code>increment</code> circuit on Preprod. Your owner secret is proven, not revealed.
      </p>

      <button className="button primary" onClick={callIncrement} disabled={!isConnected || loading}>
        {loading ? 'Generating proof…' : 'Increment Counter'}
      </button>

      <p className="privacy-note">🔒 Proved without revealing your input</p>

      {loading && <p className="muted">Generating the zero-knowledge proof locally in your browser…</p>}
      {result !== null && (
        <p className="status">
          ✓ Submitted on-chain. New count: <strong>{result}</strong>
        </p>
      )}
      {error && (
        <p className="error banner" style={{ marginTop: '0.75rem' }}>
          {error}
        </p>
      )}

      {!isConnected && (
        <p className="muted">
          Not connected.{' '}
          <button className="link" onClick={() => connect()}>
            Connect wallet
          </button>{' '}
          to call the circuit.
        </p>
      )}
    </section>
  );
}
