/** Capture authentic matrix inputs/results while executing all four original assertions. */
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const PIN='84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const [checkoutArg,outputArg]=process.argv.slice(2);
if(!checkoutArg||!outputArg)throw Error('Usage: node scripts/capture-historical-reaction-matrix.mjs HISTORICAL_CHECKOUT NEW_OUTPUT_JSON');
for(const flag of ['PRINT_REACTION_MATRIX_GOLDEN','PRINT_AURA_V9_REACTION_MATRIX'])if(process.env[flag]==='1')throw Error('Historical capture requires the original read-only assertions, without print/update exits.');
const checkout=resolve(checkoutArg),output=resolve(outputArg),git=(...args)=>execFileSync('git',['-C',checkout,...args],{encoding:'utf8'}).trim();
const assertCleanPin=()=>{if(git('rev-parse','HEAD')!==PIN||git('status','--porcelain','--untracked-files=all'))throw Error('A clean checkout of the exact pinned commit is required. Install its locked dependencies first.');};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const frozenHashes={
 '1.31':'edb5e16d698683e6a64f3ecbf01baa30ab5df012fb0137d907cef9a91d1720cc',
 '1.32':'4089587e77765a655ccf6f776a32e1bc7e259a10ba3b532fb273274d814962e4',
 '1.33':'67a6546d8562e3d9720262a26ce5b6a9224fa9e871fabbe0c9b1d0e9e5490231',
 '1.34':'2a6a08d69f6c819959def335fc7b676f7d8f48bfce7c4700307d5e80be08497e',
 '1.35':'d21e107dd1ed53f897d5f5d1f45af4735cd99297c281f5123d71e1fbc394d8c5',
};
const frozenPaths=Object.keys(frozenHashes).map(version=>`packages/test-vectors/fixtures/reaction-matrix-${version}.golden.json`);
const assertFrozen=()=>{for(const[version,expected]of Object.entries(frozenHashes))if(sha256(readFileSync(join(checkout,`packages/test-vectors/fixtures/reaction-matrix-${version}.golden.json`)))!==expected)throw Error('Frozen matrix bytes changed: '+version);};
assertCleanPin();assertFrozen();
const target='packages/sim-core/src/__tests__/reaction-matrix-golden.test.ts';
const temp=mkdtempSync(join(tmpdir(),'gidps-reaction-matrix-capture-')),observations=join(temp,'observations.jsonl'),config=join(temp,'capture.config.mjs'),report=join(temp,'report.json');
const site='import { simulate } from "../simulator";';
const wrapper=`
import {appendFileSync as recordHistoricalMatrix} from 'node:fs';
function simulate(...args: Parameters<typeof originalSimulate>){
 const sourceInputText=JSON.stringify(args);
 const result=originalSimulate(...args);
 recordHistoricalMatrix(${JSON.stringify(observations)},JSON.stringify({test:expect.getState().currentTestName,caseId:result.config.reactionEngine.mode+'/'+result.config.randomSeed,sourceInputText,sourceWireText:JSON.stringify(result)})+'\\n');
 return result;
}`;
writeFileSync(config,`import {defineConfig} from ${JSON.stringify(pathToFileURL(join(checkout,'node_modules/vitest/dist/config.js')).href)};
export default defineConfig({root:${JSON.stringify(checkout)},json:{stringify:true,namedExports:false},plugins:[{name:'observe-original-reaction-matrix',enforce:'pre',transform(code,id){if(!id.endsWith(${JSON.stringify('/'+target)}))return;const site=${JSON.stringify(site)};if(code.split(site).length!==2)throw Error('Pinned simulator import changed');return code.replace(site,${JSON.stringify(site.replace('simulate }','simulate as originalSimulate }'))})+${JSON.stringify(wrapper)};}}],test:{environment:'node',include:[${JSON.stringify(target)}],fileParallelism:false,testTimeout:20000}});\n`);
const run=spawnSync(process.execPath,['--max-old-space-size=256',join(checkout,'node_modules/vitest/vitest.mjs'),'run','--config',config,'--pool','forks','--maxWorkers','1','--execArgv=--max-old-space-size=768','--reporter','verbose','--reporter','json','--outputFile',report],{cwd:checkout,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');
if(run.error||run.status!==0)throw run.error??Error('Original historical matrix tests failed: '+run.status);
const summary=JSON.parse(readFileSync(report,'utf8'));
if(!summary.success||summary.numTotalTests!==4||summary.numPassedTests!==4||summary.numFailedTests!==0||summary.numPendingTests!==0)throw Error('Expected all four original tests, no filtering or skipped assertions.');
const rows=readFileSync(observations,'utf8').trim().split('\n').map(JSON.parse);
const scenarios=['melt','vaporize','overload','superconduct','electroCharged','freezeShatter','swirl','crystallize','catalyze','burning','bloom','burgeon','hyperbloom','cryoMultiReaction','electroOrdered','elementalResistance','hydroFrozenEcGuard'];
const extra=['reverseMelt','swirlHydro','swirlCryo','swirlElectro','crystallizeHydro','crystallizeCryo','crystallizeElectro'];
const id=(mode,name)=>mode+'/reaction-matrix-1.32:'+name;
const expected=[...scenarios.flatMap(s=>[id('aura-v6',s),id('aura-v7',s)]),...scenarios.flatMap(s=>Array(2).fill(id(['electroOrdered','elementalResistance','hydroFrozenEcGuard'].includes(s)?'aura-v6':'aura-v5',s))),...extra.flatMap(s=>Array(2).fill(id('aura-v7',s))),...[...scenarios,...extra].flatMap(s=>Array(2).fill(id('aura-v9',s)))];
if(rows.length!==130||JSON.stringify(rows.map(r=>r.caseId))!==JSON.stringify(expected))throw Error('Original 130-call scenario/mode manifest changed.');
const cases=new Map();
for(const [index,row]of rows.entries()){
 const prior=cases.get(row.caseId);
 if(prior){if(prior.sourceInputText!==row.sourceInputText||prior.sourceWireText!==row.sourceWireText)throw Error('Repeated original input/result differs: '+row.caseId);prior.observedAt.push({index,test:row.test});}
 else cases.set(row.caseId,{caseId:row.caseId,observedAt:[{index,test:row.test}],sourceInputSha256:sha256(row.sourceInputText),sourceInputText:row.sourceInputText,sourceWireSha256:sha256(row.sourceWireText),sourceWireText:row.sourceWireText});
}
if(cases.size!==79)throw Error('Expected 79 distinct exact original config/options/result cases.');
assertCleanPin();assertFrozen();
const paths=[target,...frozenPaths,'packages/sim-core/src/__tests__/fixtures.ts','packages/sim-core/src/simulator.ts','packages/sim-core/src/aura.ts','packages/sim-core/src/formulas.ts','packages/sim-core/src/target-state-timeline.ts','packages/schemas/src/schema.ts','packages/schemas/src/result-schema.ts','packages/schemas/src/result-integrity.ts','package-lock.json'];
const archive={fixtureVersion:'historical-reaction-matrix-v153-84ff5cd-v1',source:{repository:'mixuanda/genshin-elemental-reaction-sim',commit:PIN,tree:git('rev-parse','HEAD^{tree}'),method:'Original four-test reaction-matrix suite, all original 1.31–1.35 frozen comparisons, v6/v7 parity and 24-case aura-v9 release digest assertions unchanged. A read-only import wrapper captures config/options before each of 130 simulate calls and the full result before its consumer. Deduplication to 79 cases requires byte-identical inputs AND results for every repeated case. No current result is stripped, renumbered or relabelled.',originalTests:{total:4,passed:4,failed:0,pending:0},observedRunCount:rows.length,files:paths.map(path=>({path,gitBlobSha1:git('rev-parse',`HEAD:${path}`),sha256:sha256(readFileSync(join(checkout,path)))}))},cases:[...cases.values()]};
writeFileSync(output,JSON.stringify(archive,null,2)+'\n',{flag:'wx'});
console.log(`Captured ${cases.size} authentic matrix cases from all ${rows.length} original calls. ${output}`);
