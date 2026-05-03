import fetch from 'node-fetch';
import fs from 'fs';

const API = process.env.SKILL_API || 'http://127.0.0.1:3456';

async function main(){
  console.log('Fetching skills from', API);
  const r = await fetch(`${API}/skills`);
  const skillsPayload = await r.json();
  const skills = Array.isArray(skillsPayload)
    ? skillsPayload
    : (skillsPayload && Array.isArray(skillsPayload.skills) ? skillsPayload.skills : []);
  console.log('Skills:');
  skills.forEach(s => console.log('-', s.name, `(${s.category})`));

  console.log('\nFetching tools (ollama format)');
  const r2 = await fetch(`${API}/export?format=ollama`);
  const tools = await r2.json();
  fs.writeFileSync('tools.json', JSON.stringify(tools, null, 2));
  console.log('Saved tools.json with', (tools || []).length, 'entries');
}

main().catch(err => { console.error(err); process.exit(1); });
