import { decodeEvidenceHeader } from "@claimstate/sdk";
import {
  STORY_OBLIGATION_ID,
  storySteps,
  hashScanTopicUrl,
  presentHeader,
  type PublicHeaderView,
} from "@claimstate/indexer";
import { AdapterSwitch } from "./components/adapter-switch";
import { IndexStatus } from "./components/index-status";

const FIELDS: { key: keyof PublicHeaderView; label: string }[] = [
  { key: "version", label: "Version" },
  { key: "previousState", label: "Previous state" },
  { key: "newState", label: "State" },
  { key: "termsRoot", label: "Terms root" },
  { key: "evidenceHash", label: "Evidence hash" },
  { key: "actorRole", label: "Actor role" },
  { key: "holder", label: "Holder" },
];

export default function HomePage() {
  const steps = storySteps();
  return (
    <main className="frame">
      <h1>Obligation</h1>
      <p className="lede">
        Buyer-confirmed freight invoice. The public message is the signed header. Amounts and references stay in
        the local store.
      </p>
      <AdapterSwitch />
      <dl className="identity">
        <div>
          <dt>Obligation</dt>
          <dd>
            <a className="mono" href={`/obligations/${STORY_OBLIGATION_ID}`}>
              {STORY_OBLIGATION_ID}
            </a>
          </dd>
        </div>
        <div>
          <dt>Index</dt>
          <dd>
            <IndexStatus sequence="1" />
          </dd>
        </div>
      </dl>
      {steps.map((step, index) => {
        const header =
          step.publicMessage === null ? null : presentHeader(decodeEvidenceHeader(step.publicMessage.message));
        return (
          <section className="step" key={step.id} id={step.id}>
            <div className="step-head">
              <span className="step-no">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{step.title}</h2>
                <p className="proof">{step.proof}</p>
              </div>
            </div>
            <div className="columns">
              <div className="panel">
                <h3>Local store</h3>
                {step.localFacts.length === 0 ? <p>None.</p> : null}
                <ul>
                  {step.localFacts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              </div>
              <div className="panel">
                <h3>Public header</h3>
                {step.reservedError !== null ? (
                  <p className="notice">
                    {step.reservedError}. Holder not shown.
                  </p>
                ) : null}
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
                  <p className="seq">
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
