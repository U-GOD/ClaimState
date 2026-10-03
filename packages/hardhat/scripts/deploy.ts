import {
  AccountCreateTransaction,
  Hbar,
  PrivateKey,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenSupplyType,
  TokenType,
  TopicCreateTransaction,
} from "@hiero-ledger/sdk";
import type { Client } from "@hiero-ledger/sdk";
import { Interface, Wallet } from "ethers";
import { network } from "hardhat";
import { TREASURY_SUPPLY_UNITS, TUSDC_DECIMALS, ADVANCE_TOKEN_UNITS } from "@claimstate/sdk";
import {
  accountsPath,
  manifestPath,
  mirrorBase,
  operatorClient,
  requireOperatorEnv,
  writeJson,
  delay,
  type Account,
  type Accounts,
} from "./session.js";

const MIRROR_WAIT_MS = 90_000;
const MIRROR_POLL_MS = 3_000;
/** Chainlink USDC/USD on Hedera testnet. Activation reverts without a fresh peg. */
const CHAINLINK_USDC_USD = "0xb632a7e7e02d76c0Ce99d9C62c7a2d1B5F92B6B5";
const PEG_TARGET = 100_000_000n;
const PEG_BAND = 2_000_000n;
const MAX_FEED_AGE_SECONDS = 48n * 60n * 60n;

await deploy();

async function deploy(): Promise<void> {
  await assertLiveDollarFeed();
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
    const receiptTokenId = await createReceiptToken(client, factor.accountId, factorKey);
    console.log(`tokenId: ${tokenId}`);
    console.log(`receiptTokenId: ${receiptTokenId}`);

    const { ethers } = await network.create("hederaTestnet");
    const kernel = await ethers.deployContract(
      "ClaimStateKernel",
      [topicId, "testnet", kernelAddress, CHAINLINK_USDC_USD],
      { gasLimit: 4_000_000n },
    );
    await kernel.waitForDeployment();
    const contractEvmAddress = await kernel.getAddress();
    console.log(`contractEvmAddress: ${contractEvmAddress}`);
    console.log(`topicId: ${topicId}`);

    const contractId = await contractIdFromMirror(contractEvmAddress);
    console.log(`contractId: ${contractId}`);
    console.log(`advanceUnits: ${ADVANCE_TOKEN_UNITS.toString()}`);

    const accounts: Accounts = {
      fingerprintKey: randomHex(32),
      amountSalt: randomHex(32),
      factor,
      supplier,
      buyer,
    };
    await writeJson(accountsPath, accounts);
    await writeJson(manifestPath, {
      network: "hedera-testnet",
      chainId: 296,
      topicId,
      contractId,
      contractEvmAddress,
      kernel: kernelAddress,
      tokenId,
      receiptTokenId,
      tokenDecimals: TUSDC_DECIMALS,
      advanceUnits: ADVANCE_TOKEN_UNITS.toString(),
      treasurySupplyUnits: TREASURY_SUPPLY_UNITS.toString(),
      factorAccountId: factor.accountId,
      supplierAccountId: supplier.accountId,
      buyerAccountId: buyer.accountId,
      chainlinkUsdcUsd: CHAINLINK_USDC_USD,
    });
    console.log(`chainlinkUsdcUsd: ${CHAINLINK_USDC_USD}`);
  } finally {
    client.close();
  }
}

async function assertLiveDollarFeed(): Promise<void> {
  const rpc = process.env.HEDERA_RPC_URL ?? "https://testnet.hashio.io/api";
  const feed = new Interface([
    "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
    "function decimals() view returns (uint8)",
  ]);
  const round = await ethCall(rpc, feed, "latestRoundData");
  const decimals = await ethCall(rpc, feed, "decimals");
  const answer = BigInt(String(round[1]));
  const updatedAt = BigInt(String(round[3]));
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (Number(decimals[0] as number | bigint) !== 8 || answer <= 0n || updatedAt === 0n || now < updatedAt) {
    throw new Error("Chainlink USDC/USD is not a usable 8-decimal dollar feed");
  }
  if (now - updatedAt > MAX_FEED_AGE_SECONDS || answer < PEG_TARGET - PEG_BAND || answer > PEG_TARGET + PEG_BAND) {
    throw new Error("Chainlink USDC/USD is stale or off the dollar peg, so activation would revert");
  }
}

async function ethCall(rpc: string, feed: Interface, name: "latestRoundData" | "decimals"): Promise<readonly unknown[]> {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: CHAINLINK_USDC_USD, data: feed.encodeFunctionData(name) }, "latest"],
    }),
  });
  if (!response.ok) {
    throw new Error(`Chainlink read failed with HTTP ${response.status}`);
  }
  const body = (await response.json()) as { result?: string; error?: { message?: string } };
  if (body.error !== undefined || typeof body.result !== "string" || body.result === "0x") {
    throw new Error(body.error?.message ?? "Chainlink USDC/USD returned no price");
  }
  return feed.decodeFunctionResult(name, body.result);
}

async function createAccount(client: Client, key: PrivateKey, hbar: number): Promise<Account> {
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
    .setTokenName("ClaimState Advance")
    .setTokenSymbol("tUSDC")
    .setDecimals(TUSDC_DECIMALS)
    .setInitialSupply(TREASURY_SUPPLY_UNITS)
    .setTreasuryAccountId(treasury)
    .setSupplyKey(treasuryKey.publicKey)
    .setTokenMemo("Operational advance. Not an assignment and not a lien.")
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

async function createReceiptToken(client: Client, treasury: string, treasuryKey: PrivateKey): Promise<string> {
  const transaction = await new TokenCreateTransaction()
    .setTokenName("ClaimState Operational Receipt")
    .setTokenSymbol("CS-RCPT")
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(treasury)
    .setSupplyKey(treasuryKey.publicKey)
    .setTokenMemo("Operational receipt. Not an assignment and not a lien.")
    .setMaxTransactionFee(new Hbar(20))
    .freezeWith(client);
  await transaction.sign(treasuryKey);
  const receipt = await (await transaction.execute(client)).getReceipt(client);
  const tokenId = receipt.tokenId?.toString();
  if (tokenId === undefined) {
    throw new Error("Receipt token creation did not include a token id");
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
