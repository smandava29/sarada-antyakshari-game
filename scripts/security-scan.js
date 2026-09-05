import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";

const allowedExamples = new Set([".dev.vars.example"]);
const forbiddenPaths = new Map([
  ["public/suggestions.json", "suggestions must be served from the environment's private R2 binding"],
]);
const forbiddenNames = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  ".dev.vars",
  "wrangler.jsonc",
  "id_rsa",
  "id_ed25519",
]);
const forbiddenExtensions = new Set([".key", ".pem", ".p12", ".pfx", ".jks"]);
const contentRules = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/u],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u],
  ["Stripe secret key", /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/u],
  [
    "hard-coded credential",
    /\b(?:api[_-]?key|secret|password|auth[_-]?token)\b\s*[:=]\s*["'][A-Za-z0-9_+/=-]{20,}["']/iu,
  ],
];

function repositoryFiles() {
  const output = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return output.split("\0").filter(Boolean);
}

const findings = [];
for (const file of repositoryFiles()) {
  const normalizedPath = file.replaceAll("\\", "/").toLowerCase();
  if (existsSync(file) && forbiddenPaths.has(normalizedPath)) {
    findings.push(`${file}: ${forbiddenPaths.get(normalizedPath)}`);
    continue;
  }
  const name = basename(file).toLowerCase();
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";

  if (!allowedExamples.has(name) && (forbiddenNames.has(name) || forbiddenExtensions.has(extension))) {
    findings.push(`${file}: forbidden secret-bearing filename`);
    continue;
  }

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const [label, pattern] of contentRules) {
    if (pattern.test(content)) findings.push(`${file}: possible ${label}`);
  }
}

if (findings.length > 0) {
  console.error("Security scan failed. Potential secrets were found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
    console.log("Security scan passed: no repository secret files or recognized credentials found.");
}
