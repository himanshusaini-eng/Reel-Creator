import { existsSync } from "fs";

const required = [
  "public/robots.txt",
  "public/sitemap.xml",
  "public/favicon.svg",
  "public/site.webmanifest",
  "public/500.html",
  "public/offline.html",
  "public/sw.js",
  ".env.example",
  "docs/architecture.md",
  "docs/deployment.md",
  "docs/conventions.md",
];

let failed = 0;
for (const file of required) {
  if (!existsSync(file)) {
    console.error("missing", file);
    failed += 1;
  }
}

const envKeys = ["PORT", "NODE_ENV", "PUBLIC_APP_URL", "BILLING_PROVIDER", "BILLING_WEBHOOK_SECRET", "EMAIL_WEBHOOK_URL", "SUPPORT_EMAIL"];
console.log("Expected production env keys:", envKeys.join(", "));
if (!existsSync("dist/main.js")) {
  console.error("dist/main.js missing. Run npm run build.");
  failed += 1;
}

if (failed) process.exit(1);
console.log("Deploy check passed.");
