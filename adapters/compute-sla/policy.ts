/**
 * Labels and evidence checklist only. The compute path reuses ClaimStateKernel.
 * A pre-baked acknowledgement is an already-acknowledged envelope, not a second contract.
 */
export const computeSlaPolicy = {
  id: "compute-sla",
  instrument: "Compute SLA",
  supplierRole: "Provider",
  buyerRole: "Customer",
  prebakedState: "ACKNOWLEDGED",
  checklist: ["job commitment", "completion window", "buyer acknowledgement"],
} as const;
