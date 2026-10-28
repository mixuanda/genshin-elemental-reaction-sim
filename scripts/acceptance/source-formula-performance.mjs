/** Offline profiling only; does not advance game time or generate another random sample. */
import {createServer} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Session} from 'node:inspector';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [capture,output,baseline]=process.argv.slice(2);
assert.ok(capture && output, 'Provide capture.json and a fresh evidence directory.');
await mkdir(output,{recursive:true});
await writeFile(`${output}/runner-start.json`,JSON.stringify({kind:'offline recorded-formula replay, no native simulation',capture,startedAt:new Date().toISOString(),pid:process.pid}),{flag:'wx'});
const server=await createServer({root:process.cwd(),configFile:'apps/web/vite.config.ts',server:{middlewareMode:true},appType:'custom'});
const {createSourceHostFormulaResolver}=await server.ssrLoadModule('/packages/sim-core/src/source-host-formula.ts');
const raw=JSON.parse(await readFile(capture,'utf8'));
const session=new Session();session.connect();
const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(error,result)=>error?reject(error):resolve(result)));
await post('Profiler.enable');await post('Profiler.start');
const resolver=createSourceHostFormulaResolver({profile:true}),begin=performance.now();
try {
 for(const row of raw.calculations){
  const response=JSON.parse(resolver.resolve(JSON.stringify(row.request)));
  assert.equal(response.error,undefined);assert.equal(response.value,row.value);assert.equal(response.id,row.request.id);
 }
 const elapsedMs=performance.now()-begin,{profile}=await post('Profiler.stop');
 await writeFile(`${output}/resolver.cpuprofile`,JSON.stringify(profile));
 const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const records=resolver.calculations.map(row=>({id:row.request.id,kind:row.request.kind,value:row.value,fullExplanationSha256:sha(row)}));
 if(baseline) assert.deepEqual(records,JSON.parse(await readFile(baseline,'utf8')),'Complete recorded values/explanations must match the retained baseline.');
 await writeFile(`${output}/explanations.json`,JSON.stringify(records),{flag:'wx'});
 await writeFile(`${output}/summary.json`,JSON.stringify({kind:'offline actual formula-call replay, not native/browser latency',elapsedMs,profile:resolver.profile,explanationsSha256:sha(records)},null,2));
 console.log(JSON.stringify({elapsedMs,profile:resolver.profile,explanationsSha256:sha(records)}));
} finally {session.disconnect();await server.close();}
