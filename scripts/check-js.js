const { spawnSync } = require("node:child_process");
const { readdirSync, statSync } = require("node:fs");
const { join, resolve } = require("node:path");

const roots = process.argv.slice(2).map((value) => resolve(process.cwd(), value));

if (!roots.length) {
  console.error("Usage: node scripts/check-js.js <dir> [dir...]");
  process.exit(1);
}

function collectJsFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectJsFiles(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

for (const root of roots) {
  if (!statSync(root).isDirectory()) {
    console.error(`${root} is not a directory`);
    process.exit(1);
  }
}

const files = roots.flatMap(collectJsFiles);

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
