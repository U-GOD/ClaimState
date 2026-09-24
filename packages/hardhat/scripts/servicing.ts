import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ContractExecuteTransaction,
  Hbar,
  ReceiptStatusError,
} from "@hiero-ledger/sdk";
import type { Client } from "@hiero-ledger/sdk";
import { getBytes, Interface, Wallet } from "ethers";
import {
  buildDelinquencySchedule,
  dilutedAmountCommitment,
  dilutedTermsRoot,
  encodeEvidenceHeader,
  parseFreightPlan,
  payloadHash,
  STATE_CODE,
  type ClaimEvent,
  type FreightPlan,
} from "@claimstate/sdk";
import { rawEcdsaKey } from "../operator-key.js";
import { repoRoot, type DemoAccounts, type DeploymentManifest } from "./session.js";
import {
  publishHeader,
  readEnvelope,
  sign,
  type EvidenceStep,
  type OpenedObligation,
} from "./obligation.js";

const servicing = new Interface([
  "function creditNote(bytes32 obligationId, bytes32 termsRoot, bytes32 amountCommitment, bytes32 eventId, uint64 expectedVersion, bytes buyerSignature, bytes supplierSignature)",
  "function allocatePayment(bytes32 obligationId, bool settles, bytes32 paymentHash, bytes32 eventId, uint64 expectedVersion, bytes paymentAgentSignature)",
  "function release(bytes32 obligationId, bytes32 eventId, uint64 expectedVersion, bytes factorSignature)",
  "function openDispute(bytes32 obligationId, bytes32 evidenceHash, bytes32 eventId, uint64 expectedVersion, bytes buyerSignature)",
  "function cureDispute(bytes32 obligationId, bytes32 evidenceHash, bytes32 eventId, uint64 expectedVersion, bytes buyerSignature)",
  "function markDelinquent(bytes32 obligationId, uint64 observedAt, bytes32 eventId, uint64 expectedVersion, bytes executorSignature)",
]);

export const freightFixturePath = path.join(
  repoRoot,
  "adapters",
  "mock-payment-agent",
  "fixtures",
  "freight-18500.json",
);

export async function readFreightFixture(): Promise<FreightPlan> {
  return parseFreightPlan(JSON.parse(await readFile(freightFixturePath, "utf8")));
}

export function operatorWallet(): Wallet {
  const encoded = process.env.HEDERA_OPERATOR_ECDSA_KEY?.trim() ?? "";
  if (encoded.length === 0) {
    throw new Error("This testnet step needs HEDERA_OPERATOR_ID and HEDERA_OPERATOR_ECDSA_KEY. Neither is set.");
  }
  return new Wallet(rawEcdsaKey(encoded));
}

export async function creditNoteStep(input: {
  client: Client;
  manifest: DeploymentManifest;
  accounts: DemoAccounts;
  opened: OpenedObligation;
  plan: FreightPlan;
  version: bigint;
  topicId: string;
}): Promise<{ step: EvidenceStep; termsRoot: string; version: bigint }> {
  const buyer = new Wallet(hexKey(input.accounts.buyer.privateKey));
  const supplier = new Wallet(hexKey(input.accounts.supplier.privateKey));
  const termsRoot = dilutedTermsRoot(input.plan);
  const amountCommitment = dilutedAmountCommitment({
    plan: input.plan,
    domain: input.opened.domain,
    obligationId: input.opened.obligationId,
    version: input.version + 1n,
    salt: bytes32(hexKey(input.accounts.amountSalt)),
  });
  const eventId = randomId();
  const event: ClaimEvent = {
    eventType: "CreditNote",
    eventId,
    expectedVersion: input.version,
    signers: [
      { role: "buyer", account: buyer.address },
      { role: "supplier", account: supplier.address },
    ],
    termsRoot,
    amountCommitment,
  };
  await submitCall(
    input.client,
    input.manifest.contractId,
    getBytes(
      servicing.encodeFunctionData("creditNote", [
        input.opened.obligationId,
        termsRoot,
        amountCommitment,
        eventId,
        input.version,
        sign(buyer, input.opened.domain, event, input.opened.obligationId),
        sign(supplier, input.opened.domain, event, input.opened.obligationId),
      ]),
    ),
  );
  const step = await publishHeader(
    input.client,
    input.topicId,
    encodeEvidenceHeader({
      eventType: "CreditNote",
      obligationId: input.opened.obligationId,
      version: input.version + 1n,
      previousState: "RESERVED",
      newState: "RESERVED",
      termsRoot,
      evidenceHash: payloadHash(event),
      actorRole: "buyer",
    }),
    "creditNote",
  );
  return { step, termsRoot, version: input.version + 1n };
}

