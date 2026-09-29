import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getBytes, Interface, Wallet } from "ethers";
import {
  Client,
  ContractExecuteTransaction,
  PrivateKey,
  TokenMintTransaction,
  TopicMessageSubmitTransaction,
  TransferTransaction,
} from "@hiero-ledger/sdk";
import {
  ADVANCE_TOKEN_UNITS,
  BatchTooLargeError,
  MAX_OUTER_BATCH_BYTES,
  RECEIPT_METADATA_LABEL,
  buildActivationBatch,
  operationalReceiptMetadata,
} from "./batch-builder.js";
import {
  ACTOR_ROLE,
  EVIDENCE_HEADER_BYTES,
  decodeEvidenceHeader,
  encodeEvidenceHeader,
  holderIsUndisclosed,
} from "./evidence.js";
import { EVENT_TYPE_CODE } from "./events.js";
import { STATE_CODE } from "./machine.js";

const obligationId = `0x${"11".repeat(32)}`;
const termsRoot = `0x${"22".repeat(32)}`;
const evidenceHash = `0x${"33".repeat(32)}`;
const eventId = `0x${"44".repeat(32)}`;
const factorAddress = Wallet.createRandom().address;

test("the activation header is fixed-width and does not disclose the holder", () => {
  const encoded = encodeEvidenceHeader({
    eventType: "Activate",
    obligationId,
    version: 3n,
    previousState: "ACKNOWLEDGED",
    newState: "RESERVED",
    termsRoot,
    evidenceHash,
    actorRole: "factor",
  });
  assert.equal(encoded.length, EVIDENCE_HEADER_BYTES);
  assert.ok(encoded.length < 400);
  assert.equal(holderIsUndisclosed(encoded), true);
  assert.equal(Buffer.from(encoded).includes(Buffer.from(factorAddress.slice(2), "hex")), false);

  const decoded = decodeEvidenceHeader(encoded);
  assert.equal(decoded.schemaVersion, 1);
  assert.equal(decoded.eventType, EVENT_TYPE_CODE.Activate);
  assert.equal(decoded.obligationId, obligationId);
  assert.equal(decoded.version, 3n);
  assert.equal(decoded.previousState, STATE_CODE.ACKNOWLEDGED);
  assert.equal(decoded.newState, STATE_CODE.RESERVED);
  assert.equal(decoded.termsRoot, termsRoot);
  assert.equal(decoded.evidenceHash, evidenceHash);
  assert.equal(decoded.actorRole, ACTOR_ROLE.factor);
  assert.equal(decoded.holder, `0x${"00".repeat(20)}`);
});

test("the activation batch binds the contract call, the header, and the advance", async () => {
  const factor = PrivateKey.generateECDSA();
  const submitKey = PrivateKey.generateECDSA();
  const batchKey = PrivateKey.generateECDSA();
  const client = Client.forNetwork(
    { "127.0.0.1:50211": "0.0.3" },
    { scheduleNetworkUpdate: false },
  );
  client.setOperator("0.0.1001", factor);
  try {
    const built = await buildActivationBatch({
      client,
      batchKey,
      contractId: "0.0.2001",
      topicId: "0.0.2002",
      tokenId: "0.0.2003",
      receiptTokenId: "0.0.2004",
      factorAccountId: "0.0.1001",
      supplierAccountId: "0.0.1002",
      functionParameters: activateCalldata(),
      obligationId,
      termsRoot,
      evidenceHash,
      expectedVersion: 2n,
      submitKey,
    });

    assert.ok(built.outerBytes > 0);
    assert.ok(built.outerBytes <= MAX_OUTER_BATCH_BYTES);
    assert.equal(built.innerTransactionIds.length, 4);
    assert.equal(new Set(built.innerTransactionIds).size, 4);
    for (const id of built.innerTransactionIds) {
      assert.ok(id.startsWith("0.0.1001@"));
    }

    const inners = built.batch.innerTransactions;
    assert.equal(inners.length, 4);
    assert.ok(inners[0] instanceof TopicMessageSubmitTransaction);
    assert.ok(inners[1] instanceof TransferTransaction);
    assert.ok(inners[2] instanceof TokenMintTransaction);
    assert.ok(inners[3] instanceof ContractExecuteTransaction);
    const minted = (inners[2] as TokenMintTransaction).metadata;
    assert.equal(minted.length, 1);
    assert.deepEqual(minted[0], operationalReceiptMetadata(obligationId));
    assert.ok(Buffer.from(minted[0] ?? []).includes(Buffer.from(RECEIPT_METADATA_LABEL)));
    const batchKeyText = batchKey.publicKey.toString();
    for (const inner of inners) {
      assert.equal(inner.batchKey?.toString(), batchKeyText);
    }

    const message = (inners[0] as TopicMessageSubmitTransaction).getMessage();
    assert.ok(message !== null);
    assert.deepEqual(message, built.evidence);
    assert.equal(holderIsUndisclosed(message), true);
    const decoded = decodeEvidenceHeader(message);
    assert.equal(decoded.version, 3n);
    assert.equal(decoded.newState, STATE_CODE.RESERVED);

    const transfers = (inners[1] as TransferTransaction).tokenTransfers._toProtobuf();
    const amounts = transfers.flatMap((entry) => entry.transfers ?? []).map((entry) => entry.amount?.toString());
    assert.deepEqual(amounts.sort(), [(-ADVANCE_TOKEN_UNITS).toString(), ADVANCE_TOKEN_UNITS.toString()].sort());
  } finally {
    client.close();
  }
});

test("an oversized activation batch is refused intact", async () => {
  const factor = PrivateKey.generateECDSA();
  const client = Client.forNetwork(
    { "127.0.0.1:50211": "0.0.3" },
    { scheduleNetworkUpdate: false },
  );
  client.setOperator("0.0.1001", factor);
  try {
    await assert.rejects(
      () =>
        buildActivationBatch({
          client,
          batchKey: PrivateKey.generateECDSA(),
          contractId: "0.0.2001",
          topicId: "0.0.2002",
          tokenId: "0.0.2003",
          receiptTokenId: "0.0.2004",
          factorAccountId: "0.0.1001",
          supplierAccountId: "0.0.1002",
          functionParameters: activateCalldata(),
          obligationId,
          termsRoot,
          evidenceHash,
          expectedVersion: 2n,
          maxOuterBytes: 1,
        }),
      (error: unknown) => {
        assert.ok(error instanceof BatchTooLargeError);
        assert.ok(error.outerBytes > 1);
        assert.equal(error.limit, 1);
        return true;
      },
    );
  } finally {
    client.close();
  }
});

function activateCalldata(): Uint8Array {
  const iface = new Interface([
    "function activate(bytes32 obligationId, address factor, bytes32 eventId, uint64 expectedVersion, bytes supplierSignature, bytes factorSignature)",
  ]);
  return getBytes(
    iface.encodeFunctionData("activate", [
      obligationId,
      factorAddress,
      eventId,
      2n,
      `0x${"ab".repeat(65)}`,
      `0x${"cd".repeat(65)}`,
    ]),
  );
}
