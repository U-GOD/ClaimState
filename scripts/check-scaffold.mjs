import { cp, mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const destination = await mkdtemp(path.join(tmpdir(), "claimstate-scaffold-"));
const skip = new Set(["node_modules", ".git", ".next", "dist", "cache", "artifacts", "coverage"]);

await cp(root, destination, {
  recursive: true,
  filter: (source) => {
    const relative = path.relative(root, source);
    if (relative === "") {
      return true;
    }
    const parts = relative.split(path.sep);
    return !parts.some((part) => skip.has(part));
  },
});

await rm(path.join(destination, "template.json"), { force: true });
try {
  await access(path.join(destination, "template.json"));
  throw new Error("template.json is still in the generated app");
} catch (error) {
  if (error instanceof Error && error.message.includes("still in")) {
    throw error;
  }
}

const commands = [
  ["npm", ["install"]],
  ["npm", ["run", "lint"]],
  ["npm", ["test"]],
  ["npm", ["run", "build", "--workspace=@claimstate/nextjs"]],
];

try {
  for (const [command, args] of commands) {
    await run(command, args, destination);
  }
  console.log(`scaffold check passed: ${destination}`);
} finally {
  await rm(destination, { recursive: true, force: true });
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: true });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}
