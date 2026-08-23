// Copies the compiled circuit keys + ZKIR from the repo-root `managed/`
// directory into `public/` so the browser can fetch them at runtime via
// FetchZkConfigProvider (served from window.location.origin/keys and /zkir).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const managedCounter = resolve(repoRoot, 'managed', 'counter');
const publicDir = resolve(here, '..', 'public');

const keysSrc = resolve(managedCounter, 'keys');
const zkirSrc = resolve(managedCounter, 'zkir');

if (!existsSync(keysSrc) || !existsSync(zkirSrc)) {
  console.error(
    '\n❌ Contract artifacts not found in ../../managed/counter/{keys,zkir}.\n' +
      '   Generate them first from the repo root:\n\n' +
      '     npm run compile\n\n' +
      '   (this runs `compact compile contracts/counter.compact managed/counter`)\n',
  );
  process.exit(1);
}

mkdirSync(resolve(publicDir, 'keys'), { recursive: true });
mkdirSync(resolve(publicDir, 'zkir'), { recursive: true });
cpSync(keysSrc, resolve(publicDir, 'keys'), { recursive: true });
cpSync(zkirSrc, resolve(publicDir, 'zkir'), { recursive: true });

console.log('✅ Copied circuit keys + ZKIR into frontend/public');
