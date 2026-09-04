// Copies the compiled circuit keys + ZKIR from the repo-root `managed/`
// directory into `public/` so the browser can fetch them at runtime via
// FetchZkConfigProvider (served from window.location.origin/keys and /zkir).
// Also copies the compiled contract index.js so Vite can import it.
// If artifacts aren't in managed/, they are expected to already be in public/.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const managedCounter = resolve(repoRoot, 'managed', 'counter');
const publicDir = resolve(here, '..', 'public');

const keysSrc = resolve(managedCounter, 'keys');
const zkirSrc = resolve(managedCounter, 'zkir');
const contractSrc = resolve(managedCounter, 'contract');
const keysDst = resolve(publicDir, 'keys');
const zkirDst = resolve(publicDir, 'zkir');
const contractDst = resolve(publicDir, 'contract');

// If managed artifacts exist, copy them to public
if (existsSync(keysSrc)) {
  mkdirSync(keysDst, { recursive: true });
  cpSync(keysSrc, keysDst, { recursive: true });
}
if (existsSync(zkirSrc)) {
  mkdirSync(zkirDst, { recursive: true });
  cpSync(zkirSrc, zkirDst, { recursive: true });
}
if (existsSync(contractSrc)) {
  mkdirContractDst = resolve(publicDir, 'contract');
  mkdirSync(mkdirContractDst, { recursive: true });
  cpSync(contractSrc, mkdirContractDst, { recursive: true });
}

// If managed artifacts don't exist but public artifacts do, that's fine too
// (e.g., they were copied manually or from a previous build)
if (!existsSync(keysDst) || !existsSync(zkirDst) || !existsSync(contractDst)) {
  console.error(
    '\n❌ Contract artifacts not found in ../../managed/counter/{keys,zkir,contract}.\n' +
      '   Generate them first from the repo root:\n\n' +
      '     npm run compile\n\n' +
      '   (this runs `compact compile contracts/counter.compact managed/counter`)\n' +
      '   Or ensure artifacts exist in frontend/public/keys, frontend/public/zkir, \n' +
      '   and frontend/public/contract.\n',
  );
  process.exit(1);
}

console.log('✅ Copied circuit keys + ZKIR + contract into frontend/public');
