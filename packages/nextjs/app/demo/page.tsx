import { decodeEvidenceHeader } from "@claimstate/sdk";
import { DEMO_OBLIGATION_ID, demoStory, hashScanTopicUrl, presentHeader } from "@claimstate/indexer";
import { AdapterSwitch } from "./adapter-switch";
import { IndexStatus } from "./index-status";

export default function DemoPage() {
  const steps = demoStory();
  return (
    <main>
      <h1>Reference story</h1>
      <p>
        Local commercial facts sit beside the decoded HCS header. The header does not carry the invoice, the
        names, or the amounts.
      </p>
      <AdapterSwitch />
      <IndexStatus sequence="1" />
      <p>
        Obligation <a href={`/obligations/${DEMO_OBLIGATION_ID}`}>{DEMO_OBLIGATION_ID}</a>
      </p>
      {steps.map((step, index) => {
        const header =
          step.publicMessage === null ? null : presentHeader(decodeEvidenceHeader(step.publicMessage.message));
        return (
          <section key={step.id} id={step.id}>
            <h2>
              {index + 1}. {step.title}
            </h2>
            <p>{step.proof}</p>
            <div className="columns">
              <div>
                <h3>Local store</h3>
                {step.localFacts.length === 0 ? <p>No private fact is published for this step.</p> : null}
                <ul>
                  {step.localFacts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Decoded HCS payload</h3>
                {step.reservedError !== null ? <p>{step.reservedError}. Holder not shown.</p> : null}
                {header === null || step.publicMessage === null ? null : (
                  <pre>{JSON.stringify(header, null, 2)}</pre>
                )}
                {step.publicMessage === null ? null : (
                  <p>
                    <a href={hashScanTopicUrl(step.publicMessage.topicId)}>
                      Topic sequence {step.publicMessage.sequenceNumber}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
