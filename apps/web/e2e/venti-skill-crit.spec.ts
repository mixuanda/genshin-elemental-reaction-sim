import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

// Upstream fix 2f1dc6a / PR3210: neither press nor hold E always hits a weakspot.
// CR deltas below control a formula boundary, not a claimed legal artifact build.
for (const variant of ['classic', 'stellar'] as const) for (const scenario of [
  { name: 'zero', delta: -.05, seed: '1' },
  { name: 'full', delta: .95, seed: '1' },
  { name: 'mixed-one', delta: .45, seed: '1' },
  { name: 'mixed-two', delta: .45, seed: '2' },
]) test(`${variant} Venti E uses actual crit rate: ${scenario.name}`, async ({ page }, info) => {
  await page.goto('/source-simulation');
  const open = async (selector: string) => page.locator(selector).evaluate(el => {
    for (let p = el.parentElement; p; p = p.parentElement) if (p instanceof HTMLDetailsElement) p.open = true;
  });
  await open('#source-host-variant');
  await page.locator('#source-host-variant').selectOption(variant);
  const config = `options iteration=1 duration=120;
venti char lvl=90/90 cons=0 talent=1,9,9;
venti add weapon="huntersbow" refine=1 lvl=1/20;
venti add stats atk=1000 cr=${scenario.delta} cd=0.5;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active venti;
${Array.from({ length: 4 }, () => 'venti skill; wait(400);').join('\n')}
venti skill[hold=1]; wait(1000);
${Array.from({ length: 4 }, () => 'venti skill; wait(400);').join('\n')}`;
  await open('#source-host-config'); await page.locator('#source-host-config').fill(config);
  await open('#source-host-seed'); await page.locator('#source-host-seed').fill(scenario.seed);
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toHaveText(/本次运行完成|失败/, { timeout: 60000 });
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成');
  await open('#source-host-export'); const pending = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  const r = JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SourceHostResult;
  await writeFile(info.outputPath('venti-crit.capture.json'), JSON.stringify(r));
  const requests = new Map(r.calculations.map(c => [c.request.id, c.request]));
  expect(r.applications).toHaveLength(9);
  let crits = 0;
  for (const hit of r.applications) {
    const q = requests.get(hit.calculationId)!;
    if (q.kind !== 'damage') throw Error('Expected a damage request');
    expect(q.actorKey).toBe('venti'); expect(q.input.critRate).toBeCloseTo(.05 + scenario.delta, 12);
    expect(q.input.hitWeakPoint).toBe(false);
    expect(typeof q.input.critRoll).toBe('number');
    expect(hit.isCrit).toBe(q.input.critRoll! < Math.max(0, Math.min(1, q.input.critRate)));
    expect(q.input.scaling).toBe(q.ability.endsWith('(Hold)') ? 6.46 : 4.692);
    const attack = q.snapshot.baseAtk * (1 + q.snapshot.atkPct) + q.snapshot.flatAtk;
    const expected = attack * q.input.scaling * .5 * .9 * (hit.isCrit ? 1 + q.snapshot.critDamage : 1);
    expect(hit.rawDamage).toBeCloseTo(expected, 8);
    expect(Number.isInteger(hit.frame)).toBe(true);
    if (hit.isCrit) crits++;
  }
  if (scenario.name === 'zero') expect(crits).toBe(0);
  else if (scenario.name === 'full') expect(crits).toBe(9);
  else { expect(crits).toBeGreaterThan(0); expect(crits).toBeLessThan(9); }
  console.log('VENTI_CRIT', JSON.stringify({ variant, scenario: scenario.name, seed: scenario.seed, crits, hits: r.applications.length, total: r.applications.reduce((s, a) => s + a.rawDamage, 0) }));
});
