import { Connection, Keypair, PublicKey, type Transaction } from '@solana/web3.js';
import { type ChainConfig } from './chain.js';
export interface WalletSigner {
    publicKey: PublicKey;
    signMessage(message: Uint8Array): Promise<Uint8Array>;
    signTransaction(tx: Transaction): Promise<Transaction>;
}
/** Wrap a Solana Keypair (Node/agent use) as a WalletSigner. */
export declare function fromKeypair(kp: Keypair): WalletSigner;
export type Listing = {
    id: string;
    title: string;
    priceMnet: number;
    slotsTotal: number;
    slotsSold: number;
    tier: 'standard' | 'premium';
    tags: string[];
    summary: string;
    sellerPubkey?: string | null;
    listingId?: number | null;
    listingPda?: string | null;
};
export type WriteReceipt = {
    key: string;
    contentHash: string;
    root: string;
    writes: number;
    signature: string;
};
export interface ClientOptions {
    rpc: string;
    apiUrl: string;
    signer: Keypair | WalletSigner;
}
export declare function createClient(opts: ClientOptions): Promise<MemoryNetwork>;
export declare class MemoryNetwork {
    private readonly apiUrl;
    private readonly connection;
    private readonly chain;
    private readonly signer;
    readonly wallet: {
        address: string;
    };
    readonly marketplace: {
        list: () => Promise<Listing[]>;
        get: (id: string) => Promise<Listing>;
    };
    readonly memory: {
        rent: (opts: {
            listing: string;
            slots?: number;
        }) => Promise<Slot>;
        slot: (listingId: string) => Promise<Slot>;
    };
    constructor(apiUrl: string, connection: Connection, chain: ChainConfig, signer: WalletSigner);
    private json;
    private listingOrThrow;
    /** Buy `slots` on a listing on-chain, then return a usable Slot. */
    rent(listingId: string, slots?: number): Promise<Slot>;
    /** Get a Slot for a listing already owned by this wallet (no purchase). */
    slot(listingId: string): Promise<Slot>;
}
export declare class Slot {
    private readonly apiUrl;
    private readonly connection;
    private readonly chain;
    private readonly signer;
    readonly listingId: string;
    private readonly listingPda;
    private token?;
    constructor(apiUrl: string, connection: Connection, chain: ChainConfig, signer: WalletSigner, listingId: string, listingPda: string);
    /** Establish (and cache) an access session by signing a server challenge. */
    private session;
    /** Write a memory record and anchor the new integrity root on-chain. */
    write({ key, value }: {
        key: string;
        value: string;
    }): Promise<WriteReceipt>;
    read(key: string): Promise<{
        key: string;
        value: string;
    } | null>;
    search(query: string, k?: number): Promise<{
        key: string;
        value: string;
        score: number;
    }[]>;
    list(): Promise<{
        key: string;
        value: string;
        updatedAt: number;
    }[]>;
    /** Server's expected integrity root vs the on-chain anchored root. */
    proof(): Promise<{
        server: {
            root: string;
            writes: number;
        };
        onChain: {
            root: string;
            writes: number;
        } | null;
    }>;
    private get;
    private post;
}
export type { ChainConfig } from './chain.js';
export { Keypair, PublicKey } from '@solana/web3.js';
