export const EVENT_TYPES = [
  "Create",
  "Acknowledge",
  "Activate",
  "CreditNote",
  "OpenDispute",
  "CureDispute",
  "AllocatePayment",
  "MarkDelinquent",
  "DeclareDefault",
  "Release",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** Stable codes for abi.encode. Zero is not a valid event. */
export const EVENT_TYPE_CODE: Record<EventType, number> = {
  Create: 1,
  Acknowledge: 2,
  Activate: 3,
  CreditNote: 4,
  OpenDispute: 5,
  CureDispute: 6,
  AllocatePayment: 7,
  MarkDelinquent: 8,
  DeclareDefault: 9,
  Release: 10,
};

export type AccountRole =
  | "supplier"
  | "buyer"
  | "factor"
  | "paymentAgent"
  | "scheduledExecutor";

export type EventSigner = { role: AccountRole; account: string } | { role: "kernel" };

interface EventBase {
  eventId: string;
  expectedVersion: bigint;
  signers: readonly EventSigner[];
}

export interface CreateEvent extends EventBase {
  eventType: "Create";
  obligationId: string;
  termsRoot: string;
  fingerprint: string;
  amountCommitment: string;
  buyer: string;
  supplier: string;
  paymentAgent: string;
  scheduledExecutor: string;
  dueDate: bigint;
}

export interface AcknowledgeEvent extends EventBase {
  eventType: "Acknowledge";
  termsRoot: string;
}

export interface ActivateEvent extends EventBase {
  eventType: "Activate";
  factor: string;
}

export interface CreditNoteEvent extends EventBase {
  eventType: "CreditNote";
  termsRoot: string;
  amountCommitment: string;
}

export interface OpenDisputeEvent extends EventBase {
  eventType: "OpenDispute";
  evidenceHash: string;
}

export interface CureDisputeEvent extends EventBase {
  eventType: "CureDispute";
  evidenceHash: string;
}

export interface AllocatePaymentEvent extends EventBase {
  eventType: "AllocatePayment";
  settles: boolean;
  paymentHash: string;
}

export interface MarkDelinquentEvent extends EventBase {
  eventType: "MarkDelinquent";
  observedAt: bigint;
}

export interface DeclareDefaultEvent extends EventBase {
  eventType: "DeclareDefault";
  evidenceHash: string;
}

export interface ReleaseEvent extends EventBase {
  eventType: "Release";
}

export type ClaimEvent =
  | CreateEvent
  | AcknowledgeEvent
  | ActivateEvent
  | CreditNoteEvent
  | OpenDisputeEvent
  | CureDisputeEvent
  | AllocatePaymentEvent
  | MarkDelinquentEvent
  | DeclareDefaultEvent
  | ReleaseEvent;

export function eventTypeCode(eventType: EventType): number {
  return EVENT_TYPE_CODE[eventType];
}

/**
 * Business payload bound into actionDigest.
 * Signers are excluded so the signature is not part of the preimage.
 * eventId is included so a signature cannot be replayed under a new id.
 */
export function payloadEncoding(event: ClaimEvent): { types: string[]; values: readonly unknown[] } {
  switch (event.eventType) {
    case "Create":
      return {
        types: [
          "bytes32",
          "bytes32",
          "bytes32",
          "bytes32",
          "address",
          "address",
          "address",
          "address",
          "uint64",
          "bytes32",
        ],
        values: [
          event.obligationId,
          event.termsRoot,
          event.fingerprint,
          event.amountCommitment,
          event.buyer,
          event.supplier,
          event.paymentAgent,
          event.scheduledExecutor,
          event.dueDate,
          event.eventId,
        ],
      };
    case "Acknowledge":
      return {
        types: ["bytes32", "bytes32"],
        values: [event.termsRoot, event.eventId],
      };
    case "Activate":
      return {
        types: ["address", "bytes32"],
        values: [event.factor, event.eventId],
      };
    case "CreditNote":
      return {
        types: ["bytes32", "bytes32", "bytes32"],
        values: [event.termsRoot, event.amountCommitment, event.eventId],
      };
    case "OpenDispute":
    case "CureDispute":
    case "DeclareDefault":
      return {
        types: ["bytes32", "bytes32"],
        values: [event.evidenceHash, event.eventId],
      };
    case "AllocatePayment":
      return {
        types: ["bool", "bytes32", "bytes32"],
        values: [event.settles, event.paymentHash, event.eventId],
      };
    case "MarkDelinquent":
      return {
        types: ["uint64", "bytes32"],
        values: [event.observedAt, event.eventId],
      };
    case "Release":
      return {
        types: ["bytes32"],
        values: [event.eventId],
      };
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}
