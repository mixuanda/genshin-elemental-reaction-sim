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
  const target=page.locator('[data-calculator-inline-conditions] select[data-keqing-state-field$=".c4Active"]').first();
  await expect(target).toBeVisible();await target.focus();await expect(target).toBeFocused();
  // Use the actual in-place fields; the original input is moved, never copied.
  for(let i=0;i<20;i++) {
    const next=page.locator('[data-calculator-required-field="true"]').first();
    if(!await next.count()) break;
    await next.locator('select').selectOption('0');
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
  // The result previously put inherited pale text on an undefined white surface.
  // Check what users can actually read, rather than a particular CSS declaration.
  const contrast = await total.evaluate(element => {
    const luminance = (color: string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => {
        const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
      });
      return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
    };
    const a = luminance(getComputedStyle(element).color);
    const b = luminance(getComputedStyle(element.parentElement!).backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  expect(failures).toEqual([]);
  await mkdir(output,{recursive:true});
  await writeFile(`${output}/team-result.txt`,await page.locator('[data-source-host-result-overview]').innerText());
  await page.locator('[data-source-host-result-overview]').screenshot({path:`${output}/team-result.png`});
});
