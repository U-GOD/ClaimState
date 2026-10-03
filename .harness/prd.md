# ClaimState

ClaimState records a signed obligation lifecycle on Hedera testnet. The commercial document stays off the ledger. The kernel stores commitments, one reservation, and the state transitions. It does not issue title, perfect a lien, or replace a duplicate-finance registry.

The reference story is one freight invoice. A buyer acknowledges it. A factor reserves it and disburses the advance in the same HIP-551 batch as the evidence message and an operational receipt. A second factor is rejected without revealing the holder. A credit note, a payment report, and a release follow. A compute SLA uses the same kernel and different labels.

A person can run the local record without a wallet. Funded deploy and mirror checks need a testnet operator key.
