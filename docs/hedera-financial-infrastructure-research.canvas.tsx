import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Code,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Link,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasAction,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type Candidate = {
  opportunity: string;
  customer: string;
  primitive: string;
  hedera: string;
  competitors: string;
  verdict: string;
  survive: boolean;
};

const candidates: Candidate[] = [
  {
    opportunity: "Shared obligation lifecycle and control plane",
    customer: "Factoring platforms, private-credit servicers, enterprise finance teams",
    primitive: "Obligation State Envelope with operational reservation and event-sourced state",
    hedera: "HCS + smart contracts + HIP-551 + HSS + Mirror Node; HTS optional",
    competitors: "ACTUS, MonetaGo, TradeTrust, Centrifuge — each covers only one layer",
    verdict: "Survives only with a narrow wedge: buyer-confirmed invoices, one jurisdiction, one factor, controlled collections",
    survive: true,
  },
  {
    opportunity: "Cross-financier duplicate-invoice registry",
    customer: "Banks and factors",
    primitive: "Confidential invoice fingerprint collision check",
    hedera: "HCS commitments and ordered first-registration",
    competitors: "MonetaGo Secure Financing is live through SWIFT and national registries",
    verdict: "Reject as standalone; MonetaGo moved from DLT to confidential cloud, proving deduplication alone does not need a chain",
    survive: false,
  },
  {
    opportunity: "Tokenized-collateral operating system",
    customer: "Banks, asset managers, derivatives desks",
    primitive: "Eligibility, allocation, substitution, release, and optimization state",
    hedera: "HTS control + atomic transfers + HCS audit",
    competitors: "Archax Nest, Ownera FinP2P, DTCC, Broadridge DLR",
    verdict: "Strong market, but Hedera already has credible production pilots; partner-dependent MVP",
    survive: false,
  },
  {
    opportunity: "Intraday collateral substitution auctions",
    customer: "CCPs, derivatives dealers, clearing brokers",
    primitive: "Timed replacement auction preserving margin coverage",
    hedera: "Fast finality and atomic HTS asset swaps",
    competitors: "Institutional collateral platforms and CCP workflows",
    verdict: "Valuable but cannot prove the mechanism credibly without a CCP or clearing-member integration",
    survive: false,
  },
  {
    opportunity: "Liquidity-saving settlement windows",
    customer: "Tokenized exchanges, stablecoin settlement networks",
    primitive: "Queued multilateral netting followed by atomic DvP",
    hedera: "HCS ordering + Solidity netting + HIP-551 batch settlement",
    competitors: "Fnality, Partior, CLS, Project Agorá-style designs",
    verdict: "Survives shortlist, but requires legal novation and concentrated network adoption",
    survive: true,
  },
  {
    opportunity: "Settlement-liquidity rights market",
    customer: "Market makers on instant-settlement venues",
    primitive: "Intraday committed liquidity and draw rights",
    hedera: "Scheduled funding, HTS collateral, deterministic fees",
    competitors: "Intraday credit lines, repo, prime brokerage",
    verdict: "Real second-order problem, but regulated balance-sheet providers are prerequisite",
    survive: false,
  },
  {
    opportunity: "Corporate-action event router",
    customer: "Issuers, transfer agents, custodians, fund administrators",
    primitive: "Canonical event, election, entitlement, and completion state machine",
    hedera: "HCS source event + HTS entitlement + scheduled execution",
    competitors: "DTCC ComposerX, ISO 20022 vendors, Hedera Asset Tokenization Studio",
    verdict: "Survives shortlist, but risks duplicating ATS and entrenched data vendors",
    survive: true,
  },
  {
    opportunity: "Tokenized-asset servicing subledger",
    customer: "Asset managers and fund administrators",
    primitive: "Reconciliation-grade lifecycle subledger across onchain and offchain books",
    hedera: "Mirror Node read model + HCS exception log",
    competitors: "DTCC LedgerScan, fund-admin platforms, Ownera",
    verdict: "Useful software, weak protocol differentiation; mostly middleware",
    survive: false,
  },
  {
    opportunity: "Deep-tier supply-chain finance graph",
    customer: "Anchor buyers and lower-tier suppliers",
    primitive: "Buyer credit propagated through verified PO and receivable dependencies",
    hedera: "Obligation graph on HCS with HTS control certificates",
    competitors: "Taulia, C2FO, PrimeRevenue, TReDS",
    verdict: "Best implemented as a vertical adapter on the obligation lifecycle kernel",
    survive: false,
  },
  {
    opportunity: "Programmable guarantees and performance bonds",
    customer: "Surety carriers, banks, contractors, procurement platforms",
    primitive: "Bonded performance obligation with evidence-driven claim state",
    hedera: "HTS bond collateral + HCS evidence + scheduled release",
    competitors: "Surety2000, Bond-Pro, digital bank guarantees",
    verdict: "Survives shortlist; strong adapter, but underwriting capital and subjective claims limit the core",
    survive: true,
  },
  {
    opportunity: "Trade-document event bus",
    customer: "Banks, carriers, ports, exporters",
    primitive: "Portable evidence state across invoice, bill of lading, customs, and payment events",
    hedera: "HCS ordering and immutable commitments",
    competitors: "TradeTrust, SGTraDex, Komgo, ICC DSI standards",
    verdict: "Prior consortia failed on governance and adoption; too broad without a transaction wedge",
    survive: false,
  },
  {
    opportunity: "Controllable electronic-record vault",
    customer: "Lenders issuing UCC Article 12 instruments",
    primitive: "Exclusive control, transfer, and surrender of a CER",
    hedera: "KYC-gated HTS control NFT and smart-contract escrow",
    competitors: "TradeTrust title escrow and token registries",
    verdict: "Important legal adapter, not sufficiently broad as the standalone protocol",
    survive: false,
  },
  {
    opportunity: "Stablecoin treasury control plane",
    customer: "Cross-border fintechs and corporate treasury teams",
    primitive: "Policy, reconciliation, liquidity buffers, and ERP journal state",
    hedera: "HCS audit and scheduled HTS sweeps",
    competitors: "Fireblocks, BVNK, Bridge, Eco, ERP middleware vendors",
    verdict: "Crowded software category; chain choice is not structurally decisive",
    survive: false,
  },
  {
    opportunity: "Cross-stablecoin liquidity buffer coordinator",
    customer: "Payment processors and issuers",
    primitive: "Target balances and emergency rebalancing commitments",
    hedera: "Scheduled transactions and atomic swaps",
    competitors: "Treasury management and intent routers",
    verdict: "Mostly an execution application; not a new financial primitive",
    survive: false,
  },
  {
    opportunity: "Counterparty exposure graph",
    customer: "Lenders, insurers, asset managers",
    primitive: "Shared concentration and dependency commitments",
    hedera: "HCS attested exposures and Mirror Node analytics",
    competitors: "Credit bureaus, risk vendors, internal data lakes",
    verdict: "Privacy and truthful-reporting problem dominates; ledger does not create the data",
    survive: false,
  },
  {
    opportunity: "Policy-bound agent guarantee envelope",
    customer: "Enterprise agent platforms and procurement teams",
    primitive: "Agent authority, escrow, indemnity, and revocable mandate",
    hedera: "HSS multi-signature + HTS budget token + HCS action receipts",
    competitors: "Agent wallets, policy engines, ERC-8004-style identity",
    verdict: "Survives shortlist as an adapter; market is early and identity/authority projects are crowded",
    survive: true,
  },
  {
    opportunity: "Agent working-capital line",
    customer: "Autonomous procurement and marketplace operators",
    primitive: "Policy-limited revolving credit against receivables",
    hedera: "HTS credit line + HCS activity evidence",
    competitors: "No mature direct market; conventional corporate cards are substitute",
    verdict: "Premature: no proven agent borrower base or enforceable recovery path",
    survive: false,
  },
  {
    opportunity: "Compute delivery performance warrant",
    customer: "AI labs, neoclouds, compute lenders",
    primitive: "Bonded future compute obligation with attested delivery",
    hedera: "HCS SLA evidence + HTS warrant + scheduled settlement",
    competitors: "CME compute futures, Compute Exchange, USD.AI, GAIB",
    verdict: "Compelling vertical adapter on the obligation kernel; too specialized for the best template",
    survive: false,
  },
  {
    opportunity: "GPU offtake encumbrance registry",
    customer: "Compute-credit funds and neocloud lenders",
    primitive: "No-double-pledge state for hardware and contracted cashflows",
    hedera: "HCS device/offtake commitments and exclusive claim control",
    competitors: "USD.AI underwriting, asset registries",
    verdict: "Valuable but depends on trustworthy hardware identity and legal fleet control",
    survive: false,
  },
  {
    opportunity: "Parametric SLA surety",
    customer: "Cloud providers and enterprise buyers",
    primitive: "Pre-funded service-level guarantee",
    hedera: "HCS telemetry commitments + HTS reserve",
    competitors: "Service credits and specialty insurance",
    verdict: "Oracle quality and correlated failure dominate; use as an adapter",
    survive: false,
  },
  {
    opportunity: "Stablecoin FX PvP netting",
    customer: "Cross-border payment companies and FX market makers",
    primitive: "Bilateral or multilateral payment-versus-payment obligation set",
    hedera: "HCS queue + atomic HTS settlement",
    competitors: "CLS, Partior, wholesale stablecoin networks",
    verdict: "Large market, but liquidity and licensing—not software—are the scarce assets",
    survive: false,
  },
  {
    opportunity: "Intercompany treasury sweep network",
    customer: "Multinationals",
    primitive: "Programmable intercompany receivable/payable and cash-pool state",
    hedera: "Scheduled HTS transfers and HCS journals",
    competitors: "Bank cash-pooling and treasury-management systems",
    verdict: "Strong enterprise app, weak shared-protocol requirement",
    survive: false,
  },
  {
    opportunity: "Private-credit covenant monitor",
    customer: "Direct lenders and loan agents",
    primitive: "Machine-readable covenant, evidence, cure, waiver, and default state",
    hedera: "HCS evidence timeline + HSS waiver signatures",
    competitors: "Loan servicing and portfolio-monitoring SaaS",
    verdict: "Excellent obligation-kernel adapter; insufficient alone without reliable data feeds",
    survive: false,
  },
  {
    opportunity: "Loan participation servicing standard",
    customer: "Private-credit funds and loan agents",
    primitive: "Transferable participation plus shared cashflow and amendment state",
    hedera: "HTS participation controls + HCS servicing log",
    competitors: "Versana, ClearPar, private-credit platforms",
    verdict: "Regulated and commercially relevant, but narrow for a reusable public template",
    survive: false,
  },
  {
    opportunity: "Securities-lending locate and recall registry",
    customer: "Prime brokers, custodians, tokenized-equity venues",
    primitive: "Exclusive locate, borrow state, recall, and return obligation",
    hedera: "HTS locate certificate + HCS recalls",
    competitors: "Traditional agent-lender systems and emerging tokenized collateral networks",
    verdict: "Interesting whitespace, but no initial Hedera securities-borrow market to bootstrap",
    survive: false,
  },
  {
    opportunity: "Insurance claim coordination log",
    customer: "Carriers, brokers, claims administrators",
    primitive: "Shared evidence, reservation, subrogation, and payout state",
    hedera: "HCS evidence chain + scheduled HTS payout",
    competitors: "Claims-management platforms and parametric insurance",
    verdict: "Generic workflow; insurer adoption and private data outweigh chain benefits",
    survive: false,
  },
  {
    opportunity: "Carbon delivery obligation registry",
    customer: "Project developers, offtakers, carbon financiers",
    primitive: "Forward delivery, verification, replacement, and retirement obligation",
    hedera: "Guardian evidence + obligation state + HTS units",
    competitors: "Hedera Guardian and carbon marketplaces",
    verdict: "Guardian already owns the evidence layer; use obligation kernel as financing adapter",
    survive: false,
  },
];

