import {
  AccountBalanceQuery,
  ContractCallQuery,
  ContractExecuteTransaction,
  Hbar,
  PrivateKey,
  ReceiptStatusError,
  StatusError,
  TopicInfoQuery,
  TransactionRecordQuery,
} from "@hiero-ledger/sdk";
import type { Client, TransactionResponse } from "@hiero-ledger/sdk";
import { getBytes, Interface, keccak256, Wallet, type BytesLike } from "ethers";
import {
  ADVANCE_TOKEN_UNITS,
  actionDigest,
  amountCommitment,
  buildActivationBatch,
  commercialFieldBytes,
  domainSeparator,
  hmacFingerprintProvider,
  holderIsUndisclosed,
  obligationId as obligationIdOf,
  payloadHash,
  STATE_CODE,
  type ActivationBatch,
  type ClaimEvent,
} from "@claimstate/sdk";
import { requireOperatorEnv, type DemoAccounts, type DeploymentManifest } from "./session.js";

const FACE_AMOUNT_CENTS = 1_850_000n;
const DUE_DATE = "2026-12-31";
const DUE_UNIX = BigInt(Date.parse(`${DUE_DATE}T00:00:00Z`) / 1000);

const kernel = new Interface([
  "function create(bytes32 obligationId, bytes32 termsRoot, bytes32 fingerprint, bytes32 amountCommitment, address buyer, address supplier, address paymentAgent, address scheduledExecutor, uint64 dueDate, bytes32 eventId, uint64 expectedVersion, bytes supplierSignature)",
  "function acknowledge(bytes32 obligationId, bytes32 termsRoot, bytes32 eventId, uint64 expectedVersion, bytes buyerSignature)",
  "function activate(bytes32 obligationId, address factor, bytes32 eventId, uint64 expectedVersion, bytes supplierSignature, bytes factorSignature)",
  "function envelopes(bytes32 obligationId) view returns (bytes32 termsRoot, bytes32 fingerprint, bytes32 amountCommitment, address buyer, address supplier, address factor, address paymentAgent, uint64 version, uint64 dueDate, uint8 state)",
]);

export interface EnvelopeView {
  state: bigint;
  version: bigint;
  factor: string;
  termsRoot: string;
  amountCommitment: string;
}

export interface OpenedObligation {
  obligationId: string;
  termsRoot: string;
  evidenceHash: string;
  expectedVersion: bigint;
  activateCalldata: Uint8Array;
  activateEventId: string;
}

export async function openAcknowledged(
  client: Client,
  manifest: DeploymentManifest,
  accounts: DemoAccounts,
  reference: string,
): Promise<OpenedObligation> {
  const supplier = new Wallet(hexKey(accounts.supplier.privateKey));
  const buyer = new Wallet(hexKey(accounts.buyer.privateKey));
  const factor = new Wallet(hexKey(accounts.factor.privateKey));
  const domain = domainSeparator({
    chainId: 296n,
    registry: manifest.contractEvmAddress,
    topicId: manifest.topicId,
    networkLabel: "testnet",
  });
  const fields = commercialFieldBytes({
    schemaVersion: 1,
    currency: "USD",
    amountCents: FACE_AMOUNT_CENTS,
    dueDate: DUE_DATE,
    debtorReference: reference,
    carrierReference: reference,
  });
  const fingerprint = bytes32(hmacFingerprintProvider(keyBytes(accounts.fingerprintKey)).fingerprint(fields));
  const termsRoot = keccak256(fields);
  const id = obligationIdOf({
    domain,
    blindedFingerprint: fingerprint,
    buyer: buyer.address,
    supplier: supplier.address,
  });
  const commitment = amountCommitment({
    domain,
    obligationId: id,
    version: 1n,
    amountCents: FACE_AMOUNT_CENTS,
    salt: bytes32(keyBytes(accounts.amountSalt)),
  });
  const createId = randomId();
  const acknowledgeId = randomId();
  const activateId = randomId();
  const paymentAgent = manifest.kernel;

  const created: ClaimEvent = {
    eventType: "Create",
    eventId: createId,
    expectedVersion: 0n,
    signers: [{ role: "supplier", account: supplier.address }],
    obligationId: id,
    termsRoot,
    fingerprint,
    amountCommitment: commitment,
    buyer: buyer.address,
    supplier: supplier.address,
    paymentAgent,
    scheduledExecutor: paymentAgent,
    dueDate: DUE_UNIX,
  };
  await execute(
    client,
    manifest.contractId,
    getBytes(
      kernel.encodeFunctionData("create", [
        id,
        termsRoot,
        fingerprint,
        commitment,
        buyer.address,
        supplier.address,
        paymentAgent,
        paymentAgent,
        DUE_UNIX,
        createId,
        0n,
        sign(supplier, domain, created, id),
      ]),
    ),
  );

  const acknowledged: ClaimEvent = {
    eventType: "Acknowledge",
    eventId: acknowledgeId,
    expectedVersion: 1n,
    signers: [{ role: "buyer", account: buyer.address }],
    termsRoot,
  };
  await execute(
    client,
    manifest.contractId,
    getBytes(
      kernel.encodeFunctionData("acknowledge", [
        id,
        termsRoot,
        acknowledgeId,
        1n,
        sign(buyer, domain, acknowledged, id),
      ]),
    ),
  );

  const activated: ClaimEvent = {
    eventType: "Activate",
    eventId: activateId,
    expectedVersion: 2n,
    signers: [
      { role: "supplier", account: supplier.address },
      { role: "factor", account: factor.address },
    ],
    factor: factor.address,
  };
  return {
    obligationId: id,
    termsRoot,
    evidenceHash: payloadHash(activated),
    expectedVersion: 2n,
    activateEventId: activateId,
    activateCalldata: getBytes(
      kernel.encodeFunctionData("activate", [
        id,
        factor.address,
        activateId,
        2n,
        sign(supplier, domain, activated, id),
        sign(factor, domain, activated, id),
      ]),
    ),
  };
}

