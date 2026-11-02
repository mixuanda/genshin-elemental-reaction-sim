import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('Kinich C1 manual cannon is usable, rejects 19 points and reopens with exact damage',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/calculator');await page.locator('#calc-character').selectOption('character:10000101');
  const option=page.locator('#calc-skill option').filter({hasText:'迴猎贯鳞炮·一击'});await expect(option).toHaveCount(1);await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
  await page.locator('#calc-constellation').selectOption('1');await page.locator('[data-source-cast-state-field="gameContext.kinichDamage.nightsoulBlessingActive"]').selectOption('1');
  for(const [key,value] of [['cannonPointsBeforeUse','19'],['a4Stacks','0']] as const){const input=page.locator(`[data-field="gameContext.kinichDamage.${key}"]`);await input.fill(value);await input.blur();}
  const audit=async()=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
  expect((await audit()).result.status).toBe('blocked');const points=page.locator('[data-field="gameContext.kinichDamage.cannonPointsBeforeUse"]');await points.fill('20');await points.blur();
  const r=await audit();expect(r.result.status).toBe('calculated');
  // Default explicit teaching panel: ATK2000, CR70%, CD120%, enemy90/10% resistance.
  expect(r.result.totals.expected).toBeCloseTo(2000*12.37392*.5*.9*(1+.7*2.2),8);
  const expected=r.result.totals.expected,download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const saved=await readFile((await(await download).path())!,'utf8');
  await page.reload();await page.locator('#calc-import').setInputFiles({name:'kinich-manual.json',mimeType:'application/json',buffer:Buffer.from(saved)});expect((await audit()).result.totals.expected).toBe(expected);
  expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('kinich-manual.png'),fullPage:true});
});
