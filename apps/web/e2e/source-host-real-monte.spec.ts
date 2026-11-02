import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const directory=process.env.GIDPS_MONTE_EVIDENCE_DIR??'test-results/real-monte';
async function setup(page:Page,config:string){
 await page.addInitScript(()=>{const Native=window.Worker;const stats={created:0,terminated:0};(window as any).__monteWorkers=stats;window.Worker=class extends Native {ended=false;constructor(...args:ConstructorParameters<typeof Worker>){super(...args);stats.created++;}override terminate(){if(!this.ended){this.ended=true;stats.terminated++;}super.terminate();}};});
 await page.goto('/source-simulation');
 for(const id of ['#source-host-config','#source-monte-count'])await page.locator(id).evaluate(el=>{let p=el.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details')??null;}});
 await page.locator('#source-host-variant').selectOption('classic');await page.locator('#source-host-config').fill(config);
 await page.locator('#source-monte-energy').selectOption('full');await page.locator('#source-monte-seed').fill('12021');
}
async function run(page:Page,name:string,count:number,workers:number,budget=300){
 await page.locator('#source-monte-count').fill(String(count));await page.locator('#source-monte-workers').selectOption(String(workers));await page.locator('#source-monte-budget').fill(String(budget));
 await page.locator('#source-monte-run').click();
 await expect(page.locator('#source-monte-status')).toContainText(/^(complete|failed|budget|cancelled)：/,{timeout:(budget+20)*1000});
 const wait=page.waitForEvent('download');await page.locator('#source-monte-export').click();const raw=JSON.parse(await readFile((await(await wait).path())!,'utf8'));
 await writeFile(resolve(directory,`${name}.json`),JSON.stringify(raw,null,2));
 expect(await page.evaluate(()=>{const s=(window as any).__monteWorkers;return s.created-s.terminated;})).toBe(0);
 return raw;
}
test('real legal four-team 120s serial/parallel per-trial identity and cancellation',async({page})=>{
 test.setTimeout(600000);await mkdir(directory,{recursive:true});
 const config=await readFile(new URL('./fixtures/four-team-vv/vv.gcsim',import.meta.url),'utf8');await setup(page,config);
 const a=await run(page,'pilot-serial',4,1),b=await run(page,'pilot-parallel',4,2);
 for(const r of [a,b]){expect(r.status,JSON.stringify(r.errors)).toBe('complete');expect(r.counts.succeeded).toBe(4);for(const t of r.trials){expect(t.durationSeconds).toBe(120);expect(t.crits).toBeGreaterThan(0);expect(t.crits).toBeLessThan(t.ordinaryHits);}}
 expect(a.trials.map(({elapsedMs,...t}:any)=>t)).toEqual(b.trials.map(({elapsedMs,...t}:any)=>t));expect(a.statistics).toEqual(b.statistics);
 await page.locator('#source-monte-count').fill('1000');await page.locator('#source-monte-run').click();await expect(page.locator('#source-monte-status')).toContainText(/运行 [12]/);
 await page.locator('#source-monte-cancel').click();await expect(page.locator('#source-monte-status')).toContainText(/^cancelled/);
 const pending=page.waitForEvent('download');await page.locator('#source-monte-export').click();const c=JSON.parse(await readFile((await(await pending).path())!,'utf8'));await writeFile(resolve(directory,'cancelled.json'),JSON.stringify(c,null,2));expect(c.counts.succeeded).toBe(0);expect(c.counts.cancelled).toBeGreaterThan(0);
 expect(await page.evaluate(()=>{const s=(window as any).__monteWorkers;return s.created-s.terminated;})).toBe(0);
 await page.screenshot({path:resolve(directory,'real-monte-panel.png'),fullPage:true});
});
for(const [label,cr,expected] of [['zero',-.05,0],['full',.95,1]] as const)test(`real crit ${label} controlled boundary`,async({page})=>{
 test.setTimeout(150000);await mkdir(directory,{recursive:true});const base=await readFile(new URL('./fixtures/four-team-vv/vv.gcsim',import.meta.url),'utf8');
 // Controlled test override, not a legal artifact-build claim.
 const config=base.replace(/\bcr=[\d.]+/g,`cr=${cr}`);await writeFile(resolve(directory,`crit-${label}.gcsim`),config);await setup(page,config);
 const r=await run(page,`crit-${label}`,1,1,120);expect(r.status,JSON.stringify(r.errors)).toBe('complete');const t=r.trials[0];expect(t.crits).toBe(expected*t.ordinaryHits);expect(t.ordinaryHits).toBeGreaterThan(50);expect(t.conditionalHitExpectation).toBeCloseTo(t.damage,7);
});
test('measured-budget actual batch',async({page})=>{
 test.skip(!process.env.GIDPS_MONTE_SCALE,'Scale only after measured pilot; never duplicate automatically.');test.setTimeout(1100000);await mkdir(directory,{recursive:true});const config=await readFile(new URL('./fixtures/four-team-vv/vv.gcsim',import.meta.url),'utf8');await setup(page,config);
 const resources:Array<{at:string;memoryBytes:number}>=[];const timer=setInterval(()=>{void readFile('/sys/fs/cgroup/memory.current','utf8').then(v=>{resources.push({at:new Date().toISOString(),memoryBytes:Number(v)});});},5000);
 try{const r=await run(page,'scale-1000',1000,2,900);expect(['complete','budget']).toContain(r.status);expect(r.counts.failed).toBe(0);expect(r.counts.succeeded).toBeGreaterThan(0);}finally{clearInterval(timer);await writeFile(resolve(directory,'scale-resources.json'),JSON.stringify(resources,null,2));}
});

test('real batch failure stays partial and SPA navigation terminates workers',async({page})=>{
 test.setTimeout(90000);await mkdir(directory,{recursive:true});
 await setup(page,'this is intentionally invalid GCSL;');
 const bad=await run(page,'invalid-config',2,1,30);
 expect(bad.status).toBe('failed');expect(bad.counts).toEqual({requested:2,succeeded:0,failed:1,cancelled:0,notStarted:1,running:0});expect(bad.statistics).toBeNull();expect(bad.errors.length).toBeGreaterThan(0);
 const config=await readFile(new URL('./fixtures/four-team-vv/vv.gcsim',import.meta.url),'utf8');await page.locator('#source-host-config').fill(config);await page.locator('#source-monte-count').fill('1000');await page.locator('#source-monte-workers').selectOption('2');await page.locator('#source-monte-run').click();
 await expect(page.locator('#source-monte-status')).toContainText(/运行 [12]/);
 const before=await page.evaluate(()=>(window as any).__monteWorkers.created);
 await page.locator('.product-nav a[href="/calculator"]').click();await expect(page).toHaveURL(/\/calculator$/);
 const cleanup=await page.evaluate(()=>(window as any).__monteWorkers);
 expect(cleanup.created).toBe(before);expect(cleanup.terminated).toBe(before);await writeFile(resolve(directory,'navigation-cleanup.json'),JSON.stringify(cleanup,null,2));
});
