import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const forbidden = "assigns a receivable";
const skip = new Set(["node_modules", ".git", ".next", "dist", "cache", "artifacts", "coverage"]);

const hits = [];
await walk(root);
if (hits.length > 0) {
  console.error(hits.join("\n"));
  process.exit(1);
}

const fixture = await readFile(
  path.join(root, "adapters", "mock-payment-agent", "fixtures", "freight-18500.json"),
  "utf8",
);
if (/invoice/i.test(fixture)) {
  console.error("The freight fixture contains an invoice field.");
  process.exit(1);
}

console.log("copy check passed");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (skip.has(entry.name)) {
      continue;
    }
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!/\.(md|json|ts|tsx|sol|yaml|yml|mjs)$/.test(entry.name)) {
      continue;
    }
    const text = await readFile(full, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.includes(forbidden)) {
        continue;
      }
      if (/not|forbid|reject/i.test(line)) {
        continue;
      }
      if (full.endsWith(`${path.sep}scripts${path.sep}check-copy.mjs`)) {
        continue;
      }
      hits.push(`${path.relative(root, full)} claims "${forbidden}"`);
    }
  }
}
