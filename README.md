# Midnight Counter — Level 2: Privacy-Preserving Frontend

> A privacy-preserving on-chain counter with a React + Vite frontend,
  zero-knowledge circuit calls, and Lace wallet integration.

## Live Demo

https://midnight-counter-88tbx5x4k-timrossids-projects.vercel.app

## Contract Address

| Network  | Address                          |
|----------|----------------------------------|
| Preprod  | `f41078849af4602cc2e9eba6a94c61b57294b944f287c66292e6f666ea9d8269` |

(Contract address is MANDATORY. Do not leave this blank.)

---

## Project Overview

| Component | What it is |
|---|---|
| **Contract** | `contracts/counter.compact` — public `count`, `owner` commitment, `round` |
| **Circuits** | `initialize`, `increment`, `handOver` |
| **Tests** | `tests/counter.test.ts` — 6 vitest cases, including privacy checks |
| **CLI** | `src/cli.ts` — interactive initialize/increment/view/hand-over |
| **E2E check** | `scripts/e2e-check.ts` — reconnect + query the deployed contract |

### Contract Addresses

| Contract | Network | Address |
|---|---|---|
| Hello World | Preview | `023961418ff144b7bbba58d5f3037922859872b09db069444cb8643ff3cdb0fc` |
| Counter | Preview | `c98aa869dc4ad4d227e9c5961457aaf4af2f8f345dc913235c631af5a776b49b` |

> Addresses are also recorded automatically in `.midnight-state.json`
> (gitignored — it holds the wallet seed).

---

## Initial Idea

The Midnight Builder Challenge is a hands-on program for learning how to write
zero-knowledge smart contracts on the Midnight Network using the Compact
language. It guides you through building and deploying real contracts across
multiple levels, starting from a minimal toolchain setup and a hello-world
deployment, then progressing to a contract with actual privacy guarantees.

As a solo participant, I chose to build a counter for Level 1 because it is
simple enough to understand every part of the circuit, yet deep enough to
demonstrate Midnight's core privacy model. The naive version is a public
number anyone can see and bump. My version flips that: the counter value is
still public, but ownership is proven with a zero-knowledge proof against a
one-way commitment on-chain, and the owner's secret key never leaves the local
machine. The Level 1 requirements — public ledger state, a private witness fed
into the circuit as input, and a deliberate `disclose()` — map directly onto
this design and make the privacy guarantees tangible and testable.

---

## Privacy Model

### Public ledger state

The contract's public state is a single `Ledger` struct:

```compact
export ledger Ledger {
  count: Uint<64>;
  owner: Bytes<32>;
  round: Counter<1>;
}
```

- `count` — the counter value, visible to everyone.
- `owner` — a **hash** of the owner's secret key, not the key itself.
- `round` — an anti-replay counter bumped on every owner transition.

### Private witness as a circuit input

The owner's secret key is **private state**, injected into each circuit through a
witness rather than being read from the ledger:

```compact
const sk = localSecretKey();
```

`localSecretKey()` is declared in the contract as a witness
(`unprovenfn localSecretKey() -> Bytes<32>`) and implemented in the DApp
(`tests/witnesses.ts` and `src/deploy.ts`). The runtime feeds it into the proof
from the local wallet's private state; it never touches the chain.

The on-chain commitment is computed from that secret key:

```compact
owner = publicKey(sk, round)
```

So anyone can verify the owner matches *some* key (ZKP), but nobody learns the key.

### Deliberate `disclose()`

Compact is privacy-by-default: **nothing is published unless explicitly
disclosed.** The contract deliberately discloses exactly the hashed owner
commitment so the counter's ownership transition is publicly verifiable:

```compact
owner = disclose(publicKey(newSecretKey, round as Field));
```

The raw `newSecretKey` is *not* disclosed — only its hash. See the comment block
at the top of `contracts/counter.compact` for the full reasoning.

### Privacy guarantee (proved by tests)

`tests/counter.test.ts` includes a test that serializes the entire public ledger
and asserts the raw secret key bytes never appear anywhere in it.

---

## Toolchain Setup (Step 1)

Midnight does not support Windows natively, so all toolchain work runs in **WSL
(Ubuntu)**. Verify your toolchain with:

| Tool | Version used | Notes |
|---|---|---|
| Node.js | 22.x | WSL via nvm |
| Docker | 27.x | Desktop, WSL2 backend |
| Compact CLI | 0.5.1 | `~/.local/bin/compact` |
| Compact compiler | 0.31.1 | `compact update` |
| Proof server | `midnightntwrk/proof-server:8.1.0` | port `6300` |

```bash
compact --version
compact compiler --version
docker compose ps   # proof-server up on :6300
```

> Windows quirk: WSL inherits `HOME` from Windows; always run with
> `HOME=/home/<user>` or use a helper that exports it (see `docs/`).

---

## Setup & Run

> Requires the proof server (and, for `preview`/`preprod`, a funded wallet).