export async function paymentStep(input: {
  client: Client;
  manifest: DeploymentManifest;
  opened: OpenedObligation;
  settles: boolean;
  paymentHash: string;
  version: bigint;
  termsRoot: string;
  topicId: string;
}): Promise<{ step: EvidenceStep; version: bigint }> {
  const agent = operatorWallet();
  if (agent.address.toLowerCase() !== input.manifest.kernel.toLowerCase()) {
    throw new Error("The operator key is not the payment agent on this envelope");
  }
  const eventId = randomId();
  const event: ClaimEvent = {
    eventType: "AllocatePayment",
    eventId,
    expectedVersion: input.version,
    signers: [{ role: "paymentAgent", account: agent.address }],
    settles: input.settles,
    paymentHash: input.paymentHash,
  };
  await submitCall(
    input.client,
    input.manifest.contractId,
    getBytes(
      servicing.encodeFunctionData("allocatePayment", [
        input.opened.obligationId,
        input.settles,
        input.paymentHash,
        eventId,
        input.version,
        sign(agent, input.opened.domain, event, input.opened.obligationId),
      ]),
    ),
  );
  const step = await publishHeader(
    input.client,
    input.topicId,
    encodeEvidenceHeader({
      eventType: "AllocatePayment",
      obligationId: input.opened.obligationId,
      version: input.version + 1n,
      previousState: "RESERVED",
      newState: input.settles ? "SETTLED" : "RESERVED",
      termsRoot: input.termsRoot,
      evidenceHash: payloadHash(event),
      actorRole: "paymentAgent",
    }),
    "payment",
  );
  return { step, version: input.version + 1n };
}

export async function releaseStep(input: {
  client: Client;
  manifest: DeploymentManifest;
  accounts: DemoAccounts;
  opened: OpenedObligation;
  version: bigint;
  termsRoot: string;
  topicId: string;
}): Promise<{ step: EvidenceStep; version: bigint }> {
  const factor = new Wallet(hexKey(input.accounts.factor.privateKey));
  const eventId = randomId();
  const event: ClaimEvent = {
    eventType: "Release",
    eventId,
    expectedVersion: input.version,
    signers: [{ role: "factor", account: factor.address }],
  };
  await submitCall(
    input.client,
    input.manifest.contractId,
    getBytes(
      servicing.encodeFunctionData("release", [
        input.opened.obligationId,
        eventId,
        input.version,
        sign(factor, input.opened.domain, event, input.opened.obligationId),
      ]),
    ),
  );
  const step = await publishHeader(
    input.client,
    input.topicId,
    encodeEvidenceHeader({
      eventType: "Release",
      obligationId: input.opened.obligationId,
      version: input.version + 1n,
      previousState: "SETTLED",
      newState: "RELEASED",
      termsRoot: input.termsRoot,
      evidenceHash: payloadHash(event),
      actorRole: "factor",
    }),
    "release",
  );
  return { step, version: input.version + 1n };
}

export async function openDisputeStep(input: {
  client: Client;
  manifest: DeploymentManifest;
  accounts: DemoAccounts;
  opened: OpenedObligation;
  version: bigint;
  termsRoot: string;
  topicId: string;
}): Promise<EvidenceStep> {
  const buyer = new Wallet(hexKey(input.accounts.buyer.privateKey));
  return disputeCall(input, buyer, "OpenDispute", "openDispute", input.version);
}

export async function cureDisputeStep(input: {
  client: Client;
  manifest: DeploymentManifest;
  accounts: DemoAccounts;
  opened: OpenedObligation;
  version: bigint;
  termsRoot: string;
  topicId: string;
}): Promise<EvidenceStep> {
  const buyer = new Wallet(hexKey(input.accounts.buyer.privateKey));
  return disputeCall(input, buyer, "CureDispute", "cureDispute", input.version);
}

