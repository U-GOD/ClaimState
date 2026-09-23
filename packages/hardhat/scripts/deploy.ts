import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Client,
  Hbar,
  TopicCreateTransaction,
} from "@hiero-ledger/sdk";
import { Wallet } from "ethers";
import { network } from "hardhat";
import { operatorPrivateKey } from "../operator-key.js";

const MIRROR_WAIT_MS = 90_000;
const MIRROR_POLL_MS = 3_000;

await deploy();

async function deploy(): Promise<void> {
  const operatorId = process.env.HEDERA_OPERATOR_ID?.trim() ?? "";
  const encodedKey = process.env.HEDERA_OPERATOR_ECDSA_KEY?.trim() ?? "";
  if (operatorId.length === 0 || encodedKey.length === 0) {
    throw new Error(
      "A funded testnet deploy needs HEDERA_OPERATOR_ID and HEDERA_OPERATOR_ECDSA_KEY. Neither is set.",
    );
  }

  const privateKey = operatorPrivateKey(encodedKey);
  const raw = privateKey.toStringRaw();
  const kernelAddress = new Wallet(raw.startsWith("0x") ? raw : `0x${raw}`).address;
  const client = Client.forTestnet();
  client.setOperator(operatorId, privateKey);
  client.setDefaultMaxTransactionFee(new Hbar(2));

  try {
    const topicResponse = await new TopicCreateTransaction()
      .setTopicMemo("ClaimState/v1")
      .setSubmitKey(privateKey.publicKey)
      .execute(client);
    const topicReceipt = await topicResponse.getReceipt(client);
    const topicId = topicReceipt.topicId?.toString();
    if (topicId === undefined) {
      throw new Error("Topic creation receipt did not include a topic id");
    }

    const { ethers } = await network.create("hederaTestnet");
    const kernel = await ethers.deployContract(
      "ClaimStateKernel",
      [topicId, "testnet", kernelAddress],
      { gasLimit: 4_000_000n },
    );
    await kernel.waitForDeployment();
    const contractEvmAddress = await kernel.getAddress();
    console.log(`contractEvmAddress: ${contractEvmAddress}`);
    console.log(`topicId: ${topicId}`);

    const contractId = await contractIdFromMirror(contractEvmAddress);
    console.log(`contractId: ${contractId}`);

    const manifest = {
      network: "hedera-testnet",
      chainId: 296,
      topicId,
      contractId,
      contractEvmAddress,
      kernel: kernelAddress,
    };
    const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../deployments");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "hedera-testnet.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
  } finally {
    client.close();
  }
}

async function contractIdFromMirror(evmAddress: string): Promise<string> {
  const base = (process.env.HEDERA_MIRROR_BASE_URL ?? "https://testnet.mirrornode.hedera.com").replace(
    /\/$/,
    "",
  );
  const address = evmAddress.toLowerCase();
  const deadline = Date.now() + MIRROR_WAIT_MS;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    const response = await fetch(`${base}/api/v1/contracts/${address}`);
    lastStatus = response.status;
    if (response.ok) {
      const body = (await response.json()) as { contract_id?: string };
      if (typeof body.contract_id === "string" && body.contract_id.length > 0) {
        return body.contract_id;
      }
    }
    await delay(MIRROR_POLL_MS);
  }
  throw new Error(
    `Mirror node did not return a contract id for ${address} (last status ${lastStatus})`,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
