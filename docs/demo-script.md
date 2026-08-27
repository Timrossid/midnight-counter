# Demo Video Script — Level 2 (Midnight Builder Challenge)

**Goal:** ≤ 2 minutes. Show (1) Lace wallet connect, (2) a successful `increment`
circuit call with the local proof-generation loading state, and (3) point out
that the private input is never shown.

**Prerequisites before recording**
- Google Chrome with the **Lace (Midnight)** extension installed and unlocked.
- Lace switched to the **Preprod** network, with a funded Preprod balance
  (faucet: <https://midnight-tmnight-preprod.nethermind.dev>).
- The connected wallet must be the **owner** of the deployed contract
  `f41078849af4602cc2e9eba6a94c61b57294b944f287c66292e6f666ea9d8269`.
  - If it isn't the owner, click **Deploy New** in the app first to become the
    owner of a fresh Preprod counter, then record against that one.
- App running locally: `cd frontend && npm run dev` → <http://localhost:3000>
  (proof server on `:6300`, Preprod).
- Recording tool ready (OBS, Chrome "record tab", or QuickTime).

---

## Shot list

**Shot 1 — Open the app (5s)**
- Show the page: title "Midnight Counter", the **Wallet** card with
  "Connect Wallet", the **Call a Circuit** card with the "Increment Counter"
  button and the 🔒 "Proved without revealing your input" label.
- *Narration:* "This is the Midnight counter dApp. It talks to a Preprod
  contract through the Lace wallet."

**Shot 2 — Connect Lace (15s)**
- Click **Connect Wallet**. When Lace prompts, approve the connection.
- The UI flips to "Connected: <address>" with a **Disconnect** link.
- *Narration:* "I click Connect — Lace asks for permission, I approve, and the
  connected wallet address appears on screen."

**Shot 3 — Read state (10s)**
- Scroll to **Counter State**; show the current `count`, the `owner`
  commitment (a hash, not a key), and `round` loaded from the indexer.
- *Narration:* "The counter state is read live from the Preprod indexer. Notice
  the owner is only a commitment hash."

**Shot 4 — Call the circuit (30–40s)**
- Click **Increment Counter**.
- Highlight the button changing to "Generating proof…" and the muted line
  "Generating the zero-knowledge proof locally in your browser…".
- Wait for the ✓ result: "Submitted on-chain. New count: <n>".
- *Narration:* "I click Increment. The browser generates a zero-knowledge proof
  locally — you can see the loading state — then submits the transaction. The
  new count comes back from chain."

**Shot 5 — Privacy point (15s)**
- Point at the 🔒 "Proved without revealing your input" label and the fact that
  no secret key ever appeared in the UI or the transaction.
- *Narration:* "The whole point: the owner secret key is proven, never
  revealed. Only its commitment is published on-chain."

**End.** (Optional) Click **Disconnect** to show the disconnected state.

---

## Recording tips
- Use "record tab" / "record window" so only the app + Lace popup are captured.
- Keep Lace's permission popup visible so reviewers see the real wallet flow.
- Trim dead time; target 90s–120s total.
- Export as MP4 (or upload directly to YouTube/Loom and paste the link).
- Paste the final link into the **Demo Video** section of `README.md`.
