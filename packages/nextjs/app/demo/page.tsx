import { decodeEvidenceHeader } from "@claimstate/sdk";
import {
  DEMO_OBLIGATION_ID,
  demoStory,
  hashScanTopicUrl,
  presentHeader,
  type PublicHeaderView,
} from "@claimstate/indexer";
import { AdapterSwitch } from "./adapter-switch";
import { IndexStatus } from "./index-status";

const FIELDS: { key: keyof PublicHeaderView; label: string }[] = [
  { key: "version", label: "Version" },
  { key: "previousState", label: "Previous state" },
  { key: "newState", label: "State" },
  { key: "termsRoot", label: "Terms root" },
  { key: "evidenceHash", label: "Evidence hash" },
  { key: "actorRole", label: "Actor role" },
  { key: "holder", label: "Holder" },
];

export default function DemoPage() {
  const steps = demoStory();
  return (
    <main>
      <h1>Obligation</h1>
      <p className="lede">
        Buyer-confirmed freight invoice. The public message is the signed header. Amounts and references stay in
        the local store.
      </p>
      <AdapterSwitch />
      <p>
        <a href={`/obligations/${DEMO_OBLIGATION_ID}`}>{DEMO_OBLIGATION_ID}</a>
      </p>
      <IndexStatus sequence="1" />
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
                {step.localFacts.length === 0 ? <p>None.</p> : null}
                <ul>
                  {step.localFacts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Public header</h3>
                {step.reservedError !== null ? <p>{step.reservedError}. Holder not shown.</p> : null}
                {header === null ? null : (
                  <table>
                    <tbody>
                      {FIELDS.map((field) => (
                        <tr key={field.key}>
                          <th scope="row">{field.label}</th>
                          <td>{header[field.key]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
