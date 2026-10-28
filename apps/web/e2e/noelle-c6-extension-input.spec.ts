import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {SOURCE_HOST_COMMIT} from '../../../packages/sim-core/src/source-host-wire';

test('Noelle C6 ordinary Q compiles no-kill duration by default and preserves explicit extension through reopen',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const original={schemaVersion:1,name:'Synthetic UI-only no-kill Noelle C6',source:{hostVariant:'classic',revision:SOURCE_HOST_COMMIT},members:[{id:'noelle',characterKey:'noelle',level:90,levelCap:90,constellation:6,talents:{auto:1,skill:1,burst:1},weapon:{key:'debateclub',level:1,levelCap:20,refinement:1},artifactSets:[],artifactStats:{}}],actions:[{actorId:'noelle',kind:'burst'}],durationSeconds:120,startup:'full',target:{level:90,resistance:.1}};
 const source=JSON.stringify(original);await page.goto('/source-simulation');const builder=page.locator('#source-team-builder');
 const openFiles=async()=>{const details=builder.locator('details[data-team-section="files"]');if(await details.getAttribute('open')===null)await details.locator(':scope > summary').click();};
 const apply=async()=>{await openFiles();await builder.locator('[data-apply-script]').click();};
 await openFiles();
 await expect(builder.locator('[data-import-draft]')).toBeAttached();
 await builder.locator('[data-import-draft]').setInputFiles({name:'noelle-original.json',mimeType:'application/json',buffer:Buffer.from(source)});
 const input=builder.locator('[data-action-noelle-extension="0"]');await expect(input).toHaveValue('0');await expect(builder).toContainText('未自动计入击杀或后台延长');
 await apply();expect(await page.locator('#source-host-config').inputValue()).toContain('noelle burst[extend=0];');
 await openFiles();const originalDownload=page.waitForEvent('download');await builder.locator('[data-export-draft]').click();const originalSaved=JSON.parse(await readFile((await(await originalDownload).path())!,'utf8'));expect(originalSaved.actions).toEqual(original.actions);expect(originalSaved.members).toEqual(original.members);
 await input.fill('4');await input.blur();await apply();expect(await page.locator('#source-host-config').inputValue()).toContain('noelle burst[extend=4];');
 await openFiles();const download=page.waitForEvent('download');await builder.locator('[data-export-draft]').click();const saved=await readFile((await(await download).path())!,'utf8');expect(JSON.parse(saved).actions[0].params).toEqual({extend:4});
 await page.reload();await openFiles();await builder.locator('[data-import-draft]').setInputFiles({name:'noelle-explicit.json',mimeType:'application/json',buffer:Buffer.from(saved)});await expect(builder.locator('[data-action-noelle-extension="0"]')).toHaveValue('4');
 await apply();expect(await page.locator('#source-host-config').inputValue()).toContain('noelle burst[extend=4];');expect(errors).toEqual([]);
 await page.setViewportSize({width:390,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('noelle-c6-extension-390.png'),fullPage:true});
 await writeFile(info.outputPath('noelle-c6-extension-proof.json'),JSON.stringify({fixture:'Synthetic plain draft, not a real account; UI/compiler workflow only, native damage acceptance is separate',defaultExtension:0,explicitExtension:4,originalUnchanged:originalSaved.actions[0].params===undefined,reopened:JSON.parse(saved).actions[0].params,errors},null,2));
});
