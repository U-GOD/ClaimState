# Architecture

ClaimState has two pieces.

1. **Obligation envelope.** A versioned record of who signed which step. The commercial bill stays off Hedera. The network stores commitments: a terms root, an evidence hash, a blinded fingerprint, and an amount commitment.
2. **One operational reservation.** When a lender funds the bill, the reservation and the testnet advance succeed in the same batch. A second funding attempt reverts `AlreadyReserved` and does not reveal the current holder.

The envelope coordinates evidence among participants who use this software. It does not file a lien, transfer title, or see a pledge made somewhere else. See [Legal boundaries](../../LEGAL_BOUNDARIES.md).

## Who is who, in the freight example

| Role | In the example | What they sign |
|---|---|---|
| Supplier | The carrier who is owed the money | Create, and later a credit note with the buyer |
| Buyer | The broker who confirmed the load | Acknowledge, credit note, dispute |
| Factor | The lender who pays the advance | Activate and release |
| Payment agent | The reporter of money collected | Allocate payment |

`msg.sender` pays the Hedera fee. The signer is recovered from an ECDSA signature over `actionDigest`. The fee payer and the signer are different roles.

## What is private, and what is public

| Stays off the ledger | May appear on Hedera |
|---|---|
| Invoice number, names, bank details, PDF | Obligation id, version, state, role |
| Face amount in the local store | Terms root, evidence hash, blinded fingerprint |
| The HMAC key | The advance transfer, because a token transfer is public |

The HCS holder field is 20 zero bytes. The contract stores the holder. The error `AlreadyReserved` returns no address.

`obligationId` is not a hash of the invoice number. It is:

```text
domain = keccak256("ClaimState/v1", chainId, registry, topicId, schemaVersion, networkLabel)
blindedFingerprint = HMAC-SHA256(fingerprintKey, canonicalCommercialFields)
obligationId = keccak256(domain, blindedFingerprint, buyer, supplier)
actionDigest = keccak256(domain, eventType, obligationId, expectedVersion, payloadHash)
```

The same commercial fields and the same HMAC key produce the same id, so a second attempt hits the existing envelope. A different HMAC key produces a different id. The key stays in `data/private/` and is the trust boundary for that collision.

## The funding batch

Funding is one [HIP-551](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-551.md) batch. Hedera allows at most one contract call, and it must be the last inner transaction. The order is fixed:

1. Topic message: the evidence header.
2. Token transfer: 1,572,500 units of the advance token ($15,725.00 at 2 decimals).
3. Token mint: one operational receipt NFT. Metadata says `operational-receipt-not-title`.
4. Contract call: `activate`. This reads the Chainlink USDC/USD feed. A missing, stale, or off-peg price reverts `PriceUnavailable` and rolls the whole batch back. The error returns no holder.

On the published testnet run, this batch is topic sequence 3, transaction [`0.0.10835610-1790995710-643016819`](https://hashscan.io/testnet/transaction/0.0.10835610-1790995710-643016819). A later batch from the same factor, [`0.0.10835610-1790995730-481411216`](https://hashscan.io/testnet/transaction/0.0.10835610-1790995730-481411216), reverted `AlreadyReserved()` and did not add an eighth message. The other six topic messages are lifecycle events outside this batch. The map is in [Quickstart](quickstart.md).

The outer batch must stay within 6,000 bytes. If it does not fit, the builder throws and does not drop an inner transaction. A delinquency schedule is a later transaction. It is not a fifth inner of this batch. Hedera cannot make an ACH payment atomic with the reservation. A bank payment is a later signed `AllocatePayment`.

Contract calls inside batches are scheduled for removal in March 2027. The batch shape is documented so a later change is deliberate.

## Read path

The consensus receipt is the write path. Mirror Node is the public index and can lag. The UI words for that lag are exactly `pending index` and `resolved`. On the local guided page those words are scripted, because the story topic is `0.0.0`. `verify:mirror` on a real deploy checks the receipt first, then waits for the mirror copy.

## Modules

| Path | Role |
|---|---|
| `packages/hardhat/contracts` | `ClaimStateKernel` and the transition rules |
| `packages/sdk` | Canonical fields, commitments, signatures, and the batch builder |
| `packages/indexer` | Mirror reconciliation and the guided story |
| `packages/nextjs` | The local record and the obligation page |
| `adapters/freight` | Labels and private facts for the freight bill |
| `adapters/compute-sla` | Labels for a second obligation type on the same kernel |
| `schemas/event.schema.json` | The closed list of event names |
