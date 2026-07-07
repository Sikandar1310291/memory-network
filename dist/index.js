/**
 * @memorynetwork/client — rent memory slots and read/write agent memory,
 * settled in $MNET on Solana. See apps/web docs (sdk-api/client) for the model.
 *
 *   const mnet = await createClient({ rpc, apiUrl, signer })
 *   const slot = await mnet.memory.rent({ listing: 'support-ctx-pack', slots: 1 })
 *   await slot.write({ key: 'pref.theme', value: 'dark' })
 *   await slot.search('what are the user preferences?')
 */
import { createHash } from 'node:crypto';
import { Connection, Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { buildPurchaseTx, buildCommitMemoryTx, getMemoryCommit, } from './chain.js';
/** Wrap a Solana Keypair (Node/agent use) as a WalletSigner. */
export function fromKeypair(kp) {
    return {
        publicKey: kp.publicKey,
        async signMessage(m) {
            return nacl.sign.detached(m, kp.secretKey);
        },
        async signTransaction(tx) {
            tx.partialSign(kp);
            return tx;
        },
    };
}
function normalizeSigner(s) {
    return s instanceof Keypair ? fromKeypair(s) : s;
}
function sha256Hex(...parts) {
    const h = createHash('sha256');
    for (const p of parts)
        h.update(p);
    return h.digest('hex');
}
async function sendTx(connection, signer, tx) {
    const signed = await signer.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, 'confirmed');
    return sig;
}
export async function createClient(opts) {
    const signer = normalizeSigner(opts.signer);
    const connection = new Connection(opts.rpc, 'confirmed');
    const res = await fetch(`${opts.apiUrl}/api/chain`);
    if (!res.ok)
        throw new Error('Memory Network: on-chain config unavailable (/api/chain)');
    const chain = (await res.json());
    return new MemoryNetwork(opts.apiUrl.replace(/\/$/, ''), connection, chain, signer);
}
export class MemoryNetwork {
    apiUrl;
    connection;
    chain;
    signer;
    wallet;
    marketplace;
    memory;
    constructor(apiUrl, connection, chain, signer) {
        this.apiUrl = apiUrl;
        this.connection = connection;
        this.chain = chain;
        this.signer = signer;
        this.wallet = { address: signer.publicKey.toBase58() };
        this.marketplace = {
            list: () => this.json(`/api/listings`),
            get: (id) => this.json(`/api/listings/${id}`),
        };
        this.memory = {
            rent: (o) => this.rent(o.listing, o.slots ?? 1),
            slot: (id) => this.slot(id),
        };
    }
    async json(path) {
        const res = await fetch(`${this.apiUrl}${path}`);
        if (!res.ok)
            throw new Error(`GET ${path} -> ${res.status}`);
        return res.json();
    }
    async listingOrThrow(id) {
        const l = await this.marketplace.get(id);
        if (!l?.listingPda || !l.sellerPubkey)
            throw new Error(`Listing ${id} is not on-chain (no listingPda/sellerPubkey)`);
        return l;
    }
    /** Buy `slots` on a listing on-chain, then return a usable Slot. */
    async rent(listingId, slots = 1) {
        const l = await this.listingOrThrow(listingId);
        const tx = await buildPurchaseTx(this.connection, this.chain, { sellerPubkey: l.sellerPubkey, listingPda: l.listingPda }, this.signer.publicKey, slots);
        const signature = await sendTx(this.connection, this.signer, tx);
        await fetch(`${this.apiUrl}/api/purchases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                listingId,
                buyer: this.wallet.address,
                quantity: slots,
                signature,
            }),
        });
        return new Slot(this.apiUrl, this.connection, this.chain, this.signer, listingId, l.listingPda);
    }
    /** Get a Slot for a listing already owned by this wallet (no purchase). */
    async slot(listingId) {
        const l = await this.listingOrThrow(listingId);
        return new Slot(this.apiUrl, this.connection, this.chain, this.signer, listingId, l.listingPda);
    }
}
export class Slot {
    apiUrl;
    connection;
    chain;
    signer;
    listingId;
    listingPda;
    token;
    constructor(apiUrl, connection, chain, signer, listingId, listingPda) {
        this.apiUrl = apiUrl;
        this.connection = connection;
        this.chain = chain;
        this.signer = signer;
        this.listingId = listingId;
        this.listingPda = listingPda;
    }
    /** Establish (and cache) an access session by signing a server challenge. */
    async session() {
        if (this.token)
            return this.token;
        const address = this.signer.publicKey.toBase58();
        const { message } = await this.get(`/api/memory/challenge?address=${address}`);
        const sig = await this.signer.signMessage(new TextEncoder().encode(message));
        const signature = Buffer.from(sig).toString('base64');
        const res = await this.post(`/api/memory/session`, {
            address,
            listingId: this.listingId,
            message,
            signature,
        });
        this.token = res.token;
        return this.token;
    }
    /** Write a memory record and anchor the new integrity root on-chain. */
    async write({ key, value }) {
        const token = await this.session();
        const w = await this.post(`/api/memory/${this.listingId}/write`, { key, value }, token);
        // Verify the provider's hashes before trusting/anchoring them.
        const ch = sha256Hex(`${key}\n${value}\n${w.ts}`);
        const newRoot = sha256Hex(Buffer.from(w.prevRoot, 'hex'), Buffer.from(ch, 'hex'));
        if (ch !== w.contentHash || newRoot !== w.newRoot) {
            throw new Error('Provider returned inconsistent hashes — refusing to anchor');
        }
        const tx = await buildCommitMemoryTx(this.connection, this.chain, this.listingPda, this.signer.publicKey, Buffer.from(newRoot, 'hex'));
        const signature = await sendTx(this.connection, this.signer, tx);
        return { key, contentHash: ch, root: newRoot, writes: w.writes, signature };
    }
    async read(key) {
        const token = await this.session();
        const res = await fetch(`${this.apiUrl}/api/memory/${this.listingId}/read?key=${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 404)
            return null;
        if (!res.ok)
            throw new Error(`read -> ${res.status}`);
        return res.json();
    }
    async search(query, k = 5) {
        const token = await this.session();
        return this.post(`/api/memory/${this.listingId}/search`, { query, k }, token);
    }
    async list() {
        const token = await this.session();
        return this.get(`/api/memory/${this.listingId}/list`, token);
    }
    /** Server's expected integrity root vs the on-chain anchored root. */
    async proof() {
        const token = await this.session();
        const server = await this.get(`/api/memory/${this.listingId}/proof`, token);
        const onChain = await getMemoryCommit(this.connection, this.chain, this.listingPda, this.signer.publicKey);
        return { server, onChain };
    }
    async get(path, token) {
        const res = await fetch(`${this.apiUrl}${path}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok)
            throw new Error(`GET ${path} -> ${res.status}`);
        return res.json();
    }
    async post(path, body, token) {
        const res = await fetch(`${this.apiUrl}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new Error(`POST ${path} -> ${res.status} ${detail}`);
        }
        return res.json();
    }
}
// Re-exported for convenience so consumers (e.g. Node agents) can build a signer
// without a direct @solana/web3.js dependency.
export { Keypair, PublicKey } from '@solana/web3.js';
