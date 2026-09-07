import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const THEME_DIRS = ["default", "minimal", "retro-terminal"];
const FORBIDDEN_COMPONENTS = new Set([".git", ".github", "node_modules", "scripts", "test", "tests"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function portablePath(root, absolutePath) {
  const rel = relative(root, absolutePath).split(sep).join("/");
  if (!rel || rel === "." || rel.startsWith("../") || rel.includes("/../")) {
    throw new Error(`bundle path escapes theme root: ${absolutePath}`);
  }
  return rel;
}

function pathKey(path) {
  return path.normalize("NFC").toLocaleLowerCase("en-US");
}

async function collectFiles(themeRoot) {
  const files = [];
  const seen = new Map();

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));

    for (const entry of entries) {
      if (FORBIDDEN_COMPONENTS.has(entry.name)) {
        throw new Error(`repository-only path is forbidden in theme bundle: ${entry.name}`);
      }

      const absolute = join(directory, entry.name);
      const stat = await lstat(absolute);
      const rel = portablePath(themeRoot, absolute);
      const key = pathKey(rel);
      const prior = seen.get(key);
      if (prior && prior !== rel) {
        throw new Error(`ambiguous bundle paths collide: ${prior} <> ${rel}`);
      }
      seen.set(key, rel);

      if (stat.isSymbolicLink()) {
        throw new Error(`symlink is forbidden in theme bundle: ${rel}`);
      }
      if (stat.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!stat.isFile()) {
        throw new Error(`special filesystem entry is forbidden in theme bundle: ${rel}`);
      }

      const bytes = await readFile(absolute);
      files.push({
        path: rel,
        size: bytes.length,
        sha256: sha256(bytes),
        content_base64: bytes.toString("base64"),
      });
    }
  }

  await walk(themeRoot);
  files.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return files;
}

export async function buildThemeBundle(themeRoot) {
  const root = resolve(themeRoot);
  const stat = await lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`theme root must be an ordinary directory: ${root}`);
  }

  const files = await collectFiles(root);
  const manifest = files.find((file) => file.path === "totem-theme.json");
  if (!manifest) {
    throw new Error(`theme bundle is missing totem-theme.json: ${root}`);
  }

  const inventoryBytes = Buffer.from(
    files.map(({ path, size, sha256: digest }) => `${path}\0${size}\0${digest}\n`).join(""),
    "utf8",
  );

  const bundle = {
    format: "totem.theme-bundle/v1",
    theme_directory: basename(root),
    manifest_sha256: manifest.sha256,
    inventory_sha256: sha256(inventoryBytes),
    file_count: files.length,
    files,
  };

  const bytes = Buffer.from(`${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return { bundle, bytes, sha256: sha256(bytes) };
}

export async function buildAllThemes({ root = process.cwd(), outDir = join(process.cwd(), "dist") } = {}) {
  const output = resolve(outDir);
  await mkdir(output, { recursive: true });
  const index = { format: "totem.theme-bundle-index/v1", themes: [] };

  for (const theme of THEME_DIRS) {
    const result = await buildThemeBundle(join(root, theme));
    const file = `${theme}.theme-bundle.json`;
    await writeFile(join(output, file), result.bytes);
    index.themes.push({
      theme,
      file,
      bytes: result.bytes.length,
      sha256: result.sha256,
      manifest_sha256: result.bundle.manifest_sha256,
      inventory_sha256: result.bundle.inventory_sha256,
      file_count: result.bundle.file_count,
    });
  }

  const indexBytes = Buffer.from(`${JSON.stringify(index, null, 2)}\n`, "utf8");
  await writeFile(join(output, "index.json"), indexBytes);
  return { index, indexBytes, sha256: sha256(indexBytes) };
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : join(process.cwd(), "dist");
  if (outIndex >= 0 && !outDir) throw new Error("--out requires a directory");
  const result = await buildAllThemes({ outDir });
  console.log(`built ${result.index.themes.length} deterministic theme bundles; index sha256=${result.sha256}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
