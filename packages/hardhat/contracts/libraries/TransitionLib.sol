// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

/// Allowed edges of the obligation state machine.
/// State zero means the envelope does not exist yet.
library TransitionLib {
    uint8 internal constant NONE = 0;
    uint8 internal constant DRAFT = 1;
    uint8 internal constant ACKNOWLEDGED = 2;
    uint8 internal constant RESERVED = 3;
    uint8 internal constant DISPUTED = 4;
    uint8 internal constant DELINQUENT = 5;
    uint8 internal constant SETTLED = 6;
    uint8 internal constant RELEASED = 7;
    uint8 internal constant DEFAULTED = 8;

    function isCreate(uint8 state) internal pure returns (bool) {
        return state == NONE;
    }

    function isAcknowledge(uint8 state) internal pure returns (bool) {
        return state == DRAFT;
    }

    /// Activate from any other state, or while a holder is set, fails closed.
    /// The bool does not carry the holder.
    function activateFailsClosed(uint8 state, address factor) internal pure returns (bool) {
        return state != ACKNOWLEDGED || factor != address(0);
    }

    function isCreditNote(uint8 state) internal pure returns (bool) {
        return state == RESERVED;
    }

    function isOpenDispute(uint8 state) internal pure returns (bool) {
        return state == RESERVED;
    }

    function isCureDispute(uint8 state) internal pure returns (bool) {
        return state == DISPUTED;
    }

    function allocationAllowed(uint8 state) internal pure returns (bool) {
        return state == RESERVED || state == DELINQUENT;
    }

    function isMarkDelinquent(uint8 state) internal pure returns (bool) {
        return state == RESERVED;
    }

    function isDeclareDefault(uint8 state) internal pure returns (bool) {
        return state == DISPUTED || state == DELINQUENT;
    }

    function isRelease(uint8 state) internal pure returns (bool) {
        return state == SETTLED;
    }

    /// The due date has passed only when the observation is strictly later.
    function dueDatePassed(uint64 observedAt, uint64 dueDate) internal pure returns (bool) {
        return observedAt > dueDate;
    }
}
