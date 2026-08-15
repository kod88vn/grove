// Shared config loader and file walker for the guard scripts.
// Zero dependencies so the guards run before `install` completes.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const ROOT = process.cwd();

const CONFIG_FILE = "ai-guard.config.json";

export function loadConfig() {
  let raw;
  try {
    raw = readFileSync(join(ROOT, CONFIG_FILE), "utf8");
  } catch {
    console.error(
      `\n✖ ${CONFIG_FILE} not found.\n\n` +
        `  cp ai-guard.config.example.json ${CONFIG_FILE}\n\n` +
        `Then edit the "layers" list to match this repository. The guards are\n` +
        `deliberately not optional: an unconfigured guard is a guard that lies.\n`,
    );
    process.exit(1);
  }
  return stripJsonComments(raw);
}

/** Supports the "//" and "//key" comment convention used in the example config. */
function stripJsonComments(raw) {
  // First, remove line comments (// ...) that are NOT inside strings
  let result = "";
  let inString = false;
  let stringChar = "";
  let escapeNext = false;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escapeNext = true;
      continue;
    }

    // Handle string boundaries
    if ((char === '"' || char === "'" || char === "`") && !inString) {
      inString = true;
      stringChar = char;
      result += char;
      continue;
    }

    if (char === stringChar && inString) {
      inString = false;
      result += char;
      continue;
    }

    // Inside a string, just copy the character
    if (inString) {
      result += char;
      continue;
    }

    // Outside a string: handle block comments /* ... */
    if (char === "*" && raw[i + 1] === "/") {
      let endIdx = raw.indexOf("*/", i + 2);
      if (endIdx !== -1) {
        result += " ".repeat(endIdx - i + 1); // preserve line structure
        i = endIdx;
      } else {
        result += " ".repeat(raw.length - i);
        break;
      }
      continue;
    }

    // Outside a string: handle line comments // ...
    if (char === "/" && raw[i + 1] === "/") {
      let endIdx = raw.indexOf("\n", i);
      if (endIdx !== -1) {
        result += "\n"; // preserve line structure for error positions
        i = endIdx;
      } else {
        break; // last line, no newline at end
      }
      continue;
    }

    result += char;
  }

  return JSON.parse(result);
}

export function collectSourceFiles(config) {
  const ignored = new Set(config.ignoredDirs ?? []);
  const extensions = config.fileExtensions ?? [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];

  const roots = (config.sourceRoots ?? ["apps"])
    .map((dir) => join(ROOT, dir))
    .filter(isDirectory);

  return roots.flatMap((root) => walk(root, ignored, extensions, []));
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function walk(dir, ignored, extensions, files) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (ignored.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ignored, extensions, files);
    else if (matchesExtension(entry.name, extensions)) files.push(full);
  }
  return files;
}

function matchesExtension(name, extensions) {
  if (name.endsWith(".d.ts")) return false;
  return extensions.some((extension) => name.endsWith(extension));
}

export function toPosixRelative(absolutePath) {
  return relative(ROOT, absolutePath).split(sep).join("/");
}

/** Removes block comments, line comments and template literal bodies. */
export function stripNoise(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, "``");
}

export function report({ label, problems, reference }) {
  if (problems.length > 0) {
    console.error(`\n✖ ${label} failed — ${problems.length} problem(s)\n`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`\n${reference}\n`);
    process.exit(1);
  }
  console.log(`✓ ${label} passed.`);
}