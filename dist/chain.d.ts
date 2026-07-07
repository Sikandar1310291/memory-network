import { Connection, PublicKey, type Transaction } from '@solana/web3.js';
export type ChainConfig = {
    cluster: string;
    programId: string;
    mnetMint: string;
    marketplace: string;
    treasury: string;
    tokenProgram: string;
    decimals: number;
    feeBps: number;
};
export declare function purchasePda(programId: PublicKey, listingPda: PublicKey, buyer: PublicKey): PublicKey;
export declare function memoryPda(programId: PublicKey, listingPda: PublicKey, buyer: PublicKey): PublicKey;
/** Builds the purchase_slot transaction (buyer ATA ensured) ready for signing. */
export declare function buildPurchaseTx(connection: Connection, chain: ChainConfig, listing: {
    sellerPubkey: string;
    listingPda: string;
}, buyer: PublicKey, quantity: number): Promise<Transaction>;
/** Builds the commit_memory transaction anchoring a 32-byte root, ready for signing. */
export declare function buildCommitMemoryTx(connection: Connection, chain: ChainConfig, listingPda: string, buyer: PublicKey, newRoot: Uint8Array): Promise<Transaction>;
/** Reads the on-chain MemoryCommit (root + writes) for a buyer, or null. */
export declare function getMemoryCommit(connection: Connection, chain: ChainConfig, listingPda: string, buyer: PublicKey): Promise<{
    root: string;
    writes: number;
} | null>;
