# Writing an adapter

The kernel does not know what a freight bill is. An adapter supplies labels, the private checklist, and the canonical commercial fields. The state machine, the event names, and the funding batch stay the same.

Two adapters ship in this repo:

| Adapter | File | What it adds |
|---|---|---|
| Freight | `adapters/freight/policy.ts` | Carrier, broker, face amount, advance, short-pay |
| Compute SLA | `adapters/compute-sla/policy.ts` | Provider, customer, and a checklist: job commitment, completion window, buyer acknowledgement |

Neither file submits a transaction. The compute path is an already-acknowledged envelope on the same `ClaimStateKernel`, not a second contract.

## What you may change

- The private field list inside the canonical JSON: currency, amount in cents, due date, and the references your industry uses.
- The role labels shown in the local store.
- Who your organization treats as supplier, buyer, factor, and payment agent, as long as those parties sign the events in [Lifecycle](lifecycle.md).
- The HMAC key, which stays off the ledger. Rotating it changes future obligation ids. It does not hide ids already published.

`canonicalCommercialFields` is sorted-key JSON with no extra whitespace. The blinded fingerprint is the HMAC of those bytes. The obligation id mixes that fingerprint with the domain, the buyer, and the supplier.

## What you must not change

- Do not add a state or an event name without a test. The enum in `schemas/event.schema.json` is closed.
- Do not put an invoice number, a name, a bank detail, or a PDF into an HCS message, a contract argument, token metadata, or a log.
- Do not derive `obligationId` from the invoice number.
- Do not put a second contract call inside the funding batch. The only contract call is `activate`, and it is last.
- Do not remove the Chainlink read inside `activate`. A bad price has to roll the batch back.
- Do not describe an HTS receipt as an assignment or a lien. Receipt metadata stays `operational-receipt-not-title`.
- A credit note updates terms and the amount commitment. It does not mint a new obligation id.

## A practical sequence

1. Copy `adapters/freight/policy.ts` and rename the instrument and the roles.
2. List the private facts your operators need to see. Keep those facts in the local store.
3. Decide which of those facts are in the canonical bytes. Anything in the canonical bytes changes the fingerprint.
4. Reuse `Create`, `Acknowledge`, `Activate`, and the later events. Map your business step onto an existing event.
5. Add a test that the public payload still omits the private facts, and a test that a second `Activate` reverts `AlreadyReserved` with no holder.

The page switch labeled **Compute SLA** is the small version of this idea: same kernel, different labels. The seven freight cards stay on the page so the freight example remains readable.
