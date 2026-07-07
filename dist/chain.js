import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, } from '@solana/spl-token';
import { MEMORY_MARKETPLACE_IDL } from './idl.js';
// Minimal wallet so Anchor can *build* (not sign) transactions; the real
// signature comes from the connected wallet / keypair afterwards.
function readOnlyWallet(publicKey) {
    return {
        publicKey,
        signTransaction: async (t) => t,
        signAllTransactions: async (t) => t,
    };
}
function getProgram(connection, payer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = new AnchorProvider(connection, readOnlyWallet(payer), {
        commitment: 'confirmed',
    });
    return new Program(MEMORY_MARKETPLACE_IDL, provider);
}
export function purchasePda(programId, listingPda, buyer) {
    return PublicKey.findProgramAddressSync([Buffer.from('purchase'), listingPda.toBuffer(), buyer.toBuffer()], programId)[0];
}
export function memoryPda(programId, listingPda, buyer) {
    return PublicKey.findProgramAddressSync([Buffer.from('memory'), listingPda.toBuffer(), buyer.toBuffer()], programId)[0];
}
/** Builds the purchase_slot transaction (buyer ATA ensured) ready for signing. */
export async function buildPurchaseTx(connection, chain, listing, buyer, quantity) {
    const program = getProgram(connection, buyer);
    const programId = new PublicKey(chain.programId);
    const mint = new PublicKey(chain.mnetMint);
    const marketplace = new PublicKey(chain.marketplace);
    const seller = new PublicKey(listing.sellerPubkey);
    const listingPda = new PublicKey(listing.listingPda);
    const treasury = new PublicKey(chain.treasury);
    const buyerAta = getAssociatedTokenAddressSync(mint, buyer);
    const sellerAta = getAssociatedTokenAddressSync(mint, seller);
    const treasuryAta = getAssociatedTokenAddressSync(mint, treasury);
    const tx = await program.methods
        .purchaseSlot(quantity)
        .accountsPartial({
        buyer,
        marketplace,
        listing: listingPda,
        purchase: purchasePda(programId, listingPda, buyer),
        mnetMint: mint,
        buyerAta,
        sellerAta,
        treasuryAta,
    })
        .transaction();
    tx.instructions.unshift(createAssociatedTokenAccountIdempotentInstruction(buyer, buyerAta, buyer, mint));
    tx.feePayer = buyer;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return tx;
}
/** Builds the commit_memory transaction anchoring a 32-byte root, ready for signing. */
export async function buildCommitMemoryTx(connection, chain, listingPda, buyer, newRoot) {
    const program = getProgram(connection, buyer);
    const programId = new PublicKey(chain.programId);
    const listing = new PublicKey(listingPda);
    const tx = await program.methods
        .commitMemory(Array.from(newRoot))
        .accountsPartial({
        buyer,
        marketplace: new PublicKey(chain.marketplace),
        listing,
        purchase: purchasePda(programId, listing, buyer),
        memory: memoryPda(programId, listing, buyer),
    })
        .transaction();
    tx.feePayer = buyer;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return tx;
}
/** Reads the on-chain MemoryCommit (root + writes) for a buyer, or null. */
export async function getMemoryCommit(connection, chain, listingPda, buyer) {
    const program = getProgram(connection, buyer);
    const pda = memoryPda(new PublicKey(chain.programId), new PublicKey(listingPda), buyer);
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const acc = await program.account.memoryCommit.fetch(pda);
        return {
            root: Buffer.from(acc.root).toString('hex'),
            writes: Number(acc.writes),
        };
    }
    catch {
        return null;
    }
}
