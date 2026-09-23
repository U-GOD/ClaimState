import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getBytes, Wallet, type HDNodeWallet } from "ethers";
import { network } from "hardhat";
import {
  actionDigest,
  domainSeparator,
  payloadHash,
  STATE_CODE,
  type ClaimEvent,
} from "@claimstate/sdk";

const DUE = 1_800_000_000n;

await smoke();

async function smoke(): Promise<void> {
  const operatorId = process.env.HEDERA_OPERATOR_ID?.trim() ?? "";
  const encodedKey = process.env.HEDERA_OPERATOR_ECDSA_KEY?.trim() ?? "";
  if (operatorId.length === 0 || encodedKey.length === 0) {
    throw new Error(
      "The acknowledge smoke test needs HEDERA_OPERATOR_ID and HEDERA_OPERATOR_ECDSA_KEY. Neither is set.",
    );
  }

  const manifestPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../deployments/hedera-testnet.json",
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    chainId: number;
    topicId: string;
    contractEvmAddress: string;
    network: string;
  };
  if (manifest.network !== "hedera-testnet" || manifest.chainId !== 296) {
    throw new Error("The deployment manifest is not for Hedera testnet chain id 296");
  }

  const { ethers } = await network.create("hederaTestnet");
  const kernel = await ethers.getContractAt("ClaimStateKernel", manifest.contractEvmAddress);
  const domain = domainSeparator({
    chainId: 296n,
    registry: manifest.contractEvmAddress,
    topicId: manifest.topicId,
    networkLabel: "testnet",
  });
  expectMatch(await kernel.domainSeparator(), domain);

  const supplier = Wallet.createRandom();
  const buyer = Wallet.createRandom();
  const paymentAgent = Wallet.createRandom();
  const executor = Wallet.createRandom();
  const obligation = ethers.hexlify(ethers.randomBytes(32));
  const termsRoot = ethers.hexlify(ethers.randomBytes(32));
  const fingerprint = ethers.hexlify(ethers.randomBytes(32));
  const amountCommitment = ethers.hexlify(ethers.randomBytes(32));
  const createId = ethers.zeroPadValue(ethers.toBeHex(1), 32);
  const acknowledgeId = ethers.zeroPadValue(ethers.toBeHex(2), 32);

  const created: ClaimEvent = {
    eventType: "Create",
    eventId: createId,
    expectedVersion: 0n,
    signers: [{ role: "supplier", account: supplier.address }],
    obligationId: obligation,
    termsRoot,
    fingerprint,
    amountCommitment,
    buyer: buyer.address,
    supplier: supplier.address,
    paymentAgent: paymentAgent.address,
    scheduledExecutor: executor.address,
    dueDate: DUE,
  };
  const createTx = await kernel.create(
    obligation,
    termsRoot,
    fingerprint,
    amountCommitment,
    buyer.address,
    supplier.address,
    paymentAgent.address,
    executor.address,
    DUE,
    createId,
    0n,
    sign(supplier, domain, created, obligation),
    { gasLimit: 500_000n },
  );
  await createTx.wait();
  const draft = await kernel.envelopes(obligation);
  expectMatch(draft.state, BigInt(STATE_CODE.DRAFT));
  expectMatch(draft.version, 1n);
  expectMatch(draft.factor, ethers.ZeroAddress);

  const acknowledged: ClaimEvent = {
    eventType: "Acknowledge",
    eventId: acknowledgeId,
    expectedVersion: 1n,
    signers: [{ role: "buyer", account: buyer.address }],
    termsRoot,
  };
  const acknowledgeTx = await kernel.acknowledge(
    obligation,
    termsRoot,
    acknowledgeId,
    1n,
    sign(buyer, domain, acknowledged, obligation),
    { gasLimit: 400_000n },
  );
  await acknowledgeTx.wait();
  const confirmed = await kernel.envelopes(obligation);
  expectMatch(confirmed.state, BigInt(STATE_CODE.ACKNOWLEDGED));
  expectMatch(confirmed.version, 2n);
  expectMatch(confirmed.factor, ethers.ZeroAddress);
  console.log(`obligationId: ${obligation}`);
  console.log("state: ACKNOWLEDGED");
}

function sign(wallet: HDNodeWallet, domain: string, event: ClaimEvent, obligationId: string): string {
  const digest = actionDigest({
    domain,
    eventType: event.eventType,
    obligationId,
    expectedVersion: event.expectedVersion,
    payloadHash: payloadHash(event),
  });
  return wallet.signingKey.sign(getBytes(digest)).serialized;
}

function expectMatch(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error("Smoke assertion failed");
  }
}
