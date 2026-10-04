# Quickstart

You can read the example with no Hedera account. A testnet deploy needs a funded testnet operator.

## See the example

```bash
git clone https://github.com/U-GOD/ClaimState.git
cd ClaimState
npm install
npm run dev
```

Open http://localhost:3000. Read [What you are looking at](what-you-are-looking-at.md) beside the page.

These commands also work with no operator key:

```bash
npm run lint
npm test
```

## Start a new app from this template

```bash
npx create-scaffold-hbar@latest my-app --template U-GOD/ClaimState
cd my-app
cp .env.example .env.local
npm install
```

The template allows one frontend (`nextjs-app`), one Solidity framework (Hardhat), and npm. Pass those flags if you run the command with `--yes`, because the CLI defaults are otherwise Foundry and yarn.

`npm install`, `npm run lint`, `npm test`, and `npm run dev` still need no operator key.

## Put one obligation on testnet

1. Create a testnet account at the [Hedera Portal](https://portal.hedera.com/) and fund it from the faucet.
2. Copy `.env.example` to `.env.local`.
3. Set `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_ECDSA_KEY`. Leave the key in that file. Do not commit it and do not paste it into chat.
4. Run:

```bash
npm run deploy:testnet
npm run obligation
npm run verify:mirror
```

`deploy:testnet` creates the contract, the evidence topic, the advance token, and the receipt token. `obligation` walks one freight bill from `DRAFT` to `RELEASED`. `verify:mirror` checks the consensus receipt first, then the public mirror copy.

The published run already on testnet:

| Resource | Id | HashScan |
|---|---|---|
| ClaimStateKernel | `0.0.10835620` | https://hashscan.io/testnet/contract/0.0.10835620 |
| Evidence topic | `0.0.10835617` | https://hashscan.io/testnet/topic/0.0.10835617 |
| Advance token | `0.0.10835618` | https://hashscan.io/testnet/token/0.0.10835618 |
| Operational receipt | `0.0.10835619` | https://hashscan.io/testnet/token/0.0.10835619 |
| Chainlink USDC/USD | `0.0.4873353` | https://hashscan.io/testnet/contract/0.0.4873353 |

That obligation reached `RELEASED` at version 7. The supplier balance is 1,572,500 token units, which displays as $15,725.00. The advance token is named ClaimState Advance. Its memo says it is an operational advance, not an assignment and not a lien.

## How the seven messages map

The topic has seven messages because seven events were accepted. They are not seven steps of one HIP-551 batch. Only sequence 3 is a message inside the funding batch. The transfer, the receipt mint, and `activate` are the other inners, and they do not create topic messages.

HashScan shows the body as scrambled characters. It is 129 binary bytes. Mirror returns the same bytes at `https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10835617/messages/{sequence}`.

| Seq | Event | Version | Transition | Inside the funding batch? |
|---|---|---|---|---|
| 1 | Create | 1 | empty to `DRAFT` | No |
| 2 | Acknowledge | 2 | `DRAFT` to `ACKNOWLEDGED` | No |
| 3 | Activate | 3 | `ACKNOWLEDGED` to `RESERVED` | Yes. The batch's HCS inner. |
| 4 | CreditNote | 4 | `RESERVED` to `RESERVED` | No. Terms change. The id does not. |
| 5 | AllocatePayment | 5 | `RESERVED` to `RESERVED` | No. The $500 short-pay report. It does not settle. |
| 6 | AllocatePayment | 6 | `RESERVED` to `SETTLED` | No. The collection. This one settles. |
| 7 | Release | 7 | `SETTLED` to `RELEASED` | No |

The successful batch is [`0.0.10835610-1790995710-643016819`](https://hashscan.io/testnet/transaction/0.0.10835610-1790995710-643016819). Its inners, in order, are the sequence 3 topic message, the 1,572,500 unit transfer, receipt serial 1, and `activate` last.

## The second funding attempt

After release, the same factor submitted another batch. It is [`0.0.10835610-1790995730-481411216`](https://hashscan.io/testnet/transaction/0.0.10835610-1790995730-481411216). The outer result is `INNER_TRANSACTION_FAILED`. The HCS inner, the transfer, and the mint are `REVERTED_SUCCESS`, so there is no sequence 8 and the supplier balance stayed 1,572,500. The contract inner is `CONTRACT_REVERT_EXECUTED`. The revert data is `0x87b34a06`, the selector of `AlreadyReserved()`. That error has no arguments, so the holder is not returned.

The local card **Second factor** shows `ALREADY_RESERVED` and "Holder not shown." That label is this revert, and the card links the failed batch.

The local website does not read topic `0.0.10835617`. It shows the guided example on topic `0.0.0`. Use HashScan for the live messages. On HashScan the message body looks scrambled because it is a binary header. The page decodes that same kind of header into version, state, and hashes.

## Environment

| Variable | Required for | Meaning |
|---|---|---|
| `HEDERA_OPERATOR_ID` | Testnet scripts | Account id, such as `0.0.12345` |
| `HEDERA_OPERATOR_ECDSA_KEY` | Testnet scripts | Hex ECDSA private key, only in `.env.local` |
| `HEDERA_CHAIN_ID` | Optional | `296` on testnet, `295` on mainnet |
| `HEDERA_RPC_URL` | Optional | JSON-RPC. Defaults to Hashio for local development only |
| `HEDERA_MIRROR_BASE_URL` | Optional | Mirror REST. Defaults to `https://testnet.mirrornode.hedera.com` |

Hashio is a public development endpoint. Do not treat it as a production RPC.
