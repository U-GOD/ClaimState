import { keccak256, toUtf8Bytes } from "ethers";
import { canonicalCommercialFields, commercialFieldBytes, type FreightCommercialFields } from "./canonicalize.js";
import { amountCommitment } from "./commitments.js";

export const FACE_AMOUNT_CENTS = 1_850_000n;
export const CREDIT_NOTE_CENTS = 50_000n;

/** Hedera Schedule Service refuses an expiration more than 62 days ahead. */
export const MAX_SCHEDULE_FUTURE_SECONDS = 5_356_800n;

const LABEL = /^[a-z0-9-]{1,40}$/;
const FORBIDDEN = /invoice|bank|name|pdf/i;

export interface PaymentAllocation {
  settles: boolean;
  label: string;
  paymentHash: string;
}

export interface FreightPlan {
  currency: "USD";
  faceAmountCents: bigint;
  creditNoteCents: bigint;
  remainingCents: bigint;
  dueDate: string;
  debtorReference: string;
  carrierReference: string;
  allocations: [PaymentAllocation, PaymentAllocation];
}

export function parseFreightPlan(value: unknown): FreightPlan {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Payment plan must be an object");
  }
  rejectForbiddenKeys(value);
  const record = value as Record<string, unknown>;
  const currency = record.currency;
  const faceAmountCents = asCents(record.faceAmountCents, "faceAmountCents");
  const creditNoteCents = asCents(record.creditNoteCents, "creditNoteCents");
  const dueDate = asText(record.dueDate, "dueDate");
  const debtorReference = asText(record.debtorReference, "debtorReference");
  const carrierReference = asText(record.carrierReference, "carrierReference");
  if (currency !== "USD") {
    throw new Error("Payment plan currency must be USD");
  }
  if (faceAmountCents !== FACE_AMOUNT_CENTS || creditNoteCents !== CREDIT_NOTE_CENTS) {
    throw new Error("Payment plan must be the 18500.00 face amount and the 500.00 credit note");
  }
  if (creditNoteCents >= faceAmountCents) {
    throw new Error("Credit note must be smaller than the face amount");
  }
  if (!Array.isArray(record.allocations) || record.allocations.length !== 2) {
    throw new Error("Payment plan must contain a non-settling report and a settling collection");
  }
  const allocations = record.allocations.map((entry, index) => parseAllocation(entry, index)) as [
    PaymentAllocation,
    PaymentAllocation,
  ];
  if (allocations[0].settles || !allocations[1].settles) {
    throw new Error("The first allocation reports without settling and the second settles");
  }
  const fields: FreightCommercialFields = {
    schemaVersion: 1,
    currency: "USD",
    amountCents: faceAmountCents,
    dueDate,
    debtorReference,
    carrierReference,
  };
  canonicalCommercialFields(fields);
  return {
    currency: "USD",
    faceAmountCents,
    creditNoteCents,
    remainingCents: faceAmountCents - creditNoteCents,
    dueDate,
    debtorReference,
    carrierReference,
    allocations,
  };
}

export function dilutedTermsRoot(plan: FreightPlan): string {
  return keccak256(
    commercialFieldBytes({
      schemaVersion: 1,
      currency: plan.currency,
      amountCents: plan.remainingCents,
      dueDate: plan.dueDate,
      debtorReference: plan.debtorReference,
      carrierReference: plan.carrierReference,
    }),
  );
}

export function dilutedAmountCommitment(input: {
  plan: FreightPlan;
  domain: string;
  obligationId: string;
  version: bigint;
  salt: string;
}): string {
  return amountCommitment({
    domain: input.domain,
    obligationId: input.obligationId,
    version: input.version,
    amountCents: input.plan.remainingCents,
    salt: input.salt,
  });
}

export function assertScheduleDueDate(dueDateUnix: bigint, nowUnix: bigint): void {
  if (dueDateUnix <= nowUnix) {
    throw new Error("Schedule due date must be in the future");
  }
  if (dueDateUnix > nowUnix + MAX_SCHEDULE_FUTURE_SECONDS) {
    throw new Error("Hedera schedules cannot arm more than 62 days ahead");
  }
}

function parseAllocation(value: unknown, index: number): PaymentAllocation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Allocation ${index} must be an object`);
  }
  rejectForbiddenKeys(value);
  const record = value as Record<string, unknown>;
  if (typeof record.settles !== "boolean") {
    throw new Error(`Allocation ${index} must say whether it settles`);
  }
  const label = asText(record.label, `allocations[${index}].label`);
  if (!LABEL.test(label)) {
    throw new Error(`Allocation ${index} label must be a short slug`);
  }
  return {
    settles: record.settles,
    label,
    paymentHash: keccak256(toUtf8Bytes(`ClaimState/v1/payment/${label}`)),
  };
}

function rejectForbiddenKeys(value: object): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN.test(key)) {
      throw new Error(`Payment plan field ${key} is not allowed`);
    }
  }
}

function asCents(value: unknown, name: string): bigint {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return BigInt(value);
}

function asText(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error(`${name} must be text`);
  }
  return value;
}
