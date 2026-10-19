import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// One reproducible production interaction, for diagnosis rather than a throughput benchmark.
const label = process.argv[2];
if (!label || !/^[a-z-]+$/.test(label)) throw new Error('Supply an output label');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173/calculator');
  await page.locator('#calc-character').selectOption('character:10000027');
  const option = page.locator('#calc-skill option').filter({ hasText: '有璇玑屏' });
  await option.waitFor({ state: 'attached' });
  await page.locator('#calc-skill').selectOption(await option.getAttribute('value'));
  await page.locator('#calc-talent-level').fill('1');
  await page.locator('#calc-talent-level').press('Tab');
  await page.locator('[data-field="build.stats.atk"]').fill('2000');
  await page.locator('[data-field="build.stats.critRate"]').fill('0.5');
  await page.locator('[data-field="build.stats.critDamage"]').fill('1');
  const fields = { 'stats.atk': 1000, 'stats.hp': 10000, 'stats.def': 700, 'stats.em': 0,
    'stats.critRate': 0.2, 'stats.critDamage': 0.5, characterLevel: 90, ascension: 4,
    damageBonus: 0.3, additiveBaseDamage: 0, reactionBonus: 0 };
  for (const [key, value] of Object.entries(fields)) await page.locator(`[data-ningguang-snapshot="${key}"]`).fill(String(value));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  const start = performance.now();
  await page.locator('#calc-ningguang-snapshot-apply').click();
  const milliseconds = performance.now() - start;
  const { profile } = await cdp.send('Profiler.stop');
  const state = await page.locator('#calc-results').evaluate(root => ({
    elements: root.querySelectorAll('*').length, htmlBytes: new TextEncoder().encode(root.innerHTML).length,
    hitCards: root.querySelectorAll('.calculator-hit-card').length,
    expected: root.querySelector('[data-testid="calc-expected"]')?.textContent,
  }));
  if (state.expected !== '10,401.2856' || state.hitCards !== 12) throw new Error(`Unexpected result ${JSON.stringify(state)}`);
  const nodes = new Map(profile.nodes.map(node => [node.id, node]));
  const times = new Map();
  for (let index = 0; index < profile.samples.length; index++) {
    const node = nodes.get(profile.samples[index]);
    const key = `${node.callFrame.functionName} ${node.callFrame.url}:${node.callFrame.lineNumber + 1}`;
    times.set(key, (times.get(key) ?? 0) + profile.timeDeltas[index]);
  }
  const output = { label, at: new Date().toISOString(), milliseconds, ...state,
    cpuTop: [...times].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([frame, us]) => ({ frame, ms: us / 1000 })),
    note: 'Single instrumented interaction. CPU profiler enabled; not a repeated benchmark.' };
  await writeFile(`docs/validation/calculator-render-${label}.json`, JSON.stringify(output, null, 2) + '\n');
  await writeFile(`docs/validation/calculator-render-${label}.cpuprofile`, JSON.stringify(profile));
  console.log(JSON.stringify(output, null, 2));
} finally { await browser.close(); }
