import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {createSourceHostFormulaResolver,resolveSourceHostRequest} from './source-host-formula';
import type {SourceHostResult} from './source-host-wire';
const capture=JSON.parse(readFileSync(new URL('../../../docs/validation/action-opportunities-classic-xingqiu-20260929.capture.json',import.meta.url),'utf8')) as SourceHostResult;
it('live immutable memo preserves full values and explanations, per run; public edits remain revalidated',()=>{
 const a=createSourceHostFormulaResolver({memoize:false}),b=createSourceHostFormulaResolver();
 for(const c of capture.calculations){const q=JSON.stringify(c.request);expect(b.resolve(q)).toEqual(a.resolve(q));}
 expect(b.calculations).toEqual(a.calculations);
 expect(Object.isFrozen(b.calculations[0]!.request)).toBe(true);
 expect(()=>{(b.calculations[0]!.request as any).id=999;}).toThrow();
 expect(JSON.parse(b.resolve(JSON.stringify(capture.calculations[0]!.request))).error).toContain('重复');
 const copied=structuredClone(b.calculations);const q=copied.find(c=>c.request.kind==='damage')!.request;
 const lookup=new Map(copied.map(c=>[c.request.id,c]));
 expect(resolveSourceHostRequest(q,lookup).value).toBe(copied.find(c=>c.request.id===q.id)!.value);
 const forged=structuredClone(q);(forged as any).input.scalingValue+=1;expect(()=>resolveSourceHostRequest(forged,lookup)).toThrow();
 (q as any).protocol='forged';expect(()=>resolveSourceHostRequest(q,lookup)).toThrow();
 const fresh=createSourceHostFormulaResolver();expect(JSON.parse(fresh.resolve(JSON.stringify(capture.calculations[0]!.request))).error).toBeUndefined();
});
