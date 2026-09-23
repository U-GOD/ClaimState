import { PrivateKey } from "@hiero-ledger/sdk";

/// Parses a Hedera ECDSA key from hex or DER.
/// Errors from this module never include the key material.
export function operatorPrivateKey(encoded: string): PrivateKey {
  const text = encoded.trim();
  if (text.length === 0) {
    throw new Error("HEDERA_OPERATOR_ECDSA_KEY is empty");
  }
  const key = parse(text);
  if (key.toBytesRaw().length !== 32) {
    throw new Error("HEDERA_OPERATOR_ECDSA_KEY must be an ECDSA key");
  }
  return key;
}

/// 0x-prefixed raw secp256k1 key for ethers.
export function rawEcdsaKey(encoded: string): string {
  const hex = operatorPrivateKey(encoded).toStringRaw();
  return hex.startsWith("0x") ? hex : `0x${hex}`;
}

function parse(text: string): PrivateKey {
  try {
    return PrivateKey.fromStringECDSA(text);
  } catch {
    try {
      return PrivateKey.fromStringDer(text);
    } catch {
      throw new Error("HEDERA_OPERATOR_ECDSA_KEY is not a Hedera ECDSA private key");
    }
  }
}
