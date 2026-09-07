import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildAllThemes, buildThemeBundle } from "../scripts/build-theme-bundles.mjs";

async function makeTheme(root, name = "sample") {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "totem-theme.json"),
    `${JSON.stringify({ schema_version: 1, id: `test.${name}`, name, version: "1.0.0" }, null, 2)}\n`,
  );
  await writeFile(join(dir, "asset.txt"), "deterministic\n");
  return dir;
}

test("same theme tree produces byte-identical canonical bundle", async () => {
  const root = await mkdtemp(join(tmpdir(), "totem-theme-bundle-"));
  const theme = await makeTheme(root);
  const first = await buildThemeBundle(theme);
  const second = await buildThemeBundle(theme);
  assert.equal(first.sha256, second.sha256);
  assert.deepEqual(first.bytes, second.bytes);
  assert.equal(first.bundle.file_count, 2);
});

test("inventory identity changes when bundled content changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "totem-theme-bundle-drift-"));
  const theme = await makeTheme(root);
  const first = await buildThemeBundle(theme);
  await writeFile(join(theme, "asset.txt"), "changed\n");
  const second = await buildThemeBundle(theme);
  assert.notEqual(first.bundle.inventory_sha256, second.bundle.inventory_sha256);
  assert.notEqual(first.sha256, second.sha256);
});

test("symlinks fail closed", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "totem-theme-bundle-link-"));
  const theme = await makeTheme(root);
  try {
    await symlink(join(theme, "asset.txt"), join(theme, "alias.txt"));
  } catch (error) {
    if (error?.code === "EPERM") return t.skip("symlink creation unavailable");
    throw error;
  }
  await assert.rejects(buildThemeBundle(theme), /symlink is forbidden/);
});

test("repository-only paths and ambiguous case-folded paths fail closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "totem-theme-bundle-boundary-"));
  const theme = await makeTheme(root);
  await mkdir(join(theme, ".github"));
  await assert.rejects(buildThemeBundle(theme), /repository-only path is forbidden/);

  const root2 = await mkdtemp(join(tmpdir(), "totem-theme-bundle-case-"));
  const theme2 = await makeTheme(root2);
  await writeFile(join(theme2, "Asset.TXT"), "collision\n");
  await assert.rejects(buildThemeBundle(theme2), /ambiguous bundle paths collide/);
});

test("repository build emits exactly the three public theme bundles and stable index", async () => {
  const firstOut = await mkdtemp(join(tmpdir(), "totem-theme-dist-a-"));
  const secondOut = await mkdtemp(join(tmpdir(), "totem-theme-dist-b-"));
  const first = await buildAllThemes({ root: process.cwd(), outDir: firstOut });
  const second = await buildAllThemes({ root: process.cwd(), outDir: secondOut });
  assert.equal(first.sha256, second.sha256);
  assert.deepEqual(first.index.themes.map((theme) => theme.theme), ["default", "minimal", "retro-terminal"]);
  assert.deepEqual(await readFile(join(firstOut, "index.json")), await readFile(join(secondOut, "index.json")));
  for (const { file } of first.index.themes) {
    assert.deepEqual(await readFile(join(firstOut, file)), await readFile(join(secondOut, file)));
  }
});
