// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SignatureLib} from "./libraries/SignatureLib.sol";
import {TransitionLib} from "./libraries/TransitionLib.sol";

/// Obligation state envelope. Not a lien, not Article 12 control, and not an assignment.
/// Authorization is an ECDSA signature over actionDigest. msg.sender pays gas and is not the signer.
contract ClaimStateKernel {
    struct Envelope {
        bytes32 termsRoot;
        bytes32 fingerprint;
        bytes32 amountCommitment;
        address buyer;
        address supplier;
        address factor;
        address paymentAgent;
        uint64 version;
        uint64 dueDate;
        uint8 state;
    }

    /// AlreadyReserved carries no holder. Do not add an address argument.
    error AlreadyReserved();
    error StaleVersion(uint64 stateVersion, uint64 claimedVersion);
    error ReplayedEvent(bytes32 eventId);
    error Unauthorized();
    error IllegalTransition();
    error BeforeDueDate();
    error TermsMismatch();
    error InvalidEvent();

    event Transition(bytes32 indexed obligationId, uint64 version, uint8 previousState, uint8 newState);

    uint8 internal constant EVENT_CREATE = 1;
    uint8 internal constant EVENT_ACKNOWLEDGE = 2;
    uint8 internal constant EVENT_ACTIVATE = 3;
    uint8 internal constant EVENT_CREDIT_NOTE = 4;
    uint8 internal constant EVENT_OPEN_DISPUTE = 5;
    uint8 internal constant EVENT_CURE_DISPUTE = 6;
    uint8 internal constant EVENT_ALLOCATE_PAYMENT = 7;
    uint8 internal constant EVENT_MARK_DELINQUENT = 8;
    uint8 internal constant EVENT_DECLARE_DEFAULT = 9;
    uint8 internal constant EVENT_RELEASE = 10;

    string public constant DOMAIN_TAG = "ClaimState/v1";
    uint256 public constant SCHEMA_VERSION = 1;

    string public topicId;
    string public networkLabel;
    address public immutable kernel;

    mapping(bytes32 obligationId => Envelope) public envelopes;
    mapping(bytes32 obligationId => address executor) public scheduledExecutors;
    mapping(bytes32 obligationId => mapping(bytes32 eventId => bool)) public consumedEvents;

    constructor(string memory topicId_, string memory networkLabel_, address kernel_) {
        if (block.chainid != 296 && block.chainid != 295) revert InvalidEvent();
        if (!_isTopicId(topicId_)) revert InvalidEvent();
        bytes32 label = keccak256(bytes(networkLabel_));
        if (label != keccak256("testnet") && label != keccak256("mainnet")) revert InvalidEvent();
        if (kernel_ == address(0)) revert InvalidEvent();
        topicId = topicId_;
        networkLabel = networkLabel_;
        kernel = kernel_;
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(DOMAIN_TAG, block.chainid, address(this), topicId, SCHEMA_VERSION, networkLabel)
        );
    }

    function create(
        bytes32 obligationId,
        bytes32 termsRoot,
        bytes32 fingerprint,
        bytes32 amountCommitment,
        address buyer,
        address supplier,
        address paymentAgent,
        address scheduledExecutor,
        uint64 dueDate,
        bytes32 eventId,
        uint64 expectedVersion,
        bytes calldata supplierSignature
    ) external {
        Envelope storage existing = envelopes[obligationId];
        if (!TransitionLib.isCreate(existing.state) || existing.version != 0) revert IllegalTransition();
        if (expectedVersion != 0) revert StaleVersion(0, expectedVersion);
        if (
            buyer == address(0) || supplier == address(0) || paymentAgent == address(0)
                || scheduledExecutor == address(0) || dueDate == 0
        ) revert InvalidEvent();

        bytes32 digest = _digest(
            obligationId,
            EVENT_CREATE,
            expectedVersion,
            keccak256(
                abi.encode(
                    obligationId,
                    termsRoot,
                    fingerprint,
                    amountCommitment,
                    buyer,
                    supplier,
                    paymentAgent,
                    scheduledExecutor,
                    dueDate,
                    eventId
                )
            )
        );
        _requireSigner(digest, supplierSignature, supplier);

        envelopes[obligationId] = Envelope({
            termsRoot: termsRoot,
            fingerprint: fingerprint,
            amountCommitment: amountCommitment,
            buyer: buyer,
            supplier: supplier,
            factor: address(0),
            paymentAgent: paymentAgent,
            version: 1,
            dueDate: dueDate,
            state: TransitionLib.DRAFT
        });
        scheduledExecutors[obligationId] = scheduledExecutor;
        consumedEvents[obligationId][eventId] = true;
        emit Transition(obligationId, 1, TransitionLib.NONE, TransitionLib.DRAFT);
    }

    function acknowledge(
        bytes32 obligationId,
        bytes32 termsRoot,
        bytes32 eventId,
        uint64 expectedVersion,
        bytes calldata buyerSignature
    ) external {
        Envelope storage env = _load(obligationId, eventId, expectedVersion);
        if (!TransitionLib.isAcknowledge(env.state)) revert IllegalTransition();
        if (termsRoot != env.termsRoot) revert TermsMismatch();
        _requireSigner(
            _digest(
                obligationId, EVENT_ACKNOWLEDGE, expectedVersion, keccak256(abi.encode(termsRoot, eventId))
            ),
            buyerSignature,
            env.buyer
        );
        _commit(obligationId, env, eventId, TransitionLib.ACKNOWLEDGED, env.factor);
    }

    function activate(
        bytes32 obligationId,
        address factor,
        bytes32 eventId,
        uint64 expectedVersion,
        bytes calldata supplierSignature,
        bytes calldata factorSignature
    ) external {
        Envelope storage env = _load(obligationId, eventId, expectedVersion);
        if (TransitionLib.activateFailsClosed(env.state, env.factor)) revert AlreadyReserved();
        if (factor == address(0)) revert InvalidEvent();
        bytes32 digest = _digest(
            obligationId, EVENT_ACTIVATE, expectedVersion, keccak256(abi.encode(factor, eventId))
        );
        _requireSigner(digest, supplierSignature, env.supplier);
        _requireSigner(digest, factorSignature, factor);
        _commit(obligationId, env, eventId, TransitionLib.RESERVED, factor);
    }

    function creditNote(
        bytes32 obligationId,
        bytes32 termsRoot,
        bytes32 amountCommitment,
        bytes32 eventId,
        uint64 expectedVersion,
        bytes calldata buyerSignature,
        bytes calldata supplierSignature
    ) external {
        Envelope storage env = _load(obligationId, eventId, expectedVersion);
        if (!TransitionLib.isCreditNote(env.state)) revert IllegalTransition();
        bytes32 digest = _digest(
            obligationId,
            EVENT_CREDIT_NOTE,
            expectedVersion,
            keccak256(abi.encode(termsRoot, amountCommitment, eventId))
        );
        _requireSigner(digest, buyerSignature, env.buyer);
        _requireSigner(digest, supplierSignature, env.supplier);
        env.termsRoot = termsRoot;
        env.amountCommitment = amountCommitment;
        _commit(obligationId, env, eventId, TransitionLib.RESERVED, env.factor);
    }

    function openDispute(
        bytes32 obligationId,
        bytes32 evidenceHash,
        bytes32 eventId,
        uint64 expectedVersion,
        bytes calldata buyerSignature
    ) external {
        Envelope storage env = _load(obligationId, eventId, expectedVersion);
        if (!TransitionLib.isOpenDispute(env.state)) revert IllegalTransition();
        _requireSigner(
            _digest(
                obligationId,
                EVENT_OPEN_DISPUTE,
                expectedVersion,
                keccak256(abi.encode(evidenceHash, eventId))
            ),
            buyerSignature,
            env.buyer
        );
        _commit(obligationId, env, eventId, TransitionLib.DISPUTED, env.factor);
    }

    function cureDispute(
        bytes32 obligationId,
        bytes32 evidenceHash,
        bytes32 eventId,
        uint64 expectedVersion,
        bytes calldata buyerSignature
    ) external {
        Envelope storage env = _load(obligationId, eventId, expectedVersion);
        if (!TransitionLib.isCureDispute(env.state)) revert IllegalTransition();
        _requireSigner(
            _digest(
                obligationId,
                EVENT_CURE_DISPUTE,
                expectedVersion,
                keccak256(abi.encode(evidenceHash, eventId))
            ),
            buyerSignature,
            env.buyer
        );
        _commit(obligationId, env, eventId, TransitionLib.RESERVED, env.factor);
    }

    function allocatePayment(
        bytes32 obligationId,
        bool settles,
        bytes32 paymentHash,
        bytes32 eventId,
        uint64 expectedVersion,
        bytes calldata paymentAgentSignature
    ) external {
        Envelope storage env = _load(obligationId, eventId, expectedVersion);
        if (!TransitionLib.allocationAllowed(env.state)) revert IllegalTransition();
        _requireSigner(
            _digest(
                obligationId,
                EVENT_ALLOCATE_PAYMENT,
                expectedVersion,
                keccak256(abi.encode(settles, paymentHash, eventId))
            ),
            paymentAgentSignature,
            env.paymentAgent
        );
        uint8 next = settles ? TransitionLib.SETTLED : env.state;
        _commit(obligationId, env, eventId, next, env.factor);
    }

    function markDelinquent(
        bytes32 obligationId,
        uint64 observedAt,
        bytes32 eventId,
        uint64 expectedVersion,
        bytes calldata executorSignature
    ) external {
        Envelope storage env = _load(obligationId, eventId, expectedVersion);
        if (!TransitionLib.isMarkDelinquent(env.state)) revert IllegalTransition();
        if (observedAt == 0) revert InvalidEvent();
        _requireSigner(
            _digest(
                obligationId,
                EVENT_MARK_DELINQUENT,
                expectedVersion,
                keccak256(abi.encode(observedAt, eventId))
            ),
            executorSignature,
            scheduledExecutors[obligationId]
        );
        if (!TransitionLib.dueDatePassed(observedAt, env.dueDate)) revert BeforeDueDate();
        _commit(obligationId, env, eventId, TransitionLib.DELINQUENT, env.factor);
    }

    function declareDefault(
        bytes32 obligationId,
        bytes32 evidenceHash,
        bytes32 eventId,
        uint64 expectedVersion,
        bytes calldata factorSignature
    ) external {
        Envelope storage env = _load(obligationId, eventId, expectedVersion);
        if (!TransitionLib.isDeclareDefault(env.state)) revert IllegalTransition();
        _requireSigner(
            _digest(
                obligationId,
                EVENT_DECLARE_DEFAULT,
                expectedVersion,
                keccak256(abi.encode(evidenceHash, eventId))
            ),
            factorSignature,
            env.factor
        );
        _commit(obligationId, env, eventId, TransitionLib.DEFAULTED, env.factor);
    }

    function release(
        bytes32 obligationId,
        bytes32 eventId,
        uint64 expectedVersion,
        bytes calldata factorSignature
    ) external {
        Envelope storage env = _load(obligationId, eventId, expectedVersion);
        if (!TransitionLib.isRelease(env.state)) revert IllegalTransition();
        _requireSigner(
            _digest(obligationId, EVENT_RELEASE, expectedVersion, keccak256(abi.encode(eventId))),
            factorSignature,
            env.factor
        );
        _commit(obligationId, env, eventId, TransitionLib.RELEASED, address(0));
    }

    /// Kernel release after settlement. The caller must be the kernel address set at construction.
    function releaseByKernel(bytes32 obligationId, bytes32 eventId, uint64 expectedVersion) external {
        Envelope storage env = _load(obligationId, eventId, expectedVersion);
        if (!TransitionLib.isRelease(env.state)) revert IllegalTransition();
        if (msg.sender != kernel) revert Unauthorized();
        _commit(obligationId, env, eventId, TransitionLib.RELEASED, address(0));
    }

    function _load(bytes32 obligationId, bytes32 eventId, uint64 expectedVersion)
        internal
        view
        returns (Envelope storage env)
    {
        env = envelopes[obligationId];
        if (env.version == 0) revert IllegalTransition();
        if (consumedEvents[obligationId][eventId]) revert ReplayedEvent(eventId);
        if (expectedVersion != env.version) revert StaleVersion(env.version, expectedVersion);
    }

    function _commit(
        bytes32 obligationId,
        Envelope storage env,
        bytes32 eventId,
        uint8 nextState,
        address nextFactor
    ) internal {
        uint8 previous = env.state;
        env.state = nextState;
        env.factor = nextFactor;
        env.version += 1;
        consumedEvents[obligationId][eventId] = true;
        emit Transition(obligationId, env.version, previous, nextState);
    }

    function _digest(bytes32 obligationId, uint8 eventType, uint64 expectedVersion, bytes32 payloadHash_)
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(domainSeparator(), eventType, obligationId, expectedVersion, payloadHash_));
    }

    function _requireSigner(bytes32 digest, bytes calldata signature, address expected) internal pure {
        if (SignatureLib.recover(digest, signature) != expected) revert Unauthorized();
    }

    function _isTopicId(string memory value) internal pure returns (bool) {
        bytes memory text = bytes(value);
        if (text.length < 5 || text[0] != "0" || text[1] != "." || text[2] != "0" || text[3] != ".") {
            return false;
        }
        for (uint256 i = 4; i < text.length; i++) {
            if (text[i] < 0x30 || text[i] > 0x39) return false;
        }
        return true;
    }
}
