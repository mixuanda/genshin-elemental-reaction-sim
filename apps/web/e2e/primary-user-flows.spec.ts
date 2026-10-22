import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = process.env.GIDPS_UI_EVIDENCE ?? 'test-results/primary-flows';

test('home leads to a real single-skill formula and exact required-condition controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'开始计算'})).toBeVisible();
  await page.getByRole('button', {name:'打开技能计算器',exact:true}).click();
  await page.locator('#calc-character').selectOption('character:10000015');
  const frost = page.locator('#calc-skill option').filter({hasText:'霜袭·命中'});
  await expect(frost).toHaveCount(1);
  await page.locator('#calc-skill').selectOption((await frost.getAttribute('value'))!);
  for (const [key,value] of Object.entries({'build.stats.atk':'1700','build.stats.critRate':'0.4','build.stats.critDamage':'1','hits.0.damageBonus':'0.616'})) {
    await page.locator(`[data-field="${key}"]`).fill(value);
    await page.locator(`[data-field="${key}"]`).blur();
  }
  const audit = () => page.locator('#calc-results .calculator-audit pre').textContent().then(value=>JSON.parse(value!));
  const kaeya = await audit();
  expect(kaeya.document.gameContext.skillId).toBe('kaeya-skill');
  expect(kaeya.result.totals.expected).toBeCloseTo(1700*3.4416*1.616*0.5*0.9*1.4, 7);
  await expect(page.getByTestId('calc-expected')).toBeVisible();
  await mkdir(output,{recursive:true});
  await writeFile(`${output}/single-skill.json`,JSON.stringify(kaeya,null,2));
  await page.locator('#calculatorHost').screenshot({path:`${output}/single-skill.png`});

  await page.locator('#calc-character').selectOption('character:10000042');
  const burst=page.locator('#calc-skill option').filter({hasText:'天街巡游·完整十击'});
  await page.locator('#calc-skill').selectOption((await burst.getAttribute('value'))!);
  await page.locator('#calc-constellation').selectOption('4');
  await expect(page.getByTestId('calculator-required-inputs')).toBeVisible();
  const prompt=page.locator('[data-calculator-requirement]').filter({hasText:'本击快照时 C4 有效'}).first();
  await prompt.click();
  const target=page.locator('select[data-keqing-state-field$=".c4Active"]').first();
  await expect(target).toBeFocused();
  // Follow each visible prompt; the product opens the exact existing condition control.
  for(let i=0;i<20;i++) {
    const next=page.locator('[data-calculator-requirement]').first();
    if(!await next.count()) break;
    const selector=await next.getAttribute('data-calculator-requirement');
    await next.click();
    await page.locator(selector!).selectOption('0');
  }
  expect((await audit()).result.status).toBe('calculated');
});

test('candidate card loads the actual four-person action editor and produces damage', async ({ page }) => {
  test.setTimeout(120000);
  const failures:string[]=[];
  page.on('pageerror',error=>failures.push(error.message));
  await page.goto('/');
  await page.getByRole('button',{name:'挑选入门队伍',exact:true}).click();
  await expect(page.getByRole('heading',{name:'队伍候选',exact:true})).toBeVisible();
  await page.locator('[data-team-candidates-search]').fill('胡桃 行秋 夜兰');
  const card=page.locator('[data-team-candidate-id="vaporize-hydro-pyro"]');
  await expect(card).toContainText('钟离');
  await card.locator('[data-team-candidate-use]').click();
  await expect(page).toHaveURL(/\/source-simulation$/);
  await expect(page.locator('[data-member-tab]')).toHaveCount(4);
  await expect(page.locator('[data-draft-name]')).toHaveValue('水火蒸发入门');
  await expect(page.locator('[data-run-direct]')).toBeEnabled();
  await page.locator('[data-run-direct]').click();
  const total=page.locator('[data-source-host-overview-total]');
  await expect(total).toBeVisible({timeout:90000});
  expect(Number(await total.getAttribute('data-value'))).toBeGreaterThan(0);
  await expect(page.locator('[data-source-host-overview-dps]')).not.toContainText('未知');
  await expect(page.locator('[data-source-host-actor-damage]')).toHaveCount(4);
  expect(failures).toEqual([]);
  await mkdir(output,{recursive:true});
  await writeFile(`${output}/team-result.txt`,await page.locator('[data-source-host-result-overview]').innerText());
  await page.locator('[data-source-host-result-overview]').screenshot({path:`${output}/team-result.png`});
});
