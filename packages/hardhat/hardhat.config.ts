import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { rawEcdsaKey } from "./operator-key.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

const chainId = process.env.HEDERA_CHAIN_ID ?? "296";
if (chainId !== "296") {
  throw new Error(
    `ClaimState targets Hedera testnet chain id 296. Refusing HEDERA_CHAIN_ID=${chainId}.`,
  );
}

const TESTNET_CHAIN_ID = 296;
const HASHIO_TESTNET_RPC = "https://testnet.hashio.io/api";

function operatorAccounts(): string[] {
  const raw = process.env.HEDERA_OPERATOR_ECDSA_KEY?.trim();
  if (!raw) {
    return [];
  }
  return [rawEcdsaKey(raw)];
}

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.28",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  chainDescriptors: {
    [TESTNET_CHAIN_ID]: {
      name: "Hedera testnet",
      chainType: "l1",
    },
  },
  networks: {
    default: {
      type: "edr-simulated",
      chainId: TESTNET_CHAIN_ID,
      chainType: "l1",
    },
    hederaTestnet: {
      type: "http",
      chainId: TESTNET_CHAIN_ID,
      url: process.env.HEDERA_RPC_URL ?? HASHIO_TESTNET_RPC,
      accounts: operatorAccounts(),
    },
  },
});