```bash
npm install
npm run compile        # compact compile contracts/counter.compact managed/counter

# Local devnet (no wallet needed)
npm run setup          # starts node + indexer + proof-server, compiles, deploys

# Public network
npm run network preview
npm run deploy -- --network preview   # or: npm run setup -- --network preview
```

The first run creates a wallet and prints a 24-word recovery phrase — **write it
down**. Fund the printed address from the network faucet:

| Network | Faucet |
|---|---|
| Preview | <https://midnight-tmnight-preview.nethermind.dev> |
| Preprod | <https://midnight-tmnight-preprod.nethermind.dev> |

### Interact

```bash
npm run cli -- --network preview
```

Menu: **1** initialize Â· **2** increment Â· **3** view state Â· **4** hand over Â·
**5** balance Â· **6** exit.

### Wallet commands

```bash
npm run check-balance -- --network preview
npm run network          # show active network + last deploy
```

### Frontend (Web DApp)

A browser frontend (`frontend/`) connects to the **Lace** wallet and talks to the
same `counter` contract — initialize, increment, hand over, and read the public
state live from the indexer. It satisfies the Builder Challenge "Frontend
Integration" requirement.

```bash
# 1. Compile the contract (generates managed/counter/{keys,zkir}) — required once.
npm run compile

# 2. Start a proof server for Preprod (the browser sends proofs here).
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.1.0 \
  -- midnight-proof-server --network preprod

# 3. Install + run the frontend (Vite dev server on :3000).
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000> in Chrome with the **Lace (Midnight)** extension
installed and unlocked. The default Preprod contract address is set in
`frontend/.env` (`VITE_DEFAULT_CONTRACT`); change it to deploy/connect to a
different instance via the in-UI "Switch Contract" panel.

| What the UI does | How |
|---|---|
| Reads count / owner / round | `indexerPublicDataProvider` + `Counter.ledger` (no wallet needed) |
| Submits transactions | Lace DApp Connector → `balanceTx`/`submitTx` |
| Generates ZK proofs | `httpClientProofProvider` → proof server on `:6300` |
| Loads circuit keys | `FetchZkConfigProvider` from `window.location.origin/{keys,zkir}` |

> The owner's secret key is generated once and stored in `localStorage`; only
> its hash (`owner` commitment) ever touches the chain — same privacy model as
> the CLI.

---

## Level 2 — Frontend DApp (Browser)

This project adds a **browser DApp** (React + Vite) that connects to the same
`counter` contract through the **Lace** wallet and proves ownership with a
zero-knowledge proof — no raw secret key ever touches the chain or the UI.

### Live Demo

**https://midnight-counter.vercel.app/**

### Contract Address

| Network  | Address                                                            |
|----------|-------------------------------------------------------------------|
| Preprod  | `f41078849af4602cc2e9eba6a94c61b57294b944f287c66292e6f666ea9d8269` |

(Contract address is mandatory and must match the contract you deployed in Level 1.)

### What This Does

The DApp lets anyone with the Lace wallet open a web page that:

1. **Connects** to the user's Lace (Midnight) wallet and shows the connected
   address.
2. **Reads** the live counter state (`count`, `owner` commitment, `round`)
   straight from the Preprod indexer — no wallet required to view.
3. **Calls the `increment` circuit** with a single button. The browser generates
   a zero-knowledge proof locally (against the proof server) that the caller
   knows the private owner secret key, then submits the transaction on-chain.
4. Shows a **loading state** while the proof is being generated, then the new
   on-chain count after submission.

### Privacy Model

- **What is PUBLIC:** the counter `count`, the `owner` *commitment* (a hash of
  the secret key, not the key), the `round`, and the transaction itself.
- **What is PRIVATE:** the owner's secret key (kept in the browser's local
  private state / `localStorage`). It is fed into the circuit as a **witness**
  and never appears in the transaction inputs, the ledger, or the UI.
- **What the user PROVES without revealing:** knowledge of the secret owner key.
  The `increment` circuit checks `sha256(secretKey) == ownerCommitment` inside
  the proof, so the chain learns only that *some* valid key was used — not the
  key itself.

### Privacy Claim

> An on-chain observer can see the counter value increase and the owner
> commitment change, but **cannot** learn *who* the owner is or what the secret
> key is. The `increment` transaction carries a zero-knowledge proof that the
> caller knows the owner secret key, without revealing that key — only its
> commitment is ever published.

### Tech Stack

Midnight Network · Compact (smart contract) · Midnight.js SDK
(`@midnight-ntwrk/midnight-js-*`) · React + Vite · Lace wallet (DApp Connector).

### Prerequisites

- **Lace wallet** installed (the Midnight-enabled browser extension), unlocked.
- **Node.js v22** (use `nvm` on WSL/macOS; Windows via WSL).
- A **Preprod**-funded wallet (faucet: <https://midnight-tmnight-preprod.nethermind.dev>).
- Docker (to run the proof server locally) — or rely on Lace's built-in proof
  server.

### Run Locally

```bash
# 1. Clone + install root (Level 1) deps
git clone https://github.com/Timrossid/midnight-counter.git
cd midnight-counter
npm install
npm run compile          # generates managed/counter/{keys,zkir}

