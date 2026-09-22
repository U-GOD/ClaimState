import { AbiCoder, keccak256 } from "ethers";
import { eventTypeCode, payloadEncoding, type ClaimEvent, type EventType } from "./events.js";

export const DOMAIN_TAG = "ClaimState/v1";
export const SCHEMA_VERSION = 1n;

export type NetworkLabel = "testnet" | "mainnet";

const coder = AbiCoder.defaultAbiCoder();

export interface DomainInput {
  chainId: bigint;
  registry: string;
  topicId: string;
  networkLabel: NetworkLabel;
}

/**
 * Solidity: keccak256(abi.encode(string,uint256,address,string,uint256,string)).
 * chainId 296 is testnet and 295 is mainnet. Both fields are hashed so either change is material.
 */
export function domainSeparator(input: DomainInput): string {
  if (input.chainId !== 296n && input.chainId !== 295n) {
    throw new Error("chainId must be 296 (testnet) or 295 (mainnet)");
  }
  if (input.networkLabel !== "testnet" && input.networkLabel !== "mainnet") {
    throw new Error("networkLabel must be testnet or mainnet");
  }
  if (!/^0\.0\.\d+$/.test(input.topicId)) {
    throw new Error("topicId must be a Hedera id of the form 0.0.n");
  }
  return keccakAbi(
    ["string", "uint256", "address", "string", "uint256", "string"],
    [DOMAIN_TAG, input.chainId, input.registry, input.topicId, SCHEMA_VERSION, input.networkLabel],
  );
}

/**
 * obligationId is not derived from an invoice number.
 * Solidity: keccak256(abi.encode(bytes32,bytes32,address,address)).
 */
export function obligationId(input: {
  domain: string;
  blindedFingerprint: string;
  buyer: string;
  supplier: string;
}): string {
  return keccakAbi(
    ["bytes32", "bytes32", "address", "address"],
    [input.domain, input.blindedFingerprint, input.buyer, input.supplier],
  );
}

/**
 * Solidity: keccak256(abi.encode(bytes32,uint8,bytes32,uint64,bytes32)).
 */
export function actionDigest(input: {
  domain: string;
  eventType: EventType;
  obligationId: string;
  expectedVersion: bigint;
  payloadHash: string;
}): string {
  return keccakAbi(
    ["bytes32", "uint8", "bytes32", "uint64", "bytes32"],
    [
      input.domain,
      eventTypeCode(input.eventType),
      input.obligationId,
      input.expectedVersion,
      input.payloadHash,
    ],
  );
}

/**
 * Salt stays off the ledger. The face amount is not recoverable from this hash alone.
 * Solidity: keccak256(abi.encode(bytes32,bytes32,uint64,uint256,bytes32)).
 */
export function amountCommitment(input: {
  domain: string;
  obligationId: string;
  version: bigint;
  amountCents: bigint;
  salt: string;
}): string {
  if (input.amountCents <= 0n) {
    throw new Error("amountCents must be positive");
  }
  return keccakAbi(
    ["bytes32", "bytes32", "uint64", "uint256", "bytes32"],
    [input.domain, input.obligationId, input.version, input.amountCents, input.salt],
  );
}

export function payloadHash(event: ClaimEvent): string {
  const encoded = payloadEncoding(event);
  return keccakAbi(encoded.types, encoded.values);
}

export function keccakAbi(types: readonly string[], values: readonly unknown[]): string {
  return keccak256(coder.encode([...types], [...values]));
}
