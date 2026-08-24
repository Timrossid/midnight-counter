import { createKeystore, HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { resolveNetwork, getOrCreateWallet } from './network';
import { Buffer } from 'node:buffer';

const { network, config } = resolveNetwork();

if (network === 'undeployed') {
  console.error('Please specify --network preview or --network preprod');
  process.exit(1);
}

const wallet = getOrCreateWallet(network);

setNetworkId(config.networkId);

const hdWallet = HDWallet.fromSeed(Buffer.from(wallet.seed, 'hex'));

if (hdWallet.type !== 'seedOk') {
  throw new Error('Invalid wallet seed');
}

const keys = hdWallet.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.NightExternal])
  .deriveKeysAt(0);

if (keys.type !== 'keysDerived') {
  throw new Error('Failed to derive wallet keys');
}

const keystore = createKeystore(
  keys.keys[Roles.NightExternal],
  config.networkId,
);

const address = keystore.getBech32Address();

hdWallet.hdWallet.clear();

console.log('');
console.log('════════════════════════════════════════════════════════════');
console.log(`  ${network.toUpperCase()} WALLET`);
console.log('════════════════════════════════════════════════════════════');
console.log('');
console.log(`  Wallet Address: ${address}`);
console.log('');
console.log('  ✓ Address derived locally');
console.log('  ✓ No blockchain sync performed');
console.log('  ✓ No transaction submitted');
console.log('');
