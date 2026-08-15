#!/usr/bin/env node
// Code quality guard: enforces the size and hygiene limits declared in ai-guard.config.json.
// Usage: node scripts/quality-check.mjs

import { readFileSync } from "node:fs";

import {
  collectSourceFiles,
  loadConfig,
  report,
  stripNoise,
  toPosixRelative,
} from "./ai-guard-config.mjs";

const config = loadConfig();
const limits = config.limits ?? {};
const bannedFilenames = config.bannedFilenames ?? [];
const testFilePattern = new RegExp(config.testFilePattern ?? "\\.(test|spec)\\.[jt]sx?$");
const bannedPatterns = (config.bannedPatterns ?? []).map((rule) => ({
  re: new RegExp(rule.pattern, rule.flags ?? ""),
  what: rule.what,
  raw: rule.raw === true,
  scope: rule.scope ? new RegExp(rule.scope) : null,
  exclude: rule.exclude ? new RegExp(rule.exclude) : null,
}));

const problems = [];

function checkFileSize(relPath, source) {
  const lines = source.split("\n").length;
  if (limits.fileLines && lines > limits.fileLines) {
    problems.push(
      `${relPath}: ${lines} lines (limit ${limits.fileLines}) — split by responsibility, not by line count`,
    );
  }
}

function checkFilename(relPath) {
  const name = relPath.split("/").pop();
  if (bannedFilenames.includes(name)) {
    problems.push(
      `${relPath}: "${name}" names a bucket, not a responsibility — name the file after the concept it owns`,
    );
  }
}

/** Walks braces to measure the body of each function-like declaration. */
function checkFunctions(relPath, source) {
  const code = stripNoise(source);
  const declaration =
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(|(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?\(/g;

  for (const match of code.matchAll(declaration)) {
    const name = match[1] ?? match[2];
    const openParen = code.indexOf("(", match.index + match[0].length - 1);
    if (openParen === -1) continue;

    const params = readBalanced(code, openParen, "(", ")");
    if (params) reportParameterCount(relPath, name, params.inner);

    const braceStart = code.indexOf("{", params ? params.end : openParen);
    if (braceStart === -1) continue;
    const body = readBalanced(code, braceStart, "{", "}");
    if (!body) continue;

    reportBodySize(relPath, name, body.inner);
  }
}

function reportParameterCount(relPath, name, rawParams) {
  const count = splitTopLevel(rawParams).filter((part) => part.trim().length > 0).length;
  if (limits.parameters && count > limits.parameters) {
    problems.push(
      `${relPath}: ${name}() takes ${count} parameters (limit ${limits.parameters}) — pass a single typed options object`,
    );
  }
}

function reportBodySize(relPath, name, body) {
  const bodyLines = body.split("\n").length;
  if (limits.functionLines && bodyLines > limits.functionLines) {
    problems.push(
      `${relPath}: ${name}() is ${bodyLines} lines (limit ${limits.functionLines}) — extract a named helper; one level of abstraction per function`,
    );
  }
  const depth = maxDepth(body);
  if (limits.nestingDepth && depth > limits.nestingDepth) {
    problems.push(
      `${relPath}: ${name}() nests ${depth} levels deep (limit ${limits.nestingDepth}) — use guard clauses or a lookup table`,
    );
  }
}

function readBalanced(text, startIndex, open, close) {
  if (text[startIndex] !== open) return null;
  let depth = 0;
  for (let i = startIndex; i < text.length; i += 1) {
    if (text[i] === open) depth += 1;
    else if (text[i] === close) {
      depth -= 1;
      if (depth === 0) return { inner: text.slice(startIndex + 1, i), end: i + 1 };
    }
  }
  return null;
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if ("([{<".includes(char)) depth += 1;
    else if (")]}>".includes(char)) depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  return parts;
}

function maxDepth(body) {
  let depth = 0;
  let max = 0;
  for (const char of body) {
    if (char === "{") {
      depth += 1;
      max = Math.max(max, depth);
    } else if (char === "}") depth -= 1;
  }
  return max;
}

function checkBannedPatterns(relPath, source) {
  const code = stripNoise(source);
  for (const rule of bannedPatterns) {
    if (rule.scope && !rule.scope.test(relPath)) continue;
    if (rule.exclude && rule.exclude.test(relPath)) continue;
    if (rule.re.test(rule.raw ? source : code)) problems.push(`${relPath}: contains ${rule.what}`);
  }
}

function checkTestHygiene(relPath, source) {
  if (!testFilePattern.test(relPath)) return;
  if (!/\bexpect\s*\(|\bassert\b/.test(source)) {
    problems.push(
      `${relPath}: test file has no assertion — a test with no assertion is not a test`,
    );
  }
  if (/\b(it|test|describe)\.only\b/.test(source)) {
    problems.push(`${relPath}: contains .only — this silently disables the rest of the suite`);
  }
  if (/\b(it|test|describe)\.skip\b|\btest\.todo\b/.test(source)) {
    problems.push(`${relPath}: contains a skipped test`);
  }
}

const files = collectSourceFiles(config).filter((file) => !file.endsWith("ai-guard-config.mjs"));

if (files.length === 0) {
  console.log("quality:check — no source files yet, nothing to check.");
  process.exit(0);
}

for (const file of files) {
  const relPath = toPosixRelative(file);
  const source = readFileSync(file, "utf8");
  checkFileSize(relPath, source);
  checkFilename(relPath);
  checkFunctions(relPath, source);
  checkBannedPatterns(relPath, source);
  checkTestHygiene(relPath, source);
}

report({
  label: "quality:check",
  problems,
  reference: "See AGENTS.md §4. Do not disable a rule to pass it.",
});