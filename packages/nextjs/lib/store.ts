import {
  storySteps,
  emptyReadModel,
  fetchMirrorMessage,
  reconcileSequence,
  upsertConsensus,
  type IndexedEvidence,
  type ReadModel,
} from "@claimstate/indexer";

const model: ReadModel = emptyReadModel();
const localMisses = new Map<string, number>();

for (const step of storySteps()) {
  if (step.publicMessage !== null) {
    upsertConsensus(model, step.publicMessage);
  }
}

export function readModel(): ReadModel {
  return model;
}

export async function reconcile(sequenceNumber: string): Promise<IndexedEvidence> {
  const current = model.byKey.get(sequenceNumber);
  if (current === undefined) {
    throw new Error(`No consensus receipt for sequence ${sequenceNumber}`);
  }
  return reconcileSequence(model, sequenceNumber, async (topicId, sequence) => {
    if (topicId === "0.0.0") {
      const seen = localMisses.get(sequence) ?? 0;
      localMisses.set(sequence, seen + 1);
      if (seen === 0) {
        return { ok: false, status: 404 };
      }
      return { ok: true, status: 200, messageBase64: current.messageBase64 };
    }
    const base = process.env.HEDERA_MIRROR_BASE_URL ?? "https://testnet.mirrornode.hedera.com";
    return fetchMirrorMessage(base, topicId, sequence);
  });
}
