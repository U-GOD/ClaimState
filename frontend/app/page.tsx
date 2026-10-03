import { chapters } from "../lib/guides";

export default function HomePage() {
  return (
    <main className="content">
      <article className="article">
        <p className="crumb">Overview</p>
        <div className="doc">
          <h1>ClaimState</h1>
          <p className="lead">
            A trucking bill stays on the company&apos;s own computer. Hedera stores a fingerprint of the terms,
            records who signed each step, and allows only one lender to fund it.
          </p>
          <p>
            ClaimState is a privacy-preserving obligation record plus one in-network reservation. It records
            signed lifecycle evidence. It does not issue legal title, perfect a lien, or replace a UCC filing.
          </p>
        </div>
        {chapters.map((chapter) => (
          <section className="overview-chapter" key={chapter.title}>
            <h2>{chapter.title}</h2>
            <div className="overview-grid">
              {chapter.guides.map((guide) => (
                <a className="overview-card" key={guide.slug} href={`/docs/${guide.slug}`}>
                  <strong>{guide.title}</strong>
                  <span>{guide.summary}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
        <footer className="article-foot">Signed lifecycle evidence. Not a title, a lien, or an assignment.</footer>
      </article>
    </main>
  );
}
