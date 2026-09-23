// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// Recovers an ECDSA signer over a raw action digest.
/// Hedera secp256k1 keys use the same recovery as Ethereum.
/// If a funded testnet call shows that ecrecover does not accept the operator key,
/// replace this function with HIP-632 isAuthorized at system contract 0x16a
/// before adding a backend cosigner.
library SignatureLib {
    function recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError) {
            return address(0);
        }
        return signer;
    }
}
