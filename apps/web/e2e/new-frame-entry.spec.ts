import {test,expect} from '@playwright/test';
test('new browser run uses integer-frame scheduling for the original rotation entry',async({page})=>{
 await page.goto('/');await expect(page.locator('#runButton')).toBeEnabled();await page.locator('#runButton').click();
 await expect.poll(()=>page.evaluate(()=>window.GenshinDpsLab.getLastResult()?.compatibilityMode),{timeout:15000}).toBe('legal-frame-v1');
 const result=await page.evaluate(()=>window.GenshinDpsLab.getLastResult());
 expect(result!.damageEvents.length).toBeGreaterThan(0);
 for(const hit of result!.damageEvents){expect(Number.isInteger(hit.frame)).toBe(true);expect(hit.timeSeconds).toBe(hit.frame/60);}
});
