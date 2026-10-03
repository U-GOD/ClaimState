import { encodeEvidenceHeader, type EvidenceHeaderInput } from "@claimstate/sdk";
import { computeSlaPolicy } from "../../../adapters/compute-sla/policy.js";
import { freightPolicy } from "../../../adapters/freight/policy.js";
import type { ConsensusEvidence } from "./read-model.js";

const obligationId = `0x${"ab".repeat(32)}`;
const termsRoot = `0x${"11".repeat(32)}`;
const dilutedTerms = `0x${"22".repeat(32)}`;
const evidenceHash = `0x${"33".repeat(32)}`;
const topicId = "0.0.0";

export const STORY_OBLIGATION_ID = obligationId;
export const STORY_TOPIC_ID = topicId;

export interface StoryStep {
  id: string;
  title: string;
  proof: string;
  localFacts: readonly string[];
  publicMessage: ConsensusEvidence | null;
  reservedError: string | null;
}

export function storySteps(): StoryStep[] {
  const created = message(1, "1700000000.000000000", {
    eventType: "Create",
    obligationId,
    version: 1n,
    previousState: null,
    newState: "DRAFT",
    termsRoot,
    evidenceHash,
    actorRole: "supplier",
  });
  const acknowledged = message(2, "1700000001.000000000", {
    eventType: "Acknowledge",
    obligationId,
    version: 2n,
    previousState: "DRAFT",
    newState: "ACKNOWLEDGED",
    termsRoot,
    evidenceHash,
    actorRole: "buyer",
  });
  const activated = message(3, "1700000002.000000000", {
    eventType: "Activate",
    obligationId,
    version: 3n,
    previousState: "ACKNOWLEDGED",
    newState: "RESERVED",
    termsRoot,
    evidenceHash,
    actorRole: "factor",
  });
  const credit = message(4, "1700000003.000000000", {
    eventType: "CreditNote",
    obligationId,
    version: 4n,
    previousState: "RESERVED",
    newState: "RESERVED",
    termsRoot: dilutedTerms,
    evidenceHash,
    actorRole: "buyer",
  });
  const released = message(6, "1700000005.000000000", {
    eventType: "Release",
    obligationId,
    version: 7n,
    previousState: "SETTLED",
    newState: "RELEASED",
    termsRoot: dilutedTerms,
    evidenceHash,
    actorRole: "factor",
  });
  const computeAck = message(7, "1700000006.000000000", {
    eventType: "Acknowledge",
    obligationId: `0x${"cd".repeat(32)}`,
    version: 2n,
    previousState: "DRAFT",
    newState: "ACKNOWLEDGED",
    termsRoot: `0x${"44".repeat(32)}`,
    evidenceHash,
    actorRole: "buyer",
  });
  return [
    {
      id: "offered-twice",
      title: "Same private invoice offered twice",
      proof: "No document fields in the decoded HCS payload",
      localFacts: [freightPolicy.localFacts.faceAmount, freightPolicy.localFacts.debtorReference],
      publicMessage: created,
      reservedError: null,
    },
    {
      id: "broker-confirms",
      title: "Broker confirms",
      proof: "Terms root and buyer role. The PDF stays local",
      localFacts: [freightPolicy.instrument, freightPolicy.buyerRole],
      publicMessage: acknowledged,
      reservedError: null,
    },
    {
      id: "factor-funds",
      title: "Factor funds 85 percent",
      proof: "One batch: evidence, advance, receipt, contract last",
      localFacts: [freightPolicy.localFacts.advance],
      publicMessage: activated,
      reservedError: null,
    },
    {
      id: "second-factor",
      title: "Second factor",
      proof: "ALREADY_RESERVED, holder not shown",
      localFacts: [],
      publicMessage: null,
      reservedError: "ALREADY_RESERVED",
    },
    {
      id: "short-pay",
      title: "$500 short-pay",
      proof: "Version and terms root change, state stays reserved",
      localFacts: [freightPolicy.localFacts.shortPay],
      publicMessage: credit,
      reservedError: null,
    },
    {
      id: "collection-release",
      title: "Collection report and release",
      proof: "Mirror links for every sequence number",
      localFacts: [freightPolicy.localFacts.carrierReference],
      publicMessage: released,
      reservedError: null,
    },
    {
      id: "compute-sla",
      title: "Switch to Compute SLA",
      proof: "Same kernel, different evidence policy",
      localFacts: [computeSlaPolicy.instrument, computeSlaPolicy.prebakedState, ...computeSlaPolicy.checklist],
      publicMessage: computeAck,
      reservedError: null,
    },
  ];
}

export function assertPublicPayloadOmitsLocalFacts(steps: StoryStep[]): void {
  const forbidden = Object.values(freightPolicy.localFacts);
  for (const step of steps) {
    if (step.publicMessage === null) {
      continue;
    }
    const decoded = Buffer.from(step.publicMessage.message).toString("utf8");
    const hex = Buffer.from(step.publicMessage.message).toString("hex");
    for (const fact of forbidden) {
      if (decoded.includes(fact) || hex.includes(Buffer.from(fact).toString("hex"))) {
        throw new Error(`Public payload contains local fact ${fact}`);
      }
    }
  }
}

function message(sequence: number, consensusTimestamp: string, header: EvidenceHeaderInput): ConsensusEvidence {
  return {
    topicId,
    sequenceNumber: String(sequence),
    consensusTimestamp,
    message: encodeEvidenceHeader(header),
  };
}
