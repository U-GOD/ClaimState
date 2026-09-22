import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getAddress } from "ethers";
import type { ClaimEvent } from "./events.js";
import {
  OBLIGATION_STATES,
  ZERO_ADDRESS,
  apply,
  type Envelope,
} from "./machine.js";

const supplier = getAddress("0x0000000000000000000000000000000000000001");
const buyer = getAddress("0x0000000000000000000000000000000000000002");
const factor = getAddress("0x0000000000000000000000000000000000000003");
const otherFactor = getAddress("0x0000000000000000000000000000000000000004");
const paymentAgent = getAddress("0x0000000000000000000000000000000000000005");
const executor = getAddress("0x0000000000000000000000000000000000000006");

const obligation = b32(0x10);
const termsRoot = b32(0x11);
const fingerprint = b32(0x12);
const amountCommitment = b32(0x13);
const nextTerms = b32(0x21);
const nextAmount = b32(0x22);
const evidence = b32(0x31);
const paymentHash = b32(0x32);
const dueDate = 1_800_000_000n;

function b32(byte: number): string {
  return `0x${byte.toString(16).padStart(2, "0").repeat(32)}`;
}

function id(n: number): string {
  return `0x${n.toString(16).padStart(64, "0")}`;
}

function succeed(state: Envelope | null, event: ClaimEvent): Envelope {
  const result = apply(state, event);
  assert.equal(result.ok, true, result.ok ? "" : show(result.error));
  if (!result.ok) {
    throw new Error("unreachable");
  }
  return result.state;
}

function show(value: unknown): string {
  return JSON.stringify(value, (_key, inner) => (typeof inner === "bigint" ? inner.toString() : inner));
}

function create(eventId = id(1)): Envelope {
  return succeed(null, {
    eventType: "Create",
    eventId,
    expectedVersion: 0n,
    signers: [{ role: "supplier", account: supplier }],
    obligationId: obligation,
    termsRoot,
    fingerprint,
    amountCommitment,
    buyer,
    supplier,
    paymentAgent,
    scheduledExecutor: executor,
    dueDate,
  });
}

function acknowledge(state: Envelope, eventId = id(2)): Envelope {
  return succeed(state, {
    eventType: "Acknowledge",
    eventId,
    expectedVersion: state.version,
    signers: [{ role: "buyer", account: buyer }],
    termsRoot: state.termsRoot,
  });
}

function activate(state: Envelope, holder = factor, eventId = id(3)): Envelope {
  return succeed(state, {
    eventType: "Activate",
    eventId,
    expectedVersion: state.version,
    signers: [
      { role: "supplier", account: supplier },
      { role: "factor", account: holder },
    ],
    factor: holder,
  });
}

function reserved(): Envelope {
  return activate(acknowledge(create()));
}

test("the state set is closed", () => {
  assert.deepEqual(
    [...OBLIGATION_STATES],
    ["DRAFT", "ACKNOWLEDGED", "RESERVED", "DISPUTED", "DELINQUENT", "SETTLED", "RELEASED", "DEFAULTED"],
  );
});

test("Create by the supplier opens a draft at version 1", () => {
  const state = create();
  assert.equal(state.state, "DRAFT");
  assert.equal(state.version, 1n);
  assert.equal(state.factor, ZERO_ADDRESS);
  assert.equal(state.obligationId, obligation);
  assert.deepEqual(state.consumedEventIds, [id(1)]);
});

test("Acknowledge by the buyer moves DRAFT to ACKNOWLEDGED", () => {
  const state = acknowledge(create());
  assert.equal(state.state, "ACKNOWLEDGED");
  assert.equal(state.version, 2n);
  assert.equal(state.factor, ZERO_ADDRESS);
});

test("Activate by the supplier and factor reserves the envelope", () => {
  const state = activate(acknowledge(create()));
  assert.equal(state.state, "RESERVED");
  assert.equal(state.version, 3n);
  assert.equal(state.factor, factor);
});

test("CreditNote by the buyer and supplier keeps the reservation and the obligation id", () => {
  const before = reserved();
  const state = succeed(before, {
    eventType: "CreditNote",
    eventId: id(4),
    expectedVersion: before.version,
    signers: [
      { role: "buyer", account: buyer },
      { role: "supplier", account: supplier },
    ],
    termsRoot: nextTerms,
    amountCommitment: nextAmount,
  });
  assert.equal(state.state, "RESERVED");
  assert.equal(state.version, before.version + 1n);
  assert.equal(state.obligationId, before.obligationId);
  assert.equal(state.factor, factor);
  assert.equal(state.termsRoot, nextTerms);
  assert.equal(state.amountCommitment, nextAmount);
  assert.notEqual(state.termsRoot, before.termsRoot);
});