const sources = [
  ["FCI 2025 factoring statistics", "https://fci.nl/en/news/fci-releases-2025-world-industry-statistics-global-factoring-market-surpasses-eu4-trillion?language_content_entity=en"],
  ["ADB 2025 Trade Finance Gap Survey", "https://www.adb.org/publications/adb-global-trade-finance-gap-survey"],
  ["SFNet systemic resilience report", "https://www.sfnet.com/docs/default-source/uploadedfiles/systemic-resilience-in-secured-finance.pdf"],
  ["MonetaGo Secure Financing", "https://www.monetago.com/products"],
  ["MonetaGo migration from DLT to confidential cloud", "https://magazine.factoring.org/news/monetago-and-sbi-factors-announce-partnership-to-strengthen-fraud-prevention-in-trade-finance"],
  ["Singapore Trade Finance Registry", "https://www.gtreview.com/news/asia/singapores-anti-fraud-trade-registry-eyes-expansion/"],
  ["TradeTrust overview", "https://www.tradetrust.io/about/what-is-tradetrust/"],
  ["ACTUS technical specification", "https://www.actusfrf.org/techspecs"],
  ["UCC Article 12 overview", "https://www.wolterskluwer.com/en/expert-insights/uniform-commercial-code-ucc-amended-to-address-emerging-technologies"],
  ["DTCC corporate-actions costs", "https://www.dtcc.com/insights/2025/staggering-stats-understanding-inefficiencies-within-corporate-actions-processing"],
  ["IMF Tokenized Finance 2026", "https://www.elibrary.imf.org/view/journals/068/2026/001/article-A001-en.xml"],
  ["Hedera HCS message submission", "https://docs.hedera.com/native/consensus/submit-message"],
  ["Hedera network fee schedule", "https://docs.hedera.com/networks/fees"],
  ["Hedera HTS system contract", "https://docs.hedera.com/evm/hedera-services/system-contracts/hts"],
  ["HIP-551 atomic batches", "https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-551.md"],
  ["Hedera scheduled transactions", "https://docs.hedera.com/learn/core-concepts/transactions/scheduled"],
  ["create-scaffold-hbar source and schema", "https://github.com/hedera-dev/create-scaffold-hbar"],
  ["Hedera Mirror Node topic API", "https://docs.hedera.com/reference/rest-api/topics"],
  ["Scaffold-HBAR external templates", "https://docs.hedera.com/solutions/tools/scaffold-hbar"],
  ["Hedera Harness", "https://github.com/hedera-dev/hedera-harness"],
  ["ETHGlobal: Finvoice", "https://ethglobal.com/showcase/finvoice-xu0sz"],
  ["ETHGlobal: Seed Finance", "https://ethglobal.com/showcase/seed-finance-c2tnd"],
  ["ETHGlobal: Credit3", "https://ethglobal.com/showcase/credit3-60xmu"],
  ["ETHGlobal: Pagga", "https://ethglobal.com/showcase/pagga-b0szs"],
  ["ETHGlobal: Amino Hooks", "https://ethglobal.com/showcase/amino-hooks-wo9pp"],
  ["ETHGlobal: TINT Stream SDK", "https://ethglobal.com/showcase/tint-stream-sdk-v0sk3"],
  ["ETHGlobal: Human as a Service", "https://ethglobal.com/showcase/human-as-a-service-3jd8e"],
  ["ETHGlobal: Folio", "https://ethglobal.com/showcase/folio-xh7ak"],
];

