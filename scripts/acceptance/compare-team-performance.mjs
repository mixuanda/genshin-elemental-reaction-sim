/** Compare complete actual UI receipts, never repair or regenerate a result. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
const [beforeDir,afterDir,output,strictArchive]=process.argv.slice(2);
assert.ok(beforeDir&&afterDir&&output,'Provide completed before/after directories and a new report path.');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const sha=async path=>{const hash=createHash('sha256');let bytes=0;for await(const chunk of createReadStream(path)){hash.update(chunk);bytes+=chunk.length;}return{sha256:hash.digest('hex'),bytes};};
const before=await json(join(beforeDir,'acceptance.json')),after=await json(join(afterDir,'acceptance.json'));
for(const row of [before,after]){
 assert.equal(row.status,'passed');assert.equal(row.actualNativeRuns,1);
 assert.equal(row.savedNewResultReopenedWithoutAnotherNativeRun,true);assert.equal(row.frameAndActorCurveConserved,true);
 assert.equal(row.frames,7200);assert.equal(row.hits,610);
}
for(const field of ['seed','frames','hits','total','dps','byActor','byActorAbility','wasmSha256','configSha256'])assert.deepEqual(after[field],before[field],field);
assert.deepEqual(await json(join(afterDir,'run.request.json')),await json(join(beforeDir,'run.request.json')));
const files=[];
for(const [stage,directory,receipt] of [['before',beforeDir,before],['after',afterDir,after]]){
 for(const name of ['run.result.json','run.reopened.json']){
  const record=await sha(join(directory,name));assert.equal(record.sha256,receipt.resultSha256);
  files.push({stage,path:join(directory,name),...record});
 }
}
const everyResultByteIdentical=new Set(files.map(file=>file.sha256)).size===1;
const beforeResult=await json(join(beforeDir,'run.result.json')),afterResult=await json(join(afterDir,'run.result.json'));
const equalFields=[],differentFields=[];
assert.deepEqual(Object.keys(afterResult).sort(),Object.keys(beforeResult).sort());
for(const field of Object.keys(beforeResult)){
 if(isDeepStrictEqual(beforeResult[field],afterResult[field]))equalFields.push(field);
 else{assert.ok(['phaseObservations','logs'].includes(field),`Changed combat/result field: ${field}`);differentFields.push(field);}
}
// Classify the raw observer differences; never rewrite or silently normalize a
// saved result. All arithmetic, RNG, applications and recorded event streams
// above remain subject to exact deep equality, including their array order.
const canonical=value=>{
 if(typeof value==='number'&&Object.is(value,-0))return{negativeZero:true};
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 return value;
};
const members=rows=>rows.map(row=>JSON.stringify(canonical(row))).sort();
assert.deepEqual(beforeResult.logs.filter(row=>row.frame!==0),afterResult.logs.filter(row=>row.frame!==0),'Every post-initialization log and its order');
const beforeInit=beforeResult.logs.filter(row=>row.frame===0),afterInit=afterResult.logs.filter(row=>row.frame===0);
assert.deepEqual(members(beforeInit),members(afterInit),'No initial log may be lost or changed');
const resonanceLog=row=>row.event==='status'&&['pyro-res','anemo-res-cd','anemo-res-stam'].includes(row.logs?.key);
for(let index=0;index<beforeInit.length;index++)if(!isDeepStrictEqual(beforeInit[index],afterInit[index])){
 assert.ok(resonanceLog(beforeInit[index])&&resonanceLog(afterInit[index]),'Only the audited fixed-team resonance initialization may exchange positions');
}
const phaseDifferences=[];
assert.equal(beforeResult.phaseObservations.length,afterResult.phaseObservations.length);
for(let i=0;i<beforeResult.phaseObservations.length;i++){
 const left=structuredClone(beforeResult.phaseObservations[i]),right=structuredClone(afterResult.phaseObservations[i]);
 assert.equal(left.frame,right.frame);
 const a=left.normalizedState.characters.actors,b=right.normalizedState.characters.actors;
 assert.equal(a.length,b.length);
 for(let actor=0;actor<a.length;actor++)if(!isDeepStrictEqual(a[actor].modifiers,b[actor].modifiers)){
  // These are real modifier container positions, not merely JSON key order.
  // The source audit proves commutativity only for these two distinct types in
  // this exact build. Never accept an arbitrary modifier permutation by sorting.
  const positions=actor===0||actor===2?[2,3]:[1,2];
  assert.deepEqual(positions.map(index=>`${a[actor].modifiers[index]?.kind}:${a[actor].modifiers[index]?.key}`).sort(),
   ['*character.CooldownMod:anemo-res-cd','*character.StatMod:pyro-res'].sort());
  const swapped=[...a[actor].modifiers];
  [swapped[positions[0]],swapped[positions[1]]]=[swapped[positions[1]],swapped[positions[0]]];
  assert.deepEqual(swapped,b[actor].modifiers,'Only the audited adjacent fire/wind resonance exchange is allowed');
  phaseDifferences.push({frame:left.frame,actor,kind:'raw-modifier-container-order',
   before:a[actor].modifiers.map(row=>({kind:row.kind,key:row.key})),after:b[actor].modifiers.map(row=>({kind:row.kind,key:row.key}))});
  a[actor].modifiers=b[actor].modifiers; // comparison copy only
 }
 const aa=left.normalizedState.events.subscriptions,bb=right.normalizedState.events.subscriptions;
 assert.equal(aa.length,bb.length);
 for(let j=0;j<aa.length;j++)if(!isDeepStrictEqual(aa[j].orderedHooks,bb[j].orderedHooks)){
  const x=aa[j].orderedHooks,y=bb[j].orderedHooks;
  assert.equal(j,12,'Only the audited OnTick subscription may differ');
  assert.deepEqual(x.map(row=>row.key).sort(),['stats-shield-tick-log','stats-status-log']);
  assert.deepEqual([...x].reverse(),y,'Only the audited two OnTick hooks may exchange positions');
  phaseDifferences.push({frame:left.frame,subscription:j,kind:'raw-statistics-hook-registration-order',before:x,after:y});
  aa[j].orderedHooks=y; // preserve the original ordered list in phaseDifferences
 }
 assert.deepEqual(left,right,'No other phase-state field may change');
}
assert.equal(after.browserTiming.formulaProfile.calls,before.browserTiming.formulaProfile.calls);
assert.equal(after.browserTiming.formulaProfile.traceNodeReferences,before.browserTiming.formulaProfile.traceNodeReferences);
const times=receipt=>{
 const t=receipt.browserTiming,p=t.formulaProfile;
 return {clickToPaintMs:t.clickToPaintMs,workerElapsedMs:t.elapsedMs,
  nativeIncludingCallbacksMs:t.nativeMs,formulaCallbacksMs:p.totalMs,
  nativeBridgeAndSerializationResidualMs:t.nativeMs-p.totalMs,
  requestSerializeMs:t.requestSerializeMs,nativeTextChars:t.nativeResultChars,
  callbackRequestParseMs:p.parseMs,callbackCalculateAndExplainMs:p.calculateMs,
  callbackCaptureMs:p.captureMs,callbackResponseSerializeMs:p.responseMs,
  nativeResponseParseMs:t.parseMs,resultValidationMs:t.validateMs,
  transferAndQueueMs:t.transferAndQueueMs,renderMs:t.renderMs,
  setupMs:t.setupMs,workerBootstrapMs:t.workerBootstrapMs};
};
const b=times(before),a=times(after);
const report={status:everyResultByteIdentical?'passed':'combat-equivalent-with-observer-order-limit',before:{gitHead:before.gitHead,applicationPatchSha256:before.applicationPatchSha256,startedAt:before.startedAt,timing:b},
 after:{gitHead:after.gitHead,applicationPatchSha256:after.applicationPatchSha256,startedAt:after.startedAt,timing:a},
 improvement:{savedClickToPaintMs:b.clickToPaintMs-a.clickToPaintMs,percent:100*(b.clickToPaintMs-a.clickToPaintMs)/b.clickToPaintMs},
 sameConfigSeedAndEveryCombatRecord:true,everyResultByteIdentical,files,
 fullResultFields:{exactlyEqual:equalFields,different:differentFields},
 observerOrderLimit:{initialLogMembersUnchanged:true,everyPostFrameZeroLogExactlyEqual:true,phaseDifferences,
  meaning:'Actual resonance-container initialization and OnTick execution order may differ. Only the source-audited exchange for this fixed team is accepted here; all raw lists remain recorded. This is not a universal nonsemantic-order claim or a certificate of raw phase/archive reproducibility. No source or saved result is normalized.'},
 result:{seed:after.seed,frames:after.frames,hits:after.hits,total:after.total,dps:after.dps,byActor:after.byActor},
 callbackCount:after.browserTiming.formulaProfile.calls,traceNodeReferences:after.browserTiming.formulaProfile.traceNodeReferences,
 limitations:['One final matched browser pair, not a statistically stable performance guarantee.',
 'nativeMs contains shared TS callbacks. The residual still combines mechanics, Go request/result JSON and cross-runtime conversion; it is not pure mechanics time.',
 'Callback and subphase timings are nested; do not add all table rows.',
 'Browser click-to-paint is separate from tool/polling wall-clock, screenshots, export and reopen work.',
 'No lowered precision, fewer actions, synthetic damage, changed random draws or omitted result records.']};
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,...report.improvement,result:report.result,everyResultByteIdentical,differentFields}));
if(strictArchive==='--strict-archive')assert.equal(everyResultByteIdentical,true,'Complete cross-run archive-byte equality remains an explicit failed check.');
