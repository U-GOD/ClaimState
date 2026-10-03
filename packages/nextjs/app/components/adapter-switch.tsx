"use client";

import { useState } from "react";

const freight = {
  instrument: "Freight invoice",
  supplier: "carrier",
  buyer: "broker",
};

const compute = {
  instrument: "Compute SLA",
  supplier: "provider",
  buyer: "customer",
  note: "Acknowledged on the same kernel.",
};

export function AdapterSwitch() {
  const [adapter, setAdapter] = useState<"freight" | "compute">("freight");
  const selected = adapter === "freight" ? freight : compute;
  return (
    <div>
      <div className="switch">
        <button type="button" aria-pressed={adapter === "freight"} onClick={() => setAdapter("freight")}>
          Freight invoice
        </button>
        <button type="button" aria-pressed={adapter === "compute"} onClick={() => setAdapter("compute")}>
          Compute SLA
        </button>
      </div>
      <p className="caption">
        {selected.instrument}. {selected.supplier} and {selected.buyer}. Same kernel.
      </p>
      {adapter === "compute" ? <p>{compute.note}</p> : null}
    </div>
  );
}
