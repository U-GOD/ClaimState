import { strict as assert } from "node:assert";
import { test } from "node:test";
import { decodeEvidenceHeader } from "@claimstate/sdk";
import { fetchMirrorMessage, reconcileSequence } from "./mirror-reconciler.js";
import { emptyReadModel, upsertConsensus } from "./read-model.js";
import { assertPublicPayloadOmitsLocalFacts, storySteps, STORY_OBLIGATION_ID } from "./story.js";

test("consensus is stored pending and a duplicate sequence is ignored", () => {
  const model = emptyReadModel();
  const created = storySteps()[0]?.publicMessage;
  if (created === undefined || created === null) {
    throw new Error("missing create message");
  }
  assert.equal(upsertConsensus(model, created).duplicate, false);
  assert.equal(model.byKey.get("1")?.status, "pending");
  assert.equal(upsertConsensus(model, created).duplicate, true);
  assert.equal(model.byKey.size, 1);
});

test("mirror 404 stays pending and a matching message resolves once", async () => {
  const model = emptyReadModel();
  const created = storySteps()[0]?.publicMessage;
  if (created === undefined || created === null) {
    throw new Error("missing create message");
  }
  upsertConsensus(model, created);
  const pending = await reconcileSequence(model, "1", async () => ({ ok: false, status: 404 }));
  assert.equal(pending.status, "pending");
  const resolved = await reconcileSequence(model, "1", async () => ({
    ok: true,
    status: 200,
    messageBase64: Buffer.from(created.message).toString("base64"),
  }));
  assert.equal(resolved.status, "resolved");
  const again = await reconcileSequence(model, "1", async () => ({ ok: false, status: 404 }));
  assert.equal(again.status, "resolved");
});

test("a mirror body that disagrees with consensus is rejected", async () => {
  const model = emptyReadModel();
  const created = storySteps()[0]?.publicMessage;
  if (created === undefined || created === null) {
    throw new Error("missing create message");
  }
  upsertConsensus(model, created);
  await assert.rejects(
    () => reconcileSequence(model, "1", async () => ({ ok: true, status: 200, messageBase64: "aaaa" })),
    /does not match/,
  );
});

test("the scripted story has seven steps and hides local facts", () => {
  const steps = storySteps();
  assert.equal(steps.length, 7);
  assert.equal(steps[3]?.reservedError, "ALREADY_RESERVED");
  assert.equal(steps[3]?.publicMessage, null);
  assert.equal(
    steps[3]?.liveProof?.href,
    "https://hashscan.io/testnet/transaction/0.0.10835610-1790995730-481411216",
  );
  assertPublicPayloadOmitsLocalFacts(steps);
  const credit = steps[4]?.publicMessage;
  if (credit === null || credit === undefined) {
    throw new Error("missing credit note");
  }
  const header = decodeEvidenceHeader(credit.message);
  assert.equal(header.obligationId, STORY_OBLIGATION_ID);
  assert.equal(header.newState, 3);
  assert.equal(header.holder, `0x${"00".repeat(20)}`);
});

test("fetchMirrorMessage reads the mirror REST message field", async () => {
  const result = await fetchMirrorMessage("https://mirror.example", "0.0.1", "4", async (url) => {
    assert.equal(url, "https://mirror.example/api/v1/topics/0.0.1/messages/4");
    return new Response(JSON.stringify({ message: "YWI=" }), { status: 200 });
  });
  assert.equal(result.ok, true);
  assert.equal(result.messageBase64, "YWI=");
});