test("OpenDispute by the buyer keeps the holder", () => {
  const before = reserved();
  const state = succeed(before, {
    eventType: "OpenDispute",
    eventId: id(5),
    expectedVersion: before.version,
    signers: [{ role: "buyer", account: buyer }],
    evidenceHash: evidence,
  });
  assert.equal(state.state, "DISPUTED");
  assert.equal(state.factor, before.factor);
});

test("CureDispute by the buyer returns to RESERVED", () => {
  const disputed = succeed(reserved(), {
    eventType: "OpenDispute",
    eventId: id(5),
    expectedVersion: 3n,
    signers: [{ role: "buyer", account: buyer }],
    evidenceHash: evidence,
  });
  const state = succeed(disputed, {
    eventType: "CureDispute",
    eventId: id(6),
    expectedVersion: disputed.version,
    signers: [{ role: "buyer", account: buyer }],
    evidenceHash: evidence,
  });
  assert.equal(state.state, "RESERVED");
  assert.equal(state.factor, factor);
});

test("a non-settling allocation leaves RESERVED and DELINQUENT unchanged", () => {
  const open = reserved();
  const stillReserved = succeed(open, allocation(open, false, id(7)));
  assert.equal(stillReserved.state, "RESERVED");
  assert.equal(stillReserved.version, open.version + 1n);

  const late = succeed(open, {
    eventType: "MarkDelinquent",
    eventId: id(8),
    expectedVersion: open.version,
    signers: [{ role: "scheduledExecutor", account: executor }],
    observedAt: dueDate + 1n,
  });
  const stillLate = succeed(late, allocation(late, false, id(9)));
  assert.equal(stillLate.state, "DELINQUENT");
  assert.equal(stillLate.factor, factor);
});

test("a settling allocation from RESERVED or DELINQUENT moves to SETTLED", () => {
  const open = reserved();
  const fromReserved = succeed(open, allocation(open, true, id(10)));
  assert.equal(fromReserved.state, "SETTLED");
  assert.equal(fromReserved.factor, factor);

  const late = succeed(reserved(), {
    eventType: "MarkDelinquent",
    eventId: id(11),
    expectedVersion: 3n,
    signers: [{ role: "scheduledExecutor", account: executor }],
    observedAt: dueDate + 1n,
  });
  const fromLate = succeed(late, allocation(late, true, id(12)));
  assert.equal(fromLate.state, "SETTLED");
});

test("MarkDelinquent after the due date moves RESERVED to DELINQUENT", () => {
  const open = reserved();
  const state = succeed(open, {
    eventType: "MarkDelinquent",
    eventId: id(13),
    expectedVersion: open.version,
    signers: [{ role: "scheduledExecutor", account: executor }],
    observedAt: dueDate + 1n,
  });
  assert.equal(state.state, "DELINQUENT");
  assert.equal(state.factor, factor);
});

test("DeclareDefault by the factor from DISPUTED or DELINQUENT keeps the holder", () => {
  const disputed = succeed(reserved(), {
    eventType: "OpenDispute",
    eventId: id(14),
    expectedVersion: 3n,
    signers: [{ role: "buyer", account: buyer }],
    evidenceHash: evidence,
  });
  const fromDispute = succeed(disputed, {
    eventType: "DeclareDefault",
    eventId: id(15),
    expectedVersion: disputed.version,
    signers: [{ role: "factor", account: factor }],
    evidenceHash: evidence,
  });
  assert.equal(fromDispute.state, "DEFAULTED");
  assert.equal(fromDispute.factor, factor);

  const late = succeed(reserved(), {
    eventType: "MarkDelinquent",
    eventId: id(16),
    expectedVersion: 3n,
    signers: [{ role: "scheduledExecutor", account: executor }],
    observedAt: dueDate + 60n,
  });
  const fromLate = succeed(late, {
    eventType: "DeclareDefault",
    eventId: id(17),
    expectedVersion: late.version,
    signers: [{ role: "factor", account: factor }],
    evidenceHash: evidence,
  });
  assert.equal(fromLate.state, "DEFAULTED");
  assert.equal(fromLate.factor, factor);
});

test("Release by the factor or the kernel clears the slot", () => {
  const settled = settle(reserved());
  const byFactor = succeed(settled, {
    eventType: "Release",
    eventId: id(18),
    expectedVersion: settled.version,
    signers: [{ role: "factor", account: factor }],
  });
  assert.equal(byFactor.state, "RELEASED");
  assert.equal(byFactor.factor, ZERO_ADDRESS);

  const again = settle(reserved());
  const byKernel = succeed(again, {
    eventType: "Release",
    eventId: id(19),
    expectedVersion: again.version,
    signers: [{ role: "kernel" }],
  });
  assert.equal(byKernel.state, "RELEASED");
  assert.equal(byKernel.factor, ZERO_ADDRESS);
});

