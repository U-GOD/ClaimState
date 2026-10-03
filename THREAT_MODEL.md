# Threat model

ClaimState orders what the participants signed. It does not prove that freight moved, that a buyer will pay, or that an off-registry pledge does not exist. This note covers the threats that the activation batch has to keep closed.

## Duplicate fingerprint

`obligationId` is `keccak256(domain, blindedFingerprint, buyer, supplier)`. The blinded fingerprint is an HMAC of the canonical commercial fields. The same fields and the same key produce the same id, so a second financing of the same obligation hits the existing envelope and cannot open a second slot.

A different HMAC key produces a different id for the same fields. The fingerprint service is the trust boundary for that collision. The contract stores the fingerprint and never the key. An invoice number is not an input to the id.

## Replay

Every accepted event stores its event id. A second submission of that id reverts `ReplayedEvent` before the version check, and the id is not consumed by a failed attempt. The action digest also includes the event id, so a signature cannot be moved onto a fresh id.

## Batch rollback fees

Activation is one HIP-551 batch: the evidence header, the `tUSDC` advance, the receipt mint, then `activate` last, under the same batch key. Hedera accepts one contract call in a batch, and only in the final position. If any inner transaction fails, the reservation, the token transfer, and the receipt mint roll back. The builder refuses to return a batch whose outer size exceeds 6,000 bytes rather than dropping an inner transaction.

Hedera can still charge fees for inner transactions that were processed before the batch failed. A reverted batch is not free. `verify-activation.ts` prints the charged fee on the crafted inner failure. That fee is not a partial reservation and not a partial advance.

## Mirror lag

The consensus receipt is the write path. Mirror Node can 404 for a few seconds after that receipt. `verify-mirror.ts` checks contract state, token balance, and the topic message against the receipt first, then waits for the same message and balance on the mirror REST API. A missing mirror row is lag, not a failed reservation.

## Off-registry pledge

A financier who never submits an envelope is invisible. `AlreadyReserved` only stops a second activation inside this kernel. It does not search UCC filings or MonetaGo, and the revert does not return the current holder. The public HCS header writes 20 zero bytes in the holder field on activation. The contract stores the holder.

## HMAC key disclosure

Anyone who learns the fingerprint key can recompute obligation ids for commercial fields they already know. The key stays in `data/private/` and is not an HCS field, a contract argument, token metadata, or a log line. Rotating the key changes future ids. It does not hide ids that were already published.
