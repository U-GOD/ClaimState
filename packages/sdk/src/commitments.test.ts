import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { hexlify } from "ethers";
import { commercialFieldBytes, type FreightCommercialFields } from "./canonicalize.js";
import {
  actionDigest,
  amountCommitment,
  domainSeparator,
  obligationId,
  payloadHash,
} from "./commitments.js";
import { EVENT_TYPES, type ClaimEvent } from "./events.js";
import { hmacFingerprintProvider } from "./fingerprint.js";

const registryA = "0x1000000000000000000000000000000000000001";
const registryB = "0x1000000000000000000000000000000000000002";
const buyer = "0x2000000000000000000000000000000000000002";
const supplier = "0x3000000000000000000000000000000000000003";
const fingerprint = `0x${"ab".repeat(32)}`;
const saltA = `0x${"11".repeat(32)}`;
const saltB = `0x${"22".repeat(32)}`;

const demoFields: FreightCommercialFields = {
  schemaVersion: 1,
  currency: "USD",
  amountCents: 1_850_000n,
  dueDate: "2026-12-31",
  debtorReference: "debtor-ref-1",
  carrierReference: "carrier-ref-1",
};

function domain(overrides: Partial<Parameters<typeof domainSeparator>[0]> = {}): string {
  return domainSeparator({
    chainId: 296n,
    registry: registryA,
    topicId: "0.0.5000",
    networkLabel: "testnet",
    ...overrides,
  });
}

test("event type codes match the closed schema and no others", () => {
  const schemaPath = fileURLToPath(new URL("../../../schemas/event.schema.json", import.meta.url));
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
    properties: { eventType: { enum: string[] } };
  };
  assert.deepEqual([...EVENT_TYPES], schema.properties.eventType.enum);
});

test("obligationId changes when chain id, registry, or topic id changes", () => {
  const blinded = fingerprint;
  const base = obligationId({ domain: domain(), blindedFingerprint: blinded, buyer, supplier });
  const otherChain = obligationId({
    domain: domain({ chainId: 295n }),
    blindedFingerprint: blinded,
    buyer,
    supplier,
  });
  const otherRegistry = obligationId({
    domain: domain({ registry: registryB }),
    blindedFingerprint: blinded,
    buyer,
    supplier,
  });
  const otherTopic = obligationId({
    domain: domain({ topicId: "0.0.5001" }),
    blindedFingerprint: blinded,
    buyer,
    supplier,
  });
  const again = obligationId({ domain: domain(), blindedFingerprint: blinded, buyer, supplier });

  assert.equal(base, again);
  assert.notEqual(base, otherChain);
  assert.notEqual(base, otherRegistry);
  assert.notEqual(base, otherTopic);
});

test("a commercial fingerprint change moves the obligation id without hashing an invoice number", () => {
  const key = Uint8Array.from({ length: 32 }, () => 0x11);
  const provider = hmacFingerprintProvider(key);
  const basePrint = hexlify(provider.fingerprint(commercialFieldBytes(demoFields)));
  const changedPrint = hexlify(
    provider.fingerprint(commercialFieldBytes({ ...demoFields, amountCents: 1_800_000n })),
  );
  const baseId = obligationId({
    domain: domain(),
    blindedFingerprint: basePrint,
    buyer,
    supplier,
  });
  const changedId = obligationId({
    domain: domain(),
    blindedFingerprint: changedPrint,
    buyer,
    supplier,
  });
  assert.notEqual(baseId, changedId);
});

test("amount commitment hides the face amount behind a salt", () => {
  const domainValue = domain();
  const id = obligationId({ domain: domainValue, blindedFingerprint: fingerprint, buyer, supplier });
  const first = amountCommitment({
    domain: domainValue,
    obligationId: id,
    version: 1n,
    amountCents: 1_850_000n,
    salt: saltA,
  });
  const otherSalt = amountCommitment({
    domain: domainValue,
    obligationId: id,
    version: 1n,
    amountCents: 1_850_000n,
    salt: saltB,
  });
  const otherAmount = amountCommitment({
    domain: domainValue,
    obligationId: id,
    version: 1n,
    amountCents: 1_800_000n,
    salt: saltA,
  });
  assert.equal(first.length, 66);
  assert.notEqual(first, otherSalt);
  assert.notEqual(first, otherAmount);
});

test("action digest binds the event type and expected version", () => {
  const domainValue = domain();
  const id = obligationId({ domain: domainValue, blindedFingerprint: fingerprint, buyer, supplier });
  const event: ClaimEvent = {
    eventType: "Acknowledge",
    eventId: `0x${"01".repeat(32)}`,
    expectedVersion: 1n,
    signers: [{ role: "buyer", account: buyer }],
    termsRoot: `0x${"44".repeat(32)}`,
  };
  const hash = payloadHash(event);
  const digest = actionDigest({
    domain: domainValue,
    eventType: "Acknowledge",
    obligationId: id,
    expectedVersion: 1n,
    payloadHash: hash,
  });
  const stale = actionDigest({
    domain: domainValue,
    eventType: "Acknowledge",
    obligationId: id,
    expectedVersion: 2n,
    payloadHash: hash,
  });
  const otherType = actionDigest({
    domain: domainValue,
    eventType: "Activate",
    obligationId: id,
    expectedVersion: 1n,
    payloadHash: hash,
  });
  assert.notEqual(digest, stale);
  assert.notEqual(digest, otherType);
});
