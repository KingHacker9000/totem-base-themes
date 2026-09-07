import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const sdkRoot = process.env.THEME_SDK_DIR;
assert.ok(sdkRoot, "THEME_SDK_DIR must point to a built totem-theme-sdk checkout");

function run(manifests = []) {
  const args = ["scripts/validate-theme-contracts.mjs", "--sdk", sdkRoot];
  for (const manifest of manifests) args.push("--manifest", manifest);
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

test("canonical public themes satisfy the Theme SDK contract", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /default\/totem-theme\.json: PASS/);
  assert.match(result.stdout, /minimal\/totem-theme\.json: PASS/);
  assert.match(result.stdout, /retro-terminal\/totem-theme\.json: PASS/);
});

test("malformed and privileged manifests fail deterministically", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "totem-theme-contract-"));
  try {
    const manifestPath = path.join(root, "bad.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        schema: "totem.theme/v999",
        id: "Bad Theme",
        name: "",
        version: "not-semver",
        permissions: ["root"],
      }),
    );
    const result = run([manifestPath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unsupported_schema/);
    assert.match(result.stderr, /invalid_id/);
    assert.match(result.stderr, /invalid_name/);
    assert.match(result.stderr, /invalid_version/);
    assert.match(result.stderr, /theme_privilege_forbidden/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
