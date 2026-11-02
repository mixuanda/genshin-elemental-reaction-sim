import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {createSourceHostValidationLookup,resolveSourceHostRequest} from './source-host-formula';
import {verifySourceHostEnergyApplication} from './source-host-energy-capture';
import type {SourceHostResult} from './source-host-wire';
const capture=JSON.parse(readFileSync(new URL('../../../docs/validation/action-opportunities-classic-xingqiu-20260929.capture.json',import.meta.url),'utf8')) as SourceHostResult;
const records=()=>new Map(structuredClone(capture.calculations).map(c=>[c.request.id,c]));
it('validation snapshot preserves every value and full explanation; only owned requests are memoized',()=>{
 const original=records(),snapshot=createSourceHostValidationLookup(original);
 for(const [id,row] of snapshot){
  const result=resolveSourceHostRequest(row.request,snapshot);
  expect(result).toEqual(resolveSourceHostRequest(original.get(id)!.request,original));
  expect(resolveSourceHostRequest(row.request,snapshot)).toBe(result);
  expect(resolveSourceHostRequest(structuredClone(row.request),snapshot)).not.toBe(result);
  expect(Object.isFrozen(result)).toBe(true);
 }
});
it('input mutations and fresh validation contexts cannot inherit prior trusted identity',()=>{
 const original=records(),snapshot=createSourceHostValidationLookup(original),first=snapshot.values().next().value!;
 const result=resolveSourceHostRequest(first.request,snapshot);
 (original.get(first.request.id)!.request as any).protocol='forged';
 expect(resolveSourceHostRequest(first.request,snapshot)).toBe(result);
 expect(()=>createSourceHostValidationLookup(original)).toThrow();
 const fresh=createSourceHostValidationLookup(records());
 expect(resolveSourceHostRequest(fresh.get(first.request.id)!.request,fresh)).not.toBe(result);
 const forged=structuredClone(first.request);(forged as any).protocol='forged';
 expect(()=>resolveSourceHostRequest(forged,snapshot)).toThrow();
});
it('snapshot exposes no mutable backing map or nested record and rejects mismatched keys',()=>{
 const snapshot=createSourceHostValidationLookup(records());
 snapshot.forEach((row,key,map)=>{
  expect(map).toBe(snapshot);expect((map as any).set).toBeUndefined();
  expect(()=>{(row.request as any).id=key+1;}).toThrow();
 });
 const bad=records(),first=bad.values().next().value!;bad.set(-1,first);
 expect(()=>createSourceHostValidationLookup(bad)).toThrow();
});

it('warm validation cache still rejects changed energy frame, value, source and owner',()=>{
 const snapshot=createSourceHostValidationLookup(records());
 for(const app of capture.energyApplications??[])verifySourceHostEnergyApplication(app,snapshot);
 const original=capture.energyApplications![0]!;
 for(const mutate of [(a:any)=>a.frame++, (a:any)=>a.energyAfter++, (a:any)=>a.source='forged', (a:any)=>a.actorKey='forged']){
  const altered=structuredClone(original);mutate(altered);
  expect(()=>verifySourceHostEnergyApplication(altered,snapshot)).toThrow();
 }
});
