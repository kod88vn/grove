#!/usr/bin/env node
/**
 * sync-cline-mcp.js
 *
 * Syncs .vscode/mcp-shared.json into Cline-compatible MCP settings.
 * Outputs to .vscode/cline_mcp_settings.json (project-local).
 *
 * Usage: node .vscode/sync-cline-mcp.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SHARED_CONFIG = path.join(ROOT, ".vscode", "mcp-shared.json");
const OUTPUT = path.join(ROOT, ".vscode", "cline_mcp_settings.json");

// Cline-only servers that are NOT in the shared config.
// If you add a new server to mcp-shared.json, remove it from here (it will be synced automatically).
// Only put servers that Cline uses exclusively in this block.
const CLINE_ONLY_SERVERS = {};

function readJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function sharedToClineFormat(sharedConfig) {
  const result = {};
  for (const [name, server] of Object.entries(sharedConfig.servers)) {
    if (name === "_comment") continue;

    const id = `mcp-${name}`;
    result[id] = {
      command: server.command,
      args: server.args || [],
      env: server.env || {},
      disabled: false,
      autoApprove: []
    };
  }
  return result;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const sharedConfig = readJSON(SHARED_CONFIG);
  const clineFormat = sharedToClineFormat(sharedConfig);

  // Merge Cline-only servers
  for (const [id, server] of Object.entries(CLINE_ONLY_SERVERS)) {
    clineFormat[id] = server;
  }

  const output = { mcpServers: clineFormat };

  if (dryRun) {
    console.log("=== Generated Cline MCP settings (dry run) ===");
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  writeJSON(OUTPUT, output);
  console.log(`✓ Cline MCP settings written to ${OUTPUT}`);
  console.log("  To apply: copy .vscode/cline_mcp_settings.json to your Cline settings,");
  console.log("  or paste the mcpServers object into Cline's MCP configuration UI.");
}

main();