function Bullet({ children }: { children: string }) {
  const theme = useHostTheme();
  return (
    <Row gap={8} align="start">
      <span style={{ color: theme.accent.primary, lineHeight: "20px" }}>•</span>
      <Text style={{ margin: 0 }}>{children}</Text>
    </Row>
  );
}

function ArchitectureFlow() {
  const theme = useHostTheme();
  const items = [
    ["ERP / e-invoice / servicing adapter", "Canonicalize terms; obtain buyer acknowledgement; keep documents private"],
    ["ClaimState SDK", "Build signed event and HIP-551 atomic batch; query duplicate/reservation state"],
    ["HCS evidence journal", "Publicly readable 1,024-byte commitments with aBFT order, timestamp, sequence, running hash, and role-gated submission"],
    ["Solidity obligation kernel", "State machine, versioning, operational reservation slot, dispute and default logic"],
    ["Optional HTS evidence receipt", "KYC-gated operational receipt only; never presented as legal title or perfection"],
    ["HSS + settlement adapter", "Collect required signatures; execute dated transfers when applicable"],
    ["Mirror Node read model", "Materialize lifecycle after indexing lag; reconcile receipts and feed ERP/investor reporting"],
  ];
  return (
    <Stack gap={8}>
      {items.map(([name, detail], index) => (
        <div key={name}>
          <Grid columns="210px 1fr" gap={12} style={{ alignItems: "center" }}>
            <div style={{ padding: 10, background: theme.fill.tertiary, borderRadius: 6 }}>
              <Text weight="semibold" style={{ margin: 0 }}>{name}</Text>
            </div>
            <Text tone="secondary" style={{ margin: 0 }}>{detail}</Text>
          </Grid>
          {index < items.length - 1 ? (
            <div style={{ marginLeft: 101, height: 14, borderLeft: `1px solid ${theme.stroke.secondary}` }} />
          ) : null}
        </div>
      ))}
    </Stack>
  );
}

function Executive() {
  return (
    <Stack gap={18}>
      <Callout tone="success" title="Committed concept">
        <Text>
          <Text weight="bold">ClaimState</Text> is a shared lifecycle and control plane for private financial obligations.
          It turns a buyer-acknowledged invoice, purchase order, guarantee, covenant, SLA, or private-credit payment into
          a machine-readable state object that can be attested, operationally reserved, assigned, serviced, disputed,
          and settled without placing the commercial document on a public ledger.
        </Text>
      </Callout>

      <Grid columns="1.4fr 1fr" gap={16}>
        <Stack gap={10}>
          <H2>Why this problem is expensive</H2>
          <Bullet>Global factoring turnover exceeded €4.039 trillion in 2025.</Bullet>
          <Bullet>The 2025 trade-finance gap remained $2.5 trillion, about 10% of merchandise trade.</Bullet>
          <Bullet>UCC filings establish priority over broad collateral classes but do not identify or monitor individual invoices.</Bullet>
          <Bullet>Tokenization platforms can issue claims, but the underlying obligation still lives across ERP, email, legal documents, lender systems, and payment rails.</Bullet>
          <Bullet>The missing infrastructure is not another invoice token. It is one neutral, versioned state for the obligation and every claim against it.</Bullet>
        </Stack>
        <Card size="lg">
          <CardHeader>The wedge</CardHeader>
          <CardBody>
            <Stack gap={12}>
              <Stat value="€4.039T" label="2025 global factoring turnover" />
              <Divider />
              <Stat value="$2.5T" label="Unmet global trade-finance demand" tone="warning" />
              <Divider />
              <Stat value="40+" label="Banks already using Singapore's duplicate-finance registry" />
              <Text tone="secondary" size="small">
                Duplicate detection is proven demand, not whitespace. ClaimState starts after validation and coordinates
                the obligation's complete lifecycle.
              </Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Callout tone="info" title="Novel protocol, concrete commercial wedge">
        The ETHGlobal whitespace leader is a reusable programmable-obligation and performance-bond kernel. The strongest
        first customer is narrower: one factor financing buyer-confirmed freight invoices. ClaimState keeps the general
        state machine in the scaffold while using receivables to prove measurable loss prevention, servicing, and recovery.
      </Callout>

      <H2>The new primitive</H2>
      <Grid columns={3} gap={12}>
        <Card>
          <CardHeader>Obligation State Envelope</CardHeader>
          <CardBody>
            <Text>A signed, versioned commitment to terms, roles, lifecycle evidence, governing-law hooks, and settlement instructions. It is an evidence envelope—not the receivable itself.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Operational Reservation Slot</CardHeader>
          <CardBody>
            <Text>One active in-network financing reservation per obligation, changed only through an atomic compare-and-set transition. It does not determine statutory priority.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Consensus Evidence Journal</CardHeader>
          <CardBody>
            <Text>An ordered HCS history of acknowledgements, assignments, disputes, credit notes, payments, waivers, defaults, and releases—containing commitments, not documents.</Text>
          </CardBody>
        </Card>
      </Grid>

      <H2>Why the template can win</H2>
      <Table
        headers={["Rubric", "What ClaimState demonstrates"]}
        rows={[
          ["Ecosystem integration · 35%", "Removing HCS destroys the neutral event history; removing atomic batches breaks state/evidence/digital-settlement consistency; HSS supports dated multi-party actions and HTS is an optional evidence receipt."],
          ["Documentation · 30%", "A developer learns a reusable obligation-state pattern, adapters, privacy boundaries, legal limits, failure recovery, and testnet verification—not just a UI."],
          ["Code quality · 20%", "Typed event schemas, invariant-tested state machine, idempotent indexer, role adapters, deterministic deployment, CI, security tests, and explicit error taxonomy."],
          ["Hedera depth · 15%", "HCS, Smart Contract Service, HIP-551 atomic batches, HSS, and Mirror Node each perform a distinct load-bearing role; HTS demonstrates an optional controlled receipt without legal-title claims."],
        ]}
        striped
      />
    </Stack>
  );
}

