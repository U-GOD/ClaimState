import { readFile } from "node:fs/promises";
import { decodeEvidenceHeader, holderIsUndisclosed, STATE_CODE } from "@claimstate/sdk";
import {
  delay,
  HAPPY_PATH_STEPS,
  lifecycleReceiptPath,
  mirrorBase,
  operatorClient,
  type LifecycleReceipt,
} from "./session.js";
import { readEnvelope, tokenUnits } from "./obligation.js";

const MIRROR_WAIT_MS = 90_000;
const MIRROR_POLL_MS = 3_000;

await verify();

async function verify(): Promise<void> {
  const receipt = JSON.parse(await readFile(lifecycleReceiptPath, "utf8")) as LifecycleReceipt;
  if (receipt.steps.map((step) => step.name).join(",") !== HAPPY_PATH_STEPS.join(",")) {
    throw new Error("Receipt steps are not create, acknowledge, activate, credit note, payment, and release");
  }
  let previous = 0n;
  for (const step of receipt.steps) {
    const sequence = BigInt(step.sequenceNumber);
    if (sequence <= previous) {
      throw new Error("Topic sequence numbers are not in order");
    }
    previous = sequence;
    const evidence = Uint8Array.from(Buffer.from(step.evidenceBase64, "base64"));
    if (!holderIsUndisclosed(evidence)) {
      throw new Error(`The ${step.name} header disclosed the reservation holder`);
    }
  }
  const client = operatorClient();
  try {
    const envelope = await readEnvelope(client, receipt.contractId, receipt.obligationId);
    if (envelope.state !== BigInt(STATE_CODE.RELEASED) || envelope.version.toString() !== receipt.version) {
      throw new Error("Consensus state is not the released receipt");
    }
    const balance = await tokenUnits(client, receipt.supplierAccountId, receipt.tokenId);
    if (balance.toString() !== receipt.supplierBalanceAfter) {
      throw new Error("Consensus token balance does not match the lifecycle receipt");
    }
    console.log("consensus: RELEASED");
    console.log(`consensusBalance: ${balance.toString()}`);
    for (const step of receipt.steps) {
      const mirrored = await mirrorMessage(receipt.topicId, step.sequenceNumber);
      const stored = Uint8Array.from(Buffer.from(step.evidenceBase64, "base64"));
      if (Buffer.compare(Buffer.from(mirrored), Buffer.from(stored)) !== 0) {
        throw new Error(`Mirror topic message ${step.sequenceNumber} does not match ${step.name}`);
      }
      const decoded = decodeEvidenceHeader(mirrored);
      if (decoded.holder !== `0x${"00".repeat(20)}`) {
        throw new Error(`Mirror message ${step.name} disclosed the reservation holder`);
      }
      console.log(`${step.name}: ${step.sequenceNumber}`);
    }
    const mirrorBalance = await mirrorTokenBalance(receipt.supplierAccountId, receipt.tokenId);
    if (mirrorBalance !== balance) {
      throw new Error("Mirror token balance does not match the consensus balance");
    }
    console.log(`mirrorBalance: ${mirrorBalance.toString()}`);
  } finally {
    client.close();
  }
}

async function mirrorMessage(topicId: string, sequence: string): Promise<Uint8Array> {
  const deadline = Date.now() + MIRROR_WAIT_MS;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    const response = await fetch(`${mirrorBase()}/api/v1/topics/${topicId}/messages/${sequence}`);
    lastStatus = response.status;
    if (response.ok) {
      const body = (await response.json()) as { message?: string };
      if (typeof body.message === "string" && body.message.length > 0) {
        return Uint8Array.from(Buffer.from(body.message, "base64"));
      }
    }
    await delay(MIRROR_POLL_MS);
  }
  throw new Error(`Mirror did not index topic message ${sequence} (last status ${lastStatus})`);
}

async function mirrorTokenBalance(accountId: string, tokenId: string): Promise<bigint> {
  const deadline = Date.now() + MIRROR_WAIT_MS;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${mirrorBase()}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}&limit=1`,
    );
    lastStatus = response.status;
    if (response.ok) {
      const body = (await response.json()) as { tokens?: { balance?: number | string }[] };
      const row = body.tokens?.[0];
      if (row?.balance !== undefined) {
        return BigInt(row.balance);
      }
    }
    await delay(MIRROR_POLL_MS);
  }
  throw new Error(`Mirror did not index token balance (last status ${lastStatus})`);
}
