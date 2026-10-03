import { spawn, spawnSync } from "node:child_process";
import { writeSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const port = 3211;
const base = `http://127.0.0.1:${port}`;
const steps = [
  "Same private invoice offered twice",
  "Broker confirms",
  "Factor funds 85 percent",
  "Second factor",
  "$500 short-pay",
  "Collection report and release",
  "Switch to Compute SLA",
];

const server = spawn("npx", ["next", "dev", "--port", String(port)], {
  cwd: path.join(process.cwd(), "packages", "nextjs"),
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (chunk) => writeSync(1, chunk));
server.stderr.on("data", (chunk) => writeSync(2, chunk));

let exitCode = 0;
try {
  await waitFor(base, 90_000);
  const browser = await launch();
  const page = await browser.newPage();
  const response = await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  if (response === null || response.status() >= 400) {
    throw new Error(`Home route status ${response?.status() ?? "none"}`);
  }
  const text = await page.locator("body").innerText();
  for (const step of steps) {
    if (!text.includes(step)) {
      throw new Error(`Home is missing ${step}`);
    }
  }
  if (!text.includes("ALREADY_RESERVED")) {
    throw new Error("Home is missing ALREADY_RESERVED");
  }
  await browser.close();
  console.log("smoke passed");
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.message : error);
} finally {
  if (server.pid !== undefined) {
    spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { shell: true, stdio: "ignore" });
  }
  process.exit(exitCode);
}

async function launch() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ channel: "chrome", headless: true });
  }
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "not ready";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 307 || response.status === 308) {
        return;
      }
      last = String(response.status);
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not answer (${last})`);
}