function Research() {
  return (
    <Stack gap={18}>
      <H2>ETHGlobal competitive intelligence</H2>
      <Callout tone="warning" title="ETHOnline 2026 indexing limitation">
        The installed ETHGlobal Search API currently returns an empty project list for the exact event name
        <Code>ETHOnline 2026</Code>. No 2026 ETHOnline projects or winners should be claimed until the corpus is populated.
        Eighty rate-limited API requests across recent indexed events produced 1,652 unique project URLs, although 100-result
        caps and lexical keyword matching mean this is a competitive sample rather than the complete corpus.
      </Callout>
      <Grid columns="1fr 1fr" gap={16}>
        <Stack gap={8}>
          <H3>Repeated patterns</H3>
          <Bullet>Natural-language agents executing existing DeFi actions.</Bullet>
          <Bullet>Agent wallets, policy controls, and transaction guards.</Bullet>
          <Bullet>Generic stablecoin payments and x402 micropayments.</Bullet>
          <Bullet>Invoice-financing pools with buyer approval and stablecoin liquidity.</Bullet>
          <Bullet>RWA issuance, tokenization, and marketplaces.</Bullet>
          <Bullet>Prediction markets, cross-chain swaps, and LP-management bots.</Bullet>
        </Stack>
        <Stack gap={8}>
          <H3>Verified whitespace signals</H3>
          <Bullet>Exact lexical searches returned zero hits for “programmable obligation,” “performance bond,” “corporate actions,” and “credit insurance.”</Bullet>
          <Bullet>Only 12 netting, 4 DvP, and 1 securities-lending results surfaced; most netting examples were swap or state-channel specific.</Bullet>
          <Bullet>Receivable returned 10 projects, but they rebuild invoice NFTs, vaults, underwriting, and payouts without shared portfolio controls.</Bullet>
          <Bullet>Agent finance overwhelmingly means wallets, x402, swaps, auto-yield, or spending policy—not underwriting, default, claims, or recovery.</Bullet>
          <Bullet>Recent finalist selection favors a complete vertical workflow, so the reusable kernel needs the vivid freight-invoice reference workflow.</Bullet>
        </Stack>
      </Grid>

      <H2>Closest hackathon projects—and the layer still missing</H2>
      <Table
        headers={["Project", "What it validates", "Why it does not occupy ClaimState"]}
        rows={[
          ["Finvoice · Cannes 2026", "HCS event-sourced invoice state, HTS receipts, encrypted invoice workflow", "Single factoring product; no shared portfolio controls, legal adapters, or cross-financier lifecycle kernel"],
          ["Seed Finance · HackMoney 2026", "Invoice lifecycle, ERC-4626 liquidity, stablecoin settlement", "Operator-triggered flows and weak authenticity/default handling; financing venue rather than neutral state"],
          ["Pagga · Buenos Aires", "Agent credit auctions, escrow, streams, and compute-finance demand", "Mocked liquidity and simplistic reputation; no bonded performance evidence or reusable recovery state"],
          ["Amino Hooks · HackMoney 2026", "Bonded agent accountability and slashing", "Specific to AMM flow toxicity rather than general milestones, cure, claims, and loss allocation"],
          ["TINT Stream SDK · HackMoney 2026", "Private commitments, residual netting, state-channel settlement", "Swap-centric and solver-dependent; limited default and settlement-failure management"],
          ["Human as a Service · Cannes 2026", "HCS lifecycle, scheduled transactions, reconciliation, conditional work", "Vertical marketplace with central database/admin key; no asset-independent obligation SDK"],
          ["Folio · Cannes 2026", "HTS assets, HCS audit, spend notes, pricing logic", "Mock custody/legal settlement and no underlying-obligation or corporate-action control plane"],
        ]}
        striped
      />
      <Text tone="secondary" size="small">
        These adjacent projects were not present in their events' finalist responses. The API exposes sponsor prizes only
        under sponsor/prize queries, so absence from the finalist index is not evidence that a project won no bounty.
      </Text>

      <H2>Things we absolutely should not build</H2>
      <Table
        headers={["Crowded idea", "Why reject it"]}
        rows={[
          ["AI trading or portfolio agent", "Hundreds of submissions put language models on existing venues; no new infrastructure."],
          ["Agent wallet or spending-policy UI", "Useful but saturated; the missing layer is the obligation and guarantee an agent can enter."],
          ["Generic payment or x402 agent", "Dominant recent pattern; payment authorization is not credit, control, or servicing."],
          ["Generic RWA / invoice tokenization", "Centrifuge, Polytrade, Huma, InvoiceMate, cSigma and Hedera ATS already address issuance and pools."],
          ["Duplicate-invoice checker", "MonetaGo is live via SWIFT, India, Singapore, and other national implementations."],
          ["Bond/equity tokenizer", "Explicitly duplicated by Hedera Asset Tokenization Studio."],
          ["Stablecoin, payout, dividend, coupon app", "Stablecoin Studio and Mass Payout already cover the base capability."],
          ["Generic lending or yield pool", "Crowded and fails the template's 'missing infrastructure' standard."],
          ["Cross-chain swap / intent router", "Extensively built; chain connectivity is not the financial primitive."],
          ["Dashboard-only risk product", "Observability without authoritative shared state or executable controls is middleware."],
          ["Simple HCS audit wrapper", "Ordered logs without a deterministic financial state machine, signer policy, and recovery path are not infrastructure."],
          ["Hardcoded vertical escrow", "A marketplace-specific dispute flow is not the reusable obligation, claim, and loss-allocation primitive."],
        ]}
        striped
      />

      <H2>Current-market evidence</H2>
      <Table
        headers={["Fact", "Design implication"]}
        rows={[
          ["Factoring turnover reached €4.039T in 2025.", "The first market is already enormous; no speculative adoption assumption is required."],
          ["ADB estimates a $2.5T trade-finance gap and 41% SME rejection rate.", "Better verifiability and servicing can lower operational/information costs, but cannot replace credit capacity."],
          ["SFNet found billing-integrity schemes in about 58% of 26 examined fraud cases.", "Lifecycle evidence and buyer acknowledgement matter; a token alone proves nothing."],
          ["MonetaGo has processed hundreds of billions, reaches 11,000+ SWIFT members, and migrated its duplicate checker from DLT to confidential cloud.", "Deduplication is not the blockchain thesis; expose a MonetaGo adapter and focus Hedera on multiparty lifecycle ordering."],
          ["Singapore's registry has 40+ banks and activity grew 70% year-on-year.", "Shared validation works when embedded into existing workflows, not when institutions migrate to a new marketplace."],
          ["India TReDS financed roughly ₹3.47 lakh crore in FY2025–26 with buyer-confirmed obligations.", "Buyer acknowledgement is a proven operational prerequisite, not an unrealistic protocol demand."],
          ["33 US states had enacted 2022 UCC amendments by end-2025; New York became effective June 2026.", "A technical receipt is only evidence; legal effect still requires debtor agreement, assignment/perfection steps, and jurisdiction-specific documents."],
          ["Atomic settlement can sacrifice netting that reduces cash movement by up to 98%.", "The obligation layer should support deferred/netted settlement policies rather than blindly force T+0."],
          ["Corporate actions cost the industry an estimated $58B annually.", "A canonical event kernel is important, but DTCC and Hedera ATS make it a weaker first wedge."],
        ]}
        striped
      />
    </Stack>
  );
}

function CandidateSpace() {
  return (
    <Stack gap={14}>
      <H2>Twenty-seven opportunities considered</H2>
      <Text tone="secondary">
        “Survives” means serious enough for the five-candidate shortlist, not that it wins. Rejected ideas can reappear as vertical adapters on ClaimState.
      </Text>
      <Table
        headers={["Opportunity", "Customer", "Primitive", "Hedera fit", "Competitor / fatal weakness", "Verdict"]}
        rows={candidates.map(candidate => [
          candidate.opportunity,
          candidate.customer,
          candidate.primitive,
          candidate.hedera,
          candidate.competitors,
          candidate.verdict,
        ])}
        rowTone={candidates.map(candidate => candidate.survive ? "success" : "neutral")}
        striped
        stickyHeader
        style={{ maxHeight: 760, overflow: "auto" }}
      />
    </Stack>
  );
}

