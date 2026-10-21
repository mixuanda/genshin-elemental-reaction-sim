import type {AbilityDefinition,LegalTimelineCommand,SimConfig,SimulationOptions} from '@genshin-dps-lab/schemas';
import {prepareSimulationInWorker} from './worker-client';
import {sourceNormalChainDefinitions} from '../../../packages/sim-core/src/source-normal-chain';

/** Queries the real engine with one prospective command. No UI cooldown clock. */
export function mountActionPad(root:HTMLElement,config:SimConfig,options:()=>SimulationOptions,apply:(commands:LegalTimelineCommand[])=>void):{update:(commands:LegalTimelineCommand[])=>void} {
 let commands:LegalTimelineCommand[]=[];
 let selected=config.timeline!.initialActiveCharacterId;
 let pending:AbortController|null=null;
 let generation=0;
 const history:LegalTimelineCommand[][]=[];
 const removalObserver=new MutationObserver(()=>{
  if(!root.isConnected||root.closest('[hidden]')){pending?.abort();generation++;removalObserver.disconnect();}
 });
 removalObserver.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 const e=(tag:string,text:string)=>{const node=document.createElement(tag);node.textContent=text;return node;};
 function commit(next:LegalTimelineCommand[]):void {history.push(structuredClone(commands));apply(next);}
 async function render():Promise<void>{
  pending?.abort();const controller=new AbortController();pending=controller;const current=++generation;
  root.replaceChildren();root.className='card';root.id='quickActionPad';
  root.append(e('h3','点选动作 · 实际引擎资格'));
  root.append(e('p','查看角色不会切人。动作资格取当前轴末尾的同一引擎试算；等待必须明确点击。未接入的技能不会猜测。'));
  const active=commands.reduce((actor,c)=>c.type==='swap'?c.characterId:actor,config.timeline!.initialActiveCharacterId);
  const roster=document.createElement('div');roster.className='rotation-skill-buttons';root.append(roster);
  for(let i=0;i<4;i++){
   const actor=config.characters[i];const b=document.createElement('button');b.type='button';b.dataset.padActor=actor?.id??'';
   b.textContent=actor?`${actor.name}${actor.id===active?' · 当前出场':''}${actor.id===selected?' · 正在查看':''}`:`空角色槽 ${i+1}`;
   b.onclick=()=>{if(!actor){document.querySelector<HTMLAnchorElement>('.product-nav a[href="/team"]')?.click();return;}selected=actor.id;void render();};roster.append(b);
  }
  const controls=document.createElement('div');controls.className='rotation-skill-buttons';root.append(controls);
  const swap=document.createElement('button');swap.type='button';swap.id='padSwap';swap.textContent='切换为查看角色';swap.disabled=selected===active;swap.onclick=()=>commit([...commands,{type:'swap',characterId:selected}]);controls.append(swap);
  const undo=document.createElement('button');undo.type='button';undo.id='padUndo';undo.textContent='撤销上次点选';undo.disabled=!history.length;undo.onclick=()=>{const previous=history.pop();if(previous)apply(previous);};controls.append(undo);
  const durationLabel=document.createElement('label');durationLabel.textContent='完整计算窗口 ';
  const duration=document.createElement('select');duration.id='padDuration';
  for(const seconds of [...new Set([15,18,20,60,120,config.duration])].sort((a,b)=>a-b)){
   const option=document.createElement('option');option.value=String(seconds);option.textContent=`${seconds} 秒`;duration.append(option);
  }
  duration.value=String(config.duration);duration.onchange=()=>{config.duration=Number(duration.value);apply([...commands]);};durationLabel.append(duration);root.append(durationLabel);
  root.append(e('p','延长窗口不会复制动作或乘伤害；完整窗口 DPS 包含空档。循环需要逐次加入并接受真实冷却、能量校验。播放倍率仅用于结果回放。'));
  const status=e('p','正在读取实际动作资格…');status.setAttribute('role','status');status.id='padStatus';root.append(status);
  if(selected!==active){status.textContent='查看中。请先切人，再施放该角色技能。';return;}
  const chains=sourceNormalChainDefinitions(config.sourceAbilityBindings);
  const chain=chains.find(c=>c.actorId===selected);
  const chainedIds=new Set(chain?.abilityIds??[]);
  const abilities=config.timeline!.abilities.filter(a=>a.actorId===selected&&(!chainedIds.has(a.id)||a.id===chain?.abilityIds[0]));
  const rows:Array<{ability:AbilityDefinition;button:HTMLButtonElement;info:HTMLElement;normalChain:boolean}>=[];
  for(const kind of ['normal','skill','burst','charge','plunge'] as const){
   const available=abilities.filter(a=>a.kind===kind);
   const host=(kind==='charge'||kind==='plunge')?document.createElement('details'):document.createElement('div');
   if(host.tagName==='DETAILS')host.append(e('summary',kind==='charge'?'重击等更多动作':'下落动作'));
   root.append(host);
   if(!available.length){host.append(e('p',`${{normal:'A · 普攻',skill:'E · 战技',burst:'Q · 爆发',charge:'重击',plunge:'下落'}[kind]}：当前队伍未接入`));continue;}
   for(const ability of available){
    const button=document.createElement('button');button.type='button';button.disabled=true;button.dataset.padAbility=ability.id;
    button.textContent=`${{normal:'A',skill:'E',burst:'Q',charge:'重击',plunge:'下落'}[kind]} · ${ability.name}`;
    const info=e('p','读取资格…');const row=document.createElement('div');row.className='rotation-execution-row';row.append(button,info);host.append(row);
    rows.push({ability,button,info,normalChain:ability.id===chain?.abilityIds[0]});
   }
  }
  for(const {ability,button,info,normalChain} of rows){
   if(controller.signal.aborted||!root.isConnected)return;
   const command:LegalTimelineCommand={type:ability.kind,actorId:selected,abilityId:ability.id,...(normalChain?{sourceNormalChain:'next-v1' as const}:{})};
   const base=structuredClone(config);base.timeline!.commands=[...structuredClone(commands),command];base.timeline!.legalityMode='wait';
   try{
    const receipt=await prepareSimulationInWorker(base,options(),null,true,{signal:controller.signal});
    if(current!==generation||controller.signal.aborted||!root.isConnected)return;
    const result=receipt.timelineExecution?.commandResults.at(-1);
    if(!result||result.commandIndex!==commands.length)throw Error('缺少末尾动作执行回执');
    if(receipt.timelineExecution!.commandResults.slice(0,-1).some(r=>r.status==='rejected'||r.status==='waited'))throw Error('前序动作未合法执行，请先删除或显式补上等待。');
    if(result.status==='rejected'){
     const failures=receipt.timelineExecution!.failures.filter(f=>f.commandIndex===commands.length);
     info.textContent=` 未执行：${failures.map(f=>f.message).join('；')||result.failureCode}`;
    }else if(result.status==='waited'){
     const frames=result.startFrame!-result.requestedFrame;
     const causes=receipt.timelineExecution!.adjustments.filter(a=>a.commandIndex===commands.length);
     info.textContent=` ${causes.some(a=>a.code==='ABILITY_ON_COOLDOWN')?'冷却':'动作衔接'}尚需等待 ${(frames/60).toFixed(2)} 秒（${frames}f，核心实际等待）`;
     const wait=document.createElement('button');wait.type='button';wait.textContent='等到可用';wait.dataset.padWait=ability.id;
     wait.onclick=()=>commit([...commands,{type:'wait',frames}]);info.after(wait);
    }else{
     button.disabled=false;info.textContent=` 可施放 · 请求 ${(result.requestedFrame/60).toFixed(2)}s → 衔接 ${((result.cancelFrame??result.endFrame??result.startFrame!)/60).toFixed(2)}s`;
     button.onclick=()=>commit([...commands,command]);
    }
    if(result.energyBefore!==undefined)info.textContent+=` · 起手能量 ${result.energyBefore.toFixed(2)} / 消耗 ${result.energyCost??0}`;
   }catch(error){if(controller.signal.aborted)return;info.textContent='当前来源或状态不支持此动作顺序，未确认可执行。';const details=document.createElement('details');details.append(e('summary','限制详情'),e('p',error instanceof Error?error.message:String(error)));info.after(details);}
  }
  if(current===generation)status.textContent=`当前 ${commands.length} 条指令；按钮依据固定种子 ${options().randomSeed??config.randomSeed} 的真实试算。短片段不代表120秒循环；快速计算按配置完整时长运行。`;
 }
 return {update(next){commands=structuredClone(next);void render();}};
}
