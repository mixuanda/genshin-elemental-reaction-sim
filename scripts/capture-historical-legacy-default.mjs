/** Capture two authentic full default inputs shared by three frozen consumers. */
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const PIN='84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const [checkoutArg,outputArg]=process.argv.slice(2);
if(!checkoutArg||!outputArg)throw Error('Usage: node scripts/capture-historical-legacy-default.mjs CLEAN_PINNED_CHECKOUT NEW_OUTPUT_JSON');
const checkout=resolve(checkoutArg),output=resolve(outputArg);
const git=(...args)=>execFileSync('git',['-C',checkout,...args],{encoding:'utf8'}).trim();
const assertClean=()=>{if(git('rev-parse','HEAD')!==PIN||git('status','--porcelain','--untracked-files=all'))throw Error('Exact clean pinned checkout required');};
assertClean();
const versions=[148,149,153],targets=versions.map(v=>`packages/test-vectors/src/legacy-default-v${v}-golden.test.ts`);
for(const v of versions)for(const prefix of ['PREVIEW','UPDATE'])if(process.env[`${prefix}_LEGACY_DEFAULT_V${v}_GOLDEN`]==='1')throw Error('Capture cannot preview or update a Golden');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const frozen={
 'packages/test-vectors/fixtures/legacy-default-120s-1.47.golden.json':'918a78d9cdd57d11d5fc9012896c5a7fc240a29b31cd9c09c9ff761fe38d8996',
 'packages/test-vectors/fixtures/legacy-default-120s-1.48.golden.json':'563c417efe82582c9647670104b39e0c34074ceb18259a8aaa36e9c997079d5c',
 'packages/test-vectors/fixtures/legacy-default-120s-1.49.golden.json':'961505ccb95b536c3563ebeb95ec114f236f3872850df2cb98e5bc8bb5218931',
 'packages/test-vectors/fixtures/legacy-default-120s-1.53.golden.json':'617edf8482f3e212d6d78dbead3df484c2665e5169add9279ac2edd26182b45b',
 'packages/test-vectors/fixtures/elemental-application-icd-1.47.golden.json':'9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7',
};
const checkFrozen=()=>{for(const [file,sha] of Object.entries(frozen))if(hash(readFileSync(join(checkout,file)))!==sha)throw Error(`Frozen bytes changed: ${file}`);};checkFrozen();
const temp=mkdtempSync(join(tmpdir(),'gidps-historical-default-')),observations=join(temp,'wires.jsonl'),config=join(temp,'capture.config.mjs');
const site='import { simulate } from "../../sim-core/src/simulator";';
const wrapper=`
import {appendFileSync as recordHistoricalDefault} from 'node:fs';
function simulate(...args:Parameters<typeof originalDefaultSimulate>){
 const configText=JSON.stringify(args[0]),optionsText=JSON.stringify(args[1]);
 const result=originalDefaultSimulate(...args);
 if(JSON.stringify(args[0])!==configText||JSON.stringify(args[1])!==optionsText)throw Error('Original simulation mutated input');
 recordHistoricalDefault(${JSON.stringify(observations)},JSON.stringify({consumer:CONSUMER,configText,optionsText,sourceWireText:JSON.stringify(result)})+'\\n');return result;
}`;
writeFileSync(config,`import {defineConfig} from ${JSON.stringify(pathToFileURL(join(checkout,'node_modules/vitest/dist/config.js')).href)};
const targets=${JSON.stringify(targets)};
export default defineConfig({root:${JSON.stringify(checkout)},json:{stringify:true,namedExports:false},plugins:[{name:'observe-authentic-default',enforce:'pre',transform(code,id){const target=targets.find(t=>id.endsWith('/'+t));if(!target)return;const site=${JSON.stringify(site)};if(code.split(site).length!==2)throw Error('Pinned original import changed');return code.replace(site,${JSON.stringify(site.replace('simulate }','simulate as originalDefaultSimulate }'))})+${JSON.stringify(wrapper)}.replace('CONSUMER',JSON.stringify(target));}}],test:{environment:'node',include:targets,fileParallelism:false,testTimeout:20000}});\n`);
const run=spawnSync(process.execPath,['--max-old-space-size=256',join(checkout,'node_modules/vitest/vitest.mjs'),'run','--config',config,'--pool','forks','--maxWorkers','1','--execArgv=--max-old-space-size=768','--reporter','verbose'],{cwd:checkout,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');
if(run.error||run.status!==0)throw run.error??Error(`Original historical suites failed: ${run.status}`);
const rows=readFileSync(observations,'utf8').trim().split('\n').map(s=>JSON.parse(s));
const caseId=row=>JSON.parse(row.configText).callbackBusModel.mode==='legacy-no-versioned-callback-bus-v1'?'compat-v152':'native-v153';
const expectedByConsumer={
 [targets[0]]:['compat-v152','compat-v152'],
 [targets[1]]:['compat-v152','compat-v152','compat-v152'],
 [targets[2]]:['native-v153','compat-v152','native-v153'],
};
if(rows.length!==8||rows.some(row=>!targets.includes(row.consumer)))throw Error('Historical consumer manifest changed');
for(const [consumer,expected] of Object.entries(expectedByConsumer))if(JSON.stringify(rows.filter(r=>r.consumer===consumer).map(caseId))!==JSON.stringify(expected))throw Error(`Historical call order changed: ${consumer}`);
const expectedConfigs={'compat-v152':'9d5221ede5c3855b2384a2c8520edfa5e5cfebf57a29529cf8f53c21b2631e32','native-v153':'a978252f02c93b50457c39106e7b3c51aede74dbadb4eee9a7f76d7298848629'};
const expectedOptions='{"energyMode":"configured","critMode":"average","compatibilityMode":"legacy-v0.1","randomSeed":"legacy-default"}';
const cases=['compat-v152','native-v153'].map(id=>{
 const matches=rows.filter(r=>caseId(r)===id),first=matches[0];
 if(matches.length!==(id==='compat-v152'?6:2))throw Error('Case call count changed');
 if(hash(first.configText)!==expectedConfigs[id]||first.optionsText!==expectedOptions)throw Error('Exact authored config/options differ from reviewed source');
 if(matches.some(r=>r.configText!==first.configText||r.optionsText!==first.optionsText||r.sourceWireText!==first.sourceWireText))throw Error('Cannot share non-identical consumer inputs/results');
 return {caseId:id,configSha256:hash(first.configText),optionsSha256:hash(first.optionsText),sourceWireSha256:hash(first.sourceWireText),configText:first.configText,optionsText:first.optionsText,sourceWireText:first.sourceWireText,consumers:targets.filter(t=>matches.some(r=>r.consumer===t))};
});
assertClean();checkFrozen();
const paths=[...targets,...Object.keys(frozen),...[148,149,150,151,152,153].map(v=>`packages/test-vectors/src/project-v${v}-to-v${v-1}.ts`),'packages/test-vectors/src/v152-compatibility-config.ts','packages/test-vectors/src/reviewed-golden.ts','packages/game-data/src/presets.ts','packages/sim-core/src/simulator.ts','packages/sim-core/src/formulas.ts','packages/reaction-formulas/src/profile.ts','packages/schemas/src/schema.ts','packages/schemas/src/result-schema.ts','packages/schemas/src/result-integrity.ts','package-lock.json'];
const archive={fixtureVersion:'historical-legacy-default-v153-84ff5cd-v1',source:{repository:'mixuanda/genshin-elemental-reaction-sim',commit:PIN,tree:git('rev-parse','HEAD^{tree}'),method:'All eleven original tests across V148/V149/V153 default Golden consumers run unchanged. Observe eight complete simulate returns and exact config/options, enforce per-consumer call order, and require all six compatibility calls and two native calls byte-identical before deduplicating into two full cases. No current output is stripped/relabelled; native and compatibility policies stay distinct.',files:paths.map(path=>({path,gitBlobSha1:git('rev-parse',`HEAD:${path}`),sha256:hash(readFileSync(join(checkout,path)))}))},consumerCalls:expectedByConsumer,cases};
writeFileSync(output,JSON.stringify(archive,null,2)+'\n',{flag:'wx'});console.log(`Captured two authentic default cases after all eleven original tests: ${output}`);
