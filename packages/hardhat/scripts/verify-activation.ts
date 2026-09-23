import { AccountCreateTransaction, Hbar, PrivateKey } from "@hiero-ledger/sdk";
import { Wallet } from "ethers";
import { domainSeparator, STATE_CODE } from "@claimstate/sdk";
import {
  accountClient,
  operatorClient,
  readDemoAccounts,
  readManifest,
  type DeploymentManifest,
} from "./session.js";
import {
  activateCalldata,
  activationBatch,
  openAcknowledged,
  readEnvelope,
  submitBatch,
  tokenUnits,
  topicSequence,
  type OpenedObligation,
} from "./obligation.js";

await verifyFailures();

async function verifyFailures(): Promise<void> {
  const manifest = await readManifest();
  const accounts = await readDemoAccounts();
  const operator = operatorClient();
  const factor = accountClient(accounts.factor);
  try {
    await craftedInnerFailure(operator, factor, manifest, accounts);
    await staleVersion(operator, factor, manifest, accounts);
    await replayAndSecondFactor(operator, factor, manifest, accounts);
    console.log("activation failure cases held the slot and the balance");
  } finally {
    operator.close();
    factor.close();
  }
}

async function craftedInnerFailure(
  operator: ReturnType<typeof operatorClient>,
  factor: ReturnType<typeof accountClient>,
  manifest: DeploymentManifest,
  accounts: Awaited<ReturnType<typeof readDemoAccounts>>,
): Promise<void> {
  const strangerKey = PrivateKey.generateECDSA();
  const created = await new AccountCreateTransaction()
    .setKey(strangerKey.publicKey)
    .setInitialBalance(new Hbar(1))
    .execute(operator);
  const stranger = (await created.getReceipt(operator)).accountId?.toString();
  if (stranger === undefined) {
    throw new Error("Could not create the unassociated recipient");
  }
  const opened = await openAcknowledged(operator, manifest, accounts, "carrier-ref-inner-fail");
  const before = await snapshot(operator, manifest, opened.obligationId);
  const built = await activationBatch({
    factor,
    manifest,
    obligation: opened,
    supplierAccountId: stranger,
  });
  const outcome = await submitBatch(built, factor);
  await expectRolledBack(operator, manifest, opened, before, outcome.status);
  console.log("crafted inner failure rolled the activation and the transfer back");
  console.log(`feeTinybars: ${outcome.feeTinybars}`);
  console.log("inner fees can still be charged when the batch rolls back");
}

async function staleVersion(
  operator: ReturnType<typeof operatorClient>,
  factor: ReturnType<typeof accountClient>,
  manifest: DeploymentManifest,
  accounts: Awaited<ReturnType<typeof readDemoAccounts>>,
): Promise<void> {
  const opened = await openAcknowledged(operator, manifest, accounts, "carrier-ref-stale");
  const before = await snapshot(operator, manifest, opened.obligationId);
  const supplier = new Wallet(prefix(accounts.supplier.privateKey));
  const factorWallet = new Wallet(prefix(accounts.factor.privateKey));
  const built = await activationBatch({
    factor,
    manifest,
    obligation: { ...opened, expectedVersion: 0n },
    functionParameters: activateCalldata({
      obligationId: opened.obligationId,
      factor: factorWallet,
      supplier,
      domain: domainOf(manifest),
      eventId: randomId(),
      expectedVersion: 0n,
    }),
  });
  const outcome = await submitBatch(built, factor);
  await expectRolledBack(operator, manifest, opened, before, outcome.status);
  console.log(`stale version status: ${outcome.status}`);
  console.log("stale version did not transfer");
}