export function activateCalldata(input: {
  obligationId: string;
  factor: Wallet;
  supplier: Wallet;
  domain: string;
  eventId: string;
  expectedVersion: bigint;
}): Uint8Array {
  const event: ClaimEvent = {
    eventType: "Activate",
    eventId: input.eventId,
    expectedVersion: input.expectedVersion,
    signers: [
      { role: "supplier", account: input.supplier.address },
      { role: "factor", account: input.factor.address },
    ],
    factor: input.factor.address,
  };
  return getBytes(
    kernel.encodeFunctionData("activate", [
      input.obligationId,
      input.factor.address,
      input.eventId,
      input.expectedVersion,
      sign(input.supplier, input.domain, event, input.obligationId),
      sign(input.factor, input.domain, event, input.obligationId),
    ]),
  );
}

export async function activationBatch(input: {
  factor: Client;
  manifest: DeploymentManifest;
  obligation: OpenedObligation;
  functionParameters?: Uint8Array;
  supplierAccountId?: string;
  maxOuterBytes?: number;
}): Promise<ActivationBatch> {
  const { privateKey } = requireOperatorEnv();
  return buildActivationBatch({
    client: input.factor,
    batchKey: PrivateKey.generateECDSA(),
    contractId: input.manifest.contractId,
    topicId: input.manifest.topicId,
    tokenId: input.manifest.tokenId,
    factorAccountId: input.manifest.factorAccountId,
    supplierAccountId: input.supplierAccountId ?? input.manifest.supplierAccountId,
    functionParameters: input.functionParameters ?? input.obligation.activateCalldata,
    obligationId: input.obligation.obligationId,
    termsRoot: input.obligation.termsRoot,
    evidenceHash: input.obligation.evidenceHash,
    expectedVersion: input.obligation.expectedVersion,
    submitKey: privateKey,
    maxOuterBytes: input.maxOuterBytes,
  });
}

export async function readEnvelope(
  client: Client,
  contractId: string,
  obligationId: string,
): Promise<EnvelopeView> {
  const result = await new ContractCallQuery()
    .setContractId(contractId)
    .setGas(200_000)
    .setFunctionParameters(getBytes(kernel.encodeFunctionData("envelopes", [obligationId])))
    .execute(client);
  const decoded = kernel.decodeFunctionResult("envelopes", result.asBytes());
  return {
    termsRoot: String(decoded[0]),
    amountCommitment: String(decoded[2]),
    factor: String(decoded[5]),
    version: BigInt(decoded[7]),
    state: BigInt(decoded[9]),
  };
}

