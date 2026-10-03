import { accountClient, operatorClient, readAccounts, readManifest } from "./session.js";
import { STATE_CODE } from "@claimstate/sdk";
import {
  activationBatch,
  assertReserved,
  openAcknowledged,
  readEnvelope,
  submitBatch,
} from "./obligation.js";
import { armDelinquency, expectRevert, paymentStep, readFreightFixture } from "./servicing.js";

await fixture();

async function fixture(): Promise<void> {
  const manifest = await readManifest();
  const accounts = await readAccounts();
  const plan = await readFreightFixture();
  const dueUnix = BigInt(Math.floor(Date.now() / 1000) + 86_400);
  const dueDate = new Date(Number(dueUnix) * 1000).toISOString().slice(0, 10);
  const operator = operatorClient();
  const factor = accountClient(accounts.factor);
  try {
    const opened = await openAcknowledged(operator, manifest, accounts, "delinquent-ref", {
      dueDate,
      dueUnix,
    });
    const built = await activationBatch({ factor, manifest, obligation: opened });
    const outcome = await submitBatch(built, factor);
    if (!outcome.success) {
      throw new Error(`Activation batch status ${outcome.status}`);
    }
    const reserved = await readEnvelope(operator, manifest.contractId, opened.obligationId);
    assertReserved(reserved, accounts.factor.evmAddress);
    const armed = await armDelinquency({
      client: operator,
      manifest,
      opened,
      version: reserved.version,
      dueUnix,
    });
    const payment = await paymentStep({
      client: operator,
      manifest,
      opened,
      settles: true,
      paymentHash: plan.allocations[1].paymentHash,
      version: reserved.version,
      termsRoot: opened.termsRoot,
      topicId: manifest.topicId,
    });
    const status = await expectRevert(operator, manifest.contractId, armed.calldata);
    const envelope = await readEnvelope(operator, manifest.contractId, opened.obligationId);
    if (envelope.state !== BigInt(STATE_CODE.SETTLED) || envelope.version !== payment.version) {
      throw new Error("The scheduled call changed the funded envelope");
    }
    console.log("state: SETTLED");
    console.log(`scheduleId: ${armed.scheduleId}`);
    console.log(`scheduledCall: ${status}`);
    console.log("waitForExpiry: true");
  } finally {
    operator.close();
    factor.close();
  }
}
