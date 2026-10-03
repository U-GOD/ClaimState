# AGENTS.md

Agents and humans editing this repository follow this file. ClaimState is a privacy-preserving obligation state envelope plus one in-network operational reservation. It records signed lifecycle evidence on Hedera. It does not issue legal title, perfect a lien, or replace MonetaGo, a UCC filing, or a factoring marketplace.

The reference workflow is one U.S. transportation factor financing a buyer-confirmed freight invoice. Later obligation types reuse the same kernel. Hardhat is the Solidity framework. Do not add Foundry in parallel.

## Invariants

1. Raw invoice numbers, names, bank details, and PDFs never enter an HCS message, contract event argument, token metadata, or log.
2. `obligationId` is not a hash of the invoice number. It is domain-separated and includes a blinded fingerprint.
3. Every accepted transition increments `version` and is rejected when `expectedVersion` is stale.
4. Event identifiers are consumed. Replaying the same event id fails.
5. At most one reservation holder exists. A second activation fails closed.
6. The reservation lock and the digital disbursement are in the same HIP-551 batch. If either cannot be included, do not ship a split brain and call it atomic.
7. External fiat settlement is a later signed `PaymentAllocated` event. Hedera cannot make ACH atomic.
8. An HTS receipt, if built, is an operational receipt. Metadata and docs say it is not an assignment and not a lien.
9. Consensus receipts are the write-path source of truth. The UI may show "pending index" until Mirror Node catches up.
10. A submit key on an HCS topic restricts writers. The message bytes remain public. Publish commitments only.
11. HBAR amounts in the SDK use 8 decimals. The advance token uses its own decimals and must not inherit Ethereum's 18.
12. Public Hashio is for development only. Scripts accept `HEDERA_RPC_URL` and default to Hashio solely for local development.
13. `activate` reads the Chainlink USDC/USD feed. A missing, stale, or off-peg price reverts `PriceUnavailable` and rolls the funding batch back. The error returns no holder. Do not remove that call.

## State machine

`version` starts at 1 on create and increments on every accepted event.

States: `DRAFT`, `ACKNOWLEDGED`, `RESERVED`, `DISPUTED`, `DELINQUENT`, `SETTLED`, `RELEASED`, `DEFAULTED`.

Do not add a new state without a test.

`Activate` from any state other than `ACKNOWLEDGED`, or while a holder is already set, reverts `AlreadyReserved`. The error must not return the current holder.

`CreditNote` changes `termsRoot` and `amountCommitment`. It does not create a new obligation id.

Accepted event types are exactly the enum in `schemas/event.schema.json`.
