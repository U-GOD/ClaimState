"use client";

import { useState } from "react";

const freight = {
  instrument: "Freight Invoice",
  supplier: "Carrier",
  buyer: "Broker",
};

const compute = {
  instrument: "Compute SLA",
  supplier: "Provider",
  buyer: "Customer",
  note: "Pre-baked acknowledgement on the same kernel.",
};

export function AdapterSwitch() {
  const [adapter, setAdapter] = useState<"freight" | "compute">("freight");
  const selected = adapter === "freight" ? freight : compute;
  return (
    <section>
      <h2>Adapter</h2>
      <button type="button" onClick={() => setAdapter("freight")}>
        Freight Invoice
      </button>{" "}
      <button type="button" onClick={() => setAdapter("compute")}>
        Compute SLA
      </button>
      <p>
        {selected.instrument}. {selected.supplier} and {selected.buyer}. The kernel is unchanged.
      </p>
      {adapter === "compute" ? <p>{compute.note}</p> : null}
    </section>
  );
}