test("Activate from DRAFT fails AlreadyReserved and the error has no holder", () => {
  const draft = create();
  const result = apply(draft, {
    eventType: "Activate",
    eventId: id(20),
    expectedVersion: draft.version,
    signers: [
      { role: "supplier", account: supplier },
      { role: "factor", account: factor },
    ],
    factor,
  });
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("unreachable");
  }
  assert.deepEqual(result.error, { code: "AlreadyReserved" });
  assert.equal(JSON.stringify(result.error).includes(factor.slice(2).toLowerCase()), false);
  assert.equal(draft.version, 1n);
  assert.equal(draft.state, "DRAFT");
});

test("a second Activate fails AlreadyReserved and does not reveal the holder", () => {
  const open = reserved();
  const result = apply(open, {
    eventType: "Activate",
    eventId: id(21),
    expectedVersion: open.version,
    signers: [
      { role: "supplier", account: supplier },
      { role: "factor", account: otherFactor },
    ],
    factor: otherFactor,
  });
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("unreachable");
  }
  assert.deepEqual(result.error, { code: "AlreadyReserved" });
  const encoded = JSON.stringify(result.error).toLowerCase();
  assert.equal(encoded.includes(factor.slice(2).toLowerCase()), false);
  assert.equal(encoded.includes(otherFactor.slice(2).toLowerCase()), false);
  assert.equal(open.state, "RESERVED");
  assert.equal(open.factor, factor);
  assert.equal(open.consumedEventIds.length, 3);
});

test("a stale expectedVersion is rejected and does not consume the event id", () => {
  const draft = create();
  const result = apply(draft, {
    eventType: "Acknowledge",
    eventId: id(22),
    expectedVersion: 0n,
    signers: [{ role: "buyer", account: buyer }],
    termsRoot,
  });
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("unreachable");
  }
  assert.deepEqual(result.error, { code: "StaleVersion", stateVersion: 1n, claimedVersion: 0n });
  assert.deepEqual(draft.consumedEventIds, [id(1)]);
});

test("replaying an event id fails even when the version is current", () => {
  const open = reserved();
  const noted = succeed(open, {
    eventType: "CreditNote",
    eventId: id(23),
    expectedVersion: open.version,
    signers: [
      { role: "buyer", account: buyer },
      { role: "supplier", account: supplier },
    ],
    termsRoot: nextTerms,
    amountCommitment: nextAmount,
  });
  const replay = apply(noted, {
    eventType: "CreditNote",
    eventId: id(23),
    expectedVersion: noted.version,
    signers: [
      { role: "buyer", account: buyer },
      { role: "supplier", account: supplier },
    ],
    termsRoot: b32(0x41),
    amountCommitment: b32(0x42),
  });
  assert.equal(replay.ok, false);
  if (replay.ok) {
    throw new Error("unreachable");
  }
  assert.deepEqual(replay.error, { code: "ReplayedEvent", eventId: id(23) });
  assert.equal(noted.termsRoot, nextTerms);
});

test("a credit note signed by the factor is unauthorized and does not reveal the holder", () => {
  const open = reserved();
  const result = apply(open, {
    eventType: "CreditNote",
    eventId: id(24),
    expectedVersion: open.version,
    signers: [{ role: "factor", account: factor }],
    termsRoot: nextTerms,
    amountCommitment: nextAmount,
  });
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("unreachable");
  }
  assert.deepEqual(result.error, { code: "Unauthorized" });
  assert.equal(JSON.stringify(result.error).toLowerCase().includes(factor.slice(2).toLowerCase()), false);
  assert.equal(open.amountCommitment, amountCommitment);
});

test("MarkDelinquent at the due date does not pass", () => {
  const open = reserved();
  const result = apply(open, {
    eventType: "MarkDelinquent",
    eventId: id(25),
    expectedVersion: open.version,
    signers: [{ role: "scheduledExecutor", account: executor }],
    observedAt: dueDate,
  });
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("unreachable");
  }
  assert.deepEqual(result.error, { code: "BeforeDueDate" });
});

test("a further Activate after release fails closed", () => {
  const settled = settle(reserved());
  const released = succeed(settled, {
    eventType: "Release",
    eventId: id(26),
    expectedVersion: settled.version,
    signers: [{ role: "factor", account: factor }],
  });
  const result = apply(released, {
    eventType: "Activate",
    eventId: id(27),
    expectedVersion: released.version,
    signers: [
      { role: "supplier", account: supplier },
      { role: "factor", account: otherFactor },
    ],
    factor: otherFactor,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.error, { code: "AlreadyReserved" });
  }
});

function allocation(state: Envelope, settles: boolean, eventId: string): ClaimEvent {
  return {
    eventType: "AllocatePayment",
    eventId,
    expectedVersion: state.version,
    signers: [{ role: "paymentAgent", account: paymentAgent }],
    settles,
    paymentHash,
  };
}

function settle(state: Envelope): Envelope {
  return succeed(state, allocation(state, true, id(40)));
}
