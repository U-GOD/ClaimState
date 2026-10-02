import { notFound } from "next/navigation";
import { evidenceForObligation, hashScanTopicUrl, presentHeader } from "@claimstate/indexer";
import { readModel } from "../../../lib/store";
import { IndexStatus } from "../../demo/index-status";

export default async function ObligationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = evidenceForObligation(readModel(), id);
  if (rows.length === 0) {
    notFound();
  }
  const latest = rows[rows.length - 1];
  if (latest === undefined) {
    notFound();
  }
  const view = presentHeader(latest.header);
  const roles = [...new Set(rows.map((row) => presentHeader(row.header).actorRole))];
  return (
    <main>
      <h1>Obligation</h1>
      <p>
        State {view.newState}. Version {view.version}.
      </p>
      <p>Signer roles: {roles.join(", ")}</p>
      <IndexStatus sequence={latest.sequenceNumber} />
      <table>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sequenceNumber}>
              <th scope="row">
                <a href={hashScanTopicUrl(row.topicId)}>Sequence {row.sequenceNumber}</a>
              </th>
              <td>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <a href="/demo">All steps</a>
      </p>
    </main>
  );
}
