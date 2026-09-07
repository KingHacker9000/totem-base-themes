import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1] ?? null;
};

const sdkRoot = valueAfter("--sdk");
if (!sdkRoot) {
  console.error("Usage: node scripts/validate-theme-contracts.mjs --sdk <theme-sdk-root> [--manifest <path> ...]");
  process.exit(2);
}

const manifestPaths = [];
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--manifest" && args[index + 1]) {
    manifestPaths.push(args[index + 1]);
    index += 1;
  }
}
if (manifestPaths.length === 0) {
  manifestPaths.push(
    "default/totem-theme.json",
    "minimal/totem-theme.json",
    "retro-terminal/totem-theme.json",
  );
}

const sdkEntry = path.resolve(sdkRoot, "dist/index.js");
let sdk;
try {
  sdk = await import(pathToFileURL(sdkEntry).href);
} catch (error) {
  console.error(`Unable to load built Theme SDK at ${sdkEntry}: ${error.message}`);
  process.exit(2);
}

if (typeof sdk.validateThemeManifest !== "function") {
  console.error("Theme SDK does not export validateThemeManifest().");
  process.exit(2);
}

let failed = false;
for (const manifestPath of manifestPaths) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    failed = true;
    console.error(`${manifestPath}: unreadable/invalid JSON: ${error.message}`);
    continue;
  }

  const result = sdk.validateThemeManifest(manifest);
  if (result.ok) {
    console.log(`${manifestPath}: PASS (${manifest.id}@${manifest.version})`);
    continue;
  }

  failed = true;
  console.error(`${manifestPath}: FAIL`);
  for (const issue of result.issues) {
    console.error(`- ${issue.path || "manifest"} [${issue.code}]: ${issue.message}`);
  }
}

if (failed) process.exitCode = 1;
