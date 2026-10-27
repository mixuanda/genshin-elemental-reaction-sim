/** Read-only capture of the original Burning Golden and sustained-output gate.
 * Timing assertions ALWAYS run. A timing-only failure is preserved as exit 1;
 * it is not a semantic failure and must never be reported as a full test pass.
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const PIN = '84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const GOLDEN = 'packages/sim-core/src/__tests__/golden.test.ts';
const PERFORMANCE = 'packages/sim-core/src/__tests__/performance.test.ts';
const FROZEN = 'packages/test-vectors/fixtures/burning-aura-v4-1.30.golden.json';
const FROZEN_SHA = 'adbb9a815163baa6667295298a6bad547be2a05a26f5139777ba73a21269867d';
const [checkoutArg, archiveArg, timingArg] = process.argv.slice(2);
if (!checkoutArg || !archiveArg || !timingArg) throw Error('Usage: node scripts/capture-historical-burning-foundation.mjs CLEAN_PINNED_CHECKOUT NEW_ARCHIVE_JSON NEW_TIMING_JSON');
if (Object.entries(process.env).some(([key, value]) => key.startsWith('UPDATE_') && value === '1')) throw Error('Historical capture forbids Golden update modes.');
const checkout = resolve(checkoutArg), output = resolve(archiveArg), timingOutput = resolve(timingArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], {encoding:'utf8'}).trim();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const assertCleanPin = () => {
  if(git('rev-parse','HEAD') !== PIN || git('status','--porcelain','--untracked-files=all')) throw Error('Exact clean historical checkout required.');
  if(sha256(readFileSync(join(checkout,FROZEN))) !== FROZEN_SHA) throw Error('Frozen Burning Golden bytes changed.');
};
assertCleanPin();
const temp = mkdtempSync(join(tmpdir(),'gidps-burning-foundation-capture-'));
const observations = join(temp,'observations.jsonl'), report = join(temp,'test-report.json'), config = join(temp,'capture.config.mjs');
const record = (value) => `recordBurningCapture(${JSON.stringify(observations)},JSON.stringify(${value})+'\\n');`;
const pairs = {
  [GOLDEN]: [
    ['    const result = simulate(input, options);', `    const result = simulate(input, options);\n    ${record('{kind:"golden",input,options,result}')}`],
    ['    const repeated = simulate(makeBurningGoldenConfig(), options);', `    const repeated = simulate(makeBurningGoldenConfig(), options);\n    ${record('{kind:"golden",input:makeBurningGoldenConfig(),options,result:repeated}')}`],
  ],
  [PERFORMANCE]: [
    ['    const probe = simulate(config, { critMode: "noCrit" });', `    const probe = simulate(config, { critMode: "noCrit" });\n    ${record('{kind:"performance",input:config,options:{critMode:"noCrit"},result:probe}')}`],
  ],
};
const semanticMarker = record('{kind:"semantic-prerequisites-passed"}');
const timingMarker = record('{kind:"timing",durations,summary,runs:PERFORMANCE_RUNS,medianLimitMs:DESKTOP_TARGET_MS,maximumLimitMs:PATHOLOGICAL_OUTLIER_CEILING_MS}');
writeFileSync(config, `import {defineConfig} from ${JSON.stringify(pathToFileURL(join(checkout,'node_modules/vitest/dist/config.js')).href)};
const pairs=${JSON.stringify(pairs)};
export default defineConfig({root:${JSON.stringify(checkout)},json:{stringify:true,namedExports:false},plugins:[{name:'observe-original-burning-contract',enforce:'pre',transform(code,id){
const key=Object.keys(pairs).find(key=>id.endsWith('/'+key));if(!key)return;
for(const [needle,replacement] of pairs[key]){if(code.split(needle).length!==2)throw Error('Pinned observation site changed');code=code.replace(needle,replacement);}
if(key===${JSON.stringify(PERFORMANCE)}){
 const start='    const durations: number[] = [];';const end='    const summary = summarizeDurations(durations);';
 if(code.split(start).length!==4||code.split(end).length!==4)throw Error('Original three timing loops changed');
 const startAt=code.lastIndexOf(start);code=code.slice(0,startAt)+${JSON.stringify(semanticMarker+'\n')}+code.slice(startAt);
 const endAt=code.lastIndexOf(end)+end.length;code=code.slice(0,endAt)+${JSON.stringify('\n'+timingMarker)}+code.slice(endAt);
}
return 'import {appendFileSync as recordBurningCapture} from "node:fs";\\n'+code;
}}],test:{environment:'node',include:${JSON.stringify([GOLDEN,PERFORMANCE])},fileParallelism:false,testTimeout:20000}});\n`);
const run = spawnSync(process.execPath,['--max-old-space-size=256',join(checkout,'node_modules/vitest/vitest.mjs'),'run','--config',config,'-t','Burning aura-v4 provisional golden|keeps a sustained 120s Burning refresh stream','--pool','forks','--maxWorkers','1','--execArgv=--max-old-space-size=768','--reporter','default','--reporter','json','--outputFile',report],{cwd:checkout,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');
if(run.error || (run.status!==0 && run.status!==1)) throw run.error??Error('Original test process did not complete normally.');
const result = JSON.parse(readFileSync(report,'utf8'));
const allAssertions = result.testResults.flatMap(row=>row.assertionResults);
if(allAssertions.length!==21 || allAssertions.filter(row=>row.status==='skipped').length!==19)throw Error('Only the nineteen explicitly filtered unrelated cases may be skipped.');
const assertions = allAssertions.filter(row=>row.status!=='skipped');
if(assertions.length!==2)throw Error('Expected exactly the two original selected cases, without skipping either.');
const goldenTest=assertions.find(row=>row.fullName.includes('Burning aura-v4 provisional golden'));
const performanceTest=assertions.find(row=>row.fullName.includes('keeps a sustained 120s Burning refresh stream'));
if(goldenTest?.status!=='passed'||!performanceTest)throw Error('Original Golden assertions did not all pass.');
if(performanceTest.status==='failed' && !performanceTest.failureMessages.every(message=>message.includes('expectDesktopPerformance')&&/to be less than (100|250)/.test(message)))throw Error('Original performance failed outside its unchanged timing assertions.');
if(performanceTest.status!=='passed'&&performanceTest.status!=='failed')throw Error('Original performance did not reach completion.');
const lines=readFileSync(observations,'utf8').trim().split('\n');const rows=lines.map(line=>JSON.parse(line));
const goldenLines=lines.filter((_,i)=>rows[i].kind==='golden');const performanceLines=lines.filter((_,i)=>rows[i].kind==='performance');
if(goldenLines.length!==2||goldenLines[0]!==goldenLines[1]||performanceLines.length!==1)throw Error('Original output capture count/determinism failed.');
if(rows.filter(row=>row.kind==='semantic-prerequisites-passed').length!==1)throw Error('All original performance semantic prerequisites must pass before capture is accepted.');
const samples=rows.filter(row=>row.kind==='timing');if(samples.length!==1)throw Error('Original timing must run to completion.');
const timing=samples[0];if(timing.runs!==21||timing.durations.length!==21||timing.medianLimitMs!==100||timing.maximumLimitMs!==250||!timing.durations.every(value=>Number.isFinite(value)&&value>=0))throw Error('Original timing workload/limits changed.');
const sorted=[...timing.durations].sort((a,b)=>a-b);
if(timing.summary.median!==sorted[10]||timing.summary.maximum!==sorted.at(-1))throw Error('Timing summary does not match all original samples.');
assertCleanPin();
const timingRecord={fixtureVersion:'historical-burning-foundation-timing-v1',sourceCommit:PIN,originalExitCode:run.status,goldenStatus:goldenTest.status,performanceStatus:performanceTest.status,allOriginalSemanticPrerequisitesPassed:true,unchangedTimedWorkload:true,...timing};
const timingBytes=JSON.stringify(timingRecord,null,2)+'\n';
const paths=[GOLDEN,PERFORMANCE,FROZEN,'packages/sim-core/src/__tests__/fixtures.ts','packages/sim-core/src/simulator.ts','packages/sim-core/src/aura.ts','packages/sim-core/src/elemental-application-icd.ts','packages/schemas/src/schema.ts','packages/schemas/src/result-integrity.ts','packages/test-vectors/src/project-v153-to-v152.ts','package-lock.json'];
const payload=(kind,text)=>{const raw=Buffer.from(text);return {kind,encoding:'gzip-base64',rawBytes:raw.length,rawSha256:sha256(raw),gzipBase64:gzipSync(raw,{level:9}).toString('base64')};};
const archive={fixtureVersion:'historical-burning-foundation-v153-84ff5cd-v1',source:{repository:'mixuanda/genshin-elemental-reaction-sim',commit:PIN,tree:git('rev-parse','HEAD^{tree}'),method:'Read-only observers in the original selected Golden and sustained-Burning test. All original semantic and timing assertions execute unchanged. Golden passes; a timing-only performance failure may be archived with its original nonzero exit preserved and separate exact samples. This archive does not assert historical timing passed.',files:paths.map(path=>({path,gitBlobSha1:git('rev-parse',`HEAD:${path}`),sha256:sha256(readFileSync(join(checkout,path)))}))},timingEvidence:{file:basename(timingOutput),sha256:sha256(timingBytes),originalExitCode:run.status,performanceStatus:performanceTest.status},payloads:[payload('golden',goldenLines[0]),payload('performance',performanceLines[0])]};
writeFileSync(timingOutput,timingBytes,{flag:'wx'});
writeFileSync(output,JSON.stringify(archive,null,2)+'\n',{flag:'wx'});
console.log(`Captured authentic semantic outputs; original process exit ${run.status}, performance ${performanceTest.status}. Timing evidence: ${timingOutput}`);
process.exitCode=run.status;