async function replayAndSecondFactor(
  operator: ReturnType<typeof operatorClient>,
  factor: ReturnType<typeof accountClient>,
  manifest: DeploymentManifest,
  accounts: Awaited<ReturnType<typeof readDemoAccounts>>,
): Promise<void> {
  const opened = await openAcknowledged(operator, manifest, accounts, "carrier-ref-replay");
  const funded = await activationBatch({ factor, manifest, obligation: opened });
  const success = await submitBatch(funded, factor);
  if (!success.success) {
    throw new Error(`Setup activation status ${success.status}`);
  }
  const reserved = await readEnvelope(operator, manifest.contractId, opened.obligationId);
  if (reserved.state !== BigInt(STATE_CODE.RESERVED)) {
    throw new Error("Setup activation did not reserve the envelope");
  }
  const before = await snapshot(operator, manifest, opened.obligationId);

  const replay = await activationBatch({
    factor,
    manifest,
    obligation: { ...opened, expectedVersion: reserved.version },
    functionParameters: activateCalldata({
      obligationId: opened.obligationId,
      factor: new Wallet(prefix(accounts.factor.privateKey)),
      supplier: new Wallet(prefix(accounts.supplier.privateKey)),
      domain: domainOf(manifest),
      eventId: opened.activateEventId,
      expectedVersion: reserved.version,
    }),
  });
  const replayed = await submitBatch(replay, factor);
  await expectRolledBack(operator, manifest, opened, before, replayed.status);
  console.log(`replay status: ${replayed.status}`);

  const other = new Wallet(prefix(PrivateKey.generateECDSA().toStringRaw()));
  const duplicate = await activationBatch({
    factor,
    manifest,
    obligation: { ...opened, expectedVersion: reserved.version },
    functionParameters: activateCalldata({
      obligationId: opened.obligationId,
      factor: other,
      supplier: new Wallet(prefix(accounts.supplier.privateKey)),
      domain: domainOf(manifest),
      eventId: randomId(),
      expectedVersion: reserved.version,
    }),
  });
  const second = await submitBatch(duplicate, factor);
  await expectRolledBack(operator, manifest, opened, before, second.status);
  console.log(`second factor status: ${second.status}`);
  console.log("second factor left the slot and the balance unchanged");
  console.log("no second topic message was committed");
}

interface Snapshot {
  state: bigint;
  version: bigint;
  factor: string;
  balance: bigint;
  sequence: string;
}

async function snapshot(
  client: ReturnType<typeof operatorClient>,
  manifest: DeploymentManifest,
  obligationId: string,
): Promise<Snapshot> {
  const envelope = await readEnvelope(client, manifest.contractId, obligationId);
  return {
    state: envelope.state,
    version: envelope.version,
    factor: envelope.factor,
    balance: await tokenUnits(client, manifest.supplierAccountId, manifest.tokenId),
    sequence: await topicSequence(client, manifest.topicId),
  };
}

async function expectRolledBack(
  client: ReturnType<typeof operatorClient>,
  manifest: DeploymentManifest,
  opened: OpenedObligation,
  before: Snapshot,
  status: string,
): Promise<void> {
  if (status === "SUCCESS") {
    throw new Error("A failing activation batch was committed");
  }
  const after = await snapshot(client, manifest, opened.obligationId);
  if (after.state !== before.state || after.version !== before.version) {
    throw new Error("A rolled-back batch changed the envelope");
  }
  if (after.factor.toLowerCase() !== before.factor.toLowerCase()) {
    throw new Error("A rolled-back batch changed the reservation");
  }
  if (after.balance !== before.balance) {
    throw new Error("A rolled-back batch transferred tUSDC");
  }
  if (after.sequence !== before.sequence) {
    throw new Error("A rolled-back batch committed an HCS message");
  }
}

function domainOf(manifest: DeploymentManifest): string {
  return domainSeparator({
    chainId: 296n,
    registry: manifest.contractEvmAddress,
    topicId: manifest.topicId,
    networkLabel: "testnet",
  });
}

function prefix(value: string): string {
  return value.startsWith("0x") ? value : `0x${value}`;
}

function randomId(): string {
  return `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
}
