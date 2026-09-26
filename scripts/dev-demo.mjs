import { writeSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const port = 3210;
writeSync(1, `Local: http://127.0.0.1:${port}\n`);

const child = spawn("npx", ["next", "dev", "--port", String(port)], {
  cwd: path.join(process.cwd(), "packages", "nextjs"),
  shell: true,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