export async function armDelinquency(input: {
  client: Client;
  manifest: DeploymentManifest;
  opened: OpenedObligation;
  version: bigint;
  dueUnix: bigint;
}): Promise<{ scheduleId: string; calldata: Uint8Array }> {
  const executor = operatorWallet();
  if (executor.address.toLowerCase() !== input.manifest.kernel.toLowerCase()) {
    throw new Error("The operator key is not the scheduled executor on this envelope");
  }
  const eventId = randomId();
  const observedAt = input.dueUnix + 1n;
  const event: ClaimEvent = {
    eventType: "MarkDelinquent",
    eventId,
    expectedVersion: input.version,
    signers: [{ role: "scheduledExecutor", account: executor.address }],
    observedAt,
  };
  const calldata = getBytes(
    servicing.encodeFunctionData("markDelinquent", [
      input.opened.obligationId,
      observedAt,
      eventId,
      input.version,
      sign(executor, input.opened.domain, event, input.opened.obligationId),
    ]),
  );
  const call = new ContractExecuteTransaction()
    .setContractId(input.manifest.contractId)
    .setGas(500_000)
    .setFunctionParameters(calldata)
    .setMaxTransactionFee(new Hbar(5));
  const nowUnix = BigInt(Math.floor(Date.now() / 1000));
  const schedule = buildDelinquencySchedule({
    contractCall: call,
    dueDateUnix: input.dueUnix,
    nowUnix,
  });
  const response = await schedule.execute(input.client);
  const receipt = await response.getReceipt(input.client);
  const scheduleId = receipt.scheduleId?.toString();
  if (scheduleId === undefined) {
    throw new Error("Schedule create did not return a schedule id");
  }
  return { scheduleId, calldata };
}

export async function expectRevert(client: Client, contractId: string, parameters: Uint8Array): Promise<string> {
  try {
    await submitCall(client, contractId, parameters);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Contract call status ")) {
      return error.message.slice("Contract call status ".length);
    }
    throw error;
  }
  throw new Error("The contract call was accepted");
}

export async function assertReleased(client: Client, contractId: string, obligationId: string): Promise<bigint> {
  const envelope = await readEnvelope(client, contractId, obligationId);
  if (envelope.state !== BigInt(STATE_CODE.RELEASED)) {
    throw new Error("The envelope did not reach RELEASED");
  }
  if (envelope.factor.toLowerCase() !== "0x0000000000000000000000000000000000000000") {
    throw new Error("Release did not clear the reservation holder");
  }
  return envelope.version;
}

async function disputeCall(
  input: {
    client: Client;
    manifest: DeploymentManifest;
    opened: OpenedObligation;
    termsRoot: string;
    topicId: string;
  },
  buyer: Wallet,
  eventType: "OpenDispute" | "CureDispute",
  name: "openDispute" | "cureDispute",
  version: bigint,
): Promise<EvidenceStep> {
  const eventId = randomId();
  const evidenceHash = randomId();
  const event: ClaimEvent = {
    eventType,
    eventId,
    expectedVersion: version,
    signers: [{ role: "buyer", account: buyer.address }],
    evidenceHash,
  };
  await submitCall(
    input.client,
    input.manifest.contractId,
    getBytes(
      servicing.encodeFunctionData(name, [
        input.opened.obligationId,
        evidenceHash,
        eventId,
        version,
        sign(buyer, input.opened.domain, event, input.opened.obligationId),
      ]),
    ),
  );
  return publishHeader(
    input.client,
    input.topicId,
    encodeEvidenceHeader({
      eventType,
      obligationId: input.opened.obligationId,
      version: version + 1n,
      previousState: eventType === "OpenDispute" ? "RESERVED" : "DISPUTED",
      newState: eventType === "OpenDispute" ? "DISPUTED" : "RESERVED",
      termsRoot: input.termsRoot,
      evidenceHash: payloadHash(event),
      actorRole: "buyer",
    }),
    name,
  );
}

async function submitCall(client: Client, contractId: string, parameters: Uint8Array): Promise<void> {
  const response = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(500_000)
    .setFunctionParameters(parameters)
    .setMaxTransactionFee(new Hbar(5))
    .execute(client);
  try {
    const receipt = await response.getReceipt(client);
    if (receipt.status.toString() !== "SUCCESS") {
      throw new Error(`Contract call status ${receipt.status.toString()}`);
    }
  } catch (error) {
    if (error instanceof ReceiptStatusError) {
      throw new Error(`Contract call status ${error.status.toString()}`);
    }
    throw error;
  }
}

function randomId(): string {
  return `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
}

function hexKey(value: string): string {
  return value.startsWith("0x") ? value : `0x${value}`;
}

function bytes32(hex: string): string {
  return `0x${hex.replace(/^0x/, "").padStart(64, "0")}`;
}
