import {
  accountClient,
  activationReceiptPath,
  operatorClient,
  readDemoAccounts,
  readManifest,
  writeJson,
} from "./session.js";
import {
  ADVANCE_TOKEN_UNITS,
  activationBatch,
  assertReserved,
  assertUndisclosed,
  openAcknowledged,
  readEnvelope,
  submitBatch,
  tokenUnits,
} from "./obligation.js";

await demo();

async function demo(): Promise<void> {
  const manifest = await readManifest();
  const accounts = await readDemoAccounts();
  const operator = operatorClient();
  const factor = accountClient(accounts.factor);
  try {
    const before = await tokenUnits(operator, manifest.supplierAccountId, manifest.tokenId);
    const opened = await openAcknowledged(operator, manifest, accounts, "debtor-ref-1");
    const built = await activationBatch({ factor, manifest, obligation: opened });
    assertUndisclosed(built.evidence);
    const outcome = await submitBatch(built, factor);
    if (!outcome.success || outcome.topicSequenceNumber === null) {
      throw new Error(`Activation batch status ${outcome.status}`);
    }
    const envelope = await readEnvelope(operator, manifest.contractId, opened.obligationId);
    assertReserved(envelope, accounts.factor.evmAddress);
    const after = await tokenUnits(operator, manifest.supplierAccountId, manifest.tokenId);
    if (after !== before + ADVANCE_TOKEN_UNITS) {
      throw new Error("The supplier balance did not increase by the advance");
    }
    await writeJson(activationReceiptPath, {
      network: "hedera-testnet",
      chainId: 296,
      batchTransactionId: outcome.transactionId,
      innerTransactionIds: built.innerTransactionIds,
      outerBytes: built.outerBytes,
      obligationId: opened.obligationId,
      resultingVersion: envelope.version.toString(),
      supplierAccountId: manifest.supplierAccountId,
      tokenId: manifest.tokenId,
      advanceUnits: ADVANCE_TOKEN_UNITS.toString(),
      topicId: manifest.topicId,
      topicSequenceNumber: outcome.topicSequenceNumber,
      evidenceBase64: Buffer.from(built.evidence).toString("base64"),
      contractId: manifest.contractId,
      supplierBalanceAfter: after.toString(),
    });
    console.log(`state: RESERVED`);
    console.log(`version: ${envelope.version.toString()}`);
    console.log(`batchTransactionId: ${outcome.transactionId}`);
    console.log(`innerTransactionIds: ${built.innerTransactionIds.join(" ")}`);
    console.log(`topicSequenceNumber: ${outcome.topicSequenceNumber}`);
    console.log(`supplierBalance: ${after.toString()}`);
    console.log("stopped after activation");
  } finally {
    operator.close();
    factor.close();
  }
}
