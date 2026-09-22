export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalJsonError";
  }
}

export interface FreightCommercialFields {
  schemaVersion: 1;
  currency: string;
  amountCents: bigint;
  dueDate: string;
  debtorReference: string;
  carrierReference: string;
}

const FREIGHT_KEYS = [
  "amountCents",
  "carrierReference",
  "currency",
  "debtorReference",
  "dueDate",
  "schemaVersion",
] as const;

type CanonicalValue =
  | null
  | boolean
  | string
  | bigint
  | number
  | CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

/**
 * Sorted-key JSON with no insignificant whitespace.
 * Integers are decimal. Floats are rejected.
 */
export function canonicalize(value: CanonicalValue): string {
  return writeValue(value);
}

/**
 * Accepts only text that is already canonical.
 * Extra whitespace and unsorted object keys fail closed.
 */
export function assertCanonicalJson(json: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new CanonicalJsonError("JSON is not valid");
  }
  const canonical = canonicalize(parsed as CanonicalValue);
  if (canonical !== json) {
    throw new CanonicalJsonError("JSON is not canonical");
  }
  return parsed;
}

/**
 * Freight commercial preimage. The field set is closed.
 * An invoice number is not a field and is rejected.
 */
export function canonicalCommercialFields(fields: FreightCommercialFields): string {
  const present = Object.keys(fields);
  for (const key of present) {
    if (!FREIGHT_KEYS.includes(key as (typeof FREIGHT_KEYS)[number])) {
      throw new CanonicalJsonError(`Unknown commercial field: ${key}`);
    }
  }
  for (const key of FREIGHT_KEYS) {
    if (!present.includes(key)) {
      throw new CanonicalJsonError(`Missing commercial field: ${key}`);
    }
  }
  if (fields.schemaVersion !== 1) {
    throw new CanonicalJsonError("schemaVersion must be 1");
  }
  if (!/^[A-Z]{3}$/.test(fields.currency)) {
    throw new CanonicalJsonError("currency must be a 3-letter ISO code");
  }
  if (typeof fields.amountCents !== "bigint" || fields.amountCents <= 0n) {
    throw new CanonicalJsonError("amountCents must be a positive integer");
  }
  assertCalendarDate(fields.dueDate);
  assertReference(fields.debtorReference, "debtorReference");
  assertReference(fields.carrierReference, "carrierReference");

  return canonicalize({
    amountCents: fields.amountCents,
    carrierReference: fields.carrierReference,
    currency: fields.currency,
    debtorReference: fields.debtorReference,
    dueDate: fields.dueDate,
    schemaVersion: fields.schemaVersion,
  });
}

export function commercialFieldBytes(fields: FreightCommercialFields): Uint8Array {
  return new TextEncoder().encode(canonicalCommercialFields(fields));
}

function assertReference(value: string, name: string): void {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new CanonicalJsonError(`${name} must be a non-empty string`);
  }
}

function assertCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new CanonicalJsonError("dueDate must be YYYY-MM-DD");
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new CanonicalJsonError("dueDate is not a calendar date");
  }
}

function writeValue(value: CanonicalValue): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new CanonicalJsonError("negative integers are rejected");
    }
    return value.toString(10);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new CanonicalJsonError("numbers must be non-negative safe integers");
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => writeValue(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const body = keys
      .map((key) => `${JSON.stringify(key)}:${writeValue(value[key] as CanonicalValue)}`)
      .join(",");
    return `{${body}}`;
  }
  throw new CanonicalJsonError("value cannot be canonicalized");
}
