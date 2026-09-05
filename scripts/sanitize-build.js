import { existsSync, readdirSync, rmSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

const buildRoot = resolve(process.cwd(), "dist");
const secretNames = new Set([".dev.vars", ".env"]);
const secretExtensions = [".pem", ".key", ".p12", ".pfx", ".jks"];

function isSecretArtifact(path) {
  const name = basename(path).toLowerCase();
  return secretNames.has(name) || name.startsWith(".env.") ||
    secretExtensions.some((extension) => name.endsWith(extension));
}

function assertWithinBuild(path) {
  const relativePath = relative(buildRoot, path);
  if (!relativePath || relativePath.startsWith(`..${sep}`) || resolve(buildRoot, relativePath) !== path) {
    throw new Error("Refusing to sanitize a path outside the build directory.");
  }
}

function visit(directory, remove) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = resolve(join(directory, entry.name));
    assertWithinBuild(target);
    if (entry.isDirectory()) visit(target, remove);
    else if (entry.isFile() && isSecretArtifact(target)) {
      if (remove) rmSync(target, { force: true });
      else throw new Error("Secret-bearing environment files remain in the build output.");
    }
  }
}

if (existsSync(buildRoot)) {
  visit(buildRoot, true);
  visit(buildRoot, false);
}

console.log("Sanitized build output: secret-bearing environment files removed.");
