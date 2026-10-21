import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const directory=process.env.GIDPS_CURVE_EVIDENCE_DIR??'test-results/damage-curve';
test('real 120s damage curve, attribution and user-visible latency',async({page})=>{
 test.setTimeout(150000);await mkdir(directory,{recursive:true});
 const painted=()=>page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
 const cold=performance.now();await page.goto('/calculator');await expect(page.locator('#calc-character')).toBeVisible();await painted();const coldCalculatorMs=performance.now()-cold;
 await page.locator('#calc-character').selectOption('character:10000034');await expect(page.locator('#calc-skill')).toBeEnabled();await page.locator('#calc-form').selectOption('noelle-burst-inactive');
 const skill=await page.locator('#calc-skill option').filter({hasText:'基础普攻第 1 下'}).getAttribute('value');await page.locator('#calc-skill').selectOption(skill!);
 const edits=[];
 for(const atk of [1000,1100,1200]){
  const start=performance.now();await page.locator('[data-field="build.stats.atk"]').fill(String(atk));
  await expect.poll(async()=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!).document.build.stats.atk).toBe(atk);await painted();
  const a=JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);expect(a.result.status).toBe('calculated');
  edits.push({atk,clickToPaintMs:performance.now()-start,expected:a.result.totals.expected});
 }
 expect(edits[2]!.expected).toBeGreaterThan(edits[0]!.expected);
 await page.addInitScript(()=>{
 document.addEventListener('click',e=>{if((e.target as HTMLElement).closest('#source-host-run'))(window as any).__sourceClick=performance.now();},true);
 document.addEventListener('source-host-timing',e=>{(window as any).__sourceTiming=(e as CustomEvent).detail;requestAnimationFrame(()=>requestAnimationFrame(()=>{(window as any).__sourceClickToPaint=performance.now()-(window as any).__sourceClick;}));});
 });
 await page.goto('/source-simulation');
 await page.locator('#source-host-config').evaluate(el=>{let p=el.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details')??null;}});
 await page.locator('#source-host-variant').selectOption('classic');await page.locator('#source-host-config').fill(await readFile(new URL('./fixtures/four-team-vv/vv.gcsim',import.meta.url),'utf8'));await page.locator('#source-host-seed').fill('12021');await page.locator('#source-host-stop-at-duration').check();
 const start=performance.now();await page.locator('#source-host-run').click();await expect(page.locator('#source-host-status')).toContainText(/本次运行完成|失败/,{timeout:110000});
 expect(await page.locator('#source-host-status').textContent()).toContain('本次运行完成');await expect(page.locator('[data-source-host-overview-total]')).toBeVisible();await painted();const single120ClickToPaintMs=performance.now()-start;
 const total=Number(await page.locator('[data-source-host-overview-total]').getAttribute('data-value'));
 const chartStart=performance.now();await page.locator('[data-source-curve] > summary').click();await expect(page.locator('[data-curve-svg]')).toBeVisible();await painted();const lazyCurveToPaintMs=performance.now()-chartStart;
 for(const dimension of ['actor','source','element','reaction']){
  const values=await page.locator(`[data-curve-table="${dimension}"] tbody tr`).evaluateAll(rows=>rows.map(row=>Number((row as HTMLElement).dataset.damage)));
  expect(values.reduce((a,b)=>a+b,0)).toBeCloseTo(total,6);
 }
 await page.locator('[data-source-curve]').screenshot({path:resolve(directory,'damage-curve.png')});
 await page.locator('[data-curve-filter="actor"]').selectOption('xiangling');await page.locator('[data-curve-filter="source"]').selectOption('Q');await page.locator('[data-curve-bin]').fill('119');await page.locator('[data-curve-bin]').dispatchEvent('input');
 await expect(page.locator('[data-curve-tooltip]')).toContainText('[119, 120)');await page.locator('[data-curve-mode]').selectOption('cumulative');await expect(page.locator('[data-curve-table="actor"] tbody tr')).toHaveCount(1);await expect(page.locator('[data-curve-table="source"] tbody tr')).toHaveCount(1);
 await page.locator('[data-source-curve]').screenshot({path:resolve(directory,'damage-curve-filtered.png')});
 await page.locator('[data-curve-filter="actor"]').selectOption('');await page.locator('[data-curve-filter="source"]').selectOption('');
 await page.locator('[data-curve-mode]').selectOption('events');await page.locator('[data-curve-start]').fill('0');await page.locator('[data-curve-end]').fill('180');await page.locator('[data-curve-zoom]').click();
 await page.locator('[data-curve-events] > summary').click();await expect(page.locator('[data-curve-event-table]')).toContainText('原始帧');
 const eventRows=await page.locator('[data-curve-event-table] tbody tr').evaluateAll(rows=>rows.map(row=>({id:Number((row as HTMLElement).dataset.eventId),frame:Number((row as HTMLElement).dataset.eventFrame)})));
 expect(eventRows.length).toBeGreaterThan(0);expect(eventRows.every(h=>Number.isInteger(h.frame)&&h.frame<180)).toBe(true);
 await page.locator('[data-source-curve]').screenshot({path:resolve(directory,'damage-curve-frames.png')});
 await page.locator('[data-curve-mode]').selectOption('cumulative');
 const points=await page.locator('[data-curve-step]').getAttribute('points');const pairs=points!.split(' ').map(s=>s.split(',').map(Number));
 for(let i=1;i<pairs.length;i++)expect(pairs[i]![0]===pairs[i-1]![0]||pairs[i]![1]===pairs[i-1]![1]).toBe(true);
 await page.locator('[data-source-curve]').screenshot({path:resolve(directory,'damage-curve-frame-cumulative.png')});

 await page.locator('#source-host-export').evaluate(el=>{el.closest('details')!.open=true;});const pending=page.waitForEvent('download');await page.locator('#source-host-export').click();const raw=JSON.parse(await readFile((await(await pending).path())!,'utf8'));await writeFile(resolve(directory,'real-120.capture.json'),JSON.stringify(raw));
 expect(raw.observationWindow.actualEndFrame).toBe(7200);expect(eventRows).toEqual(raw.applications.filter((a:any)=>a.frame>=0&&a.frame<180).slice(0,50).map((a:any)=>({id:a.id,frame:a.frame})));expect(raw.applications.filter((a:any)=>a.frame>=0&&a.frame<7200).reduce((sum:number,a:any)=>sum+a.appliedDamage,0)).toBe(total);
 let explanationToPaintMs: number | null = null;
 if(process.env.GIDPS_CURVE_COMPARE){
  const previous=JSON.parse(await readFile(resolve(process.env.GIDPS_CURVE_COMPARE,'real-120.capture.json'),'utf8'));
  for(const field of ['calculations','applications','randomness','abilityInvocations','energyApplications'])expect(raw[field],field).toEqual(previous[field]);
  const explainStart=performance.now();await page.locator('[data-source-explain-hit]').click();await expect(page.locator('#source-host-hit')).toContainText('记账差值 0');await painted();explanationToPaintMs=performance.now()-explainStart;
  await page.locator('[data-source-deferred="source-host-energy"] > summary').click();await expect(page.locator('#source-host-energy')).toContainText('公式重放');
 }
 await writeFile(resolve(directory,'latency.json'),JSON.stringify({coldCalculatorMs,edits,single120ClickToPaintMs,lazyCurveToPaintMs,explanationToPaintMs,actualClickToPaintMs:await page.evaluate(()=>(window as any).__sourceClickToPaint),timing:await page.evaluate(()=>(window as any).__sourceTiming),total,status:await page.locator('#source-host-status').textContent(),notes:'Cloud Chromium; automation wall time includes actionability, UI updates and two animation frames. Single120 includes fresh Worker/WASM setup and validation. Playback speed does not change computation.'},null,2));
});