function Shortlist() {
  const rows = [
    [
      "ClaimState obligation lifecycle kernel",
      "€4T factoring plus private credit, guarantees, SLAs",
      "No open shared evidence state from acknowledgement through reservation, servicing, dispute, and release",
      "HCS, contracts, HIP-551, HSS, and Mirror Node map naturally; HTS stays optional",
      "First value inside one originator; network effect compounds",
      "Survives",
    ],
    [
      "Liquidity-saving settlement windows",
      "Tokenized exchanges and payment networks",
      "Instant gross settlement destroys netting and raises pre-funding",
      "HCS queue + atomic batch settlement",
      "Legal novation, default fund, and dense participant network required",
      "Killed",
    ],
    [
      "Corporate-action event router",
      "$58B annual servicing-cost problem",
      "Canonical source event and elections",
      "HCS is an excellent event backbone",
      "DTCC is modernizing; Hedera ATS already performs lifecycle actions",
      "Killed",
    ],
    [
      "Programmable guarantee network",
      "Surety, procurement, cloud SLA, trade guarantees",
      "Evidence-driven bonded obligation",
      "HTS reserve + HCS evidence + HSS release",
      "Subjective claims and underwriting capital dominate; best as adapter",
      "Killed",
    ],
    [
      "Policy-bound agent guarantee envelope",
      "Autonomous procurement and enterprise agents",
      "Delegated authority plus indemnity and recovery",
      "Native schedules, budgets, and receipts",
      "Market too early; identity/policy projects are crowded; no proven borrower base",
      "Killed",
    ],
  ];
  return (
    <Stack gap={18}>
      <H2>Five-candidate kill test</H2>
      <Table
        headers={["Candidate", "Market importance", "Novelty", "Hedera", "Fatal test", "Result"]}
        rows={rows}
        rowTone={["success", "danger", "danger", "danger", "danger"]}
        striped
      />
      <H2>Why ClaimState survives</H2>
      <Grid columns="1fr 1fr" gap={14}>
        <Stack gap={8}>
          <Bullet>It is not another financing venue; existing venues become clients.</Bullet>
          <Bullet>It produces standalone value before network scale: audit history, buyer acknowledgement, settlement automation, and investor reporting.</Bullet>
          <Bullet>It becomes more valuable with adoption because participating originators and lenders can rely on the same signed envelope and reservation history.</Bullet>
          <Bullet>It uses existing legal and data standards rather than inventing a new legal claim.</Bullet>
          <Bullet>Its core mechanism is demonstrable with real testnet transactions in under three minutes.</Bullet>
        </Stack>
        <Callout tone="warning" title="The limitation that must stay in the pitch">
          ClaimState cannot detect a financing or assignment performed completely outside participating systems.
          It prevents conflicting operational reservations inside its registry and makes off-registry financing contractually non-compliant;
          it does not perfect a lien, determine legal priority, repeal property law, or create universal visibility by itself.
        </Callout>
      </Grid>
    </Stack>
  );
}

function Protocol() {
  return (
    <Stack gap={18}>
      <H2>1–7 · Protocol definition</H2>
      <Grid columns="1fr 1fr" gap={16}>
        <Stack gap={9}>
          <H3>1. Protocol name</H3>
          <Text><Text weight="bold">ClaimState</Text> — signed lifecycle evidence for private financial obligations.</Text>
          <H3>2. One sentence</H3>
          <Text>ClaimState wraps a private commercial obligation in a privacy-preserving state envelope whose acknowledgement, reservation, evidence, servicing, dispute, and settlement events can be verified across participating institutions.</Text>
          <H3>3. The problem</H3>
          <Text>Tokenized claims settle quickly, but the obligation underneath remains fragmented across ERP records, invoice PDFs, emails, UCC filings, lender systems, insurer records, and bank rails. No participant has authoritative real-time state.</Text>
          <H3>4. Existing workflow</H3>
          <Text>Originators upload documents, buyers confirm by portal or email, lenders run duplicate checks and legal searches, assignment notices are sent, servicing teams reconcile payments, and exceptions are handled manually across systems.</Text>
        </Stack>
        <Stack gap={9}>
          <H3>5. Why it is broken</H3>
          <Text>Every institution rebuilds the same lifecycle; updates arrive late; broad lien registries do not identify invoice-level claims; transfer breaks audit continuity; and token ownership does not prove legal assignment or current commercial state.</Text>
          <H3>6. New primitive</H3>
          <Text>An <Text weight="semibold">Obligation State Envelope</Text> plus an <Text weight="semibold">Operational Reservation Slot</Text>. The envelope is a shared evidence state machine, not a token and not a substitute for legal filing.</Text>
          <H3>7. Protocol mechanism</H3>
          <Text>The parties commit private terms, sign a canonical obligation fingerprint, register ordered lifecycle events, and atomically activate one in-network reservation together with disbursement and evidence. Later events update state by versioned, role-gated transitions; jurisdiction adapters separately perform notices and statutory filings.</Text>
        </Stack>
      </Grid>

      <H2>8 · Participants</H2>
      <Table
        headers={["Participant", "Role", "Reason to join"]}
        rows={[
          ["Obligor / buyer", "Acknowledges the obligation, disputes, pays, approves amendments", "Fewer supplier queries, stronger supplier finance, one record of what is actually owed"],
          ["Supplier / originator", "Creates the obligation and supplies evidence", "Faster finance and portable proof of acknowledgement"],
          ["Financier / factor", "Acquires the operational reservation and funds", "Buyer-confirmed state, lower servicing/reconciliation cost, stronger audit evidence"],
          ["Insurer / guarantor", "Attaches cover and processes claims", "Machine-readable exposure and event history"],
          ["Payment or servicing agent", "Attests receipts, allocations, reversals, and recovery", "One idempotent instruction and event interface"],
          ["Registry / legal adapter", "Performs MonetaGo, UCC, CERSAI, MLETR, or jurisdiction checks", "Reusable integration instead of a new financing platform"],
        ]}
        striped
      />

      <H2>9 · Economic model</H2>
      <Grid columns={3} gap={12}>
        <Card>
          <CardHeader>Protocol revenue</CardHeader>
          <CardBody><Text>Per-active-obligation API fee, per-event HCS topic fee, enterprise connector licence, validation-adapter revenue share, and premium analytics.</Text></CardBody>
        </Card>
        <Card>
          <CardHeader>Incentive</CardHeader>
          <CardBody><Text>Originators get faster funding; buyers strengthen suppliers; financiers reduce verification and servicing cost; adapters gain distribution.</Text></CardBody>
        </Card>
        <Card>
          <CardHeader>Liquidity</CardHeader>
          <CardBody><Text>The core does not require a liquidity pool. Financing remains bilateral or venue-based; ClaimState is the shared control and servicing substrate.</Text></CardBody>
        </Card>
      </Grid>

      <H2>10 · Hedera architecture</H2>
      <ArchitectureFlow />

      <H2>11 · Why Hedera</H2>
      <Table
        headers={["Requirement", "Hedera property", "Why a substitute is weaker"]}
        rows={[
          ["Neutral multi-party event order", "HCS aBFT ordering, consensus timestamps, sequence numbers, and running hashes", "A database has an owner; EVM logs require every evidence event to execute contract code and do not offer HCS topic economics."],
          ["Optional controlled evidence receipt", "HTS KYC, freeze, pause, wipe, supply keys, allowances, and EVM system-contract access", "Useful for regulated operational receipts, but deliberately not represented as legal assignment or lien perfection."],
          ["State + evidence + money consistency", "HIP-551 batches atomically combine contract call, HCS message, HTS mint/transfer, and payment", "The outer transaction is limited to 6 KB, batches cannot be scheduled or nested, and processed inner transactions can remain chargeable after rollback."],
          ["Independent signatures and dated actions", "Hedera Schedule Service collects signatures and can wait until expiry, up to 62 days", "There is no native perpetual recurrence; recurring workflows must self-reschedule and handle capacity, funding, and failure."],
          ["Enterprise-scale event economics", "USD-denominated fees; standard HCS submission is currently $0.0008", "Fees can change by Council governance; custom-fee topic submission currently has a $0.05 base before its own charge."],
          ["Public audit read model", "Mirror Node APIs expose HCS, token transfers, contract results, and logs", "Mirror indexing lags consensus and REST responses are not portable cryptographic proofs; archive signed record/block streams for high-assurance evidence."],
        ]}
        striped
      />

      <H2>12 · Enterprise use cases</H2>
      <Grid columns={3} gap={12}>
        <Card>
          <CardHeader>First wedge: U.S. transportation factor</CardHeader>
          <CardBody><Text>Start with a non-bank factor financing buyer-accepted freight invoices through existing TMS, debtor-verification, and controlled-collection workflows. Sell loss prevention and servicing evidence before network interoperability.</Text></CardBody>
        </Card>
        <Card>
          <CardHeader>Bank or factoring network</CardHeader>
          <CardBody><Text>Keep MonetaGo for duplicate validation, then use ClaimState for assignment, servicing, transfer, dispute, and release across lenders.</Text></CardBody>
        </Card>
        <Card>
          <CardHeader>Enterprise procurement platform</CardHeader>
          <CardBody><Text>Issue buyer-acknowledged obligations from purchase-order and delivery events, attach a guarantee, and offer approved payables to financiers without becoming a lender.</Text></CardBody>
        </Card>
      </Grid>

      <H2>13 · Example transaction</H2>
      <Table
        headers={["Step", "Action", "Network effect"]}
        rows={[
          ["1", "A freight carrier's TMS creates an $18,500 invoice; the broker/shipper confirms amount and due date in a lightweight portal.", "Buyer confirmation is the high-value fact; no invoice or PII is published."],
          ["2", "An OPRF/HSM fingerprint service, MonetaGo where available, and UCC/notice adapters return signed checks committed to HCS.", "Existing validation and legal rails are reused."],
          ["3", "The factor offers an 85% advance. Supplier and factor sign activation; buyer acknowledgement is already attached.", "The first deployment needs one factor, not an industry consortium."],
          ["4", "One HIP-551 batch locks the operational reservation, disburses testnet funds, and submits activation evidence to HCS.", "State, evidence, and disbursement either activate together or fail together."],
          ["5", "A short-pay or credit note arrives. The buyer and supplier sign an amendment; state version and amount commitment update.", "Dilution reaches the factor immediately."],
          ["6", "The controlled collection account reports payment; the adapter allocates principal, fee, reserve, and supplier remainder.", "Settlement evidence and servicing state stay synchronized."],
          ["7", "After final payment, the reservation releases. An optional HTS receipt may burn, but no token is required for legal effect.", "The obligation cannot remain falsely open inside the participating workflow."],
        ]}
        striped
      />

      <H2>14–15 · Contract and data architecture</H2>
      <Table
        headers={["Component", "Responsibility"]}
        rows={[
          ["ObligationRegistry.sol", "Canonical IDs, terms roots, version, state, role hashes, dates, adapter references"],
          ["ReservationSlot.sol", "Single active in-network reservation, compare-and-set activation, release, and legal-adapter references"],
          ["TransitionPolicy.sol", "Allowed state transitions and required role signatures"],
          ["SettlementVault.sol", "HTS stablecoin disbursement, repayment allocation, refunds, and recovery"],
          ["EvidenceReceiptManager.sol", "Optional HTS operational receipt via system contract 0x167; explicitly carries no claim of legal title"],
          ["DisputeModule.sol", "Dispute, cure, waiver, arbitration result, and default states"],
          ["AdapterRegistry.sol", "Approved validation, identity, payment, and evidence attestors with revocation"],
          ["EventBatchBuilder.ts", "Constructs HIP-551 inner transactions and enforces the exact contract/HCS/payment bundle; optional HTS receipt is policy-controlled"],
          ["Mirror indexer", "Idempotent materialized view from consensus timestamp, sequence number, contract events, and token history"],
          ["Private document store", "Encrypted documents and disclosure envelopes; only roots and opaque references go onchain"],
        ]}
        striped
      />
    </Stack>
  );
}

