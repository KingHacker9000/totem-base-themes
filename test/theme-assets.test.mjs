import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateTheme } from "../scripts/validate-theme-assets.mjs";

async function fixture(manifest = { schema: "totem.theme/v0", id: "fixture", version: "0.0.0" }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "totem-theme-assets-"));
  await writeFile(path.join(root, "totem-theme.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return root;
}

test("accepts an ordinary self-contained theme tree", async () => {
  const root = await fixture({ schema: "totem.theme/v0", id: "fixture", version: "0.0.0", icon: "assets/icon.svg" });
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "assets", "icon.svg"), "<svg/>\n");
  const result = await validateTheme(root);
  assert.equal(result.id, "fixture");
  assert.deepEqual(result.files, ["assets/icon.svg", "totem-theme.json"]);
});

test("rejects traversal in manifest asset references", async () => {
  const root = await fixture({ schema: "totem.theme/v0", id: "fixture", version: "0.0.0", image: "../secret.png" });
  await assert.rejects(validateTheme(root), /escapes theme root/);
});

test("rejects missing referenced assets", async () => {
  const root = await fixture({ schema: "totem.theme/v0", id: "fixture", version: "0.0.0", icon: "assets/missing.svg" });
  await assert.rejects(validateTheme(root), /does not exist as an ordinary file/);
});

test("rejects symlinks anywhere inside a theme", async () => {
  const root = await fixture();
  await writeFile(path.join(root, "target.txt"), "ok\n");
  await symlink("target.txt", path.join(root, "linked.txt"));
  await assert.rejects(validateTheme(root), /symlinks are not allowed/);
});

test("rejects case-fold collisions", async () => {
  const root = await fixture();
  await writeFile(path.join(root, "Icon.svg"), "a\n");
  await writeFile(path.join(root, "icon.svg"), "b\n");
  await assert.rejects(validateTheme(root), /case-fold\/Unicode collision/);
});

test("rejects platform-unsafe names", async () => {
  const root = await fixture();
  await writeFile(path.join(root, "CON"), "reserved\n");
  await assert.rejects(validateTheme(root), /reserved Windows filename/);
});
