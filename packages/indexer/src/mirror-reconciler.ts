import type { IndexedEvidence, ReadModel } from "./read-model.js";

export interface MirrorMessageResponse {
  ok: boolean;
  status: number;
  messageBase64?: string;
}

/**
 * Consensus is already stored. This only moves pending to resolved when Mirror Node
 * returns the same bytes. A missing message stays pending. A resolved row is left alone.
 */
export async function reconcileSequence(
  model: ReadModel,
  sequenceNumber: string,
  load: (topicId: string, sequenceNumber: string) => Promise<MirrorMessageResponse>,
): Promise<IndexedEvidence> {
  const row = model.byKey.get(sequenceNumber);
  if (row === undefined) {
    throw new Error(`No consensus receipt for sequence ${sequenceNumber}`);
  }
  if (row.status === "resolved") {
    return row;
  }
  const mirrored = await load(row.topicId, row.sequenceNumber);
  if (!mirrored.ok || mirrored.messageBase64 === undefined) {
    return row;
  }
  if (mirrored.messageBase64 !== row.messageBase64) {
    throw new Error(`Mirror message ${sequenceNumber} does not match the consensus receipt`);
  }
  const resolved: IndexedEvidence = { ...row, status: "resolved" };
  model.byKey.set(sequenceNumber, resolved);
  return resolved;
}

export function mirrorMessageUrl(baseUrl: string, topicId: string, sequenceNumber: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/v1/topics/${topicId}/messages/${sequenceNumber}`;
}

export async function fetchMirrorMessage(
  baseUrl: string,
  topicId: string,
  sequenceNumber: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MirrorMessageResponse> {
  const response = await fetchImpl(mirrorMessageUrl(baseUrl, topicId, sequenceNumber));
  if (!response.ok) {
    return { ok: false, status: response.status };
  }
  const body = (await response.json()) as { message?: string };
  if (typeof body.message !== "string" || body.message.length === 0) {
    return { ok: false, status: response.status };
  }
  return { ok: true, status: response.status, messageBase64: body.message };
}
