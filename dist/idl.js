// Mirrors apps/web/src/lib/idl/memory_marketplace.json and programs/idl. Kept as
// a TS const so the SDK bundles cleanly (no JSON import / copy step).
export const MEMORY_MARKETPLACE_IDL = {
    address: '7e9QjBjJWfdFqYDhpDP3ekzZPskKHkPg1gfyJdNbe5G1',
    metadata: {
        name: 'memory_marketplace',
        version: '0.1.0',
        spec: '0.1.0',
        description: 'Memory Network — on-chain memory-slot marketplace settled in $MNET',
    },
    instructions: [
        {
            name: 'purchase_slot',
            discriminator: [179, 11, 137, 138, 144, 177, 68, 215],
            accounts: [
                { name: 'buyer', writable: true, signer: true },
                { name: 'marketplace' },
                { name: 'listing', writable: true },
                { name: 'purchase', writable: true },
                { name: 'mnet_mint' },
                { name: 'buyer_ata', writable: true },
                { name: 'seller_ata', writable: true },
                { name: 'treasury_ata', writable: true },
                { name: 'token_program', address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
                { name: 'system_program', address: '11111111111111111111111111111111' },
            ],
            args: [{ name: 'quantity', type: 'u32' }],
        },
        {
            name: 'commit_memory',
            discriminator: [75, 239, 115, 244, 228, 46, 213, 207],
            accounts: [
                { name: 'buyer', writable: true, signer: true },
                { name: 'marketplace' },
                { name: 'listing' },
                { name: 'purchase' },
                { name: 'memory', writable: true },
                { name: 'system_program', address: '11111111111111111111111111111111' },
            ],
            args: [{ name: 'new_root', type: { array: ['u8', 32] } }],
        },
    ],
    accounts: [
        { name: 'Marketplace', discriminator: [70, 222, 41, 62, 78, 3, 32, 174] },
        { name: 'Listing', discriminator: [218, 32, 50, 73, 43, 134, 26, 58] },
        { name: 'Purchase', discriminator: [33, 203, 1, 252, 231, 228, 8, 67] },
        { name: 'MemoryCommit', discriminator: [71, 84, 156, 138, 192, 157, 189, 237] },
    ],
    types: [
        {
            name: 'Marketplace',
            type: {
                kind: 'struct',
                fields: [
                    { name: 'authority', type: 'pubkey' },
                    { name: 'mnet_mint', type: 'pubkey' },
                    { name: 'treasury', type: 'pubkey' },
                    { name: 'fee_bps', type: 'u16' },
                    { name: 'listing_count', type: 'u64' },
                    { name: 'bump', type: 'u8' },
                ],
            },
        },
        {
            name: 'Listing',
            type: {
                kind: 'struct',
                fields: [
                    { name: 'marketplace', type: 'pubkey' },
                    { name: 'seller', type: 'pubkey' },
                    { name: 'listing_id', type: 'u64' },
                    { name: 'price', type: 'u64' },
                    { name: 'slots_total', type: 'u32' },
                    { name: 'slots_sold', type: 'u32' },
                    { name: 'metadata_hash', type: { array: ['u8', 32] } },
                    { name: 'active', type: 'bool' },
                    { name: 'bump', type: 'u8' },
                ],
            },
        },
        {
            name: 'Purchase',
            type: {
                kind: 'struct',
                fields: [
                    { name: 'listing', type: 'pubkey' },
                    { name: 'buyer', type: 'pubkey' },
                    { name: 'quantity', type: 'u32' },
                    { name: 'bump', type: 'u8' },
                ],
            },
        },
        {
            name: 'MemoryCommit',
            type: {
                kind: 'struct',
                fields: [
                    { name: 'listing', type: 'pubkey' },
                    { name: 'buyer', type: 'pubkey' },
                    { name: 'root', type: { array: ['u8', 32] } },
                    { name: 'writes', type: 'u64' },
                    { name: 'bump', type: 'u8' },
                ],
            },
        },
    ],
};
