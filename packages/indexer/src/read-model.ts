import { decodeEvidenceHeader, holderIsUndisclosed, type EvidenceHeader } from "@claimstate/sdk";

export type IndexStatus = "pending" | "resolved";

export interface ConsensusEvidence {
  topicId: string;
  sequenceNumber: string;
  consensusTimestamp: string;
  message: Uint8Array;
}

export interface IndexedEvidence {
  key: string;
  topicId: string;
  sequenceNumber: string;
  consensusTimestamp: string;
  status: IndexStatus;
  messageBase64: string;
  header: EvidenceHeader;
}

export interface ReadModel {
  byKey: Map<string, IndexedEvidence>;
}

export function emptyReadModel(): ReadModel {
  return { byKey: new Map() };
}

/** Topic sequence number is the upsert key. A second delivery of that sequence is ignored. */
export function upsertConsensus(model: ReadModel, evidence: ConsensusEvidence): { duplicate: boolean } {
  const key = evidence.sequenceNumber;
  if (model.byKey.has(key)) {
    return { duplicate: true };
  }
  if (!holderIsUndisclosed(evidence.message)) {
    throw new Error("Consensus evidence disclosed the reservation holder");
  }
  model.byKey.set(key, {
    key,
    topicId: evidence.topicId,
    sequenceNumber: evidence.sequenceNumber,
    consensusTimestamp: evidence.consensusTimestamp,
    status: "pending",
    messageBase64: Buffer.from(evidence.message).toString("base64"),
    header: decodeEvidenceHeader(evidence.message),
  });
  return { duplicate: false };
}

export function listEvidence(model: ReadModel): IndexedEvidence[] {
  return [...model.byKey.values()].sort((left, right) =>
    BigInt(left.sequenceNumber) < BigInt(right.sequenceNumber) ? -1 : 1,
  );
}

export function evidenceForObligation(model: ReadModel, obligationId: string): IndexedEvidence[] {
  return listEvidence(model).filter(
    (row) => row.header.obligationId.toLowerCase() === obligationId.toLowerCase(),
  );
}
