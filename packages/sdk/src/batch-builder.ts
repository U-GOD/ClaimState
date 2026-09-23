import {
  AccountId,
  BatchTransaction,
  ContractExecuteTransaction,
  Hbar,
  TopicMessageSubmitTransaction,
  TransferTransaction,
} from "@hiero-ledger/sdk";
import type { Client, PrivateKey, Transaction } from "@hiero-ledger/sdk";
import { ACTOR_ROLE, encodeEvidenceHeader } from "./evidence.js";

/** HIP-551 outer transaction cap. The activation batch must stay under it. */
export const MAX_OUTER_BATCH_BYTES = 6_000;

/** Demo tUSDC uses 2 decimals. 1,572,500 units display as 15,725.00. */
export const TUSDC_DECIMALS = 2;
export const ADVANCE_TOKEN_UNITS = 1_572_500n;

/**
 * Treasury inventory for more than one activation attempt.
 * A rolled-back transfer has to be a transfer that could otherwise succeed.
 */
export const TREASURY_SUPPLY_UNITS = ADVANCE_TOKEN_UNITS * 4n;

const INNER_FEE_CEILING = new Hbar(5);
const ACTIVATE_GAS = 500_000;

export class BatchTooLargeError extends Error {
  readonly outerBytes: number;
  readonly limit: number;

  constructor(outerBytes: number, limit: number) {
    super(`Activation batch is ${outerBytes} bytes, above the ${limit} byte outer limit`);
    this.name = "BatchTooLargeError";
    this.outerBytes = outerBytes;
    this.limit = limit;
  }
}

export interface ActivationBatchInput {
  client: Client;
  batchKey: PrivateKey;
  contractId: string;
  topicId: string;
  tokenId: string;
  factorAccountId: string;
  supplierAccountId: string;
  functionParameters: Uint8Array;
  obligationId: string;
  termsRoot: string;
  evidenceHash: string;
  expectedVersion: bigint;
  submitKey?: PrivateKey;
  maxOuterBytes?: number;
}

export interface ActivationBatch {
  batch: BatchTransaction;
  innerTransactionIds: [string, string, string];
  evidence: Uint8Array;
  outerBytes: number;
}

/**
 * One HIP-551 batch: activate, then the evidence header, then the tUSDC advance.
 * The public header's holder field is zero. The contract stores the holder.
 * If the outer transaction would exceed the cap, this throws and returns nothing.
 */
export async function buildActivationBatch(input: ActivationBatchInput): Promise<ActivationBatch> {
  if (input.client.operatorAccountId === null) {
    throw new Error("The factor client must have an operator");
  }
  requireHederaId(input.contractId, "contractId");
  requireHederaId(input.topicId, "topicId");
  requireHederaId(input.tokenId, "tokenId");
  requireHederaId(input.factorAccountId, "factorAccountId");
  requireHederaId(input.supplierAccountId, "supplierAccountId");
  if (input.functionParameters.length < 4) {
    throw new Error("activate calldata is missing");
  }
  if (input.expectedVersion < 0n) {
    throw new Error("expectedVersion must be non-negative");
  }

  const limit = input.maxOuterBytes ?? MAX_OUTER_BATCH_BYTES;
  const evidence = encodeEvidenceHeader({
    eventType: "Activate",
    obligationId: input.obligationId,
    version: input.expectedVersion + 1n,
    previousState: "ACKNOWLEDGED",
    newState: "RESERVED",
    termsRoot: input.termsRoot,
    evidenceHash: input.evidenceHash,
    actorRole: "factor",
  });
  if (evidence[108] !== ACTOR_ROLE.factor) {
    throw new Error("activation evidence must name the factor role");
  }

  const batchPublicKey = input.batchKey.publicKey;
  const activate = new ContractExecuteTransaction()
    .setContractId(input.contractId)
    .setGas(ACTIVATE_GAS)
    .setFunctionParameters(input.functionParameters)
    .setMaxTransactionFee(INNER_FEE_CEILING);
  const topic = new TopicMessageSubmitTransaction()
    .setTopicId(input.topicId)
    .setMessage(evidence)
    .setMaxTransactionFee(INNER_FEE_CEILING);
  const advance = new TransferTransaction()
    .addTokenTransferWithDecimals(input.tokenId, input.factorAccountId, -ADVANCE_TOKEN_UNITS, TUSDC_DECIMALS)
    .addTokenTransferWithDecimals(input.tokenId, input.supplierAccountId, ADVANCE_TOKEN_UNITS, TUSDC_DECIMALS)
    .setMaxTransactionFee(INNER_FEE_CEILING);

  await activate.batchify(input.client, batchPublicKey);
  await topic.batchify(input.client, batchPublicKey);
  if (input.submitKey !== undefined) {
    await topic.sign(input.submitKey);
  }
  await advance.batchify(input.client, batchPublicKey);

  const inners: [Transaction, Transaction, Transaction] = [activate, topic, advance];
  const batch = new BatchTransaction().setMaxTransactionFee(INNER_FEE_CEILING);
  for (const inner of inners) {
    batch.addInnerTransaction(inner);
  }
  batch.freezeWith(input.client);
  await batch.sign(input.batchKey);
  await batch.signWithOperator(input.client);

  const outerBytes = await batch.size;
  if (outerBytes > limit) {
    throw new BatchTooLargeError(outerBytes, limit);
  }

  const ids = inners.map((inner) => {
    const id = inner.transactionId;
    if (id === null) {
      throw new Error("An inner transaction is missing its transaction id");
    }
    return id.toString();
  });
  if (new Set(ids).size !== 3) {
    throw new Error("Inner transaction ids must be distinct");
  }
  const factorPayer = AccountId.fromString(input.factorAccountId).toString();
  for (const id of ids) {
    if (!id.startsWith(`${factorPayer}@`)) {
      throw new Error("The factor account must pay every inner transaction");
    }
  }

  return {
    batch,
    innerTransactionIds: [ids[0] ?? "", ids[1] ?? "", ids[2] ?? ""],
    evidence,
    outerBytes,
  };
}

function requireHederaId(value: string, name: string): void {
  if (!/^0\.0\.\d+$/.test(value)) {
    throw new Error(`${name} must be a Hedera id of the form 0.0.n`);
  }
}
