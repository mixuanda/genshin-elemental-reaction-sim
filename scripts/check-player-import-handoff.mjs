// Read-only receipt gate. Never applies a patch or downloads code.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/check-player-import-handoff.mjs /absolute/path/full.patch');
const bytes = readFileSync(file);
const expected = '5b083dd098fe66b713bce928d6fef8ae857343a24443b7e0c57e822b798d2be5';
if (bytes.length !== 203115 || createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Incomplete or different patch; no application attempted.');
const expectedFiles = [
'apps/player-import/e2e/import.spec.ts','apps/player-import/env.d.ts','apps/player-import/index.html','apps/player-import/main.ts','apps/player-import/playwright.config.ts','apps/player-import/style.css','apps/player-import/tsconfig.json','apps/player-import/vite.config.ts',
'packages/player-import/fixtures/synthetic-enka.json','packages/player-import/fixtures/synthetic-good.json','packages/player-import/fixtures/synthetic-hutao-multi.txt','packages/player-import/scripts/generate-catalog.mjs',
...['adapters.ts','catalog.generated.json','catalog.ts','core-handoff.test.ts','core-handoff.ts','hutao-text.test.ts','hutao-text.ts','import-contract.test.ts','import.ts','index.ts','input.ts','model.ts','name-map.ts','normalize.ts'].map(f=>'packages/player-import/src/'+f)
].sort();
const blocks = bytes.toString('utf8').split(/^diff --git /m).slice(1);
const names = blocks.map(block => {
 const match = block.match(/^a\/(\S+) b\/(\S+)\n/);
 if (!match || match[1] !== match[2] || !/^new file mode 100644$/m.test(block)) throw new Error('Expected only regular new files.');
 return match[2];
}).sort();
if (JSON.stringify(names) !== JSON.stringify(expectedFiles)) throw new Error('Unexpected file manifest.');
execFileSync('git', ['apply', '--check', resolve(file)], { stdio: 'inherit' });
console.log(JSON.stringify({sha256:expected,bytes:bytes.length,newFiles:names.length,applyCheck:'passed',applied:false}));
