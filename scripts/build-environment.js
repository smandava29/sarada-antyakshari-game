const environment = process.argv[2];

if (environment !== "development" && environment !== "production") {
  throw new Error("Expected build environment: development or production");
}

// Start Vite in a fresh process: the Cloudflare plugin reads this before config loading.
const { spawnSync } = await import("node:child_process");
const { join } = await import("node:path");
const vite = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
const childEnv = { ...process.env };
if (environment === "production") childEnv.CLOUDFLARE_ENV = "production";
else delete childEnv.CLOUDFLARE_ENV;

const result = spawnSync(process.execPath, [vite, "build", "--mode", environment], {
  env: childEnv,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
await import("./sanitize-build.js");
