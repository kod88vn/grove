#!/usr/bin/env node
// Architecture guard: enforces the layer rules declared in ai-guard.config.json.
// Usage: node scripts/arch-check.mjs

import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

import {
  collectSourceFiles,
  loadConfig,
  report,
  toPosixRelative,
} from "./ai-guard-config.mjs";

const config = loadConfig();
const layers = config.layers ?? [];
const vendorSdks = config.vendorSdks ?? [];
const vendorAllowedLayers = new Set(config.vendorAllowedLayers ?? [3]);
const purityPatterns = (config.purityPatterns ?? []).map((rule) => ({
  re: new RegExp(rule.pattern),
  why: rule.why,
}));
const aliases = (config.importAliases ?? []).map((alias) => ({
  re: new RegExp(alias.pattern),
  path: alias.path,
}));

const violations = [];

function layerOfPath(posixPath) {
  for (const layer of layers) {
    if (layer.match.some((prefix) => posixPath.startsWith(prefix))) return layer;
  }
  return null;
}

function resolveSpecifier(specifier, fromPosixPath) {
  if (specifier.startsWith(".")) {
    return normalize(join(dirname(fromPosixPath), specifier)).split("\\").join("/");
  }
  for (const alias of aliases) {
    const match = alias.re.exec(specifier);
    if (match) return alias.path.replace(/\$(\d)/g, (_, index) => match[Number(index)] ?? "");
  }
  return null;
}

function importsIn(source) {
  const specifiers = [];
  const patterns = [
    /^\s*import\s+[^'"]*from\s+["']([^"']+)["']/gm,
    /^\s*import\s+["']([^"']+)["']/gm,
    /^\s*export\s+[^'"]*from\s+["']([^"']+)["']/gm,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gm,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gm,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

function isVendorSdk(specifier) {
  return vendorSdks.some((sdk) =>
    sdk.endsWith("/") ? specifier.startsWith(sdk) : specifier === sdk || specifier.startsWith(`${sdk}/`),
  );
}

function isRelativeOrAliased(specifier) {
  return specifier.startsWith(".") || aliases.some((alias) => alias.re.test(specifier));
}

function checkAllowedExternal(layer, specifier, relPath) {
  if (!layer.allowedExternal) return;
  if (isRelativeOrAliased(specifier)) return;
  if (layer.allowedExternal.includes(specifier)) return;
  violations.push(
    `${relPath}: L${layer.level} ${layer.name} imported "${specifier}" — only [${layer.allowedExternal.join(", ")}] are allowed here`,
  );
}

function checkDownwardOnly(layer, specifier, relPath) {
  const resolved = resolveSpecifier(specifier, relPath);
  if (!resolved) return;
  const target = layerOfPath(resolved);
  if (target && target.level > layer.level) {
    violations.push(
      `${relPath}: L${layer.level} ${layer.name} imports L${target.level} ${target.name} ("${specifier}") — dependencies point downward only`,
    );
  }
}

function checkVendorPlacement(layer, specifier, relPath) {
  if (!isVendorSdk(specifier)) return;
  if (layer.noVendor) {
    violations.push(
      `${relPath}: L${layer.level} ${layer.name} must contain interfaces only, but imports the vendor SDK "${specifier}"`,
    );
    return;
  }
  if (!vendorAllowedLayers.has(layer.level)) {
    violations.push(
      `${relPath}: vendor SDK "${specifier}" imported in L${layer.level} ${layer.name} — put it behind a port and an adapter`,
    );
  }
}

function checkPurity(layer, source, relPath) {
  if (!layer.pure) return;
  for (const { re, why } of purityPatterns) {
    if (re.test(source)) {
      violations.push(`${relPath}: L${layer.level} ${layer.name} must be pure but this file ${why}`);
    }
  }
}

function checkFile(absolutePath) {
  const relPath = toPosixRelative(absolutePath);
  const layer = layerOfPath(relPath);
  if (!layer) return;

  const source = readFileSync(absolutePath, "utf8");

  for (const specifier of importsIn(source)) {
    checkAllowedExternal(layer, specifier, relPath);
    checkDownwardOnly(layer, specifier, relPath);
    checkVendorPlacement(layer, specifier, relPath);
  }

  checkPurity(layer, source, relPath);
}

if (layers.length === 0) {
  console.error("\n✖ arch:check — no layers configured in ai-guard.config.json.\n");
  process.exit(1);
}

const files = collectSourceFiles(config);

if (files.length === 0) {
  console.log("arch:check — no source files yet, nothing to check.");
  process.exit(0);
}

for (const file of files) checkFile(file);

report({
  label: "arch:check",
  problems: violations,
  reference: "See AGENTS.md §3. Dependencies point downward only.",
});