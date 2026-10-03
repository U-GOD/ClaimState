# Lifecycle

`version` starts at 1 when the envelope is created. Every accepted event increments it. A submission with a stale `expectedVersion` is rejected. Replaying an event id that was already accepted is rejected. A failed attempt does not consume the event id.

The accepted event names are exactly the enum in `schemas/event.schema.json`. Do not add a state or an event type without a test.

## States

| State | Meaning |
|---|---|
| `DRAFT` | The supplier created the envelope. The buyer has not signed. |
| `ACKNOWLEDGED` | The buyer signed the terms root. The funding slot is open. |
| `RESERVED` | One factor holds the reservation. The advance moved in the same batch. |
| `DISPUTED` | The buyer opened a dispute. The holder stays. |
| `DELINQUENT` | The due date passed without a settling payment. |
| `SETTLED` | A settling payment was reported. The holder can still release. |
| `RELEASED` | Terminal. The slot is clear and cannot be reserved again. |
| `DEFAULTED` | Terminal. The holder remains for the record. |

## Events

| Event | Who signs | Effect |
|---|---|---|
| `Create` | Supplier | `DRAFT` at version 1. No invoice body is stored. |
| `Acknowledge` | Buyer | `ACKNOWLEDGED`. The terms root must match. |
| `Activate` | Supplier and factor | `RESERVED`, only from `ACKNOWLEDGED`, and only when no holder is set. This is the contract call inside the funding batch. |
| `CreditNote` | Buyer and supplier | Changes `termsRoot` and `amountCommitment`. The obligation id stays the same. State stays `RESERVED`. |
| `OpenDispute` | Buyer | `DISPUTED`. The holder does not move. |
| `CureDispute` | Buyer | Back to `RESERVED`. |
| `AllocatePayment` | Payment agent | A non-settling report leaves the state as it is. A settling report moves `RESERVED` or `DELINQUENT` to `SETTLED`. |
| `MarkDelinquent` | Scheduled executor | Only after the due date. At the due date it reverts `BeforeDueDate`. |
| `DeclareDefault` | Factor | From dispute or delinquency. The holder stays. |
| `Release` | Factor, or the kernel for a scheduled path | `RELEASED`. The holder is cleared. |

`Activate` from any state other than `ACKNOWLEDGED`, or while a holder is already set, reverts `AlreadyReserved()` with no arguments. The revert must not return the current holder.

## Other reverts

| Error | When |
|---|---|
| `StaleVersion` | `expectedVersion` is behind the envelope. |
| `ReplayedEvent` | That event id was already accepted. |
| `Unauthorized` | The recovered signer is not allowed for this event. |
| `IllegalTransition` | The state machine has no edge for this event, including a second `Create`. |
| `BeforeDueDate` | `MarkDelinquent` is at or before the due date. |
| `TermsMismatch` | An acknowledgement names a different terms root. |
| `InvalidEvent` | The event encoding or a constructor argument is not acceptable. |
| `PriceUnavailable` | The Chainlink USDC/USD answer is missing, older than 48 hours, or more than 2 percent from $1. No holder is returned. |

For every event after create, the contract checks replay, then a stale version, then the edge, then the signers. `Activate` also calls `quoteDollar` before it commits. `_load` is a view and does not consume the event id.

## The freight numbers

| Fact | Value |
|---|---|
| Face amount, private | $18,500.00 |
| Advance rate | 85 percent |
| Advance | $15,725.00 = 1,572,500 units at 2 decimals |
| Short-pay, private | $500.00 |
| Happy path | Versions 1 through 7, ending `RELEASED` |

HBAR amounts in the SDK use 8 decimals. The advance token uses 2. Do not use Ethereum's 18.
