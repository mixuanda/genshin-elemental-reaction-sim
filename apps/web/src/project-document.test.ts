import {describe,it,expect} from 'vitest';
import {makeConfig} from '../../../packages/sim-core/src/__tests__/fixtures';
import {openProjectDocument,saveEditedDocument,parseProjectDocument} from './project-document';

describe('project document copy-on-edit',()=>{
 it('opens old inputs without changing any byte and saves/reopens a separate unverified copy',()=>{
  const config=makeConfig();const original=JSON.stringify(config,null,4)+'\n';
  const opened=openProjectDocument(original,'old.json');
  expect(opened.state).toBe('editable-input');expect(opened.original.text).toBe(original);
  const writes=new Map<string,string>();const storage={setItem:(k:string,v:string)=>{writes.set(k,v);}};
  expect(writes.size).toBe(0);
  const edit=structuredClone(opened.config!);edit.duration=120;
  const doc=saveEditedDocument(opened,edit,storage,'copy-1');
  expect(doc.original!.text).toBe(original);expect(doc.verification).toBe('not-recomputed');
  expect(writes.size).toBe(1);expect(opened.config!.duration).toBe(config.duration);
  const reopened=openProjectDocument(writes.get('gidps:document:copy-1')!,'edited.gidps.json');
  expect(reopened.config!.duration).toBe(120);
  const next=structuredClone(reopened.config!);next.duration=60;
  const saved=saveEditedDocument(reopened,next,storage,'unused');
  expect(saved.id).toBe('copy-1');expect(saved.original!.text).toBe(original);expect(saved.config.duration).toBe(60);
 });
 it('preserves old results without inferring source inputs',()=>{
  const raw='{"schemaVersion":"1.53.0","damageEvents":[],"totalDamage":123}';
  const opened=openProjectDocument(raw,'result.json');
  expect(opened.state).toBe('result-readonly');expect(opened.config).toBeNull();expect(opened.original.text).toBe(raw);
 });
 it('keeps a saved record original while extracting only explicit source inputs',()=>{
  const raw=JSON.stringify({format:'simulation-record-v1',sourceConfig:makeConfig(),result:{totalDamage:123}});
  const opened=openProjectDocument(raw,'record.json');expect(opened.original.text).toBe(raw);
  expect(opened.state).toBe('missing-input');expect(opened.config).toBeNull();
  expect(JSON.parse(opened.original.text).result.totalDamage).toBe(123);
 });
 it.each(['randomSeed','duration','characters','enemy'])('does not guess missing %s',key=>{
  const raw=makeConfig() as unknown as Record<string,unknown>;delete raw[key];
  const opened=openProjectDocument(JSON.stringify(raw),'missing.json');
  expect(opened.state).toBe('missing-input');expect(opened.config).toBeNull();expect(opened.reason).toContain(key);
 });
 it('conversion or quota failure preserves the edit and original',()=>{
  const opened=openProjectDocument(JSON.stringify(makeConfig()),'old.json');
  const edit=structuredClone(opened.config!);edit.duration=120;
  const before=JSON.stringify(edit),original=opened.original.text;
  expect(()=>saveEditedDocument(opened,edit,{setItem:()=>{throw Error('quota');}},'copy')).toThrow('quota');
  expect(JSON.stringify(edit)).toBe(before);expect(opened.original.text).toBe(original);
  expect(()=>saveEditedDocument(opened,{duration:120},{setItem:()=>{throw Error('must not write');}},'copy')).toThrow('缺少必要输入');
 });
 it('rejects fabricated verification and unknown document fields',()=>{
  const doc=saveEditedDocument(null,makeConfig(),{setItem:()=>{}},'new');
  expect(()=>parseProjectDocument({...doc,verification:'verified'})).toThrow();
  expect(()=>parseProjectDocument({...doc,evidence:[]})).toThrow();
 });
});

import {simulate} from '../../../packages/sim-core/src/simulator';
it('preserves explicit runtime options and execution settings when editing a legacy run',()=>{
 const config=makeConfig();const result=simulate(config,{critMode:'noCrit',randomSeed:'saved-seed'});
 const raw=JSON.stringify({format:'simulation-record-v1',sourceConfig:config,options:result.resolvedRuntimeOptions,iterations:7,executionProfile:null,benchmark:null,result});
 const opened=openProjectDocument(raw,'run.json');expect(opened.state).toBe('editable-input');
 const edited=structuredClone(opened.config!);edited.duration=120;
 const doc=saveEditedDocument(opened,edited,{setItem:()=>{}},'copy');
 const restored=openProjectDocument(JSON.stringify(doc),'copy.json');
 expect(restored.runInputs!.options).toEqual(result.resolvedRuntimeOptions);
 expect(restored.runInputs!.iterations).toBe(7);
 expect(restored.runInputs!.sourceConfig.duration).toBe(120);
 expect(restored.original.text).not.toBe(raw);expect(restored.document!.original!.text).toBe(raw);
});
