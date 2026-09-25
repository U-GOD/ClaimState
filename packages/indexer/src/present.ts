import { ACTOR_ROLE, STATE_CODE, type EvidenceHeader } from "@claimstate/sdk";

const STATE_NAME = Object.fromEntries(Object.entries(STATE_CODE).map(([name, code]) => [code, name]));
const ROLE_NAME = Object.fromEntries(Object.entries(ACTOR_ROLE).map(([name, code]) => [code, name]));

export interface PublicHeaderView {
  obligationId: string;
  version: string;
  previousState: string;
  newState: string;
  termsRoot: string;
  evidenceHash: string;
  actorRole: string;
  holder: string;
}

export function presentHeader(header: EvidenceHeader): PublicHeaderView {
  return {
    obligationId: header.obligationId,
    version: header.version.toString(),
    previousState: header.previousState === 0 ? "none" : (STATE_NAME[header.previousState] ?? "unknown"),
    newState: STATE_NAME[header.newState] ?? "unknown",
    termsRoot: header.termsRoot,
    evidenceHash: header.evidenceHash,
    actorRole: ROLE_NAME[header.actorRole] ?? "unknown",
    holder: header.holder,
  };
}

export function hashScanTopicUrl(topicId: string): string {
  return `https://hashscan.io/testnet/topic/${topicId}`;
}
