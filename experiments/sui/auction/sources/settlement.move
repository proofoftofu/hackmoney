module auction::settlement {
    use sui::ed25519;
    
    public struct StateChannel has key, store {
        id: UID,
        owner_pubkey: vector<u8>,
        latest_bid: u64,
        top_bidder: address
    }

    public entry fun create_channel(pubkey: vector<u8>, ctx: &mut TxContext) {
        let channel = StateChannel {
            id: object::new(ctx),
            owner_pubkey: pubkey,
            latest_bid: 0,
            top_bidder: @0x0,
        };
        transfer::share_object(channel);
    }

    public entry fun verify_bid(
        channel: &mut StateChannel,
        signature: vector<u8>,
        message: vector<u8>,
        bidder: address,
        amount: u64
    ) {
        // Verify the signed off-chain message against the stored public key
        let is_valid = ed25519::ed25519_verify(&signature, &channel.owner_pubkey, &message);
        assert!(is_valid, 0);

        channel.latest_bid = amount;
        channel.top_bidder = bidder;
    }
}
