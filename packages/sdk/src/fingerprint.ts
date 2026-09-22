import { createHmac } from "node:crypto";

/**
 * Replacement seam for a later OPRF or HSM.
 * `fingerprint` returns 32 bytes and must not receive the HMAC key from the caller.
 */
export interface FingerprintProvider {
  fingerprint(canonicalBytes: Uint8Array): Uint8Array;
}

const FINGERPRINT_BYTES = 32;

export function hmacFingerprintProvider(key: Uint8Array): FingerprintProvider {
  if (key.length < FINGERPRINT_BYTES) {
    throw new Error("Fingerprint key must be at least 32 bytes");
  }
  const keyCopy = new Uint8Array(key);
  return {
    fingerprint(canonicalBytes: Uint8Array): Uint8Array {
      const digest = createHmac("sha256", keyCopy).update(canonicalBytes).digest();
      if (digest.length !== FINGERPRINT_BYTES) {
        throw new Error("HMAC-SHA256 must produce 32 bytes");
      }
      return new Uint8Array(digest);
    },
  };
}
