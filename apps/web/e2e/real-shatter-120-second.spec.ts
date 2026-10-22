import {expect,test} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {auditRealShatter120} from './real-shatter-120-audit';
import type {SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';
import builds from './fixtures/real-shatter/builds.json';
import {resolveEquipmentBuild,type EquipmentBuildInput} from '../../../packages/game-data/src/equipment-build';
const directory=process.env.GIDPS_SHATTER_120_EVIDENCE??'test-results/real-shatter-120';

test('real 120-second Shatter zero/full two-seed energy-constrained acceptance',async({page})=>{
 test.setTimeout(240000);await mkdir(directory,{recursive:true});
 for(const input of Object.values(builds))resolveEquipmentBuild(input as EquipmentBuildInput);
 const config=await readFile(new URL('./fixtures/real-shatter/rotation-120.gcsim',import.meta.url),'utf8');
 await page.goto('/source-simulation');
 await page.locator('#source-host-config').evaluate(el=>{let p=el.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details')??null;}});
 await page.locator('#source-host-variant').selectOption('classic');await page.locator('#source-host-config').fill(config);
 await page.locator('#source-startup-seeds').fill('12021,12022');
 await page.locator('#source-startup-warmup').fill('0');await page.locator('#source-startup-window').fill('60');
 await page.locator('#source-startup-run').click();
 await expect(page.locator('#source-host-status')).toContainText(/起步对照完成|失败/,{timeout:180000});
 const diagnostic=await page.locator('[data-diagnostic-json]').textContent();if(diagnostic)await writeFile(`${directory}/diagnostic.json`,diagnostic);
 expect(await page.locator('#source-host-status').textContent(),diagnostic??'').toContain('起步对照完成');
 const pending=page.waitForEvent('download');await page.locator('#source-startup-export').click();
 const result=JSON.parse(await readFile((await(await pending).path())!,'utf8')) as {runs:{scenario:'zero'|'full';result:SourceHostResult}[]};
 await writeFile(`${directory}/startup.capture.json`,JSON.stringify(result));expect(result.runs).toHaveLength(4);
 const summaries=[];
 for(const run of result.runs){const summary=auditRealShatter120(run.result,run.scenario);summaries.push(summary);await writeFile(`${directory}/${run.scenario}-${run.result.seed}.summary.json`,JSON.stringify(summary,null,2));}
 await writeFile(`${directory}/summary.json`,JSON.stringify(summaries,null,2));
});
