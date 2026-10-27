/** Authentic test-only legacy compatibility inputs; no current result is stripped. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type {SimConfig,SimulationResult} from '@genshin-dps-lab/schemas';
export const HISTORICAL_DEFAULT_SHA256='c31eb103838aebff94d1e448d07ca38a7b6be12c2c241cc20b0441b1246ab98d';
const bytes=readFileSync(new URL('./fixtures/historical-legacy-default-v153-84ff5cd.json',import.meta.url));
const hash=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
if(hash(bytes)!==HISTORICAL_DEFAULT_SHA256)throw Error('Authentic default archive bytes changed');
export const historicalDefaultArchive=JSON.parse(bytes.toString('utf8')) as {source:{commit:string;tree:string};consumerCalls:Record<string,string[]>;cases:{caseId:string;configSha256:string;optionsSha256:string;sourceWireSha256:string;configText:string;optionsText:string;sourceWireText:string;consumers:string[]}[]};
if(historicalDefaultArchive.source.commit!=='84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5'||historicalDefaultArchive.cases.length!==2)throw Error('Unexpected authentic default provenance');
export function historicalLegacyDefault(config:SimConfig,options:unknown):SimulationResult{
 const configText=JSON.stringify(config),optionsText=JSON.stringify(options);
 const row=historicalDefaultArchive.cases.find(r=>r.configText===configText&&r.optionsText===optionsText);
 if(!row)throw Error('No authentic default input matches this exact config/options');
 if(hash(configText)!==row.configSha256||hash(optionsText)!==row.optionsSha256||hash(row.sourceWireText)!==row.sourceWireSha256)throw Error('Authentic default case hash changed');
 return JSON.parse(row.sourceWireText) as SimulationResult;
}
