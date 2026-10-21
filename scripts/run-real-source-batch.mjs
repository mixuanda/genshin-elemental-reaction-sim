/** Durable, bounded local continuation through the same browser UI/Worker pool. No deployment. */
import {chromium} from '@playwright/test';
import {readFile,writeFile,rename,open,mkdir,appendFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const [input,outArg,segmentsArg='8',secondsArg='900']=process.argv.slice(2);
if(!input||!outArg)throw Error('Usage: node scripts/run-real-source-batch.mjs checkpoint.json output-directory [max-segments=8] [seconds-per-segment=900]');
const maxSegments=Number(segmentsArg),seconds=Number(secondsArg);
if(!Number.isInteger(maxSegments)||maxSegments<1||maxSegments>8||!Number.isInteger(seconds)||seconds<1||seconds>3600)throw Error('Invalid bounded segment policy.');
const out=resolve(outArg);await mkdir(out,{recursive:true});
const checkpoint=resolve(out,'checkpoint.json'),lockPath=resolve(out,'runner.lock');
if(await stat(resolve(out,'run-policy.json')).then(()=>true,()=>false))throw Error('Output directory already contains an attempt; use a new directory and its saved checkpoint.');
// An existing lock requires inspecting its PID/outcome; never start a duplicate runner automatically.
const lock=await open(lockPath,'wx');await lock.writeFile(String(process.pid));await lock.sync();
let writes=Promise.resolve(),writeFailure,lastSavedKey='',latest,browser,page,stopping=false;
const atomic=async(path,text)=>{const temp=path+'.tmp';const f=await open(temp,'w');try{await f.writeFile(text);await f.sync();}finally{await f.close();}await rename(temp,path);const d=await open(dirname(path),'r');try{await d.sync();}finally{await d.close();}};
const save=(r)=>{
 const key=`${r.previousAttempts?.length??0}/${r.counts.succeeded}/${r.status}`;
 latest=r;if(key===lastSavedKey)return writes;lastSavedKey=key;
 const text=JSON.stringify(r,null,2);
 writes=writes.then(async()=>{await atomic(checkpoint,text);await appendFile(resolve(out,'progress.jsonl'),JSON.stringify({at:new Date().toISOString(),status:r.status,counts:r.counts,retained:r.retainedSampleCount??0,elapsedMs:r.elapsedMs,meanDps:r.statistics?.dps.meanDamage??null})+'\n');}).catch(e=>{writeFailure=e;throw e;});return writes;
};
const stop=()=>{stopping=true;void page?.locator('#source-monte-cancel').click().catch(()=>{});};process.on('SIGINT',stop);process.on('SIGTERM',stop);
try{
 const original=await readFile(input,'utf8');
 await atomic(resolve(out,'input-checkpoint.json'),original);
 await atomic(resolve(out,'run-policy.json'),JSON.stringify({input:resolve(input),inputSha256:createHash('sha256').update(original).digest('hex'),maxSegments,secondsPerSegment:seconds,workers:2,start:new Date().toISOString(),paidResources:false},null,2));
 let current=input;
 browser=await chromium.launch({headless:true});const context=await browser.newContext({acceptDownloads:true});page=await context.newPage();
 await page.exposeFunction('__saveMonteCheckpoint',save);
 await page.addInitScript(()=>{document.addEventListener('source-monte-update',event=>{const r=event.detail;window.__lastMonteReport=r;void window.__saveMonteCheckpoint(r).catch(()=>document.querySelector('#source-monte-cancel')?.click());});});
 await page.goto('http://127.0.0.1:4173/source-simulation');
 await page.locator('#source-monte-import').evaluate(el=>el.closest('details').open=true);
 for(let segment=0;segment<maxSegments&&!stopping;segment++){
  if(writeFailure)throw writeFailure;
  await page.locator('#source-monte-import').setInputFiles(resolve(current));
  await page.waitForFunction(()=>document.querySelector('#source-monte-status')?.textContent?.startsWith('已读取'));
  const prior=JSON.parse(await readFile(current,'utf8'));if(prior.counts.succeeded===prior.counts.requested){latest=prior;break;}
  await page.locator('#source-monte-workers').selectOption('2');await page.locator('#source-monte-budget').fill(String(seconds));
  await page.locator('#source-monte-resume').click();
  await page.waitForFunction(()=>/^(complete|failed|budget|cancelled)：/.test(document.querySelector('#source-monte-status')?.textContent??''),{},{timeout:(seconds+60)*1000});
  const final=await page.evaluate(()=>window.__lastMonteReport);await save(final);await writes;
  await atomic(resolve(out,`segment-${segment+1}.json`),JSON.stringify(final,null,2));
  console.log(JSON.stringify({segment:segment+1,status:final.status,counts:final.counts}));
  if(final.status!=='budget')break;
  current=checkpoint;
 }
 if(writeFailure)throw writeFailure;
 await writes;
 await page.screenshot({path:resolve(out,'final-panel.png'),fullPage:true});
 await atomic(resolve(out,'runner-result.json'),JSON.stringify({ended:new Date().toISOString(),status:latest?.status,counts:latest?.counts,complete:latest?.counts.succeeded===latest?.counts.requested,stopped:stopping},null,2));
}finally{
 if(page&&!page.isClosed()){await page.locator('#source-monte-cancel').click({timeout:1000}).catch(()=>{});}
 await writes.catch(()=>{});await browser?.close();await lock.close();
 // Preserve the lock record as evidence; successful runner ends rename it, interrupted processes leave it for inspection.
 await rename(lockPath,resolve(out,'runner-finished.pid'));
}
