import type { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';

export const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID ?? 'preview') as NetworkId;

export const INDEXER_URL =
  import.meta.env.VITE_INDEXER_URL ??
  'https://indexer.preview.midnight.network/api/v4/graphql';

export const INDEXER_WS_URL =
  import.meta.env.VITE_INDEXER_WS_URL ??
  'wss://indexer.preview.midnight.network/api/v4/graphql/ws';

// Falls back to the public Preview deployment (see README) so the UI works
// out-of-the-box even if no .env is present. Override via VITE_DEFAULT_CONTRACT.
export const DEFAULT_CONTRACT =
  (import.meta.env.VITE_DEFAULT_CONTRACT ??
    'c98aa869dc4ad4d227e9c5961457aaf4af2f8f345dc913235c631af5a776b49b') as string;
