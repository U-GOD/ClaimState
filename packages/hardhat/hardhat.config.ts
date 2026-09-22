import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

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
  return [raw.startsWith("0x") ? raw : `0x${raw}`];
}

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hederaTestnet: {
      type: "http",
      chainId: TESTNET_CHAIN_ID,
      url: process.env.HEDERA_RPC_URL ?? HASHIO_TESTNET_RPC,
      accounts: operatorAccounts(),
    },
  },
});