function Template() {
  return (
    <Stack gap={18}>
      <H2>16 · Scaffold-HBAR repository</H2>
      <Card>
        <CardHeader>claimstate-template/</CardHeader>
        <CardBody>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, lineHeight: "18px" }}>{`claimstate-template/
  packages/
    hardhat/
      contracts/
        ObligationRegistry.sol
        ReservationSlot.sol
        TransitionPolicy.sol
        SettlementVault.sol
        EvidenceReceiptManager.sol
        DisputeModule.sol
        AdapterRegistry.sol
      deploy/
      test/
        invariants/
        integration/
      scripts/
        deploy.ts
        run-obligation.ts
        verify-mirror.ts
    nextjs/
      app/
        obligations/
        create/
        app/
        api/mirror/
      components/
      hooks/
      lib/
        claimstate-sdk/
        hedera/
        schemas/
    indexer/
      src/
        hcs-consumer.ts
        mirror-reconciler.ts
        read-model.ts
    sdk/
      src/
        canonicalize.ts
        commitments.ts
        events.ts
        batch-builder.ts
        adapters.ts
        client.ts
  adapters/
    mock-erp/
    mock-payment-agent/
    mock-duplicate-check/
  schemas/
    obligation.schema.json
    event.schema.json
    evidence.schema.json
  .harness/
    prd.md
    spec.yaml
    validators/
      static.json
      yarn.json
      semantic.md
      chain.ts
  template.json
  AGENTS.md
  README.md
  SECURITY.md
  THREAT_MODEL.md
  LEGAL_BOUNDARIES.md
  .env.example
  LICENSE`}</pre>
        </CardBody>
      </Card>

      <H2>17 · Why developers would scaffold it</H2>
      <Text>
        A developer receives the difficult horizontal capability that every serious financial application otherwise rebuilds:
        canonical private-data commitments, multi-party signatures, role-gated state transitions, operational reservation,
        atomic evidence/state/payment batches, optional HTS evidence receipts, Mirror Node indexing, scheduled settlement,
        and recovery-safe idempotency.
      </Text>
      <Table
        headers={["Application built on the template", "Adapter work required—not core protocol work"]}
        rows={[
          ["Invoice or approved-payables finance", "ERP/e-invoice ingestion, buyer UX, duplicate-check adapter"],
          ["Private-credit servicing", "Covenant and payment-agent adapters"],
          ["Performance guarantee / surety", "Evidence policy and insurer claims adapter"],
          ["Compute-capacity warrant", "Hardware/SLA measurement adapter"],
          ["Carbon forward delivery", "Guardian project and verification adapter"],
          ["Royalty or revenue-share finance", "Usage/revenue attestor and waterfall policy"],
          ["Agent procurement commitment", "Agent mandate and counterparty identity adapter"],
        ]}
        striped
      />

      <H2>18 · Developer experience</H2>
      <Card>
        <CardHeader>Five-command happy path</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Text><Code>npx create-scaffold-hbar@latest claimstate --template your-org/claimstate-template</Code></Text>
            <Text><Code>cp .env.example .env.local</Code> and set funded Hedera testnet operator credentials.</Text>
            <Text><Code>npm install && npm run deploy:testnet</Code></Text>
            <Text><Code>npm run obligation</Code> creates topic, obligation envelope, reservation, atomic activation, and scheduled settlement.</Text>
            <Text><Code>npm run verify:mirror</Code> prints Mirror Node and HashScan links and asserts state/evidence/payment consistency.</Text>
            <Text><Code>npm run dev</Code> opens the lifecycle explorer.</Text>
          </Stack>
        </CardBody>
      </Card>
      <Callout tone="warning" title="Scaffold contract and generated-project gotcha">
        <Code>create-scaffold-hbar</Code> currently requires Node 20.18.3 or newer. It reads the repository's
        <Code>template.json</Code> to choose capabilities, defaults, environment variables, renames, and outro steps,
        then removes that file from the generated project. Harness validators for scaffolded output must not require
        <Code>template.json</Code>.
      </Callout>

      <H2>19 · AGENTS.md</H2>
      <Text>The file should teach an AI coding agent constraints, not restate the README:</Text>
      <Grid columns="1fr 1fr" gap={14}>
        <Stack gap={7}>
          <Bullet>Never publish invoice documents, raw PII, bank data, or unsalted deterministic identifiers.</Bullet>
          <Bullet>Every state change must increment version and be idempotent by event ID.</Bullet>
          <Bullet>Use HIP-551 when Hedera-native evidence, state, optional receipt, and digital payment must not diverge.</Bullet>
          <Bullet>Never treat Mirror Node as the write-path source of truth; verify receipts first.</Bullet>
          <Bullet>Never claim an HTS token alone creates a legal lien, assignment, or Article 12 control.</Bullet>
        </Stack>
        <Stack gap={7}>
          <Bullet>Preserve the transition matrix and required signer set when adding obligation types.</Bullet>
          <Bullet>Keep domain-specific logic in adapters; the kernel remains asset-independent.</Bullet>
          <Bullet>Use network-specific chain/topic/registry domain separation in every signature and commitment.</Bullet>
          <Bullet>HBAR uses 8 decimals; do not reuse Ethereum 18-decimal assumptions or production-depend on public Hashio rate limits.</Bullet>
          <Bullet>A submit-key HCS topic restricts writers, not readers; every submitted payload remains public through Mirror Nodes.</Bullet>
          <Bullet>Tests must cover rollback, replay, stale versions, duplicate activation, Mirror Node lag, and scheduled-transfer failure.</Bullet>
          <Bullet>Any new privileged role requires threat-model and recovery documentation.</Bullet>
        </Stack>
      </Grid>

      <H2>20 · Hedera Harness</H2>
      <Callout tone="info" title="Use it—and submit the recipe and validators">
        <Stack gap={6}>
          <Text><Code>.harness/spec.yaml</Code> uses <Code>schemaVersion: 2</Code>, a baseline command literally named <Code>install</Code>, and the default deterministic validators.</Text>
          <Text>Tier 2 Playwright verifies the routes and state transitions render.</Text>
          <Text>Tier 3 semantic validation grades numbered assertions: no plaintext documents, reservation invariant, signed transition display, and recovery UX.</Text>
          <Text>Tier 3.5 creates an ephemeral funded testnet signer, runs atomic activation, queries Mirror Node, and proves the HCS event, contract version, optional HTS receipt, and payment share one parent batch.</Text>
          <Text>A custom validator also scaffolds into a fresh temporary directory and runs install, lint, test, build, and route health checks—the exact eligibility gate.</Text>
        </Stack>
      </Callout>

      <H2>21 · 2–3 minute walkthrough</H2>
      <Table
        headers={["Time", "What judges see", "What it proves"]}
        rows={[
          ["0:00–0:25", "A carrier submits the same private $18.5k freight invoice twice; no document is shown onchain.", "The real loss vector and privacy boundary."],
          ["0:25–0:55", "Broker/shipper confirms the invoice. App displays terms root and signer roles; private document stays encrypted.", "Buyer-confirmed obligation without public commercial data."],
          ["0:55–1:25", "Factor funds an 85% advance. One atomic batch posts HCS activation, locks the reservation, and disburses testnet funds.", "Load-bearing Hedera composition without pretending a token is title."],
          ["1:25–1:45", "Duplicate activation receives ALREADY_RESERVED; the factor identity is not disclosed.", "In-workflow conflict prevention and minimum disclosure."],
          ["1:45–2:15", "Buyer issues a signed credit note; state version, outstanding amount commitment, and HCS timeline update.", "Lifecycle servicing, not a one-time registry."],
          ["2:15–2:40", "Controlled-account payment posts and the reservation releases. Mirror Node verification shows every linked transaction.", "End-to-end servicing evidence and audit."],
          ["2:40–3:00", "Switch adapter selector from Invoice to Compute SLA or Performance Bond.", "Why this is a reusable template, not an invoice dApp."],
        ]}
        striped
      />
    </Stack>
  );
}

