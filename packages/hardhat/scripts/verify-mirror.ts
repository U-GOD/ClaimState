import { readFile } from "node:fs/promises";
import { TransactionReceiptQuery } from "@hiero-ledger/sdk";
import { decodeEvidenceHeader, holderIsUndisclosed } from "@claimstate/sdk";
import {
  activationReceiptPath,
  delay,
  mirrorBase,
  operatorClient,
  readDemoAccounts,
  readManifest,
  type ActivationReceipt,
} from "./session.js";
import { assertReserved, readEnvelope, tokenUnits } from "./obligation.js";

const MIRROR_WAIT_MS = 90_000;
const MIRROR_POLL_MS = 3_000;

await verify();

async function verify(): Promise<void> {
  const manifest = await readManifest();
  const accounts = await readDemoAccounts();
  const receipt = JSON.parse(await readFile(activationReceiptPath, "utf8")) as ActivationReceipt;
  const evidence = Uint8Array.from(Buffer.from(receipt.evidenceBase64, "base64"));
  if (!holderIsUndisclosed(evidence)) {
    throw new Error("The stored evidence header disclosed the reservation holder");
  }
  const client = operatorClient();
  try {
    for (const transactionId of receipt.innerTransactionIds) {
      const inner = await new TransactionReceiptQuery().setTransactionId(transactionId).execute(client);
      if (inner.status.toString() !== "SUCCESS") {
        throw new Error(`Inner transaction ${transactionId} status ${inner.status.toString()}`);
      }
    }
    const envelope = await readEnvelope(client, manifest.contractId, receipt.obligationId);
    assertReserved(envelope, accounts.factor.evmAddress);
    const balance = await tokenUnits(client, receipt.supplierAccountId, receipt.tokenId);
    if (balance.toString() !== receipt.supplierBalanceAfter) {
      throw new Error("Consensus token balance does not match the activation receipt");
    }
    console.log("consensus: RESERVED");
    console.log(`consensusBalance: ${balance.toString()}`);

    const mirrored = await mirrorMessage(receipt.topicId, receipt.topicSequenceNumber);
    if (Buffer.compare(Buffer.from(mirrored), Buffer.from(evidence)) !== 0) {
      throw new Error("Mirror topic message does not match the consensus evidence header");
    }
    const decoded = decodeEvidenceHeader(mirrored);
    if (decoded.holder !== `0x${"00".repeat(20)}`) {
      throw new Error("Mirror topic message disclosed the reservation holder");
    }
    const mirrorBalance = await mirrorTokenBalance(receipt.supplierAccountId, receipt.tokenId);
    if (mirrorBalance !== balance) {
      throw new Error("Mirror token balance does not match the consensus balance");
    }
    console.log(`mirrorSequence: ${receipt.topicSequenceNumber}`);
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
