import { useMidnight } from '../hooks/useMidnight';

function trunc(addr: string): string {
  return addr.length <= 24 ? addr : `${addr.slice(0, 14)}…${addr.slice(-8)}`;
}

const LACE_INSTALL_URL =
  'https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk';

export default function WalletConnect() {
  const { status, address, error, connect, disconnect } = useMidnight();

  const isConnected = status === 'connected';

  return (
    <section className="card">
      <h2>Wallet</h2>

      {isConnected && address ? (
        <p className="connected">
          Connected: <code>{trunc(address)}</code>
          <button className="link" style={{ marginLeft: '0.75rem' }} onClick={disconnect}>
            Disconnect
          </button>
        </p>
      ) : (
        <button className="button" onClick={() => connect()} disabled={status === 'connecting'}>
          {status === 'connecting' ? 'Connecting…' : 'Connect Wallet'}
        </button>
      )}

      {error && (
        <div className="error banner" style={{ marginTop: '0.75rem' }}>
          {error.kind === 'not-installed' ? (
            <span>
              Lace wallet not found.{' '}
              <a href={LACE_INSTALL_URL} target="_blank" rel="noopener noreferrer">
                Install it here
              </a>
              , then refresh.
            </span>
          ) : (
            <span>{error.message}</span>
          )}
        </div>
      )}

      {!error && status === 'disconnected' && (
        <p className="muted">Connect your Lace wallet to read and update the counter on Preprod.</p>
      )}
    </section>
  );
}
