import { type ContractAddress, fromHex, toHex } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  BehaviorSubject,
  catchError,
  concatMap,
  filter,
  firstValueFrom,
  interval,
  map,
  throwError,
  timeout,
  type Observable,
} from 'rxjs';
import { pipe as fnPipe } from 'fp-ts/function';
import { type Logger } from 'pino';
import { type ConnectedAPI, type InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import semver from 'semver';
import {
  Binding,
  Proof,
  SignatureEnabled,
  Transaction,
  type FinalizedTransaction,
  type TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { type NetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import * as CompiledContract from '@midnight-ntwrk/compact-js/effect/CompiledContract';
import { Buffer } from 'buffer';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import * as CounterContract from '@contract';
import { inMemoryPrivateStateProvider } from './in-memory-private-state-provider';
import { NETWORK_ID } from './constants';

const PRIVATE_STATE_ID = 'counterPrivateState';

export type DeployedCounter = Awaited<ReturnType<typeof findDeployedContract>>;

export type CounterDeployment =
  | { readonly status: 'in-progress' }
  | { readonly status: 'deployed'; readonly api: DeployedCounter; readonly address: string }
  | { readonly status: 'failed'; readonly error: Error };

const counterWitnesses = {
  localSecretKey: ({ privateState }: any): [unknown, Uint8Array] => [
    privateState,
    new Uint8Array(Buffer.from(privateState.secretKey, 'hex')),
  ],
};

// `CompiledContract` is cast to `any` for construction so the strict generic
// defaults (which collapse to `never` without the generated contract types
// present at type-check time) don't block compilation. The resulting value is
// passed as `any` to deployContract/findDeployedContract below.
const compiledContract: any = (CompiledContract as any).withWitnesses(
  (CompiledContract as any).make('counter', CounterContract.Contract),
  counterWitnesses,
);

const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

// The counter owner's secret key is generated once and persisted in
// localStorage so ownership survives page reloads (mirrors the CLI's private
// state). It never leaves the browser and only its hash is published on-chain.
function getSecretKey(): Uint8Array {
  const storageKey = 'midnight-counter-secret';
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  }
  const secret = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(storageKey, btoa(String.fromCharCode(...secret)));
  return secret;
}

function getFirstCompatibleWallet(): InitialAPI | undefined {
  const midnight = (window as any).midnight;
  if (!midnight) return undefined;
  return Object.values(midnight).find(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === 'object' &&
      'apiVersion' in wallet &&
      semver.satisfies((wallet as any).apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
}

function connectToWallet(logger: Logger, networkId: string): Promise<ConnectedAPI> {
  return firstValueFrom(
    fnPipe(
      interval(100),
      map(() => getFirstCompatibleWallet()),
      filter((api): api is InitialAPI => !!api),
      timeout({
  first: 10_000,
  with: () =>
    throwError(
      () =>
        new Error(
          'Could not find the Midnight Lace wallet. Install the extension and unlock it.',
        ),
    ),
}),
      concatMap(async (initialAPI) => initialAPI.connect(networkId)),
      timeout({
  first: 30_000,
  with: () => throwError(() => new Error('Lace wallet failed to respond within 30 seconds.')),
}),
      catchError((error) => throwError(() => (error instanceof Error ? error : new Error('Wallet not authorized')))),
    ),
  );
}

export interface CounterProviders {
  privateStateProvider: ReturnType<typeof inMemoryPrivateStateProvider>;
  zkConfigProvider: FetchZkConfigProvider<any>;
  proofProvider: ReturnType<typeof httpClientProofProvider>;
  publicDataProvider: ReturnType<typeof indexerPublicDataProvider>;
  walletProvider: {
    getCoinPublicKey: () => any;
    getEncryptionPublicKey: () => any;
    balanceTx: (tx: UnboundTransaction) => Promise<FinalizedTransaction>;
  };
  midnightProvider: { submitTx: (tx: FinalizedTransaction) => Promise<TransactionId> };
}

async function initializeProviders(logger: Logger): Promise<CounterProviders> {
  const networkId = NETWORK_ID as NetworkId;
  setNetworkId(networkId);
  const connectedAPI = await connectToWallet(logger, networkId);
  const walletNetwork = (connectedAPI as { networkId?: NetworkId }).networkId;
  if (walletNetwork && walletNetwork !== networkId) {
    throw new Error(
      `Network mismatch: your Lace wallet is on '${walletNetwork}' but this app requires '${networkId}'. ` +
        `Switch Lace to the ${networkId} network and reconnect.`,
    );
  }
  const config = await connectedAPI.getConfiguration();
  const proofServerUri = config.proverServerUri ?? 'http://127.0.0.1:6300';
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();
  const { unshieldedAddress } = await connectedAPI.getUnshieldedAddress();
  const zkConfigProvider = new FetchZkConfigProvider<any>(window.location.origin, fetch.bind(window));
  return {
    privateStateProvider: inMemoryPrivateStateProvider<string, { secretKey: string }>(),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proofServerUri, zkConfigProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        const received = await connectedAPI.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          'signature',
          'proof',
          'binding',
          fromHex(received.tx),
        );
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
    // Exposed for the hook to read the connected address without re-querying.
    ...({ walletAddress: unshieldedAddress, walletNetworkId: walletNetwork } as object),
  } as CounterProviders & { walletAddress: string; walletNetworkId?: NetworkId };
}

export class CounterManager {
  readonly #deploymentsSubject = new BehaviorSubject<Array<BehaviorSubject<CounterDeployment>>>([]);
  #initializedProviders: Promise<CounterProviders> | undefined;
  #walletAddress: string | undefined;
  #walletNetworkId: NetworkId | undefined;

  constructor(private readonly logger: Logger) {}

  readonly deployments$: Observable<Array<Observable<CounterDeployment>>> = this.#deploymentsSubject;

  /** The connected wallet's transparent address (set after a successful connect). */
  get address(): string | undefined {
    return this.#walletAddress;
  }

  /** The network the connected wallet reported (used to detect mismatches). */
  get walletNetworkId(): NetworkId | undefined {
    return this.#walletNetworkId;
  }

  resolve(contractAddress?: ContractAddress): Observable<CounterDeployment> {
    const deployments = this.#deploymentsSubject.value;
    if (contractAddress) {
      const existing = deployments.find(
        (d) => d.value.status === 'deployed' && d.value.address === contractAddress,
      );
      if (existing) return existing;
    }

    const secretKey = getSecretKey();
    const deployment = new BehaviorSubject<CounterDeployment>({ status: 'in-progress' });
    void this.run(deployment, contractAddress, secretKey);
    this.#deploymentsSubject.next([...deployments, deployment]);
    return deployment;
  }

  private getProviders(): Promise<CounterProviders> {
    if (!this.#initializedProviders) {
      this.#initializedProviders = initializeProviders(this.logger)
        .then((providers) => {
          const extra = providers as unknown as { walletAddress?: string; walletNetworkId?: NetworkId };
          this.#walletAddress = extra.walletAddress;
          this.#walletNetworkId = extra.walletNetworkId;
          return providers;
        })
        .catch((error) => {
          this.#initializedProviders = undefined;
          throw error;
        });
    }
    return this.#initializedProviders;
  }

  private async run(
    deployment: BehaviorSubject<CounterDeployment>,
    contractAddress: ContractAddress | undefined,
    secretKey: Uint8Array,
  ): Promise<void> {
    try {
      const providers = await this.getProviders();
      const initialPrivateState = { secretKey: Buffer.from(secretKey).toString('hex') };
      let api: DeployedCounter;
      let address: string;

      if (contractAddress) {
        api = await findDeployedContract(providers, {
          compiledContract: compiledContract as any,
          contractAddress,
          privateStateId: PRIVATE_STATE_ID,
          initialPrivateState,
        });
        address = contractAddress;
      } else {
        api = await deployContract(providers, {
          compiledContract: compiledContract as any,
          args: [],
          privateStateId: PRIVATE_STATE_ID,
          initialPrivateState,
        });
        address = api.deployTxData.public.contractAddress;
      }

      deployment.next({ status: 'deployed', api, address });
    } catch (error: unknown) {
  console.error('COUNTER DEPLOYMENT ERROR:', error);

  const cause = error instanceof Error ? (error as any).cause : undefined;

  console.error('ERROR DETAILS:', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    cause,
  });

  if (cause) {
    console.error('ERROR CAUSE:', cause);

    try {
      console.error(
        'ERROR CAUSE JSON:',
        JSON.stringify(cause, null, 2),
      );
    } catch {
      console.error('ERROR CAUSE could not be serialized');
    }
  }

  this.logger.error({ error }, 'Counter contract operation failed');

  const err =
    error instanceof Error
      ? new Error(
          error.message ||
            'Counter contract operation failed',
          { cause },
        )
      : new Error(
          JSON.stringify(error) || 'Unknown error',
        );

  deployment.next({ status: 'failed', error: err });
}
  }
}
