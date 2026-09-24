import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getAddress } from "ethers";
import { BatchTransaction, ContractExecuteTransaction, TransferTransaction } from "@hiero-ledger/sdk";
import { apply, ZERO_ADDRESS, type Envelope } from "./machine.js";
import type { ClaimEvent } from "./events.js";
import {
  CREDIT_NOTE_CENTS,
  FACE_AMOUNT_CENTS,
  assertScheduleDueDate,
  dilutedAmountCommitment,
  dilutedTermsRoot,
  parseFreightPlan,
} from "./payment-plan.js";
import { buildDelinquencySchedule } from "./schedule.js";
import { encodeEvidenceHeader, holderIsUndisclosed } from "./evidence.js";

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../adapters/mock-payment-agent/fixtures/freight-18500.json",
);

const buyer = getAddress("0x0000000000000000000000000000000000000002");
const supplier = getAddress("0x0000000000000000000000000000000000000001");
const factor = getAddress("0x0000000000000000000000000000000000000003");
const agent = getAddress("0x0000000000000000000000000000000000000005");
const executor = getAddress("0x0000000000000000000000000000000000000006");

test("the freight fixture is the 500.00 credit note and two allocations", async () => {
  const plan = parseFreightPlan(JSON.parse(await readFile(fixturePath, "utf8")));
  assert.equal(plan.faceAmountCents, FACE_AMOUNT_CENTS);
  assert.equal(plan.creditNoteCents, CREDIT_NOTE_CENTS);
  assert.equal(plan.remainingCents, 1_800_000n);
  assert.equal(plan.allocations[0].settles, false);
  assert.equal(plan.allocations[1].settles, true);
  assert.notEqual(plan.allocations[0].paymentHash, plan.allocations[1].paymentHash);
  assert.throws(() => parseFreightPlan({ invoiceNumber: "INV-1" }), /not allowed/);
});

test("credit note, payment, and release stay on the same obligation", async () => {
  const plan = parseFreightPlan(JSON.parse(await readFile(fixturePath, "utf8")));
  const domain = `0x${"ab".repeat(32)}`;
  const salt = `0x${"cd".repeat(32)}`;
  let state = reserved();
  const nextTerms = dilutedTermsRoot(plan);
  const nextAmount = dilutedAmountCommitment({
    plan,
    domain,
    obligationId: state.obligationId,
    version: state.version + 1n,
    salt,
  });
  state = ok(state, {
    eventType: "CreditNote",
    eventId: id(4),
    expectedVersion: state.version,
    signers: [
      { role: "buyer", account: buyer },
      { role: "supplier", account: supplier },
    ],
    termsRoot: nextTerms,
    amountCommitment: nextAmount,
  });
  assert.equal(state.state, "RESERVED");
  assert.equal(state.obligationId, reserved().obligationId);
  assert.equal(state.termsRoot, nextTerms);
  assert.equal(state.amountCommitment, nextAmount);
  state = ok(state, payment(state, plan.allocations[0].settles, plan.allocations[0].paymentHash, id(5)));
  assert.equal(state.state, "RESERVED");
  state = ok(state, payment(state, plan.allocations[1].settles, plan.allocations[1].paymentHash, id(6)));
  assert.equal(state.state, "SETTLED");
  state = ok(state, {
    eventType: "Release",
    eventId: id(7),
    expectedVersion: state.version,
    signers: [{ role: "factor", account: factor }],
  });
  assert.equal(state.state, "RELEASED");
  assert.equal(state.factor, ZERO_ADDRESS);
  const again = apply(state, {
    eventType: "Activate",
    eventId: id(8),
    expectedVersion: state.version,
    signers: [
      { role: "supplier", account: supplier },
      { role: "factor", account: factor },
    ],
    factor,
  });
  assert.equal(again.ok, false);
  if (!again.ok) {
    assert.equal(again.error.code, "AlreadyReserved");
    assert.equal("holder" in again.error, false);
  }
});

test("a payment before markDelinquent leaves the envelope unchanged by that call", () => {
  let state = reserved();
  state = ok(state, payment(state, true, id(9), id(10)));
  assert.equal(state.state, "SETTLED");
  const stale = apply(state, delinquent(3n, id(11)));
  assert.equal(stale.ok, false);
  if (!stale.ok) {
    assert.equal(stale.error.code, "StaleVersion");
  }
  const illegal = apply(state, delinquent(state.version, id(12)));
  assert.equal(illegal.ok, false);
  if (!illegal.ok) {
    assert.equal(illegal.error.code, "IllegalTransition");
  }
  assert.equal(state.state, "SETTLED");
});