function RiskBusiness() {
  return (
    <Stack gap={18}>
      <H2>22 · Thirty-second business pitch</H2>
      <Callout tone="success">
        Tokenization made financial claims transferable, but it did not make the obligations underneath them trustworthy.
        A €4 trillion receivables market still coordinates buyer acknowledgements, assignments, disputes, credit notes,
        payments, and releases across emails, ERPs, lender databases, and legal registries. ClaimState gives a factor and its
        counterparties signed, versioned obligation evidence: private terms stay private, lifecycle events receive Hedera
        consensus, and in-network reservation, evidence, and digital settlement update atomically. It does not claim to be a
        universal legal registry. It begins as a loss-prevention and servicing product, then earns the right to become shared infrastructure.
      </Callout>

      <H2>23–24 · Long-term protocol and business model</H2>
      <Grid columns="1.3fr 1fr" gap={16}>
        <Stack gap={8}>
          <Bullet>Year 1: one U.S. transportation factor, buyer-confirmed freight invoices, controlled collections, TMS connector, and measurable loss/reconciliation reduction.</Bullet>
          <Bullet>Year 2: a second factor or bank relies on the same envelope; add insurer, MonetaGo, and legal-notice adapters.</Bullet>
          <Bullet>Year 3: jurisdiction-certified Article 12/MLETR/control agreements and institutional custody integrations.</Bullet>
          <Bullet>Years 4–5: the neutral obligation graph used by lenders, insurers, agents, and settlement networks to discover control, exposure, and lifecycle state.</Bullet>
          <Bullet>The moat compounds through obligation-performance data, integrations, legal adapters, and the cost of leaving a shared standard—not through a speculative token.</Bullet>
        </Stack>
        <Card>
          <CardHeader>Who pays</CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text><Text weight="semibold">Originators:</Text> per active obligation and connector licence.</Text>
              <Text><Text weight="semibold">Financiers:</Text> validation, servicing, and portfolio APIs.</Text>
              <Text><Text weight="semibold">Insurers:</Text> event and exposure feeds.</Text>
              <Text><Text weight="semibold">Developers:</Text> hosted API, SLA, and certified adapters; core remains open source.</Text>
              <Text><Text weight="semibold">Protocol:</Text> optional HCS topic custom fee per accepted lifecycle event.</Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Callout tone="warning" title="Hard go / no-go tests before calling this a protocol">
        <Stack gap={6}>
          <Bullet>Stop if the buyer or broker will not sign acceptance, dilution, and dispute events.</Bullet>
          <Bullet>Stop if legal counsel cannot connect each reservation to enforceable notice, assignment, or filing in the launch jurisdiction.</Bullet>
          <Bullet>Stop if the factor's savings are only internal reconciliation that an ordinary database can deliver.</Bullet>
          <Bullet>Stop if a second independent financier will not rely on the envelope after the single-factor pilot.</Bullet>
          <Bullet>Stop if the product reduces to MonetaGo-style duplicate checking or depends on issuing a token before useful shared state exists.</Bullet>
        </Stack>
      </Callout>

      <H2>25 · Competitive landscape</H2>
      <Table
        headers={["Competitor", "What it solves", "What remains missing", "ClaimState relationship"]}
        rows={[
          ["MonetaGo", "Production duplicate-financing and document validation through SWIFT and national registries; moved from DLT to confidential cloud", "Buyer-confirmed lifecycle, amendments, servicing, disputes, settlement, and composable evidence", "Integrate as validation adapter; its migration proves dedup alone is not the chain use case"],
          ["TradeTrust", "Authenticity, source, singularity, and title control for electronic transferable records", "Cashflow obligation state, financing control, servicing and settlement", "Legal/title adapter for MLETR instruments"],
          ["ACTUS", "Machine-readable terms and deterministic contractual cashflow algorithms", "Shared evidence, identity, control, transfer and settlement infrastructure", "Terms/schedule standard adapter"],
          ["Centrifuge / Polytrade / Huma / cSigma", "Origination, tokenization, pools, underwriting, and investor liquidity", "Cross-platform authoritative lifecycle/control state", "Customers and vertical gateways"],
          ["Hedera Asset Tokenization Studio", "Security issuance, compliance, lifecycle actions, and mass payouts", "State of the underlying private obligation and competing claims", "Use or interoperate for securities; never duplicate"],
          ["DTCC / Ownera / Archax Nest", "Institutional tokenized assets, collateral connectivity, and regulated workflows", "Open reusable kernel for private obligations outside securities infrastructure", "Potential enterprise integrations, not first-market competitors"],
        ]}
        striped
      />

      <H2>26 · Security model</H2>
      <Table
        headers={["Threat", "Control", "Residual risk"]}
        rows={[
          ["Variant fingerprints evade duplicate detection", "Buyer signs canonical schema; domain-separated ID includes registry, environment, schema version, blinded fingerprint, and role identities", "Colluding buyer and supplier can still fabricate a genuine-looking obligation"],
          ["Hash dictionary attack leaks invoice identity", "Never hash raw invoice IDs; derive blinded fingerprints through an OPRF or HMAC inside an HSM/TEE; keep documents and lookup fields encrypted offchain", "The fingerprint service becomes a governed trust and availability dependency"],
          ["Race between two financiers", "Versioned compare-and-set ReservationSlot in the same atomic batch as disbursement and evidence", "It prevents only conflicts visible to participating systems; legal priority still depends on governing law"],
          ["HCS, contract, and payment diverge", "HIP-551 atomic batch where all legs are Hedera-native; reconciliation validator handles external ACH and checks parent consensus timestamp", "External fiat settlement cannot be made atomically final by Hedera"],
          ["Replay / double settlement", "Event ID, state version, chain/registry domain separation, consumed schedule and payment IDs", "Cross-system payment reversals require explicit reversal events"],
          ["Mirror Node lag", "Write flow trusts consensus receipt; UI marks read model as pending until indexed", "Temporary UX inconsistency"],
          ["Compromised issuer or attestor key", "Threshold/multisig keys, key rotation, adapter revocation, exposure limits, optional HTS pause/freeze", "Emergency controls create governance power"],
          ["Admin wipes or seizes valid claims", "Separate narrowly scoped roles, timelock, policy multisig, immutable live-obligation terms, public HCS emergency reason", "Regulated recovery cannot be both fully permissionless and reversible"],
          ["Scheduled repayment lacks funds", "Treat execution as conditional; on failure enter DELINQUENT and retain the reservation", "HSS does not create credit or guarantee payment"],
          ["Reentrancy / contract exploits", "Checks-effects-interactions, ReentrancyGuard, no arbitrary callbacks, invariant/fuzz tests, audited HTS return-code handling", "Standard smart-contract risk remains"],
          ["DoS and registry spam", "Submit keys, role credentials, minimum bond or topic fee, per-tenant rate limits", "Permissioning reduces openness"],
          ["Off-registry pledge", "Contractual covenant, validation adapters, lender onboarding, audit evidence", "Invisible external activity remains the fundamental coverage limit"],
        ]}
        striped
      />

      <H2>27 · Regulatory model</H2>
      <Grid columns="1fr 1fr" gap={14}>
        <Stack gap={8}>
          <H3>Permissionless core</H3>
          <Bullet>Open-source schemas, SDK, validators, read APIs, and deployment tooling.</Bullet>
          <Bullet>Public verification of opaque commitments and lifecycle proofs.</Bullet>
          <Bullet>Anyone can build an adapter or application.</Bullet>
          <H3>Permissioned financial edges</H3>
          <Bullet>KYB/KYC for obligors, originators, financiers, insurers, and control-token holders.</Bullet>
          <Bullet>Only licensed entities originate or fund where factoring/lending law requires it.</Bullet>
          <Bullet>Custody, securities, and money-transmission obligations remain with regulated providers.</Bullet>
        </Stack>
        <Stack gap={8}>
          <H3>Claims we must not make</H3>
          <Bullet>An HTS token does not automatically assign a receivable or perfect a lien.</Bullet>
          <Bullet>UCC Article 12 control requires technical control plus the debtor's agreement to pay the controller and jurisdiction-specific legal analysis.</Bullet>
          <Bullet>A financing participation may be a security; the core template does not fractionalize claims by default.</Bullet>
          <Bullet>Hashes can still be personal data if linkable; no raw PII or predictable identifiers belong on HCS.</Bullet>
          <Bullet>Cross-border assignment, insolvency priority, tax, withholding, and dispute law remain legal-adapter responsibilities.</Bullet>
        </Stack>
      </Grid>

      <H2>28 · Why this could become important</H2>
      <Text>
        If ClaimState succeeds, the important change is not that invoices move onchain. It is that a lender, insurer,
        payment agent, enterprise system, or autonomous agent can ask one machine-verifiable question—“what is this
        obligation's current state, who controls it, what evidence changed it, and what happens next?”—without trusting
        the originator's private database. That turns private obligations from static legal documents into interoperable
        financial state. Financing venues compete above it; legal registries and validation services connect below it;
        and developers stop rebuilding bespoke escrow, assignment, servicing, and recovery logic for every new asset class.
      </Text>
    </Stack>
  );
}

