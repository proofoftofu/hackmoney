## Sui Integration

### How it works

This flow utilizes Ed25519 digital signatures to verify off-chain authorizations without incurring the latency or cost of intermediate on-chain transactions. First, the channel owner signs a raw byte message—such as a specific bid amount—using their private key off-chain. This signature, the original message, and the bidder's address are then submitted to the Sui network. The verify_bid function employs the sui::ed25519::ed25519_verify native function to cryptographically match the signature against the owner_pubkey stored within the StateChannel object. Upon successful verification, the contract updates the global state with the new bid and bidder; otherwise, the transaction aborts to prevent unauthorized state changes.

### Yellow Network Integration

This implementation serves as a technical Proof of Concept (PoC) to validate state channel feasibility on Sui. While a production-grade deployment would involve updating the Yellow SDK and formalizing contract registration, this project focuses on the core cryptographic settlement layer. By utilizing Sui Move and an integration test suite, the project demonstrates that off-chain authorizations can be securely verified on-chain. This flow ensures that high-frequency state updates—such as bids—are settled using Sui’s native Ed25519 primitives, proving that the infrastructure can support the low-latency requirements of the Yellow Network.
