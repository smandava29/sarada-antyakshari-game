import { readFileSync, writeFileSync } from "node:fs";

const validationOnly = process.argv.includes("--validation-only");
const placeholderDatabaseId = "00000000-0000-0000-0000-000000000000";

function requireProductionValue(name, pattern, description) {
  const value = process.env[name]?.trim();
  if (!value || !pattern.test(value)) {
    throw new Error(`${name} must be set to a valid ${description}.`);
  }
  return value;
}

const productionDatabaseId = validationOnly
  ? placeholderDatabaseId
  : requireProductionValue(
      "CLOUDFLARE_PROD_D1_DATABASE_ID",
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
      "D1 database UUID",
    );
const productionBucketName = validationOnly
  ? "ci-production-bucket-placeholder"
  : requireProductionValue(
      "CLOUDFLARE_PROD_R2_BUCKET_NAME",
      /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u,
      "R2 bucket name",
    );

const replacements = new Map([
  ["__DEV_D1_DATABASE_ID__", placeholderDatabaseId],
  ["__DEV_R2_BUCKET_NAME__", "ci-development-bucket-placeholder"],
  ["__PROD_D1_DATABASE_ID__", productionDatabaseId],
  ["__PROD_R2_BUCKET_NAME__", productionBucketName],
]);

let config = readFileSync("wrangler.example.jsonc", "utf8");
for (const [placeholder, value] of replacements) {
  if (!config.includes(placeholder)) {
    throw new Error(`Missing expected placeholder ${placeholder}.`);
  }
  config = config.replaceAll(placeholder, value);
}

if (/__[A-Z0-9_]+__/u.test(config)) {
  throw new Error("The generated Wrangler configuration contains unresolved placeholders.");
}

writeFileSync("wrangler.jsonc", config, { encoding: "utf8", mode: 0o600 });
console.log(
  validationOnly
    ? "Generated validation-only wrangler.jsonc."
    : "Generated production wrangler.jsonc from GitHub Environment variables.",
);
