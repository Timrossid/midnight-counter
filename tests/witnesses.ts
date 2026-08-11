import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from '../managed/counter/contract/index.js';

export type CounterPrivateState = {
  secretKey: string;
};

export const witnesses = {
  localSecretKey: ({ privateState }: WitnessContext<Ledger, CounterPrivateState>): [
    CounterPrivateState,
    Uint8Array,
  ] => [privateState, new Uint8Array(Buffer.from(privateState.secretKey, 'hex'))],
};
