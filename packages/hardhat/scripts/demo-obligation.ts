import { Wallet } from "ethers";
import {
  accountClient,
  HAPPY_PATH_STEPS,
  lifecycleReceiptPath,
  operatorClient,
  readDemoAccounts,
  readManifest,
  writeJson,
} from "./session.js";
import {
  ADVANCE_TOKEN_UNITS,
  activateCalldata,
  activationBatch,
  assertReserved,
  burnReceipt,
  mintSerial,
  assertUndisclosed,
  openAcknowledged,
  readEnvelope,
  submitBatch,
  tokenUnits,
} from "./obligation.js";
import { assertReleased, creditNoteStep, paymentStep, readFreightFixture, releaseStep } from "./servicing.js";

await demo();

async function demo(): Promise<void> {
  const manifest = await readManifest();
  const accounts = await readDemoAccounts();
  const plan = await readFreightFixture();
  const operator = operatorClient();
  const factor = accountClient(accounts.factor);
  try {
    const before = await tokenUnits(operator, manifest.supplierAccountId, manifest.tokenId);
    const opened = await openAcknowledged(operator, manifest, accounts, "debtor-ref-1", {
      publishEvidence: true,
    });
    const built = await activationBatch({ factor, manifest, obligation: opened });
    assertUndisclosed(built.evidence);
    const outcome = await submitBatch(built, factor);
    if (!outcome.success || outcome.topicSequenceNumber === null) {
      throw new Error(`Activation batch status ${outcome.status}`);
    }
    const serial = await mintSerial(operator, built.innerTransactionIds[3]);
    const reserved = await readEnvelope(operator, manifest.contractId, opened.obligationId);
    assertReserved(reserved, accounts.factor.evmAddress);
    const after = await tokenUnits(operator, manifest.supplierAccountId, manifest.tokenId);
    if (after !== before + ADVANCE_TOKEN_UNITS) {
      throw new Error("The supplier balance did not increase by the advance");
    }

    const steps = [
      ...opened.evidenceSteps,
      {
        name: "activate",
        sequenceNumber: outcome.topicSequenceNumber,
        evidenceBase64: Buffer.from(built.evidence).toString("base64"),
      },
    ];
    const credit = await creditNoteStep({
      client: operator,
      manifest,
      accounts,
      opened,
      plan,
      version: reserved.version,
      topicId: manifest.topicId,
    });
    steps.push(credit.step);
    let version = credit.version;
    let termsRoot = credit.termsRoot;
    for (const allocation of plan.allocations) {
      const payment = await paymentStep({
        client: operator,
        manifest,
        opened,
        settles: allocation.settles,
        paymentHash: allocation.paymentHash,
        version,
        termsRoot,
        topicId: manifest.topicId,
      });
      steps.push(payment.step);
      version = payment.version;
    }
    const released = await releaseStep({
      client: operator,
      manifest,
      accounts,
      opened,
      version,
      termsRoot,
      topicId: manifest.topicId,
    });
    steps.push(released.step);
    await burnReceipt(factor, manifest.receiptTokenId, serial);
    const finalVersion = await assertReleased(operator, manifest.contractId, opened.obligationId);
    if (steps.map((step) => step.name).join(",") !== HAPPY_PATH_STEPS.join(",")) {
      throw new Error("Topic steps are not create, acknowledge, activate, credit note, payment, and release");
    }

    const supplier = new Wallet(hexKey(accounts.supplier.privateKey));
    const factorWallet = new Wallet(hexKey(accounts.factor.privateKey));
    const eventId = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
    const again = await activationBatch({
      factor,
      manifest,
      obligation: {
        ...opened,
        termsRoot,
        expectedVersion: finalVersion,
        evidenceHash: `0x${"00".repeat(32)}`,
        activateCalldata: activateCalldata({
          obligationId: opened.obligationId,
          factor: factorWallet,
          supplier,
          domain: opened.domain,
          eventId,
          expectedVersion: finalVersion,
        }),
      },
    });
    const rejected = await submitBatch(again, factor);
    if (rejected.success) {
      throw new Error("A further activate was accepted");
    }
    await assertReleased(operator, manifest.contractId, opened.obligationId);
    const balance = await tokenUnits(operator, manifest.supplierAccountId, manifest.tokenId);
    if (balance !== after) {
      throw new Error("The rejected activate changed the supplier balance");
    }

    await writeJson(lifecycleReceiptPath, {
      network: "hedera-testnet",
      chainId: 296,
      obligationId: opened.obligationId,
      contractId: manifest.contractId,
      topicId: manifest.topicId,
      tokenId: manifest.tokenId,
      supplierAccountId: manifest.supplierAccountId,
      supplierBalanceAfter: balance.toString(),
      advanceUnits: ADVANCE_TOKEN_UNITS.toString(),
      state: "RELEASED",
      version: finalVersion.toString(),
      steps,
    });
    console.log("state: RELEASED");
    console.log(`version: ${finalVersion.toString()}`);
    for (const step of steps) {
      console.log(`${step.name}: ${step.sequenceNumber}`);
    }
    console.log(`supplierBalance: ${balance.toString()}`);
    console.log(`furtherActivate: ${rejected.status}`);
  } finally {
    operator.close();
    factor.close();
  }
}

function hexKey(value: string): string {
  return value.startsWith("0x") ? value : `0x${value}`;
}
