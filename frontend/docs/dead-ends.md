# Dead ends

These approaches were considered or tried. They are not the design.

## Hash the invoice number

Using the invoice number as `obligationId` lets anyone with a word list find the bill. The id is a domain-separated hash of an HMAC fingerprint, the buyer, and the supplier. The HMAC key never goes into a message or a log.

## Put the contract call first in the batch

An early version submitted `activate` before the evidence and the transfer. Hedera rejected the body because a contract call inside a batch has to be last. The shipped order is evidence, advance, receipt mint, then `activate`.

## Drop an inner when the batch is too big

Cutting the receipt or the transfer would leave a reservation without the advance, or an advance without the reservation. The builder refuses an oversized batch instead.

## A second contract call in the same batch

A swap, a second kernel call, or any other contract call cannot share this batch. The one allowed call is `activate`, because that is the call that can roll the funding back when the dollar feed is bad.

## Treat the receipt NFT as title

The receipt metadata is `operational-receipt-not-title`. Burning or transferring the NFT does not release the reservation. The contract does not read the NFT to decide state.

## Give the token an admin key so the name can change

An admin key would also be a way to rewrite a public label after the fact, and it would sit next to the keys that sign lifecycle events. The tokens are created without admin, pause, freeze, wipe, or KYC keys. A wrong name means a new deploy, not an update. That is why the current testnet token was created again as ClaimState Advance. The earlier token still carries its original name.

## Trust Mirror Node as the write path

A mirror 404 in the seconds after consensus is lag. `verify:mirror` asserts the receipt first. The local page's `pending index` line on topic `0.0.0` is a scripted stand-in for that lag, not a live read of topic `0.0.10835617`.

## Add Foundry beside Hardhat

This repository is a Hardhat template. A second Solidity toolchain splits the tests and the deploy path. Do not add one.

## Use 18 decimals for the advance token

The advance token uses 2 decimals so 1,572,500 units display as 15,725.00. HBAR still uses 8. Copying an Ethereum ERC-20 default moves the displayed amount by many orders of magnitude.

## Rely on peers during `npm create`

The scaffold CLI installs with `--legacy-peer-deps`, which skips peers. A lockfile that only recorded `protobufjs` and the Hardhat plugins as peers passed in this checkout and failed in a fresh app. They are direct dependencies for that reason.
