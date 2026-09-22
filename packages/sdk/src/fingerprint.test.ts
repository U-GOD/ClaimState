import { strict as assert } from "node:assert";
import { test } from "node:test";
import { commercialFieldBytes, type FreightCommercialFields } from "./canonicalize.js";
import { hmacFingerprintProvider } from "./fingerprint.js";
import * as sdk from "./index.js";

const demoFields: FreightCommercialFields = {
  schemaVersion: 1,
  currency: "USD",
  amountCents: 1_850_000n,
  dueDate: "2026-12-31",
  debtorReference: "debtor-ref-1",
  carrierReference: "carrier-ref-1",
};

const keyA = Uint8Array.from({ length: 32 }, () => 0x11);
const keyB = Uint8Array.from({ length: 32 }, () => 0x22);

test("the same commercial fields and key always produce the same fingerprint", () => {
  const provider = hmacFingerprintProvider(keyA);
  const bytes = commercialFieldBytes(demoFields);
  const first = provider.fingerprint(bytes);
  const second = provider.fingerprint(bytes);
  assert.equal(first.length, 32);
  assert.deepEqual(first, second);
});

test("changing amount, due date, or debtor reference changes the fingerprint", () => {
  const provider = hmacFingerprintProvider(keyA);
  const base = provider.fingerprint(commercialFieldBytes(demoFields));
  const changedAmount = provider.fingerprint(
    commercialFieldBytes({ ...demoFields, amountCents: 1_800_000n }),
  );
  const changedDue = provider.fingerprint(
    commercialFieldBytes({ ...demoFields, dueDate: "2027-01-15" }),
  );
  const changedDebtor = provider.fingerprint(
    commercialFieldBytes({ ...demoFields, debtorReference: "debtor-ref-2" }),
  );
  assert.notDeepEqual(base, changedAmount);
  assert.notDeepEqual(base, changedDue);
  assert.notDeepEqual(base, changedDebtor);
});

test("two HMAC keys do not collide on the demo invoice", () => {
  const bytes = commercialFieldBytes(demoFields);
  const left = hmacFingerprintProvider(keyA).fingerprint(bytes);
  const right = hmacFingerprintProvider(keyB).fingerprint(bytes);
  assert.notDeepEqual(left, right);
});

test("hashing the raw invoice number is not a function the SDK exports", () => {
  for (const name of Object.keys(sdk)) {
    assert.equal(/invoice/i.test(name), false, name);
  }
});
