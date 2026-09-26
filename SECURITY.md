# Security

ClaimState on this branch is a Hedera testnet template. It is not a production custody or filing system.

## Keys

Operator and demo keys are testnet keys. Put them in `.env.local` or `data/private/`. Both paths are gitignored. Do not commit a private key, a seed phrase, or a funded mainnet account. The harness rejects a mainnet chain check.

Demo accounts created by `deploy.ts` are ECDSA testnet accounts. Their key material stays in `data/private/demo-accounts.json` with mode `0600`. Scripts must not print those keys.

## Topics

HCS messages are public even when a submit key restricts writers. A topic payload is the fixed evidence header: ids, version, state codes, a terms root, an evidence hash, and a role. It must not carry an invoice number, a name, a bank detail, a PDF, or an email address.

## Pause and freeze

The demo fungible token and the operational receipt are created without a pause key, a freeze key, a wipe key, or a KYC key. There is no admin key that can halt transfers. If a later deployment adds pause or freeze, that authority has to be a separate governance key. It must not be the key that signs lifecycle events, and it must not be described as a lien.
