import type { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';

export const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID ?? 'preprod') as NetworkId;

export const INDEXER_URL =
  import.meta.env.VITE_INDEXER_URL ??
  'https://indexer.preprod.midnight.network/api/v4/graphql';

export const INDEXER_WS_URL =
  import.meta.env.VITE_INDEXER_WS_URL ??
  'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';

// Pre-deployed counter contract on Preprod (see README). Override via
// VITE_DEFAULT_CONTRACT to point at a different deployment.
export const DEFAULT_CONTRACT =
  (import.meta.env.VITE_DEFAULT_CONTRACT ??
    'f41078849af4602cc2e9eba6a94c61b57294b944f287c66292e6f666ea9d8269') as string;
