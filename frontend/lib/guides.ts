export const chapters = [
  {
    title: "Getting started",
    guides: [
      {
        slug: "what-you-are-looking-at",
        title: "What you are looking at",
        summary: "The bill, the seven cards, and the guided example.",
      },
      {
        slug: "quickstart",
        title: "Quickstart",
        summary: "Scaffold, run without a key, and deploy one obligation.",
      },
    ],
  },
  {
    title: "Concepts",
    guides: [
      {
        slug: "architecture",
        title: "Architecture",
        summary: "Private bill, public fingerprint, one lender, one batch.",
      },
      {
        slug: "lifecycle",
        title: "Lifecycle",
        summary: "States, events, and who signs each step.",
      },
    ],
  },
  {
    title: "Building",
    guides: [
      {
        slug: "writing-an-adapter",
        title: "Writing an adapter",
        summary: "How a second obligation type reuses the same kernel.",
      },
    ],
  },
  {
    title: "Field notes",
    guides: [
      {
        slug: "hedera-landmines",
        title: "Hedera landmines",
        summary: "Batch order, decimals, Mirror lag, keys, and install peers.",
      },
      {
        slug: "dead-ends",
        title: "Dead ends",
        summary: "Approaches that were tried and rejected.",
      },
    ],
  },
] as const;

export type Guide = (typeof chapters)[number]["guides"][number] & { chapter: string };
export type GuideSlug = Guide["slug"];

export const guides: Guide[] = chapters.flatMap((chapter) =>
  chapter.guides.map((guide) => ({ ...guide, chapter: chapter.title })),
);

const guideSlugs = new Set<string>(guides.map((guide) => guide.slug));

export function isGuideSlug(slug: string): slug is GuideSlug {
  return guideSlugs.has(slug);
}

export function neighbours(slug: GuideSlug): { previous?: Guide; next?: Guide } {
  const index = guides.findIndex((guide) => guide.slug === slug);
  return { previous: guides[index - 1], next: guides[index + 1] };
}

export function rewriteHref(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#")) {
    return href;
  }
  const [target, hash] = href.split("#");
  const file = target.split("/").pop() ?? target;
  if (!file.endsWith(".md")) {
    return href;
  }
  const slug = file.slice(0, -3);
  const suffix = hash === undefined ? "" : `#${hash}`;
  if (guideSlugs.has(slug)) {
    return `/docs/${slug}${suffix}`;
  }
  return `https://github.com/U-GOD/ClaimState/blob/main/${file}${suffix}`;
}

export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type Heading = { depth: 2 | 3; text: string; id: string };

export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  let fenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      continue;
    }
    const match = /^(##|###) (.+)$/.exec(line);
    if (match !== null) {
      const text = match[2].replace(/[`*_]/g, "").trim();
      headings.push({ depth: match[1].length as 2 | 3, text, id: headingId(text) });
    }
  }
  return headings;
}
