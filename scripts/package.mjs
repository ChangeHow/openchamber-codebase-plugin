import { readFile, writeFile } from 'node:fs/promises';

import { parseManifest } from '@openchamber/sdk/schemas';

const root = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = structuredClone(root.openchamber);
manifest.contributes.panel.entry = 'index.html';
manifest.contributes.service.entry = 'service/main.js';
const packaged = {
  name: root.name,
  version: root.version,
  private: true,
  type: 'module',
  openchamber: manifest,
};
const result = parseManifest(packaged);
if (!result.ok) throw new Error(`Invalid extension manifest: ${JSON.stringify(result)}`);
await writeFile('dist/package.json', `${JSON.stringify(packaged, null, 2)}\n`);
console.log('Built an SDK-valid local-service extension. Native extension-owned sign-in remains a proposal.');
