import { getAddress } from "ethers";
import type {
  AcknowledgeEvent,
  ActivateEvent,
  AllocatePaymentEvent,
  ClaimEvent,
  CreateEvent,
  CreditNoteEvent,
  CureDisputeEvent,
  DeclareDefaultEvent,
  EventSigner,
  MarkDelinquentEvent,
  OpenDisputeEvent,
  ReleaseEvent,
} from "./events.js";

export const OBLIGATION_STATES = [
  "DRAFT",
  "ACKNOWLEDGED",
  "RESERVED",
  "DISPUTED",
  "DELINQUENT",
  "SETTLED",
  "RELEASED",
  "DEFAULTED",
] as const;

export type ObligationStateName = (typeof OBLIGATION_STATES)[number];

/** Zero is unused so an empty storage slot is not a state. */
export const STATE_CODE: Record<ObligationStateName, number> = {
  DRAFT: 1,
  ACKNOWLEDGED: 2,
  RESERVED: 3,
  DISPUTED: 4,
  DELINQUENT: 5,
  SETTLED: 6,
  RELEASED: 7,
  DEFAULTED: 8,
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface Envelope {
  state: ObligationStateName;
  version: bigint;
  obligationId: string;
  termsRoot: string;
  fingerprint: string;
  amountCommitment: string;
  buyer: string;
  supplier: string;
  factor: string;
  paymentAgent: string;
  scheduledExecutor: string;
  dueDate: bigint;
  consumedEventIds: readonly string[];
}

export type ApplyError =
  | { code: "AlreadyReserved" }
  | { code: "StaleVersion"; stateVersion: bigint; claimedVersion: bigint }
  | { code: "ReplayedEvent"; eventId: string }
  | { code: "Unauthorized" }
  | { code: "IllegalTransition" }
  | { code: "BeforeDueDate" }
  | { code: "TermsMismatch" }
  | {
      code: "InvalidEvent";
      reason: "event-id" | "address" | "bytes32" | "signers" | "due-date" | "amount";
    };

export type ApplyResult = { ok: true; state: Envelope } | { ok: false; error: ApplyError };

/**
 * Pure transition function. Phase 2 Solidity must accept the same rows and reject the same rows.
 * AlreadyReserved never carries the current holder.
 */
export function apply(state: Envelope | null, event: ClaimEvent): ApplyResult {
  const eventId = normalizeBytes32(event.eventId);
  if (eventId === null) {
    return invalid("event-id");
  }

  if (event.eventType === "Create") {
    return create(state, event, eventId);
  }
  if (state === null) {
    return illegal();
  }
  if (state.consumedEventIds.includes(eventId)) {
    return { ok: false, error: { code: "ReplayedEvent", eventId } };
  }
  if (event.expectedVersion !== state.version) {
    return {
      ok: false,
      error: {
        code: "StaleVersion",
        stateVersion: state.version,
        claimedVersion: event.expectedVersion,
      },
    };
  }

  switch (event.eventType) {
    case "Acknowledge":
      return acknowledge(state, event, eventId);
    case "Activate":
      return activate(state, event, eventId);
    case "CreditNote":
      return creditNote(state, event, eventId);
    case "OpenDispute":
      return openDispute(state, event, eventId);
    case "CureDispute":
      return cureDispute(state, event, eventId);
    case "AllocatePayment":
      return allocatePayment(state, event, eventId);
    case "MarkDelinquent":
      return markDelinquent(state, event, eventId);
    case "DeclareDefault":
      return declareDefault(state, event, eventId);
    case "Release":
      return release(state, event, eventId);
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

function create(state: Envelope | null, event: CreateEvent, eventId: string): ApplyResult {
  if (state !== null) {
    return illegal();
  }
  if (event.expectedVersion !== 0n) {
    return {
      ok: false,
      error: { code: "StaleVersion", stateVersion: 0n, claimedVersion: event.expectedVersion },
    };
  }
  const obligationId = normalizeBytes32(event.obligationId);
  const termsRoot = normalizeBytes32(event.termsRoot);
  const fingerprint = normalizeBytes32(event.fingerprint);
  const amountCommitment = normalizeBytes32(event.amountCommitment);
  const buyer = normalizeAccount(event.buyer);
  const supplier = normalizeAccount(event.supplier);
  const paymentAgent = normalizeAccount(event.paymentAgent);
  const scheduledExecutor = normalizeAccount(event.scheduledExecutor);
  if (
    obligationId === null ||
    termsRoot === null ||
    fingerprint === null ||
    amountCommitment === null
  ) {
    return invalid("bytes32");
  }
  if (buyer === null || supplier === null || paymentAgent === null || scheduledExecutor === null) {
    return invalid("address");
  }
  if (
    buyer === ZERO_ADDRESS ||
    supplier === ZERO_ADDRESS ||
    paymentAgent === ZERO_ADDRESS ||
    scheduledExecutor === ZERO_ADDRESS
  ) {
    return invalid("address");
  }
  if (event.dueDate <= 0n) {
    return invalid("due-date");
  }
  if (!signedBy(event.signers, "supplier", supplier)) {
    return unauthorized();
  }
  if (hasForeignRole(event.signers, ["supplier"])) {
    return unauthorized();
  }

  return {
    ok: true,
    state: {
      state: "DRAFT",
      version: 1n,
      obligationId,
      termsRoot,
      fingerprint,
      amountCommitment,
      buyer,
      supplier,
      factor: ZERO_ADDRESS,
      paymentAgent,
      scheduledExecutor,
      dueDate: event.dueDate,
      consumedEventIds: [eventId],
    },
  };
}

function acknowledge(state: Envelope, event: AcknowledgeEvent, eventId: string): ApplyResult {
  if (state.state !== "DRAFT") {
    return illegal();
  }
  const termsRoot = normalizeBytes32(event.termsRoot);
  if (termsRoot === null) {
    return invalid("bytes32");
  }
  if (termsRoot !== state.termsRoot) {
    return { ok: false, error: { code: "TermsMismatch" } };
  }
  if (!signedBy(event.signers, "buyer", state.buyer) || hasForeignRole(event.signers, ["buyer"])) {
    return unauthorized();
  }
  return ok(advance(state, eventId, { state: "ACKNOWLEDGED" }));
}

function activate(state: Envelope, event: ActivateEvent, eventId: string): ApplyResult {
  if (state.state !== "ACKNOWLEDGED" || state.factor !== ZERO_ADDRESS) {
    return { ok: false, error: { code: "AlreadyReserved" } };
  }
  const factor = normalizeAccount(event.factor);
  if (factor === null || factor === ZERO_ADDRESS) {
    return invalid("address");
  }
  if (
    !signedBy(event.signers, "supplier", state.supplier) ||
    !signedBy(event.signers, "factor", factor) ||
    hasForeignRole(event.signers, ["supplier", "factor"])
  ) {
    return unauthorized();
  }
  return ok(advance(state, eventId, { state: "RESERVED", factor }));
}

function creditNote(state: Envelope, event: CreditNoteEvent, eventId: string): ApplyResult {
  if (state.state !== "RESERVED") {
    return illegal();
  }
  const termsRoot = normalizeBytes32(event.termsRoot);
  const amountCommitment = normalizeBytes32(event.amountCommitment);
  if (termsRoot === null || amountCommitment === null) {
    return invalid("bytes32");
  }
  if (
    !signedBy(event.signers, "buyer", state.buyer) ||
    !signedBy(event.signers, "supplier", state.supplier) ||
    hasForeignRole(event.signers, ["buyer", "supplier"])
  ) {
    return unauthorized();
  }
  return ok(
    advance(state, eventId, {
      state: "RESERVED",
      termsRoot,
      amountCommitment,
    }),
  );
}

function openDispute(state: Envelope, event: OpenDisputeEvent, eventId: string): ApplyResult {
  if (state.state !== "RESERVED") {
    return illegal();
  }
  if (normalizeBytes32(event.evidenceHash) === null) {
    return invalid("bytes32");
  }
  if (!signedBy(event.signers, "buyer", state.buyer) || hasForeignRole(event.signers, ["buyer"])) {
    return unauthorized();
  }
  return ok(advance(state, eventId, { state: "DISPUTED" }));
}

function cureDispute(state: Envelope, event: CureDisputeEvent, eventId: string): ApplyResult {
  if (state.state !== "DISPUTED") {
    return illegal();
  }
  if (normalizeBytes32(event.evidenceHash) === null) {
    return invalid("bytes32");
  }
  if (!signedBy(event.signers, "buyer", state.buyer) || hasForeignRole(event.signers, ["buyer"])) {
    return unauthorized();
  }
  return ok(advance(state, eventId, { state: "RESERVED" }));
}

function allocatePayment(
  state: Envelope,
  event: AllocatePaymentEvent,
  eventId: string,
): ApplyResult {
  if (state.state !== "RESERVED" && state.state !== "DELINQUENT") {
    return illegal();
  }
  if (typeof event.settles !== "boolean" || normalizeBytes32(event.paymentHash) === null) {
    return invalid("bytes32");
  }
  if (
    !signedBy(event.signers, "paymentAgent", state.paymentAgent) ||
    hasForeignRole(event.signers, ["paymentAgent"])
  ) {
    return unauthorized();
  }
  return ok(
    advance(state, eventId, {
      state: event.settles ? "SETTLED" : state.state,
    }),
  );
}

function markDelinquent(state: Envelope, event: MarkDelinquentEvent, eventId: string): ApplyResult {
  if (state.state !== "RESERVED") {
    return illegal();
  }
  if (event.observedAt <= 0n) {
    return invalid("due-date");
  }
  if (
    !signedBy(event.signers, "scheduledExecutor", state.scheduledExecutor) ||
    hasForeignRole(event.signers, ["scheduledExecutor"])
  ) {
    return unauthorized();
  }
  if (event.observedAt <= state.dueDate) {
    return { ok: false, error: { code: "BeforeDueDate" } };
  }
  return ok(advance(state, eventId, { state: "DELINQUENT" }));
}

function declareDefault(state: Envelope, event: DeclareDefaultEvent, eventId: string): ApplyResult {
  if (state.state !== "DISPUTED" && state.state !== "DELINQUENT") {
    return illegal();
  }
  if (normalizeBytes32(event.evidenceHash) === null) {
    return invalid("bytes32");
  }
  if (
    !signedBy(event.signers, "factor", state.factor) ||
    hasForeignRole(event.signers, ["factor"])
  ) {
    return unauthorized();
  }
  return ok(advance(state, eventId, { state: "DEFAULTED" }));
}

function release(state: Envelope, event: ReleaseEvent, eventId: string): ApplyResult {
  if (state.state !== "SETTLED") {
    return illegal();
  }
  const byFactor =
    signedBy(event.signers, "factor", state.factor) && hasForeignRole(event.signers, ["factor"]) === false;
  const byKernel = event.signers.some((signer) => signer.role === "kernel") && event.signers.length === 1;
  if (!byFactor && !byKernel) {
    return unauthorized();
  }
  return ok(advance(state, eventId, { state: "RELEASED", factor: ZERO_ADDRESS }));
}

function advance(state: Envelope, eventId: string, patch: Partial<Envelope>): Envelope {
  return {
    ...state,
    ...patch,
    version: state.version + 1n,
    consumedEventIds: [...state.consumedEventIds, eventId],
  };
}

function signedBy(
  signers: readonly EventSigner[],
  role: Exclude<EventSigner["role"], "kernel">,
  account: string,
): boolean {
  return signers.some((signer) => signer.role === role && sameAddress(signer.account, account));
}

function hasForeignRole(signers: readonly EventSigner[], allowed: readonly EventSigner["role"][]): boolean {
  return signers.some((signer) => !allowed.includes(signer.role));
}

function sameAddress(left: string, right: string): boolean {
  const a = normalizeAccount(left);
  const b = normalizeAccount(right);
  return a !== null && a === b;
}

function normalizeAccount(value: string): string | null {
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function normalizeBytes32(value: string): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

function ok(state: Envelope): ApplyResult {
  return { ok: true, state };
}

function illegal(): ApplyResult {
  return { ok: false, error: { code: "IllegalTransition" } };
}

function unauthorized(): ApplyResult {
  return { ok: false, error: { code: "Unauthorized" } };
}

function invalid(reason: Extract<ApplyError, { code: "InvalidEvent" }>["reason"]): ApplyResult {
  return { ok: false, error: { code: "InvalidEvent", reason } };
}
