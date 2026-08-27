import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { filter, take } from 'rxjs';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import pino from 'pino';
import { CounterManager, type DeployedCounter } from '../counterManager';
import { DEFAULT_CONTRACT } from '../constants';

export type WalletErrorKind = 'not-installed' | 'rejected' | 'network-mismatch' | 'generic';

export interface WalletError {
  kind: WalletErrorKind;
  message: string;
}

export type MidnightStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MidnightContextValue {
  status: MidnightStatus;
  address: string | null;
  error: WalletError | null;
  /** The deployed contract API once connected (used to call circuits). */
  api: DeployedCounter | null;
  contractAddress: string;
  setContractAddress: (address: string) => void;
  connect: (address?: string) => void;
  deploy: () => Promise<string>;
  disconnect: () => void;
  manager: CounterManager;
}

function hasMidnightWallet(): boolean {
  const midnight = (window as unknown as { midnight?: Record<string, unknown> }).midnight;
  return !!midnight && Object.keys(midnight).length > 0;
}

function categorize(error: unknown): WalletError {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  if (message.includes('Could not find the Midnight Lace wallet')) {
    return {
      kind: 'not-installed',
      message: 'Lace wallet not found. Install the Midnight Lace extension and unlock it.',
    };
  }
  if (/network mismatch/i.test(message)) {
    return { kind: 'network-mismatch', message };
  }
  if (/reject|denied|user closed|user rejected/i.test(message)) {
    return { kind: 'rejected', message: 'Connection request was rejected in the wallet.' };
  }
  return { kind: 'generic', message };
}

interface DeploymentHandlers {
  onDeployed: (address: string) => void;
  onError?: (error: WalletError) => void;
}

function useMidnightState(): MidnightContextValue {
  const managerRef = useRef<CounterManager | null>(null);
  const [status, setStatus] = useState<MidnightStatus>('disconnected');
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<WalletError | null>(null);
  const [api, setApi] = useState<DeployedCounter | null>(null);
  const [contractAddress, setContractAddressState] = useState<string>(DEFAULT_CONTRACT);

  const getManager = useCallback((): CounterManager => {
    if (!managerRef.current) {
      managerRef.current = new CounterManager(pino({ level: 'warn', browser: { asObject: true } }));
    }
    return managerRef.current;
  }, []);

  const handleDeployment = useCallback(
  (
    deployment$: ReturnType<CounterManager['resolve']>,
    handlers: DeploymentHandlers,
  ) => {
    deployment$
      .pipe(
        filter((d) => d.status !== 'in-progress'),
        take(1),
      )
      .subscribe({
        next: (d) => {
          if (d.status === 'deployed') {
            setApi(d.api as DeployedCounter);
            setAddress(getManager().address ?? null);
            setStatus('connected');
            handlers.onDeployed(d.address);
          } else if (d.status === 'failed') {
            const walletError = categorize(d.error);
            setError(walletError);
            setStatus('error');
            handlers.onError?.(walletError);
          }
        },
        error: (e) => {
          const walletError = categorize(e);
          setError(walletError);
          setStatus('error');
          handlers.onError?.(walletError);
        },
      });
  },
  [getManager],
);

  const connect = useCallback(
    (addressArg?: string) => {
      if (!hasMidnightWallet()) {
        setError({
          kind: 'not-installed',
          message: 'Lace wallet not found. Install the Midnight Lace extension and unlock it.',
        });
        setStatus('error');
        return;
      }
      setStatus('connecting');
      setError(null);
      const target = addressArg ?? contractAddress;
      handleDeployment(getManager().resolve(target as never), { onDeployed: () => undefined });
    },
    [contractAddress, getManager, handleDeployment],
  );

  const deploy = useCallback((): Promise<string> => {
    if (!hasMidnightWallet()) {
      setError({
        kind: 'not-installed',
        message: 'Lace wallet not found. Install the Midnight Lace extension and unlock it.',
      });
      setStatus('error');
      return Promise.reject(new Error('wallet not installed'));
    }
    setStatus('connecting');
    setError(null);
    return new Promise<string>((resolve, reject) => {
      handleDeployment(getManager().resolve(undefined as never), {
        onDeployed: (addr) => resolve(addr),
        onError: (walletError) => reject(new Error(walletError.message)),
      });
    });
  }, [getManager, handleDeployment]);

  const setContractAddress = useCallback((addr: string) => {
    setContractAddressState(addr);
  }, []);

  const disconnect = useCallback(() => {
    setStatus('disconnected');
    setAddress(null);
    setApi(null);
    setError(null);
  }, []);

  return {
    status,
    address,
    error,
    api,
    contractAddress,
    setContractAddress,
    connect,
    deploy,
    disconnect,
    manager: getManager(),
  };
}

const MidnightContext = createContext<MidnightContextValue | null>(null);

export function MidnightProvider({ children }: { children: ReactNode }) {
  const value = useMidnightState();
  return <MidnightContext.Provider value={value}>{children}</MidnightContext.Provider>;
}

export function useMidnight(): MidnightContextValue {
  const ctx = useContext(MidnightContext);
  if (!ctx) {
    throw new Error('useMidnight must be used within a <MidnightProvider>.');
  }
  return ctx;
}
