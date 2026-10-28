import {test,expect} from '@playwright/test';

test('Durin C2 E uses actual per-hit controls, keeps unknown blocked, and matches independent damage',async({page})=>{
  await page.goto('/calculator');await page.locator('#calc-character').selectOption('character:10000123');
  // White Q is also selectable now; select this E branch, never the first color match.
  const white=page.locator('#calc-skill option').filter({hasText:'转变·白化之是'});
  await expect(white).toHaveCount(1);
  await page.locator('#calc-skill').selectOption((await white.getAttribute('value'))!);
  await page.locator('#calc-constellation').selectOption('2');await page.locator('#calc-talent-level').fill('10');await page.locator('#calc-talent-level').blur();
  const values={characterLevel:'90','build.stats.atk':'2000','build.stats.critRate':'0.5','build.stats.critDamage':'1','enemy.level':'90','enemy.resistance':'0.1'};
  for(const [field,value] of Object.entries(values)){await page.locator(`input[data-field="${field}"]`).fill(value);await page.locator(`input[data-field="${field}"]`).blur();}
  const audit=async()=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
  expect((await audit()).result.status).toBe('blocked');
  const panel=page.locator('[data-calculator-inline-conditions]');
  const active=panel.locator('select[data-source-cast-state-field$="c2PyroBonusActive"]');
  const included=panel.locator('select[data-source-cast-state-field$="c2PyroBonusIncluded"]');
  await expect(active).toBeVisible();await expect(active).toHaveValue('unknown');await included.selectOption('0');
  expect((await audit()).result.status).toBe('blocked');await active.selectOption('0');
  let report=await audit();expect(report.result.status).toBe('calculated');
  await expect(panel).not.toHaveAttribute('open','');await panel.locator(':scope > summary').click();
  const base=2000*1.9008*.5*.9*1.5;
  expect(report.result.totals.expected).toBeCloseTo(base,8);
  await active.selectOption('1');report=await audit();expect(report.result.totals.expected).toBeCloseTo(base*1.5,8);
  await page.locator('input[data-field="hits.0.damageBonus"]').fill('0.5');await page.locator('input[data-field="hits.0.damageBonus"]').blur();
  await included.selectOption('1');report=await audit();expect(report.result.totals.expected).toBeCloseTo(base*1.5,8);
  await active.selectOption('0');report=await audit();expect(report.result.totals.expected).toBeCloseTo(base,8);
  const black=page.locator('#calc-skill option').filter({hasText:'转变·黑度之否'});
  await expect(black).toHaveCount(1);
  await page.locator('#calc-skill').selectOption((await black.getAttribute('value'))!);
  await expect(page.locator('[data-calculator-required-field="true"]')).toHaveCount(7);
  expect((await audit()).result.status).toBe('blocked');
  await page.locator('#calc-skill').selectOption((await white.getAttribute('value'))!);
  report=await audit();expect(report.document.gameContext.durinSkill.hitStates['durin-white-e']).toEqual({c2PyroBonusActive:false,c2PyroBonusIncluded:true});
  expect(report.result.totals.expected).toBeCloseTo(base,8);
});
