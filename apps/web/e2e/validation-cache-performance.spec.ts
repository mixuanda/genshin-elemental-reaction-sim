import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const directory=process.env.GIDPS_CURVE_EVIDENCE_DIR!;
test('real 120s validation cache preserves all recorded events',async({page})=>{
 test.skip(!process.env.GIDPS_CURVE_EVIDENCE_DIR || !process.env.GIDPS_CURVE_COMPARE, 'Explicit saved real baseline required for this opt-in performance comparison.');
 test.setTimeout(150000);await mkdir(directory,{recursive:true});
 const painted=()=>page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
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
 await page.locator('#source-host-export').evaluate(el=>{el.closest('details')!.open=true;});const pending=page.waitForEvent('download');await page.locator('#source-host-export').click();const raw=JSON.parse(await readFile((await(await pending).path())!,'utf8'));await writeFile(resolve(directory,'real-120.capture.json'),JSON.stringify(raw));

 const previous=JSON.parse(await readFile(resolve(process.env.GIDPS_CURVE_COMPARE!,'real-120.capture.json'),'utf8'));
 for(const field of ['calculations','applications','randomness','abilityInvocations','energyApplications','healingApplications'])expect(raw[field],field).toEqual(previous[field]);
 await writeFile(resolve(directory,'latency.json'),JSON.stringify({single120ClickToPaintMs,actualClickToPaintMs:await page.evaluate(()=>(window as any).__sourceClickToPaint),timing:await page.evaluate(()=>(window as any).__sourceTiming),total},null,2));
});
