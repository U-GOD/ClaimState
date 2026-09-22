import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CanonicalJsonError,
  assertCanonicalJson,
  canonicalCommercialFields,
  canonicalize,
  type FreightCommercialFields,
} from "./canonicalize.js";

const demoFields: FreightCommercialFields = {
  schemaVersion: 1,
  currency: "USD",
  amountCents: 1_850_000n,
  dueDate: "2026-12-31",
  debtorReference: "debtor-ref-1",
  carrierReference: "carrier-ref-1",
};

test("canonical JSON sorts keys and omits insignificant whitespace", () => {
  assert.equal(canonicalize({ b: 1, a: { d: true, c: "x y" } }), '{"a":{"c":"x y","d":true},"b":1}');
  assert.equal(
    canonicalCommercialFields(demoFields),
    '{"amountCents":1850000,"carrierReference":"carrier-ref-1","currency":"USD","debtorReference":"debtor-ref-1","dueDate":"2026-12-31","schemaVersion":1}',
  );
});

test("canonical JSON rejects extra whitespace", () => {
  assert.throws(() => assertCanonicalJson('{ "a": 1 }'), CanonicalJsonError);
  assert.throws(() => assertCanonicalJson('{"a":1, "b":2}'), CanonicalJsonError);
  assert.throws(() => assertCanonicalJson('{\n"a":1\n}'), CanonicalJsonError);
});

test("canonical JSON rejects unsorted keys", () => {
  assert.throws(() => assertCanonicalJson('{"b":1,"a":2}'), CanonicalJsonError);
  assert.doesNotThrow(() => assertCanonicalJson('{"a":2,"b":1}'));
});

test("whitespace inside a string is significant", () => {
  assert.doesNotThrow(() => assertCanonicalJson('{"a":"x y"}'));
});

test("commercial fields reject an invoice number", () => {
  const withInvoice = { ...demoFields, invoiceNumber: "INV-18500" };
  assert.throws(
    () => canonicalCommercialFields(withInvoice as FreightCommercialFields),
    /invoiceNumber/,
  );
});
