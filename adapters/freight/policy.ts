/** Labels and the local commercial checklist. This file does not submit transactions. */
export const freightPolicy = {
  id: "freight",
  instrument: "Freight Invoice",
  supplierRole: "Carrier",
  buyerRole: "Broker",
  localFacts: {
    faceAmount: "$18,500.00",
    advance: "$15,725.00",
    shortPay: "$500.00",
    dueDate: "2026-12-31",
    debtorReference: "debtor-ref-1",
    carrierReference: "carrier-ref-1",
  },
} as const;
