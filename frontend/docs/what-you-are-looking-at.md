# What you are looking at

A traditional freight invoice is a bill. A trucking company hauls a load for a broker and sends a bill for the work. The bill names the parties, the load, the invoice number, the amount due, the due date, and where to pay. That PDF stays in the trucking company's own system.

ClaimState is the record beside that bill. Hedera stores a fingerprint of the commercial terms, the step the deal is on, and one rule: only one lender can fund it. The invoice number, the names, the bank details, and the PDF never enter a Hedera message.

## The example on the page

Open the site with `npm run dev` at http://localhost:3000. The heading is **Obligation**. The page walks one example:

- Face amount **$18,500.00**, kept on the private side.
- A lender advances **85 percent**, which is **$15,725.00**.
- A second lender is refused.
- A **$500.00** short-pay updates the terms.
- The deal ends `RELEASED` at version 7.

Each card has two columns.

| Column | What it holds |
|---|---|
| Local store | Amounts and private references. These stay off Hedera. |
| Public header | Version, state, role, and hashes. This is the shape of an HCS message. |

A hash is a fingerprint. It lets a later reader prove the private terms were not swapped, without showing the terms.

The long id that starts with `0xabab` is the example obligation. Click it for the short view: state `RELEASED`, version 7, and the list of public messages.

**Index** says `pending index`, then `resolved`. Those words mean "the public copy has not caught up" and "the public copy matches." On this page the wait is scripted. The built-in story uses topic id `0.0.0`, which is not a Hedera topic. The first read is treated as missing. The second read returns the story the page already has.

The topic links on the cards point at `0.0.0`. The live testnet run is a different topic. Use the addresses in [Quickstart](quickstart.md).

## The seven cards

| Card | In plain language | Public result |
|---|---|---|
| Same private invoice offered twice | The bill exists. Offering it twice does not publish a second document. | `DRAFT`, version 1 |
| Broker confirms | The broker agrees the terms. The PDF stays local. | `ACKNOWLEDGED` |
| Factor funds 85 percent | One lender pays the advance. Evidence, payment, receipt, and the contract succeed together, or the whole batch rolls back. | `RESERVED` |
| Second factor | Another lender tries the same bill and is refused. The holder is not named. | `ALREADY_RESERVED`. Holder not shown. |
| $500 short-pay | The amount owed changes. The obligation id stays the same. | Still `RESERVED`, new version and terms root |
| Collection report and release | The bill is collected and the lender lets go. | `RELEASED`, version 7 |
| Switch to Compute SLA | The same kernel can describe a different contract. Click **Compute SLA** and the sentence under the control changes. The seven cards stay the freight example. | A separate acknowledged envelope |

The gray line under **Factor funds 85 percent** names the real batch order: evidence, advance, receipt, then the contract last.

## What a company would do

A company would not leave these seven cards on a homepage. Their own billing system would send each step when it happens: create the envelope, wait for the broker, fund it, record a short-pay, release it. The cards are the guided tour of those steps.

Scaffolding this repository gives you the kernel, the scripts, and this tour. It does not replace a transportation system, a bank transfer, a UCC filing, or a duplicate-invoice registry. See [Legal boundaries](../../LEGAL_BOUNDARIES.md).
