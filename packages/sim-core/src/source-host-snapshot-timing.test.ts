import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {captureSourceHostHit,replaySourceHostHit,createSourceHostResult} from './source-host-capture';
import {assertSourceHostSnapshotTiming} from './source-host-stat-provenance';
import type {SourceHostResult} from './source-host-wire';

for(const lane of ['classic','stellar']){
 const result=JSON.parse(readFileSync(new URL(`../../../docs/validation/action-opportunities-${lane}-xingqiu-20260929.capture.json`,import.meta.url),'utf8')) as SourceHostResult;
 const app=result.applications.find(a=>{const q=result.calculations.find(c=>c.request.id===a.calculationId)?.request;return q?.kind==='damage'&&q.snapshot.statProvenance?.snapshotRead;})!;
 const captured=captureSourceHostHit(result,app.id);
 describe(`${lane} real snapshot timing`,()=>{
  it('preserves the original numeric replay',()=>expect(replaySourceHostHit(captured).difference).toBe(0));
  it('rejects an attribute read after snapshot creation',()=>{
   const c=structuredClone(captured);const q=c.calculation.request;
   if(q.kind!=='damage')throw Error('damage fixture required');
   q.snapshot.statProvenance!.snapshotRead!.frame=q.snapshotFrame+1;
   expect(()=>assertSourceHostSnapshotTiming(q.snapshot.statProvenance!,q.snapshotFrame,q.frame)).toThrow(/读取帧晚于快照帧/);
   // This archived Xingqiu read also has a same-frame modifier link; either
   // independent guard may reject it first. The real Pyronado audit covers
   // a cached modifier that previously accepted this mutation.
   expect(()=>replaySourceHostHit(c)).toThrow();
  });
  it('rejects a snapshot after the actual hit',()=>{
   const c=structuredClone(captured);c.calculation.request.snapshotFrame=c.calculation.request.frame+1;
   expect(()=>replaySourceHostHit(c)).toThrow(/快照帧晚于实际命中帧/);
  });
  it('rejects a different application frame in independent replay and complete import',()=>{
   const c=structuredClone(captured);c.application.frame++;
   expect(()=>replaySourceHostHit(c)).toThrow(/身份或帧不一致/);
   const r=structuredClone(result);r.applications.find(a=>a.id===app.id)!.frame++;
   expect(()=>createSourceHostResult(r)).toThrow(/应用帧与共享公式计算帧不一致/);
  });
  it('permits saved Stats reads followed by a later projectile launch and hit',()=>{
   const q=captured.calculation.request;if(q.kind!=='damage')throw Error('damage fixture required');
   // SourceFrame may be updated on launch (pinned Lyney Grin-Malkin Hat).
   // No equality with either the historical getter or the final hit is imposed.
   expect(()=>assertSourceHostSnapshotTiming(q.snapshot.statProvenance!,q.frame+10,q.frame+20)).not.toThrow();
  });
  it('rejects an attack modifier read after the actual hit',()=>{
   const q=structuredClone(captured.calculation.request);if(q.kind!=='damage')throw Error('damage fixture required');
   const p=q.snapshot.statProvenance!;expect(p.attackReads.length).toBeGreaterThan(0);
   p.attackReads[0]!.frame=q.frame+1;
   expect(()=>assertSourceHostSnapshotTiming(p,q.snapshotFrame,q.frame)).toThrow(/实际命中之后/);
  });
 });
}
