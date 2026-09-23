import { EVENT_TYPE_CODE, type EventType } from "./events.js";
import { STATE_CODE, type ObligationStateName } from "./machine.js";

/** Public actor role codes. Zero is not a role. */
export const ACTOR_ROLE = {
  supplier: 1,
  buyer: 2,
  factor: 3,
  paymentAgent: 4,
  scheduledExecutor: 5,
  kernel: 6,
} as const;

export type ActorRoleName = keyof typeof ACTOR_ROLE;

export const EVIDENCE_HEADER_BYTES = 129;
export const EVIDENCE_HOLDER_OFFSET = 109;
export const EVIDENCE_HOLDER_LENGTH = 20;

const ZERO_HOLDER = "0x" + "00".repeat(EVIDENCE_HOLDER_LENGTH);

export interface EvidenceHeaderInput {
  eventType: EventType;
  obligationId: string;
  version: bigint;
  previousState: ObligationStateName;
  newState: ObligationStateName;
  termsRoot: string;
  evidenceHash: string;
  actorRole: ActorRoleName;
}

export interface EvidenceHeader {
  schemaVersion: number;
  eventType: number;
  obligationId: string;
  version: bigint;
  previousState: number;
  newState: number;
  termsRoot: string;
  evidenceHash: string;
  actorRole: number;
  holder: string;
}

/**
 * Fixed evidence header. The reservation holder is always 20 zero bytes.
 * Invoice numbers, names, bank details, and amounts are not fields of this header.
 */
export function encodeEvidenceHeader(input: EvidenceHeaderInput): Uint8Array {
  const header = new Uint8Array(EVIDENCE_HEADER_BYTES);
  header[0] = 1;
  header[1] = EVENT_TYPE_CODE[input.eventType];
  header.set(readBytes32(input.obligationId), 2);
  writeUint64(header, 34, input.version);
  header[42] = STATE_CODE[input.previousState];
  header[43] = STATE_CODE[input.newState];
  header.set(readBytes32(input.termsRoot), 44);
  header.set(readBytes32(input.evidenceHash), 76);
  header[108] = ACTOR_ROLE[input.actorRole];
  return header;
}

export function decodeEvidenceHeader(bytes: Uint8Array): EvidenceHeader {
  if (bytes.length !== EVIDENCE_HEADER_BYTES) {
    throw new Error(`Evidence header must be ${EVIDENCE_HEADER_BYTES} bytes`);
  }
  return {
    schemaVersion: bytes[0] ?? 0,
    eventType: bytes[1] ?? 0,
    obligationId: hex(bytes.subarray(2, 34)),
    version: readUint64(bytes, 34),
    previousState: bytes[42] ?? 0,
    newState: bytes[43] ?? 0,
    termsRoot: hex(bytes.subarray(44, 76)),
    evidenceHash: hex(bytes.subarray(76, 108)),
    actorRole: bytes[108] ?? 0,
    holder: hex(bytes.subarray(EVIDENCE_HOLDER_OFFSET, EVIDENCE_HEADER_BYTES)),
  };
}

export function holderIsUndisclosed(bytes: Uint8Array): boolean {
  return decodeEvidenceHeader(bytes).holder === ZERO_HOLDER;
}

function readBytes32(value: string): Uint8Array {
  const hexText = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hexText)) {
    throw new Error("expected a 32-byte hex value");
  }
  return Uint8Array.from(Buffer.from(hexText, "hex"));
}

function writeUint64(target: Uint8Array, offset: number, value: bigint): void {
  if (value < 0n || value > 0xffffffffffffffffn) {
    throw new Error("value does not fit in uint64");
  }
  let rest = value;
  for (let index = 7; index >= 0; index -= 1) {
    target[offset + index] = Number(rest & 0xffn);
    rest >>= 8n;
  }
}

function readUint64(source: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let index = 0; index < 8; index += 1) {
    value = (value << 8n) + BigInt(source[offset + index] ?? 0);
  }
  return value;
}

function hex(bytes: Uint8Array): string {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}
