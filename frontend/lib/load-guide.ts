import { readFile } from "node:fs/promises";
import path from "node:path";
import { isGuideSlug, type GuideSlug } from "./guides";

export async function loadGuide(slug: string): Promise<{ slug: GuideSlug; markdown: string } | null> {
  if (!isGuideSlug(slug)) {
    return null;
  }
  const markdown = await readFile(path.join(process.cwd(), "docs", `${slug}.md`), "utf8");
  return { slug, markdown };
}
