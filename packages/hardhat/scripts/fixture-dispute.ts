import { Wallet } from "ethers";
import { accountClient, operatorClient, readAccounts, readManifest } from "./session.js";
import { STATE_CODE } from "@claimstate/sdk";
import {
  activateCalldata,
  activationBatch,
  assertReserved,
  openAcknowledged,
  readEnvelope,
  submitBatch,
} from "./obligation.js";
import { cureDisputeStep, openDisputeStep } from "./servicing.js";

await fixture();

async function fixture(): Promise<void> {
  const manifest = await readManifest();
  const accounts = await readAccounts();
  const operator = operatorClient();
  const factor = accountClient(accounts.factor);
  try {
    const opened = await openAcknowledged(operator, manifest, accounts, "dispute-ref");
    const built = await activationBatch({ factor, manifest, obligation: opened });
    const outcome = await submitBatch(built, factor);
    if (!outcome.success) {
      throw new Error(`Activation batch status ${outcome.status}`);
    }
    const reserved = await readEnvelope(operator, manifest.contractId, opened.obligationId);
    assertReserved(reserved, accounts.factor.evmAddress);
    const holder = reserved.factor;
    const openedDispute = await openDisputeStep({
      client: operator,
      manifest,
      accounts,
      opened,
      version: reserved.version,
      termsRoot: opened.termsRoot,
      topicId: manifest.topicId,
    });
    const disputed = await readEnvelope(operator, manifest.contractId, opened.obligationId);
    if (disputed.state !== BigInt(STATE_CODE.DISPUTED) || disputed.factor.toLowerCase() !== holder.toLowerCase()) {
      throw new Error("Open dispute did not keep the reservation holder");
    }
    const supplier = new Wallet(hexKey(accounts.supplier.privateKey));
    const factorWallet = new Wallet(hexKey(accounts.factor.privateKey));
    const eventId = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
    const again = await activationBatch({
      factor,
      manifest,
      obligation: {
        ...opened,
        expectedVersion: disputed.version,
        activateCalldata: activateCalldata({
          obligationId: opened.obligationId,
          factor: factorWallet,
          supplier,
          domain: opened.domain,
          eventId,
          expectedVersion: disputed.version,
        }),
      },
    });
    const rejected = await submitBatch(again, factor);
    if (rejected.success) {
      throw new Error("A replacement activate was accepted");
    }
    const curedStep = await cureDisputeStep({
      client: operator,
      manifest,
      accounts,
      opened,
      version: disputed.version,
      termsRoot: opened.termsRoot,
      topicId: manifest.topicId,
    });
    const cured = await readEnvelope(operator, manifest.contractId, opened.obligationId);
    if (cured.state !== BigInt(STATE_CODE.RESERVED) || cured.factor.toLowerCase() !== holder.toLowerCase()) {
      throw new Error("Cure did not return the same reservation");
    }
    console.log("state: RESERVED");
    console.log(`openDispute: ${openedDispute.sequenceNumber}`);
    console.log(`cureDispute: ${curedStep.sequenceNumber}`);
    console.log(`replacementActivate: ${rejected.status}`);
  } finally {
    operator.close();
    factor.close();
  }
}

function hexKey(value: string): string {
  return value.startsWith("0x") ? value : `0x${value}`;
}
