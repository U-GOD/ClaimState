import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Hbar, PrivateKey } from "@hiero-ledger/sdk";
import { operatorPrivateKey } from "../operator-key.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export const packageRoot = path.resolve(scriptDir, "..");
export const repoRoot = path.resolve(packageRoot, "../..");
export const manifestPath = path.join(packageRoot, "deployments", "hedera-testnet.json");
export const activationReceiptPath = path.join(packageRoot, "deployments", "activation-receipt.json");
export const lifecycleReceiptPath = path.join(packageRoot, "deployments", "lifecycle-receipt.json");
export const demoAccountsPath = path.join(repoRoot, "data", "private", "demo-accounts.json");

export interface DeploymentManifest {
  network: "hedera-testnet";
  chainId: 296;
  topicId: string;
  contractId: string;
  contractEvmAddress: string;
  kernel: string;
  tokenId: string;
  tokenDecimals: 2;
  advanceUnits: string;
  treasurySupplyUnits: string;
  factorAccountId: string;
  supplierAccountId: string;
  buyerAccountId: string;
}

export interface DemoAccount {
  accountId: string;
  evmAddress: string;
  privateKey: string;
}

export interface DemoAccounts {
  fingerprintKey: string;
  amountSalt: string;
  factor: DemoAccount;
  supplier: DemoAccount;
  buyer: DemoAccount;
}

export const HAPPY_PATH_STEPS = [
  "create",
  "acknowledge",
  "activate",
  "creditNote",
  "payment",
  "payment",
  "release",
] as const;

export interface LifecycleStep {
  name: string;
  sequenceNumber: string;
  evidenceBase64: string;
}

export interface LifecycleReceipt {
  network: "hedera-testnet";
  chainId: 296;
  obligationId: string;
  contractId: string;
  topicId: string;
  tokenId: string;
  supplierAccountId: string;
  supplierBalanceAfter: string;
  advanceUnits: string;
  state: "RELEASED";
  version: string;
  steps: LifecycleStep[];
}

export interface ActivationReceipt {
  network: "hedera-testnet";
  chainId: 296;
  batchTransactionId: string;
  innerTransactionIds: [string, string, string];
  outerBytes: number;
  obligationId: string;
  resultingVersion: string;
  supplierAccountId: string;
  tokenId: string;
  advanceUnits: string;
  topicId: string;
  topicSequenceNumber: string;
  evidenceBase64: string;
  contractId: string;
  supplierBalanceAfter: string;
}

export function requireOperatorEnv(): { operatorId: string; privateKey: PrivateKey } {
  const operatorId = process.env.HEDERA_OPERATOR_ID?.trim() ?? "";
  const encodedKey = process.env.HEDERA_OPERATOR_ECDSA_KEY?.trim() ?? "";
  if (operatorId.length === 0 || encodedKey.length === 0) {
    throw new Error(
      "This testnet step needs HEDERA_OPERATOR_ID and HEDERA_OPERATOR_ECDSA_KEY. Neither is set.",
    );
  }
  return { operatorId, privateKey: operatorPrivateKey(encodedKey) };
}

export function operatorClient(): Client {
  const { operatorId, privateKey } = requireOperatorEnv();
  const client = Client.forTestnet();
  client.setOperator(operatorId, privateKey);
  client.setDefaultMaxTransactionFee(new Hbar(20));
  return client;
}

export function accountClient(account: DemoAccount): Client {
  const client = Client.forTestnet();
  client.setOperator(account.accountId, PrivateKey.fromStringECDSA(account.privateKey));
  client.setDefaultMaxTransactionFee(new Hbar(20));
  return client;
}

export async function readManifest(): Promise<DeploymentManifest> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as DeploymentManifest;
  if (manifest.network !== "hedera-testnet" || manifest.chainId !== 296) {
    throw new Error("The deployment manifest is not for Hedera testnet chain id 296");
  }
  if (manifest.tokenId === undefined || manifest.factorAccountId === undefined) {
    throw new Error("The deployment manifest has no tUSDC token. Run deploy:testnet again.");
  }
  return manifest;
}

export async function readDemoAccounts(): Promise<DemoAccounts> {
  return JSON.parse(await readFile(demoAccountsPath, "utf8")) as DemoAccounts;
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function mirrorBase(): string {
  return (process.env.HEDERA_MIRROR_BASE_URL ?? "https://testnet.mirrornode.hedera.com").replace(/\/$/, "");
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
