import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { observedCharacterResourceContextSchema, type ObservedCharacterResourceContext } from "../../../packages/sim-core/src/observed-character-resource-context";
import { resolveObservedCharacterResources } from "../../../packages/sim-core/src/observed-character-resource";
import { observedZibaiResourceContextSchema, type ObservedZibaiResourceContext } from "../../../packages/sim-core/src/observed-zibai-resource-context";
import { resolveObservedZibaiResources } from "../../../packages/sim-core/src/observed-zibai-resource";

type Family="lohen"|"zibai";
type ResourceGame=NonNullable<CalculatorDocument["gameContext"]>&{observedCharacterResources?:ObservedCharacterResourceContext;observedZibaiResources?:ObservedZibaiResourceContext};
type Row=Record<string,string>;
type Field=readonly [key:string,label:string,type:"text"|"number"|"boolean"|ReadonlyArray<readonly [string,string]>];
type Draft={enabled:boolean;main:Row;initialKnown:boolean;initial:Row;eventsKnown:boolean;events:Row[];cooldowns:Row[];bindings:Row[];dirty:boolean};
const drafts=new Map<string,Draft>();
const familyOf=(doc:CalculatorDocument):Family|undefined=>["lohen-skill-etch-resource","lohen-burst-six-cuts-resource"].includes(doc.gameContext?.skillId??"")?"lohen":doc.gameContext?.skillId==="zibai-finite-spirit-steed-c0"?"zibai":undefined;
const gameOf=(doc:CalculatorDocument)=>doc.gameContext as ResourceGame|undefined;
const contextOf=(doc:CalculatorDocument,family:Family)=>family==="lohen"?gameOf(doc)?.observedCharacterResources:gameOf(doc)?.observedZibaiResources;
const draftKey=(doc:CalculatorDocument)=>`${doc.gameContext?.characterId}:${doc.gameContext?.skillId}`;
const esc=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const asRow=(value:unknown):Row=>value&&typeof value==="object"?Object.fromEntries(Object.entries(value).filter(([,v])=>["string","number","boolean"].includes(typeof v)).map(([k,v])=>[k,String(v)])):{};
const commonFields:Field[]=[["casterId","资源拥有者标识","text"],["constellation","实际命座（当前协议C0）","number"],["initialStateObserved","起点状态来自实际观察","boolean"],["eventsObservedThroughCutoff","截至本击的相关事件全部记录","boolean"],["observedOrderConfirmed","同帧实际先后已明确","boolean"],["noHitlag","本账本没有卡肉延时","boolean"],["consumptionEventId","当前动作共用的实际消费事件标识","text"]];
const lohenFields:Field[]=[["ascension","实际突破阶段（判断A1）","number"],["cooldownsClearAtStart","起点各获得冷却均已明确就绪","boolean"]];
const initialCommon:Field[]=[["frame","起点实际帧","number"],["order","起点同帧顺序","number"]];
const initialLohen:Field[]=[["stanceActive","起点处于奇谋","boolean"],["stanceId","该次奇谋标识（有效姿态必填）","text"],["expiresAtFrame","已观察姿态的实际到期帧","number"],["joy","起点实际欢悦（0至100）","number"],["will","起点实际争胜（0至100）","number"],["etchUses","本次已施放镂骨彻心次数（0至3）","number"],["noPendingEtchConfirmed","起点没有已施放但尚未结算的镂骨彻心","boolean"],["joyGainReadyAtFrame","欢悦获得冷却实际就绪帧（未知留空）","number"]];
const initialZibai:Field[]=[["phaseActive","起点处于月转时隙","boolean"],["phaseId","该次姿态标识（有效姿态必填）","text"],["expiresAtFrame","已观察姿态的实际到期帧","number"],["radiance","起点实际时隙浮光（0至100）","number"],["releasedSteeds","本次已经释放的灵驹数（0至4）","number"],["noPendingSteedConfirmed","起点没有已消费但尚未释放的灵驹","boolean"],["normalGainReadyAtFrame","普攻获点冷却实际就绪帧","number"],["lunarGainReadyAtFrame","月结晶获点冷却实际就绪帧","number"],["lastNaturalGainFrame","最近一次已观察的自然获点帧（不是预测首tick）","number"]];
const commonEvent:Field[]=[["id","事件唯一标识","text"],["frame","实际发生帧","number"],["order","同帧实际顺序","number"]];
const lohenKinds:ReadonlyArray<readonly[string,string]>=[["enter","进入奇谋"],["normal-hit","自身普攻／重击命中观察"],["party-damage","其他附近队员的实际伤害"],["etch-cast","施放镂骨彻心（尚不消费）"],["etch-resolve","镂骨彻心命中／落空与消费"],["burst-cast","施放Q并消费争胜"],["exit","奇谋实际退出"]];
const zibaiKinds:ReadonlyArray<readonly[string,string]>=[["enter","进入月转时隙"],["natural-gain","已观察的每秒自然获点"],["normal-gain","自身普攻命中获点"],["lunar-gain","附近月结晶触发获点"],["steed-consume","灵驹实际消费70点"],["steed-release","灵驹实际释放／月结晶冷却重置"],["burst-cast","Q施放延长姿态"],["exit","姿态实际退出"]];
const lohenEvents:Record<string,Field[]>={
  enter:[["stanceId","本次奇谋标识","text"],["actionReadyConfirmed","实际战技动作已就绪","boolean"]],
  "normal-hit":[["attackTag","实际伤害标签",[["normal","普通攻击"],["charged","重击"]]],["actorId","命中者标识（洛恩本人）","text"],["hitId","原始命中标识（不重复计数）","text"],["enemyHitConfirmed","确实命中敌人","boolean"]],
  "party-damage":[["actorId","其他队员标识","text"],["damageId","原始伤害事件标识","text"],["nearbyPartyMemberConfirmed","确为其他附近队员造成","boolean"],["damage","该次实际伤害值","number"],["lohenBaseAttack","该时点洛恩实际白字攻击力","number"]],
  "etch-cast":[["actionId","本次镂骨彻心动作标识","text"],["actionReadyConfirmed","真实动作已经就绪","boolean"]],
  "etch-resolve":[["actionId","对应已施放动作标识","text"],["hitOpponent","确实命中至少一个敌人","boolean"]],
  "burst-cast":[["actionId","本次Q动作标识","text"],["actionReadyConfirmed","真实Q动作与能量已经就绪","boolean"]],
  exit:[["reason","实际退出原因",[["leave-field","离场"],["duration","自然到期"],["observed-early-exit","已观察提前退出"]]]],
};
const zibaiEvents:Record<string,Field[]>={
  enter:[["phaseId","本次姿态标识","text"],["initialRadiance","实际进入时浮光点数","number"],["normalGainReadyAtFrame","普攻获点冷却实际就绪帧","number"],["lunarGainReadyAtFrame","月结晶获点冷却实际就绪帧","number"]],
  "natural-gain":[],
  "normal-gain":[["actorId","命中者标识（兹白本人）","text"],["hitId","原始命中标识","text"],["enemyHitConfirmed","确实命中敌人","boolean"]],
  "lunar-gain":[["reactionId","真实月结晶反应标识","text"],["triggerOwnerId","反应触发者标识","text"],["nearbyPartyTriggerConfirmed","确为附近队伍触发","boolean"],["moonsignLevel","本事件实际月兆等级","number"]],
  "steed-consume":[["actionId","本次灵驹动作标识","text"]],
  "steed-release":[["consumptionEventId","对应70点消费事件标识","text"]],
  "burst-cast":[["castId","实际Q施放标识","text"]],
  exit:[["reason","实际退出原因",[["duration","自然到期"],["four-steeds","实际释放四次灵驹"],["observed-early-exit","已观察提前退出"]]]],
};
const boundaryFields=(family:Family,kind:string):Field[]=>family==="lohen"?[["stanceActiveAtBoundaryConfirmed","若恰在到期帧：本事件时奇谋仍有效","boolean"],["cooldownBoundaryReadyConfirmed","若恰在获点冷却边界：本事件时已经就绪","boolean"]]:[["phaseActiveAtBoundaryConfirmed","若恰在到期帧：本事件时姿态仍有效","boolean"],...(["normal-gain","lunar-gain"].includes(kind)?[["cooldownBoundaryReadyConfirmed","若恰在获点冷却边界：本事件时已经就绪","boolean"]] as Field[]:[])];
function getDraft(doc:CalculatorDocument,family:Family):Draft{
  const key=draftKey(doc),previous=drafts.get(key);if(previous)return previous;
  const context=contextOf(doc,family),lohen=context as ObservedCharacterResourceContext|undefined;
  const draft:Draft={enabled:context!==undefined,main:asRow(context),initialKnown:context?.initial!==undefined,initial:asRow(context?.initial),eventsKnown:context?.events!==undefined,events:context?.events?.map(asRow)??[],cooldowns:Object.entries(family==="lohen"?lohen?.initial?.willGainReadyAtByActor??{}:{}).map(([actorId,readyAtFrame])=>({actorId,readyAtFrame:String(readyAtFrame)})),bindings:Object.entries(family==="lohen"?lohen?.hitBindings??{}:{}).map(([hitId,eventId])=>({hitId,eventId})),dirty:false};drafts.set(key,draft);return draft;
}
function field([key,label,type]:Field,row:Row):string{
  const value=row[key]??"",attr=`data-character-resource-key="${esc(key)}" data-character-resource-draft-input`;
  if(type==="boolean" || typeof type!=="string"){const choices=type==="boolean"?[["true","是"],["false","否"]] as const:type;return `<label>${esc(label)}<select ${attr}><option value=""${!value?" selected":""}>未知；需明确</option>${choices.map(([id,name])=>`<option value="${esc(id)}"${value===id?" selected":""}>${esc(name)}</option>`).join("")}</select></label>`;}
  return `<label>${esc(label)}<input ${attr} type="${type}" value="${esc(value)}"${type==="number"?' min="0" step="any"':''} placeholder="未知；留空"></label>`;
}
const fields=(definitions:Field[],row:Row)=>definitions.map(def=>field(def,row)).join("");
const known=(key:string,label:string,value:boolean)=>`<label>${esc(label)}<select data-character-resource-known="${key}" data-character-resource-draft-input><option value="unknown"${!value?" selected":""}>未知／未提供</option><option value="provided"${value?" selected":""}>明确提供（可为空）</option></select></label>`;
const remove=(collection:string,index:number)=>`<button type="button" data-action="character-resource-remove-${collection}" data-character-resource-row-index="${index}">移除此行</button>`;
export function renderCharacterResourceDraft(doc:CalculatorDocument):string{
  const family=familyOf(doc);if(!family)return "";const draft=getDraft(doc,family),kinds=family==="lohen"?lohenKinds:zibaiKinds,eventFields=family==="lohen"?lohenEvents:zibaiEvents;
  const bindings=family==="lohen"?`<details><summary>逐击消费事件绑定（留空时采用共同绑定）</summary><p>可以让同一次Q的全部六斩指向同一消费记录，不重复扣资源。</p>${draft.bindings.map((row,index)=>`<div class="calculator-fields" data-character-resource-row="bindings">${field(["hitId","本击完整标识","text"],row)}${field(["eventId","实际消费事件标识","text"],row)}${remove("bindings",index)}</div>`).join("")}<button type="button" data-action="character-resource-add-bindings">添加逐击绑定</button><p>${doc.hits.map(hit=>`${esc(hit.label)}：${esc(hit.id)}`).join("<br>")}</p></details>`:"";
  const cooldowns=family==="lohen"?`<details><summary>起点队员各自的争胜获得冷却</summary>${draft.cooldowns.map((row,index)=>`<div class="calculator-fields" data-character-resource-row="cooldowns">${field(["actorId","队员标识","text"],row)}${field(["readyAtFrame","实际就绪帧","number"],row)}${remove("cooldowns",index)}</div>`).join("")}<button type="button" data-action="character-resource-add-cooldowns">添加起点队员冷却</button></details>`:"";
  return `<div data-character-resource-editor><label>本动作资源输入方式<select data-character-resource-enabled data-character-resource-draft-input><option value="manual"${!draft.enabled?" selected":""}>保留现有独立本击输入</option><option value="ledger"${draft.enabled?" selected":""}>采用实际资源事件账本</option></select></label><div class="calculator-fields" data-character-resource-main>${fields([...commonFields,...(family==="lohen"?lohenFields:[])],draft.main)}</div><details open><summary>真实观察起点</summary>${known("initial","起点资源状态",draft.initialKnown)}<div class="calculator-fields" data-character-resource-initial>${fields([...initialCommon,...(family==="lohen"?initialLohen:initialZibai)],draft.initial)}</div>${cooldowns}</details><details open><summary>按实际帧与同帧顺序记录事件</summary>${known("events","相关资源事件列表",draft.eventsKnown)}${draft.events.map((row,index)=>`<fieldset data-character-resource-row="events"><legend>资源事件 ${index+1}</legend><div class="calculator-fields">${field(["kind","实际事件类型",kinds],row)}${fields(commonEvent,row)}${fields(eventFields[row.kind??""]??[],row)}</div><details><summary>恰在到期或冷却边界时的实际状态</summary><div class="calculator-fields">${fields(boundaryFields(family,row.kind??""),row)}</div></details>${remove("events",index)}</fieldset>`).join("")}<button type="button" data-action="character-resource-add-events">添加实际资源事件</button></details>${bindings}<p data-character-resource-draft-status role="status">${draft.dirty?"资源账本草稿尚未应用；请应用后计算或导出。":"资源账本没有未应用编辑。"}</p><button type="button" data-action="character-resource-apply">应用资源账本</button><button type="button" data-action="character-resource-reset">放弃未应用编辑</button></div>`;
}
export function renderCharacterResourceControls(doc:CalculatorDocument):string{
  const family=familyOf(doc);if(!family)return "";const context=contextOf(doc,family);let ledger="";
  if(context){try{if(family==="lohen"){
    const value=context as ObservedCharacterResourceContext,result=resolveObservedCharacterResources(value,value.consumptionEventId?{throughEventId:value.consumptionEventId}:{});
    ledger=`${result.issues.length?`<ul>${result.issues.map(issue=>`<li>${esc(issue)}</li>`).join("")}</ul>`:""}<table><thead><tr><th>事件／顺序</th><th>欢悦</th><th>争胜</th><th>实际判定</th></tr></thead><tbody>${result.records.map(row=>`<tr><td>${esc(row.eventId)} · ${row.frame}f / ${row.order}</td><td>${row.joyBefore} → ${row.joyAfter}</td><td>${row.willBefore} → ${row.willAfter}</td><td>${esc(row.reason)}</td></tr>`).join("")}</tbody></table><p>${result.consumptions.map(row=>`${esc(row.eventId)}：实际消费争胜${row.willConsumed}／欢悦${row.joyConsumed}`).join("；")}</p>`;
  }else{const value=context as ObservedZibaiResourceContext,result=resolveObservedZibaiResources(value,value.consumptionEventId?{throughEventId:value.consumptionEventId}:{});
    ledger=`${result.issues.length?`<ul>${result.issues.map(issue=>`<li>${esc(issue)}</li>`).join("")}</ul>`:""}<table><thead><tr><th>事件／顺序</th><th>浮光</th><th>已释放灵驹</th><th>姿态</th></tr></thead><tbody>${result.steps.map(row=>`<tr><td>${esc(row.eventId)} · ${row.after.frame}f / ${row.after.order}</td><td>${row.before.radiance} → ${row.after.radiance}</td><td>${row.after.releasedSteeds}</td><td>${row.after.phaseActive?"有效":"已结束"}</td></tr>`).join("")}</tbody></table><p>${result.consumptions.map(row=>`${esc(row.eventId)}：${row.radianceBefore}−${row.cost}=${row.radianceAfter}`).join("；")}</p>`;
  }}catch(error){ledger=`<p role="alert">${esc(error instanceof Error?error.message:String(error))}</p>`;}}
  return `<fieldset data-character-resource-controls="${family}"><legend>${family==="lohen"?"洛恩欢悦／争胜":"兹白时隙浮光"}：实际事件资源账本</legend><p class="calculator-hint">只根据已记录的实际事件计算资源，不推测队友输出或动画。独立本击只读取绑定消费及之前的事件，不要求未来或整场轮转。来源状态：有条件／source-assumed。</p><div class="table-wrap" data-character-resource-ledger>${ledger||"尚未启用账本；可以保留原有独立本击条件输入。"}</div>${renderCharacterResourceDraft(doc)}<p class="calculator-hint">${family==="lohen"?"镂骨彻心施放先计次数，命中后才消费。其他队员的争胜获得冷却分别记录；本击有效天赋与实际最终面板继续独立编辑。退出账本会把最后消费值保留为显式本击输入，不再自动更新。":"自然获点只记录已观察的tick，不默认首tick帧。灵驹释放／月结晶冷却重置是实际资源回调记录，不能直接套用伤害动画帧。退出账本后，需在独立本击控件重新确认动作资格。"}未知字段保持未知，不自动填0。</p></fieldset>`;
}
function readRow(element:Element):Row{return Object.fromEntries([...element.querySelectorAll<HTMLInputElement|HTMLSelectElement>("[data-character-resource-key]")].map(input=>[input.getAttribute("data-character-resource-key")!,input.value]));}
export function captureCharacterResourceDraft(doc:CalculatorDocument,root:HTMLElement):void{
  const family=familyOf(doc),editor=root.querySelector<HTMLElement>("[data-character-resource-editor]");if(!family||!editor)return;const draft=getDraft(doc,family);
  draft.enabled=editor.querySelector<HTMLSelectElement>("[data-character-resource-enabled]")?.value==="ledger";
  const main=editor.querySelector("[data-character-resource-main]"),initial=editor.querySelector("[data-character-resource-initial]");if(main)draft.main=readRow(main);if(initial)draft.initial=readRow(initial);
  draft.initialKnown=editor.querySelector<HTMLSelectElement>('[data-character-resource-known="initial"]')?.value==="provided";draft.eventsKnown=editor.querySelector<HTMLSelectElement>('[data-character-resource-known="events"]')?.value==="provided";
  for(const collection of ["events","cooldowns","bindings"] as const)draft[collection]=[...editor.querySelectorAll(`[data-character-resource-row="${collection}"]`)].map(readRow);draft.dirty=true;
}
export function editCharacterResourceDraft(doc:CalculatorDocument,root:HTMLElement,button:HTMLButtonElement):void{
  const family=familyOf(doc);if(!family)return;captureCharacterResourceDraft(doc,root);const draft=getDraft(doc,family),action=button.dataset.action??"";
  for(const collection of ["events","cooldowns","bindings"] as const){if(action===`character-resource-add-${collection}`){draft[collection].push({});if(collection==="events")draft.eventsKnown=true;}else if(action===`character-resource-remove-${collection}`)draft[collection].splice(Number(button.getAttribute("data-character-resource-row-index")),1);}
}
function parseFields(row:Row,definitions:Field[]):Record<string,unknown>{
  const output:Record<string,unknown>={};for(const [key,label,type]of definitions){const value=row[key]?.trim();if(!value)continue;if(type==="number"){const number=Number(value);if(!Number.isFinite(number))throw new Error(`${label}必须是实际有限数值。`);output[key]=number;}else if(type==="boolean")output[key]=value==="true";else output[key]=value;}return output;
}
export function applyCharacterResourceDraft(doc:CalculatorDocument,root:HTMLElement):void{
  const family=familyOf(doc),game=gameOf(doc);if(!family||!game)return;captureCharacterResourceDraft(doc,root);const draft=getDraft(doc,family);
  if(!draft.enabled){
    const prefix=family==="lohen"?"observed-lohen-resource:":"observed-zibai-resources:";
    doc.dependencies=doc.dependencies.filter(row=>!row.id.startsWith(prefix));
    for(const hit of doc.hits){hit.dependencies=hit.dependencies.filter(id=>!id.startsWith(prefix));
      if(family==="lohen"&&hit.kind==="ordinary"&&hit.additiveBaseFormula?.ruleId.startsWith(prefix)){
        hit.additiveBaseFormula={...hit.additiveBaseFormula,ruleId:"lohen-will-c0-optimizer-180a0a1",label:"洛恩：本次明确消耗争胜",
          inputs:hit.additiveBaseFormula.inputs.map(input=>input.key==="lohenWillConsumed"?{...input,origin:"conditioned-user-input",meaningKey:"从资源账本保留为显式本击输入；后续不再自动随事件更新"}:input)};
      }
    }
    if(family==="lohen")delete game.observedCharacterResources;
    else {delete game.observedZibaiResources;if(game.zibaiFiniteCast){delete game.zibaiFiniteCast.legalCastConfirmed;delete game.zibaiFiniteCast.spiritSteedRecastConfirmed;}}
    doc.assumptions=doc.assumptions.filter(row=>!row.startsWith(family==="lohen"?"洛恩观察资源：":"兹白资源账本："));
    resetCharacterResourceDraft(doc);return;
  }
  const current=contextOf(doc,family),next:Record<string,unknown>={...(current?structuredClone(current):{}),...parseFields(draft.main,[...commonFields,...(family==="lohen"?lohenFields:[])])};
  for(const [key]of [...commonFields,...(family==="lohen"?lohenFields:[])])if(!draft.main[key]?.trim())delete next[key];
  if(family==="lohen")next.character="lohen";
  if(draft.initialKnown){const initial=parseFields(draft.initial,[...initialCommon,...(family==="lohen"?initialLohen:initialZibai)]);if(family==="lohen"&&draft.cooldowns.length){const cooldowns:Record<string,number>={};for(const row of draft.cooldowns){const actor=row.actorId?.trim(),ready=row.readyAtFrame?.trim();if(!actor||!ready)throw new Error("起点队员冷却需要完整身份与就绪帧。");if(Object.hasOwn(cooldowns,actor))throw new Error("起点队员冷却身份重复。");Object.defineProperty(cooldowns,actor,{value:Number(ready),enumerable:true});}initial.willGainReadyAtByActor=cooldowns;}next.initial=initial;}else delete next.initial;
  if(draft.eventsKnown)next.events=draft.events.map(row=>parseFields(row,[["kind","事件类型",family==="lohen"?lohenKinds:zibaiKinds],...commonEvent,...((family==="lohen"?lohenEvents:zibaiEvents)[row.kind??""]??[]),...boundaryFields(family,row.kind??"")]));else delete next.events;
  if(family==="lohen"){const bindings:Record<string,string>={};for(const row of draft.bindings){const hit=row.hitId?.trim(),event=row.eventId?.trim();if(!hit||!event)throw new Error("逐击绑定需要完整命中标识与消费事件标识。");if(Object.hasOwn(bindings,hit))throw new Error("本击消费绑定重复。");Object.defineProperty(bindings,hit,{value:event,enumerable:true});}if(draft.bindings.length)next.hitBindings=bindings;else delete next.hitBindings;
    const parsed=observedCharacterResourceContextSchema.safeParse(next);if(!parsed.success)throw new Error(`洛恩资源记录尚不完整：${parsed.error.issues.map(issue=>`${issue.path.join(".")} ${issue.message}`).join("；")}`);game.observedCharacterResources=parsed.data;
  }else{const parsed=observedZibaiResourceContextSchema.safeParse(next);if(!parsed.success)throw new Error(`兹白资源记录尚不完整：${parsed.error.issues.map(issue=>`${issue.path.join(".")} ${issue.message}`).join("；")}`);game.observedZibaiResources=parsed.data;}
  resetCharacterResourceDraft(doc);
}
export function resetCharacterResourceDraft(doc:CalculatorDocument):void{drafts.delete(draftKey(doc));}
export function hasCharacterResourceDraft(doc:CalculatorDocument):boolean{return drafts.get(draftKey(doc))?.dirty===true;}