test("dispute blocks a replacement and cure returns to RESERVED", () => {
  let state = reserved();
  const holder = state.factor;
  state = ok(state, {
    eventType: "OpenDispute",
    eventId: id(13),
    expectedVersion: state.version,
    signers: [{ role: "buyer", account: buyer }],
    evidenceHash: id(14),
  });
  assert.equal(state.state, "DISPUTED");
  assert.equal(state.factor, holder);
  const replacement = apply(state, {
    eventType: "Activate",
    eventId: id(15),
    expectedVersion: state.version,
    signers: [
      { role: "supplier", account: supplier },
      { role: "factor", account: factor },
    ],
    factor,
  });
  assert.equal(replacement.ok, false);
  if (!replacement.ok) {
    assert.equal(replacement.error.code, "AlreadyReserved");
  }
  state = ok(state, {
    eventType: "CureDispute",
    eventId: id(16),
    expectedVersion: state.version,
    signers: [{ role: "buyer", account: buyer }],
    evidenceHash: id(17),
  });
  assert.equal(state.state, "RESERVED");
  assert.equal(state.factor, holder);
});

test("create evidence starts from an empty state and hides the holder", () => {
  const header = encodeEvidenceHeader({
    eventType: "Create",
    obligationId: id(18),
    version: 1n,
    previousState: null,
    newState: "DRAFT",
    termsRoot: id(19),
    evidenceHash: id(20),
    actorRole: "supplier",
  });
  assert.equal(header[42], 0);
  assert.equal(holderIsUndisclosed(header), true);
});

test("the delinquency schedule is a contract call that waits for its due date", () => {
  const now = 1_700_000_000n;
  assert.throws(() => assertScheduleDueDate(now + 5_356_801n, now), /62 days/);
  const due = now + 86_400n;
  const call = new ContractExecuteTransaction().setContractId("0.0.5000").setGas(200_000);
    const schedule = buildDelinquencySchedule({
      contractCall: call,
      dueDateUnix: due,
      nowUnix: now,
    });
    assert.equal(schedule.waitForExpiry, true);
    assert.equal(schedule.expirationTime?.toDate().getTime(), Number(due) * 1000);
    assert.throws(
      () =>
        buildDelinquencySchedule({
          contractCall: new TransferTransaction(),
          dueDateUnix: due,
          nowUnix: now,
        }),
      /contract call/,
    );
    assert.throws(
      () =>
        buildDelinquencySchedule({
          contractCall: new BatchTransaction() as never,
          dueDateUnix: due,
          nowUnix: now,
        }),
      /contract call/,
    );
});

function reserved(): Envelope {
  const created = ok(null, {
    eventType: "Create",
    eventId: id(1),
    expectedVersion: 0n,
    signers: [{ role: "supplier", account: supplier }],
    obligationId: id(99),
    termsRoot: id(21),
    fingerprint: id(22),
    amountCommitment: id(23),
    buyer,
    supplier,
    paymentAgent: agent,
    scheduledExecutor: executor,
    dueDate: 1_800_000_000n,
  });
  const acknowledged = ok(created, {
    eventType: "Acknowledge",
    eventId: id(2),
    expectedVersion: created.version,
    signers: [{ role: "buyer", account: buyer }],
    termsRoot: created.termsRoot,
  });
  return ok(acknowledged, {
    eventType: "Activate",
    eventId: id(3),
    expectedVersion: acknowledged.version,
    signers: [
      { role: "supplier", account: supplier },
      { role: "factor", account: factor },
    ],
    factor,
  });
}

function payment(state: Envelope, settles: boolean, paymentHash: string, eventId: string): ClaimEvent {
  return {
    eventType: "AllocatePayment",
    eventId,
    expectedVersion: state.version,
    signers: [{ role: "paymentAgent", account: agent }],
    settles,
    paymentHash,
  };
}

function delinquent(expectedVersion: bigint, eventId: string): ClaimEvent {
  return {
    eventType: "MarkDelinquent",
    eventId,
    expectedVersion,
    signers: [{ role: "scheduledExecutor", account: executor }],
    observedAt: 1_800_000_001n,
  };
}

function ok(state: Envelope | null, event: ClaimEvent): Envelope {
  const result = apply(state, event);
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error("unreachable");
  }
  return result.state;
}

function id(n: number): string {
  return `0x${n.toString(16).padStart(64, "0")}`;
}