# 2. Start a Preprod proof server on :6300
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.1.0 \
  -- midnight-proof-server --network preprod

# 3. Run the frontend
cd frontend
npm install
npm run dev              # http://localhost:3000
```

Open <http://localhost:3000> in Chrome with Lace installed and unlocked. The
app auto-connects to the Preprod contract above; use **Switch Contract** to
point at a different deployment or **Deploy New** to become the owner of a fresh
counter.

### Deploy the Frontend

Deploy config is committed at the repo root:

- `vercel.json` — Vercel project settings (builds `frontend/`, SPA rewrite).
- `netlify.toml` — Netlify build (base `frontend/`, publish `dist`, SPA redirect).

**Vercel (CLI):**

```bash
npm i -g vercel
vercel login
vercel                       # pick "frontend" as the root? No — root has vercel.json
# (vercel.json points the build at frontend/ automatically)
```

**Netlify (CLI):**

```bash
npm i -g netlify-cli
netlify login
netlify init                 # detects netlify.toml; choose "frontend" as the base
netlify deploy --prod
```

After deploy, paste the live URL into the **Live Demo** section above.

### Demo Video

[PLACEHOLDER — I will add the link after recording]

---

## Run Tests

```bash
npm test                 # 6 vitest tests (contract simulates circuits locally)
npm run test:e2e -- --network preview   # reconnect + query the deployed contract
```

The unit tests run the real compiled circuits through a local `CounterSimulator`
(`tests/counter-simulator.ts`) without needing a chain, then verify:

1. deterministic initial state,
2. initialize binds the owner commitment,
3. increment is a valid state transition,
4. a non-owner secret key cannot authorize increments,
5. hand-over transfers ownership and replays are rejected,
6. private inputs never appear in public state.

---

## Project Structure

```
my-project/
├── contracts/counter.compact    # the Midnight (Compact) contract
├── managed/counter/             # generated: keys, contract, ZKIR, circuits
├── frontend/                    # Level 2 browser DApp (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx   # connect/disconnect + address + error states
│   │   │   └── CircuitCall.tsx     # increment circuit, local proof, privacy label
│   │   ├── hooks/
│   │   │   └── useMidnight.ts       # Midnight.js SDK hook (context provider)
│   │   ├── counterManager.ts        # deploy/find + providers wiring
│   │   ├── useCounter.ts            # indexer polling of count/owner/round
│   │   ├── constants.ts             # network + contract config
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/                      # keys/zkir copied here at build time
│   ├── vite.config.ts
│   └── package.json
├── src/
│   ├── deploy.ts                # deploy + wallet/proof wiring
│   ├── cli.ts                   # interactive CLI
│   ├── setup.ts                 # orchestrated setup
│   ├── network.ts               # network/wallet/state helpers
│   └── wallet.ts                # wallet sync helpers
├── tests/
│   ├── counter.test.ts          # 6 tests
│   ├── counter-simulator.ts     # local circuit runner
│   └── witnesses.ts             # private-state type + witness impl
├── scripts/e2e-check.ts         # read-only on-chain smoke check
├── vercel.json                  # Level 2 frontend deploy config (Vercel)
├── netlify.toml                 # Level 2 frontend deploy config (Netlify)
└── docker-compose.yml           # local devnet (node, indexer, proof-server)
```

---

## Screenshots

### Successful compile output

![Compile output](docs/Compile%20output.png)

The compiled artifacts (`managed/counter/` — circuits, proving key, verifying key, ZKIR) are
uploaded by CI on every push and can be downloaded from the
[latest passing Actions run](https://github.com/Timrossid/midnight-counter/actions/workflows/ci.yml)
under **Artifacts → managed-counter**.

### Contract deployed with address

![Deployed address](docs/Deployed%20address.png)

### Initialize

![CLI initialize](docs/cli-initialize.png)

### Increment

![CLI increment](docs/cli-increment.png)

### View state

![CLI view state](docs/cli-view-state.png)

---

## Final Checklist

| Requirement | Status |
|---|---|
| Step 1 — toolchain installed & verified (WSL) | ✅ |
| Step 1 — proof server running | ✅ |
| Step 3 — hello-world deployed to preview | ✅ |
| Step 4 — counter contract written (`counter.compact`) | ✅ |
| Step 4 — public ledger state | ✅ |
| Step 4 — private witness as circuit input (`localSecretKey`) | ✅ |
| Step 4 — deliberate `disclose()` + comment block | ✅ |
| Step 5 — 3+ tests | ✅ (6 tests) |
| Step 6 — README with all required sections | ✅ |
| Contract address in README | ✅ |
| 5+ meaningful commits | ✅ (7 commits) |
| Level 2 frontend | ✅ (React + Vite, Lace wallet, ZK circuits, deployed to Vercel) |

---

## License

MIT