export async function tokenUnits(client: Client, accountId: string, tokenId: string): Promise<bigint> {
  const balance = await new AccountBalanceQuery().setAccountId(accountId).execute(client);
  const row = balance.toJSON().tokens.find((entry) => entry.tokenId === tokenId);
  return row === undefined ? 0n : BigInt(row.balance);
}

export async function topicSequence(client: Client, topicId: string): Promise<string> {
  const info = await new TopicInfoQuery().setTopicId(topicId).execute(client);
  return info.sequenceNumber.toString();
}

export interface BatchOutcome {
  success: boolean;
  status: string;
  transactionId: string;
  feeTinybars: string;
  topicSequenceNumber: string | null;
}

export async function submitBatch(batch: ActivationBatch, client: Client): Promise<BatchOutcome> {
  let response: TransactionResponse;
  try {
    response = await batch.batch.execute(client);
  } catch (error) {
    if (!(error instanceof StatusError)) {
      throw error;
    }
    return {
      success: false,
      status: error.status.toString(),
      transactionId: error.transactionId.toString(),
      feeTinybars: "unavailable",
      topicSequenceNumber: null,
    };
  }
  const transactionId = response.transactionId.toString();
  try {
    const receipt = await response.getReceipt(client);
    const status = receipt.status.toString();
    const record = await response.getRecord(client);
    return {
      success: status === "SUCCESS",
      status,
      transactionId,
      feeTinybars: record.transactionFee.toTinybars().toString(),
      topicSequenceNumber: await innerTopicSequence(client, batch.innerTransactionIds[1]),
    };
  } catch (error) {
    if (!(error instanceof ReceiptStatusError)) {
      throw error;
    }
    return {
      success: false,
      status: error.status.toString(),
      transactionId,
      feeTinybars: await feeOf(client, response),
      topicSequenceNumber: null,
    };
  }
}

export function assertReserved(envelope: EnvelopeView, factor: string): void {
  if (envelope.state !== BigInt(STATE_CODE.RESERVED) || envelope.version !== 3n) {
    throw new Error("Activation did not reach RESERVED at version 3");
  }
  if (envelope.factor.toLowerCase() !== factor.toLowerCase()) {
    throw new Error("The stored factor does not match the activating key");
  }
}

export function assertUndisclosed(evidence: Uint8Array): void {
  if (!holderIsUndisclosed(evidence)) {
    throw new Error("The HCS header disclosed the reservation holder");
  }
}

export { ADVANCE_TOKEN_UNITS };

async function execute(client: Client, contractId: string, parameters: Uint8Array): Promise<void> {
  const response = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1_000_000)
    .setFunctionParameters(parameters)
    .setMaxTransactionFee(new Hbar(5))
    .execute(client);
  const receipt = await response.getReceipt(client);
  if (receipt.status.toString() !== "SUCCESS") {
    throw new Error(`Contract call status ${receipt.status.toString()}`);
  }
}

async function innerTopicSequence(client: Client, transactionId: string): Promise<string | null> {
  const receipt = await new TransactionRecordQuery().setTransactionId(transactionId).execute(client);
  const sequence = receipt.receipt.topicSequenceNumber;
  return sequence === null ? null : sequence.toString();
}

async function feeOf(client: Client, response: TransactionResponse): Promise<string> {
  try {
    const record = await response.getVerboseRecord(client);
    return record.transactionFee.toTinybars().toString();
  } catch {
    return "unavailable";
  }
}

function sign(wallet: Wallet, domain: string, event: ClaimEvent, id: string): string {
  const digest = actionDigest({
    domain,
    eventType: event.eventType,
    obligationId: id,
    expectedVersion: event.expectedVersion,
    payloadHash: payloadHash(event),
  });
  return wallet.signingKey.sign(getBytes(digest)).serialized;
}

function hexKey(value: string): string {
  return value.startsWith("0x") ? value : `0x${value}`;
}

function keyBytes(hex: string): Uint8Array {
  return getBytes(hexKey(hex));
}

function bytes32(bytes: BytesLike): string {
  const hex = typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("hex");
  return `0x${hex.replace(/^0x/, "").padStart(64, "0")}`;
}

function randomId(): string {
  return `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
}