function Sources() {
  return (
    <Stack gap={14}>
      <H2>Research sources</H2>
      <Text tone="secondary">
        Facts in this artifact were checked against current sources on 22 September 2026. Market-size estimates and vendor claims should be revalidated before a public pitch deck.
      </Text>
      <Table
        headers={["Source", "Link"]}
        rows={sources.map(([label, url]) => [label, <span key={url}><Link href={url}>{url}</Link></span>])}
        striped
      />
      <Callout tone="info" title="ETHGlobal skill status">
        The installed skill file identifies itself as v1.0.0; the API previously reported v1.1.0.
        Update with <Code>npx skills add ethglobal-skills/repo</Code>. The exact ETHOnline 2026 event query currently returns no projects.
      </Callout>
    </Stack>
  );
}

export default function HederaFinancialInfrastructureResearch() {
  const theme = useHostTheme();
  const action = useCanvasAction();
  const [tab, setTab] = useCanvasState("hedera-report-tab", "Executive");
  const tabs = ["Executive", "Research", "27 Candidates", "Shortlist", "Protocol", "Template", "Risk + Business", "Sources"];

  let content = <Executive />;
  if (tab === "Research") content = <Research />;
  if (tab === "27 Candidates") content = <CandidateSpace />;
  if (tab === "Shortlist") content = <Shortlist />;
  if (tab === "Protocol") content = <Protocol />;
  if (tab === "Template") content = <Template />;
  if (tab === "Risk + Business") content = <RiskBusiness />;
  if (tab === "Sources") content = <Sources />;

  return (
    <Stack gap={18} style={{ padding: 24, maxWidth: 1440, margin: "0 auto", color: theme.text.primary }}>
      <Grid columns="1fr auto" gap={20} style={{ alignItems: "start" }}>
        <Stack gap={6}>
          <H1>ClaimState · Hedera Financial Infrastructure Research</H1>
          <Text tone="secondary">
            One protocol concept selected from 27 candidates after ETHGlobal corpus mining, institutional-market research,
            Hedera ecosystem analysis, competitor mapping, and explicit kill tests.
          </Text>
        </Stack>
        <Button
          variant="secondary"
          onClick={() => action({ type: "newComposerChat", userPrompt: "Turn the ClaimState research into a phased implementation plan for the Scaffold-HBAR bounty." })}
        >
          Continue in chat
        </Button>
      </Grid>

      <Row gap={8} wrap>
        {tabs.map(name => (
          <span key={name}>
            <Pill active={tab === name} onClick={() => setTab(name)}>
              {name}
            </Pill>
          </span>
        ))}
      </Row>
      <Divider />
      {content}
    </Stack>
  );
}
