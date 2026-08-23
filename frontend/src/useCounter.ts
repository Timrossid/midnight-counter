import { useState, useEffect, useCallback } from 'react';
import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import * as CounterContract from '@contract';
import { INDEXER_URL } from './constants';

const CONTRACT_STATE_QUERY = `
  query ContractState($address: HexEncoded!) {
    contractAction(address: $address) {
      state
    }
  }
`;

export interface CounterState {
  count: bigint;
  owner: string;
  round: number;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useCounter(contractAddress: string | null, refreshInterval = 10_000) {
  const [state, setState] = useState<CounterState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!contractAddress || !/^[0-9a-fA-F]{64}$/.test(contractAddress)) return;
    try {
      setLoading(true);
      const res = await fetch(INDEXER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: CONTRACT_STATE_QUERY, variables: { address: contractAddress } }),
      });
      const gql = await res.json();
      if (gql.errors) throw new Error(gql.errors[0]?.message ?? 'Indexer query failed');
      const stateHex = gql.data?.contractAction?.state;
      if (!stateHex) {
        setState(null);
        setError(null);
        return;
      }
      const contractState = ContractState.deserialize(hexToBytes(stateHex));
      const ledger = CounterContract.ledger(contractState.data as any);
      setState({
        count: ledger.count,
        owner: bytesToHex(Uint8Array.from(ledger.owner as Uint8Array)),
        round: Number(ledger.round as unknown),
      });
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to read counter state');
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (!contractAddress) return;
    const interval = setInterval(() => void fetchState(), refreshInterval);
    return () => clearInterval(interval);
  }, [contractAddress, refreshInterval, fetchState]);

  return { state, loading, error, refresh: fetchState };
}
