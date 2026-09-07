import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_THEMES = ["default", "minimal", "retro-terminal"];
const REFERENCE_KEY = /(?:asset|image|icon|font|file|path|src)$/i;
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function fail(message) {
  throw new Error(message);
}

function assertPortableSegment(segment, relativePath) {
  if (!segment || segment === "." || segment === "..") fail(`${relativePath}: unsafe path segment`);
  if (/[<>:"\\|?*\u0000-\u001f]/u.test(segment)) fail(`${relativePath}: platform-unsafe filename`);
  if (/[. ]$/u.test(segment)) fail(`${relativePath}: filename has trailing dot/space`);
  if (WINDOWS_RESERVED.test(segment)) fail(`${relativePath}: reserved Windows filename`);
}

async function walkTheme(root) {
  const rootReal = await realpath(root);
  const folded = new Map();
  const files = new Set();

  async function walk(directory, relativeDirectory = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const relativePath = path.posix.join(relativeDirectory.split(path.sep).join("/"), entry.name);
      assertPortableSegment(entry.name, relativePath);
      const foldedPath = relativePath.normalize("NFC").toLocaleLowerCase("en-US");
      const previous = folded.get(foldedPath);
      if (previous && previous !== relativePath) fail(`${relativePath}: case-fold/Unicode collision with ${previous}`);
      folded.set(foldedPath, relativePath);

      const absolutePath = path.join(directory, entry.name);
      const stat = await lstat(absolutePath);
      if (stat.isSymbolicLink()) fail(`${relativePath}: symlinks are not allowed`);
      if (stat.isDirectory()) {
        const resolved = await realpath(absolutePath);
        if (resolved !== rootReal && !resolved.startsWith(`${rootReal}${path.sep}`)) fail(`${relativePath}: directory escapes theme root`);
        await walk(absolutePath, path.join(relativeDirectory, entry.name));
      } else if (stat.isFile()) {
        files.add(relativePath);
      } else {
        fail(`${relativePath}: special filesystem entries are not allowed`);
      }
    }
  }

  await walk(root);
  return files;
}

function collectReferences(value, key = "", output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, key, output);
    return output;
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && REFERENCE_KEY.test(key)) output.push(value);
    return output;
  }
  for (const [childKey, childValue] of Object.entries(value)) collectReferences(childValue, childKey, output);
  return output;
}

function normalizeReference(reference) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.startsWith("//")) return null;
  const normalized = reference.replaceAll("\\", "/");
  if (path.posix.isAbsolute(normalized)) fail(`${reference}: absolute asset paths are not allowed`);
  const clean = path.posix.normalize(normalized);
  if (clean === ".." || clean.startsWith("../")) fail(`${reference}: asset path escapes theme root`);
  return clean.replace(/^\.\//u, "");
}

export async function validateTheme(themeRoot) {
  const files = await walkTheme(themeRoot);
  const manifestPath = path.join(themeRoot, "totem-theme.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const reference of collectReferences(manifest)) {
    const normalized = normalizeReference(reference);
    if (!normalized) continue;
    if (!files.has(normalized)) fail(`${reference}: referenced asset does not exist as an ordinary file`);
  }
  return { id: manifest.id, files: [...files].sort() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const themes = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--theme" && args[index + 1]) themes.push(args[++index]);
  }
  if (themes.length === 0) themes.push(...DEFAULT_THEMES);

  let failed = false;
  for (const theme of themes) {
    try {
      const result = await validateTheme(theme);
      console.log(`${theme}: PASS (${result.id}; ${result.files.length} files)`);
    } catch (error) {
      failed = true;
      console.error(`${theme}: FAIL: ${error.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}
