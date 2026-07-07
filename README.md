# @memorynetwork/client

JS/TS SDK for [Memory Network](https://memorynetworks.tech): rent memory slots and read/write agent memory, settled in **$MNET** on **Solana** (devnet).

Agents start every session from zero. Memory Network is a marketplace where storage providers list "memory packs", agents buy persistent memory slots on-chain, and then write, read, and semantically search their long-term context through this SDK.

## Install

```bash
bun add @memorynetwork/client
# or
npm install @memorynetwork/client
```

Node 20+ or Bun. The package is ESM-only.

## Quick start

```ts
import { Keypair, createClient } from '@memorynetwork/client'

const mnet = await createClient({
  rpc: 'https://api.devnet.solana.com',
  apiUrl: 'https://memorynetworks.tech', // Memory Network API
  signer: Keypair.generate(),           // or any WalletSigner (see below)
})

// Buy a slot on a listing (on-chain $MNET transfer) and get a usable Slot
const slot = await mnet.memory.rent({ listing: 'support-ctx-pack', slots: 1 })

// Write a memory record — the integrity root is anchored on-chain
await slot.write({ key: 'pref.theme', value: 'The user prefers a dark, high-contrast UI.' })

// Later, in a fresh process/session: no purchase needed, the wallet already owns the slot
const sameSlot = await mnet.memory.slot('support-ctx-pack')
await sameSlot.read('pref.theme')                       // exact key lookup
await sameSlot.search('what are the user preferences?') // semantic recall (top-k)
```

A complete runnable version of this flow lives in [`examples/agent-demo.ts`](../../examples/agent-demo.ts) — session A buys a slot and stores facts, session B (a fresh process) recalls them.

## How it works

1. **Rent** — `mnet.memory.rent()` fetches the listing, builds a `purchase_slot` transaction against the Memory Network Anchor program, has your signer sign it, and confirms it on devnet. $MNET moves from the buyer to the seller (plus a network fee to the treasury) and a `Purchase` account is recorded on-chain. The purchase is then reported to the API for the dashboard.
2. **Session** — memory access is gated by ownership. The first read/write signs a server challenge with your wallet key; the server verifies the on-chain purchase and issues a bearer token, cached for the lifetime of the `Slot` object.
3. **Write with integrity** — every `write()` returns the provider's content hash and new Merkle-style root. The SDK recomputes both locally and refuses to proceed if they don't match, then anchors the new root on-chain with a `commit_memory` transaction. Use `slot.proof()` at any time to compare the server's expected root against the on-chain anchored one.

The on-chain program is the source of truth for funds and slot ownership; the API stores the memory content and serves fast reads.

## API

### `createClient(options): Promise<MemoryNetwork>`

| Option   | Type                    | Description                                            |
| -------- | ----------------------- | ------------------------------------------------------ |
| `rpc`    | `string`                | Solana RPC endpoint (devnet)                           |
| `apiUrl` | `string`                | Memory Network API base URL                            |
| `signer` | `Keypair \| WalletSigner` | Who pays and owns the memory                         |

Fetches the chain config (program id, $MNET mint, treasury) from `GET {apiUrl}/api/chain`, so nothing chain-specific needs to be hardcoded.

### `MemoryNetwork`

- `wallet.address` — the signer's base58 address.
- `marketplace.list()` — all listings (`Listing[]`).
- `marketplace.get(id)` — a single listing.
- `memory.rent({ listing, slots? })` — buy `slots` (default 1) on-chain, returns a `Slot`.
- `memory.slot(listingId)` — get a `Slot` for a listing this wallet already owns, no purchase. The first access fails if the wallet has no on-chain purchase.

### `Slot`

- `write({ key, value })` — store a record, verify the provider's hashes, anchor the new root on-chain. Returns a `WriteReceipt` (`key`, `contentHash`, `root`, `writes`, `signature`).
- `read(key)` — exact lookup; `null` if the key doesn't exist.
- `search(query, k = 5)` — semantic search over the slot's records, returns `{ key, value, score }[]` sorted by relevance.
- `list()` — all records in the slot with timestamps.
- `proof()` — `{ server, onChain }` integrity roots for auditing.

### Signers

For Node/agent use, pass a `Keypair` directly (re-exported from the package). For browser wallets, pass anything implementing `WalletSigner`:

```ts
interface WalletSigner {
  publicKey: PublicKey
  signMessage(message: Uint8Array): Promise<Uint8Array>
  signTransaction(tx: Transaction): Promise<Transaction>
}
```

Wallet-adapter and AppKit providers satisfy this shape out of the box. `fromKeypair(kp)` is exported if you need the explicit wrapper.

## Funding a test wallet

On devnet, the API exposes a faucet that funds an address with test SOL and $MNET:

```ts
await fetch(`${apiUrl}/api/faucet`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: mnet.wallet.address }),
})
```

## Errors

All HTTP failures throw with the method, path, and status (e.g. `POST /api/memory/x/write -> 403`). Common cases:

- `Listing <id> is not on-chain` — the listing exists in the API but has no on-chain counterpart; it can't be rented.
- `403` on session — the wallet has no confirmed on-chain purchase for this listing.
- `Provider returned inconsistent hashes — refusing to anchor` — the server's hashes failed local verification; the write is not anchored and should not be trusted.

## Development

This package lives in the [Memory Network monorepo](../../README.md):

```bash
bun install            # from the repo root
bun run gen:client     # build dist/ (tsc)
```

`src/idl.ts` and `src/chain.ts` contain the Anchor IDL and transaction builders; `src/index.ts` is the public API.

## License

MIT
