import {z} from 'zod';
import {restoreSimulationInputs,type RestoredSimulationInputs} from './simulation-record';
import { migrateConfig, type SimConfig } from '@genshin-dps-lab/schemas';

const controlsSchema=z.object({randomSeed:z.string().min(1),iterations:z.number().int().min(1).max(10000),energyMode:z.enum(['configured','zero','full']),critMode:z.enum(['average','allCrit','noCrit','seeded-random-v1']),checkpoint:z.boolean(),detailedTraces:z.boolean()}).strict();
export type DocumentControls=z.infer<typeof controlsSchema>;

/** A document identity, separate from the engine's frozen result identities. */
export interface ProjectDocument {
  format:'gidps-document-v1';
  id:string;
  config:SimConfig;
  verification:'not-recomputed';
  original:{name:string; text:string}|null;
  runInputs:RestoredSimulationInputs|null;
  controls:DocumentControls|null;
}
export interface OpenDocument {
  original:{name:string;text:string};
  document:ProjectDocument|null;
  config:SimConfig|null;
  runInputs:RestoredSimulationInputs|null;
  state:'editable-input'|'missing-input'|'result-readonly';
  reason:string;
}
function object(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
function assertPreserved(before:unknown,after:unknown,path=''):void {
  if(object(before)&&object(after)){
    for(const key of Object.keys(before)){
      if(path===''&&(key==='schemaVersion'||key==='engineVersion'))continue;
      if(!(key in after))throw Error(`不能无损转换：${path}.${key}`);
      assertPreserved(before[key],after[key],`${path}.${key}`);
    }
  }else if(Array.isArray(before)&&Array.isArray(after)){
    if(before.length!==after.length)throw Error(`不能无损转换：${path}`);
    before.forEach((v,i)=>assertPreserved(v,after[i],`${path}.${i}`));
  }else if(before!==after)throw Error(`不能无损转换：${path}`);
}
export function convertDocumentInput(raw:unknown):SimConfig {
  if(!object(raw))throw Error('缺少配置输入。');
  for(const key of ['schemaVersion','engineVersion','randomSeed','duration','cycleLength','characters','rotation','enemy']){
    if(!Object.hasOwn(raw,key))throw Error(`缺少必要输入：${key}；不会猜测默认值。`);
  }
  const config=migrateConfig(raw);
  assertPreserved(raw,config);
  return config;
}
export function parseProjectDocument(raw:unknown):ProjectDocument {
  if(!object(raw)||raw.format!=='gidps-document-v1'||typeof raw.id!=='string'||!raw.id||raw.verification!=='not-recomputed')throw Error('不支持的项目文档或验证状态。');
  if(Object.keys(raw).some(k=>!['format','id','config','verification','original','runInputs','controls'].includes(k)))throw Error('项目文档包含未知字段。');
  if(raw.original!==null&&(!object(raw.original)||typeof raw.original.name!=='string'||typeof raw.original.text!=='string'||Object.keys(raw.original).some(k=>k!=='name'&&k!=='text')))throw Error('原件信息无效。');
  const config=convertDocumentInput(raw.config);
  const runInputs=raw.runInputs===null?null:restoreSimulationInputs({...raw.runInputs as object,format:'simulation-record-v1'});
  if(runInputs&&JSON.stringify(runInputs.sourceConfig)!==JSON.stringify(config))throw Error('文档配置与运行输入不一致');
  return {format:'gidps-document-v1',id:raw.id,config,runInputs,controls:raw.controls===null?null:controlsSchema.parse(raw.controls),verification:'not-recomputed',original:raw.original as ProjectDocument['original']};
}
/** Opening is pure: it neither writes storage nor invokes the simulator. */
export function openProjectDocument(text:string,name:string):OpenDocument {
  const original={name,text};const raw:unknown=JSON.parse(text);
  if(object(raw)&&raw.format==='gidps-document-v1'){
    const document=parseProjectDocument(raw);
    return {original,document,config:document.config,runInputs:document.runInputs,state:'editable-input',reason:'项目输入可编辑；尚未重新模拟。'};
  }
  const resultOnly=object(raw)&&'damageEvents' in raw;
  const record=object(raw)&&(raw.format==='simulation-record-v1'||raw.format==='gidps-simulation-record-v2');
  try{
    if(resultOnly) return {original,document:null,config:null,runInputs:null,state:'result-readonly',reason:'旧结果仅供读取和原样导出；没有独立源输入，不自动反推配置。'};
    const config=convertDocumentInput(record?raw.sourceConfig:raw);
    const runInputs=record?restoreSimulationInputs({...raw,format:'simulation-record-v1'}):null;
    return {original,document:null,config,runInputs,state:'editable-input',reason:'旧文件保持原样；编辑后另存新格式副本，原结果未重新验证。'};
  }catch(error){return {original,document:null,config:null,runInputs:null,state:'missing-input',reason:error instanceof Error?error.message:String(error)};}
}
/** Conversion precedes the write. A failed write never replaces the original. */
export function saveEditedDocument(opened:OpenDocument|null,edited:unknown,storage:Pick<Storage,'setItem'>,id:string,runInputsOverride?:RestoredSimulationInputs|null,controls:DocumentControls|null=null):ProjectDocument {
  const config=convertDocumentInput(edited);
  const sourceInputs=runInputsOverride===undefined?opened?.runInputs??null:runInputsOverride;
  const runInputs=sourceInputs?restoreSimulationInputs({...sourceInputs,sourceConfig:config,format:'simulation-record-v1'}):null;
  const document:ProjectDocument={controls:controls===null?null:controlsSchema.parse(controls),runInputs,format:'gidps-document-v1',id:opened?.document?.id??id,config,verification:'not-recomputed',original:opened?.document?.original??opened?.original??null};
  storage.setItem(`gidps:document:${document.id}`,JSON.stringify(document));
  return document;
}
