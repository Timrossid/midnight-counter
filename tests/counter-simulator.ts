import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  type Ledger,
  ledger,
} from '../managed/counter/contract/index.js';
import { type CounterPrivateState, witnesses } from './witnesses.js';

export const SAMPLE_SECRET_KEY = 'a'.repeat(64);
export const SAMPLE_SECRET_KEY_2 = 'b'.repeat(64);

function samplePrivateState(secretKey: string): CounterPrivateState {
  return { secretKey };
}

export class CounterSimulator {
  readonly contract: Contract<CounterPrivateState>;
  circuitContext: CircuitContext<CounterPrivateState>;

  constructor(secretKey: string = SAMPLE_SECRET_KEY) {
    this.contract = new Contract<CounterPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext(samplePrivateState(secretKey), '0'.repeat(64)),
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState,
    );
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): CounterPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /** The DApp updates its local private state after a hand-over. */
  public setPrivateSecretKey(secretKey: string): void {
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: { secretKey },
    };
  }

  public initialize(): Ledger {
    this.circuitContext = this.contract.impureCircuits.initialize(
      this.circuitContext,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public increment(): Ledger {
    this.circuitContext = this.contract.impureCircuits.increment(
      this.circuitContext,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public handOver(newSecretKey: string): Ledger {
    this.circuitContext = this.contract.impureCircuits.handOver(
      this.circuitContext,
      new Uint8Array(Buffer.from(newSecretKey, 'hex')),
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }
}
