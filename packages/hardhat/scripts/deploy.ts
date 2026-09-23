import { AccountCreateTransaction, Hbar, PrivateKey, TokenAssociateTransaction, TokenCreateTransaction, TopicCreateTransaction } from "@hiero-ledger/sdk";
import type { Client } from "@hiero-ledger/sdk";
import { Wallet } from "ethers";
import { network } from "hardhat";
import { TREASURY_SUPPLY_UNITS, TUSDC_DECIMALS, ADVANCE_TOKEN_UNITS } from "@claimstate/sdk";
import {
  demoAccountsPath,
  manifestPath,
  mirrorBase,
  operatorClient,
  requireOperatorEnv,
  writeJson,
  delay,
  type DemoAccount,
  type DemoAccounts,
} from "./session.js";

const MIRROR_WAIT_MS = 90_000;
const MIRROR_POLL_MS = 3_000;

await deploy();

async function deploy(): Promise<void> {
  const { privateKey } = requireOperatorEnv();
  const kernelAddress = new Wallet(rawHex(privateKey)).address;
  const client = operatorClient();
  try {
    const factorKey = PrivateKey.generateECDSA();
    const supplierKey = PrivateKey.generateECDSA();
    const buyerKey = PrivateKey.generateECDSA();
    const factor = await createAccount(client, factorKey, 30);
    const supplier = await createAccount(client, supplierKey, 5);
    const buyer = await createAccount(client, buyerKey, 5);
    console.log(`factorAccountId: ${factor.accountId}`);
    console.log(`supplierAccountId: ${supplier.accountId}`);
    console.log(`buyerAccountId: ${buyer.accountId}`);

    const topicResponse = await new TopicCreateTransaction()
      .setTopicMemo("ClaimState/v1")
      .setSubmitKey(privateKey.publicKey)
      .setMaxTransactionFee(new Hbar(2))
      .execute(client);
    const topicId = (await topicResponse.getReceipt(client)).topicId?.toString();
    if (topicId === undefined) {
      throw new Error("Topic creation receipt did not include a topic id");
    }

    const tokenId = await createToken(client, factor.accountId, factorKey);
    await associateSupplier(client, supplier.accountId, supplierKey, tokenId);
    console.log(`tokenId: ${tokenId}`);

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
    console.log(`advanceUnits: ${ADVANCE_TOKEN_UNITS.toString()}`);

    const accounts: DemoAccounts = {
      fingerprintKey: randomHex(32),
      amountSalt: randomHex(32),
      factor,
      supplier,
      buyer,
    };
    await writeJson(demoAccountsPath, accounts);
    await writeJson(manifestPath, {
      network: "hedera-testnet",
      chainId: 296,
      topicId,
      contractId,
      contractEvmAddress,
      kernel: kernelAddress,
      tokenId,
      tokenDecimals: TUSDC_DECIMALS,
      advanceUnits: ADVANCE_TOKEN_UNITS.toString(),
      treasurySupplyUnits: TREASURY_SUPPLY_UNITS.toString(),
      factorAccountId: factor.accountId,
      supplierAccountId: supplier.accountId,
      buyerAccountId: buyer.accountId,
    });
  } finally {
    client.close();
  }
}

async function createAccount(client: Client, key: PrivateKey, hbar: number): Promise<DemoAccount> {
  const response = await new AccountCreateTransaction()
    .setKey(key.publicKey)
    .setInitialBalance(new Hbar(hbar))
    .setMaxTransactionFee(new Hbar(5))
    .execute(client);
  const accountId = (await response.getReceipt(client)).accountId?.toString();
  if (accountId === undefined) {
    throw new Error("Account creation receipt did not include an account id");
  }
  return {
    accountId,
    evmAddress: evmAddress(key),
    privateKey: key.toStringRaw().replace(/^0x/, ""),
  };
}

async function createToken(client: Client, treasury: string, treasuryKey: PrivateKey): Promise<string> {
  const transaction = await new TokenCreateTransaction()
    .setTokenName("ClaimState Demo USD")
    .setTokenSymbol("tUSDC")
    .setDecimals(TUSDC_DECIMALS)
    .setInitialSupply(TREASURY_SUPPLY_UNITS)
    .setTreasuryAccountId(treasury)
    .setSupplyKey(treasuryKey.publicKey)
    .setTokenMemo("Demo advance. Not an assignment and not a lien.")
    .setMaxTransactionFee(new Hbar(20))
    .freezeWith(client);
  await transaction.sign(treasuryKey);
  const receipt = await (await transaction.execute(client)).getReceipt(client);
  const tokenId = receipt.tokenId?.toString();
  if (tokenId === undefined) {
    throw new Error("Token creation receipt did not include a token id");
  }
  return tokenId;
}

async function associateSupplier(
  client: Client,
  supplierId: string,
  supplierKey: PrivateKey,
  tokenId: string,
): Promise<void> {
  const transaction = await new TokenAssociateTransaction()
    .setAccountId(supplierId)
    .setTokenIds([tokenId])
    .setMaxTransactionFee(new Hbar(5))
    .freezeWith(client);
  await transaction.sign(supplierKey);
  const receipt = await (await transaction.execute(client)).getReceipt(client);
  if (receipt.status.toString() !== "SUCCESS") {
    throw new Error(`Token association status ${receipt.status.toString()}`);
  }
}

function evmAddress(key: PrivateKey): string {
  const fromSdk = key.publicKey.toEvmAddress();
  const sdk = fromSdk.startsWith("0x") ? fromSdk : `0x${fromSdk}`;
  const recovered = new Wallet(rawHex(key)).address;
  if (sdk.toLowerCase() !== recovered.toLowerCase()) {
    throw new Error("The Hedera ECDSA address does not match the address the kernel recovers");
  }
  return recovered;
}

function rawHex(key: PrivateKey): string {
  const hex = key.toStringRaw();
  return hex.startsWith("0x") ? hex : `0x${hex}`;
}

function randomHex(bytes: number): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("hex");
}

async function contractIdFromMirror(evmAddressText: string): Promise<string> {
  const address = evmAddressText.toLowerCase();
  const deadline = Date.now() + MIRROR_WAIT_MS;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    const response = await fetch(`${mirrorBase()}/api/v1/contracts/${address}`);
    lastStatus = response.status;
    if (response.ok) {
      const body = (await response.json()) as { contract_id?: string };
      if (typeof body.contract_id === "string" && body.contract_id.length > 0) {
        return body.contract_id;
      }
    }
    await delay(MIRROR_POLL_MS);
  }
  throw new Error(`Mirror node did not return a contract id for ${address} (last status ${lastStatus})`);
}
