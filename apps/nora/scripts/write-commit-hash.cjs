const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let commit = '';
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {}

const envPath = path.resolve(__dirname, '../.env.local');
let env = '';
if (fs.existsSync(envPath)) {
  env = fs.readFileSync(envPath, 'utf8');
  env = env.replace(/^NEXT_PUBLIC_COMMIT_HASH=.*/m, '').replace(/^\s*\n/gm, '');
}
if (commit) env += `\nNEXT_PUBLIC_COMMIT_HASH=${commit}\n`;
fs.writeFileSync(envPath, env.trim() + '\n');
console.log('Wrote commit hash:', commit);
