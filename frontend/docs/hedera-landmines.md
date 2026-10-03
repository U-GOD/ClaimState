# Hedera landmines

These are the mistakes that look small and break the funding path or the scaffold install.

## One contract call, and it must be last

A HIP-551 batch accepts at most one smart contract call, and that call has to be the final inner transaction. The funding order is:

1. HCS topic message
2. Advance-token transfer
3. Receipt mint
4. `activate`

Putting `activate` earlier makes the network reject the batch. Adding a second contract call, including a swap, is rejected the same way. If the batch cannot include both the reservation and the advance, do not send a partial batch and call it atomic.

`activate` reads Chainlink USDC/USD (`0xb632a7e7e02d76c0Ce99d9C62c7a2d1B5F92B6B5` on testnet, contract `0.0.4873353`). The peg target is `1e8`. The band is 2 percent (`2e6`). The maximum age is 48 hours. Missing, stale, or off-peg data reverts `PriceUnavailable` and rolls the evidence, the advance, and the receipt back with it.

Contract calls inside batches are scheduled for removal in March 2027.

## Six thousand bytes

`MAX_OUTER_BATCH_BYTES` is 6000. `ACTIVATE_GAS` is 800,000. If the outer transaction is larger than the cap, throw. Do not drop the receipt, the transfer, or the contract call to make it fit.

## Decimals

HBAR amounts in the SDK use 8 decimals. The advance token uses 2 decimals. 1,572,500 units display as 15,725.00. Do not inherit Ethereum's 18.

## The token name cannot be edited later

The advance token and the receipt are created with no admin key, no pause key, no freeze key, no wipe key, and no KYC key. That is intentional. It also means a wrong name or memo cannot be updated. Fix the strings in `deploy.ts` before the next deploy. The live advance token is named ClaimState Advance.

## Topic messages are public

A submit key restricts who can write. Anyone can read the bytes. Publish the evidence header only. HashScan shows those bytes as scrambled characters because they are not UTF-8 text.

## Mirror lag

The consensus receipt is the source of truth. Mirror Node can lag. The UI words are `pending index` and `resolved`. On the local page, topic `0.0.0` makes that wait scripted. On a real topic, `verify:mirror` checks the receipt first and then the mirror REST API.

## Hashio

`https://testnet.hashio.io/api` is for development. Scripts honor `HEDERA_RPC_URL` and fall back to Hashio only for a local run.

## Scaffold install drops peer dependencies

`create-scaffold-hbar` installs with `npm install --legacy-peer-deps`. That flag does not install peer dependencies. `protobufjs@8.0.1` and the Hardhat toolbox plugins are direct dependencies so a fresh app still typechecks and tests. Do not float `protobufjs`. The Hedera proto package requires 8.0.1.

The root `format` script exits 0. The CLI runs `npm run format` after install. A missing script prints a warning and still exits 0. The no-op keeps that step quiet.

## Chain id

Testnet is 296. Mainnet is 295. The kernel constructor reverts on any other chain id. This template's harness rejects a mainnet key check. Do not commit `.env.local` or `data/private/`.
