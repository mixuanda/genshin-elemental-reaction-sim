import { colleiSkillContextSchema, charlotteSkillContextSchema, type CalculatorDocument, type CalculatorFormula, type ColleiSkillContext, type CharlotteSkillContext } from "./calculator-model";
import { expr } from "./calculation-trace";
const source=(slug:string)=>["skill.go","asc.go","cons.go"].map(file=>`https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/${slug}/${file}`);
export const COLLEI_SKILL_SOURCE_REFS=[...source("collei"),"https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/catalyze.go","https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/reaction.go","https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Collei/index.tsx"];
export const CHARLOTTE_SKILL_SOURCE_REFS=[...source("charlotte"),"https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/stats.go","https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attributes/stats.go","https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/hitlag.go","https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Charlotte/index.tsx"];
export const isColleiSkillAction=(doc:CalculatorDocument)=>["collei-skill-no-sprout-complete","collei-skill-sprout-complete","collei-skill-extended-sprout-complete"].includes(doc.gameContext?.skillId??"");
export const isCharlotteSkillAction=(doc:CalculatorDocument)=>["charlotte-skill-press-complete","charlotte-skill-hold-complete"].includes(doc.gameContext?.skillId??"");
const ascensionOf=(doc:CalculatorDocument)=>(doc.build.mode==="equipment-derived"?doc.build.equipment?.ascension:doc.build.ascension)??doc.gameContext?.ascension;

/** Static full-cast branches use one E release snapshot and a different, explicitly supplied return snapshot. */
export function applyColleiSkillContext(document:CalculatorDocument,supplied:ColleiSkillContext):CalculatorDocument {
  if(!isColleiSkillAction(document))return document;
  const context=colleiSkillContextSchema.parse(supplied),result=structuredClone(document),game=result.gameContext!;
  game.colleiSkill=context;
  const prefix="collei-skill-context:",assumptionPrefix="柯莱完整 E 来源上下文：";
  result.dependencies=result.dependencies.filter(row=>!row.id.startsWith(prefix));result.assumptions=result.assumptions.filter(row=>!row.startsWith(assumptionPrefix));
  const fullCast=result.scope==="one-cast"&&result.hits.every(hit=>result.selectedHitIds.includes(hit.id)),ascension=ascensionOf(result),c=game.constellation;
  const count=game.skillId==="collei-skill-no-sprout-complete"?0:game.skillId==="collei-skill-sprout-complete"?2:4;
  const reasons:string[]=[],snapshotReasons:string[]=[];
  if(fullCast){
    if(ascension===undefined)reasons.push("缺少明确突破阶段，不能确定新叶是否解锁。");
    if(c>=6)reasons.push("C6 另有200%ATK伤害，攻击分类/快照未接入；当前分支不能作为 C6 完整 E。");
    if(ascension===0){if(count!==0)reasons.push("突破0未解锁A1，不会产生本分支的新叶。");}
    else if(ascension!==undefined){
      const before=context.reactionBeforeReturn;
      let expected:number|undefined;
      if(c<2){
        if(before===undefined)reasons.push("需要明确飞叶轮返回前是否触发符合A1的草相关反应，不能默认未触发。");
        else expected=before?2:0;
      } else {
        if(before===true||context.reactionDuringSprout===true)expected=4;
        else if(before===false&&context.reactionDuringSprout===false)expected=2;
        else reasons.push("C2 已生成新叶，但飞行/新叶期间是否触发一次延长尚未确定；任一明确触发即四次，两处均未触发才两次。");
      }
      if(expected!==undefined&&count!==expected)reasons.push(`当前触发和命座条件产生 ${expected} 次新叶，不能使用所选 ${count} 次新叶完整分支。`);
      const ringSpread=result.hits.some(hit=>hit.kind==="ordinary"&&hit.id.includes("-ring-")&&hit.additiveReaction==="spread");
      const sproutSpread=result.hits.some(hit=>hit.kind==="ordinary"&&hit.id.includes("-sprout-instance-")&&hit.additiveReaction==="spread");
      if(before===false&&ringSpread)reasons.push("往返击已指定Spread，不能同时声明回收前没有草相关反应；这会触发新叶或C2延长。");
      if(c>=2&&before===false&&context.reactionDuringSprout===false&&sproutSpread)reasons.push("新叶已指定Spread，不能同时声明新叶期间没有草反应；C2 会延长一次。");
    }
    if(count&&context.sproutUninterrupted!==true)reasons.push("完整新叶次数需要明确未被新一次E/新叶替换、未中断，且没有额外延长到新增tick。");
  }
  if(count){
    if(!context.sproutSnapshot)snapshotReasons.push("缺少飞叶轮回收时新叶的独立历史进攻快照，不能复制 E 起手面板。");
    else if(context.sproutSnapshot.ascension<1)snapshotReasons.push("新叶快照突破至少为1；突破0没有该伤害。");
  }
  const fullId=`${prefix}full-branch`,snapId=`${prefix}return-snapshot`,reactionId=`${prefix}reaction-stats`;
  result.dependencies.push({id:fullId,status:reasons.length?"missing":"provisional",reason:reasons.join("；")||"所选完整分支与明确触发、持续及命座范围相符；未执行反应时间线。",sourceRefs:COLLEI_SKILL_SOURCE_REFS},{id:snapId,status:snapshotReasons.length?"missing":"provisional",reason:snapshotReasons.join("；")||"新叶使用明确回收时快照，同一新叶的所有tick复用该快照。",sourceRefs:COLLEI_SKILL_SOURCE_REFS},{id:reactionId,status:context.reactionStatsMatchSnapshots===true?"provisional":"missing",reason:context.reactionStatsMatchSnapshots===true?"所选Spread命中时实际EM与反应加成明确等于该击所用释放/回收面板；没有把反应EM自动锁定。":"Spread的EM与反应加成在命中时读取，不自动快照；需要明确它们与该击所用起手/回收面板相同。",sourceRefs:COLLEI_SKILL_SOURCE_REFS});
  for(const hit of result.hits){
    hit.dependencies=hit.dependencies.filter(id=>!id.startsWith(prefix));if(fullCast)hit.dependencies.push(fullId);
    if(hit.kind!=="ordinary")continue;
    if(hit.additiveReaction==="spread")hit.dependencies.push(reactionId);
    if(hit.id.includes("-sprout-instance-")){
      hit.dependencies.push(snapId);hit.terms=[{stat:"atk",coefficient:.4,minimumAscension:1}];
      if(context.sproutSnapshot)hit.finalSnapshot=structuredClone(context.sproutSnapshot);else delete hit.finalSnapshot;
    }
  }
  result.assumptions.push(`${assumptionPrefix}往返两击在E释放20帧快照；新叶在回收157帧另取快照，按返回后86、175帧两次tick，C2延长时再有264、353帧两次。这里只合计明确全部命中、没有替换/额外延长的数值，不运行这些帧或认证位置。`,`${assumptionPrefix}单选飞叶轮不依赖未选新叶的未来快照；单选新叶以该tick确实存在为条件，仍必须恢复其实际历史快照。只有全选整个施放才检查完整触发/次数分支。`,`${assumptionPrefix}Spread的EM及反应加成在实际命中时读取，不随释放/回收伤害快照自动锁定；选择Spread时须明确其命中实际值等于对应面板，否则当前静态条件不成立。`,`${assumptionPrefix}C1退场充能等状态必须已体现在实际E/回收快照；不从当前在场状态猜历史状态。C3由显式有效E等级处理，新叶始终40%ATK，不随E天赋放大。C6完整动作仍阻塞。`);
  return result;
}

export function createCharlotteA4SkillFormula(nonFontaineTeammates:number,included:boolean):CalculatorFormula {
  return {ruleId:"charlotte-a4-region-accounting-b4ae769",label:"夏洛蒂A4：每名非枫丹其他队友5%冰伤，减去已含份额",expression:expr.mul(expr.value(.05),expr.input("charlotteNonFontaineTeammates"),expr.sub(expr.value(1),expr.input("charlotteA4Included"))),inputs:[{key:"charlotteNonFontaineTeammates",value:nonFontaineTeammates,minimum:0,maximum:3,integer:true,unit:"count",meaningKey:"队伍中除夏洛蒂外的非枫丹角色人数",origin:"derived-character-context"},{key:"charlotteA4Included",value:Number(included),allowedValues:[0,1],unit:"boolean",meaningKey:"所填逐击增伤已含当前人数对应的A4冰伤",origin:"derived-character-context"}],requirements:{minimumAscension:4,maximumConstellation:5,elements:["cryo"],attackTags:["skill"]},sourceRefs:CHARLOTTE_SKILL_SOURCE_REFS};
}
/** ATK% is applied to base ATK. Subtract the part already present in the shared panel before adding this hit's actual state. */
export function createCharlotteC2AttackFormula(baseAttack:number|undefined,actualStacks:number,includedStacks:number):CalculatorFormula {
  const same=actualStacks===includedStacks;
  const inputs:CalculatorFormula["inputs"]=[{key:"charlotteC2ActualStacks",value:actualStacks,minimum:0,maximum:3,integer:true,unit:"count",meaningKey:"本命中实际取样时存在的C2层数；0为明确已无效果",origin:"derived-character-context"},{key:"charlotteC2IncludedStacks",value:includedStacks,minimum:0,maximum:3,integer:true,unit:"count",meaningKey:"共同输入最终ATK已含的C2层数",origin:"derived-character-context"}];
  if(!same)inputs.unshift({key:"charlotteBaseAttack",value:baseAttack!,minimum:0,unit:"stat",meaningKey:"角色白值＋武器白值，不含百分比或固定攻击加成",origin:"derived-character-context"});
  return {ruleId:"charlotte-c2-hit-atk-accounting-b4ae769",label:same?`夏洛蒂C2：实际${actualStacks}层＝面板已含${includedStacks}层，10%×(${actualStacks}−${includedStacks})＝0%；ATK差为0，无需基础攻击`:"夏洛蒂C2：基础攻击×10%×（本击实际层数−面板已含层数）",expression:same?expr.value(0):expr.mul(expr.input("charlotteBaseAttack"),expr.value(.1),expr.sub(expr.input("charlotteC2ActualStacks"),expr.input("charlotteC2IncludedStacks"))),inputs,requirements:{minimumConstellation:2,maximumConstellation:5,elements:["cryo"],attackTags:["skill"]},sourceRefs:CHARLOTTE_SKILL_SOURCE_REFS};
}
export function applyCharlotteSkillContext(document:CalculatorDocument,supplied:CharlotteSkillContext):CalculatorDocument {
  if(!isCharlotteSkillAction(document))return document;
  const context=charlotteSkillContextSchema.parse(supplied),result=structuredClone(document),game=result.gameContext!;
  game.charlotteSkill=context;
  const prefix="charlotte-skill-context:",assumptionPrefix="夏洛蒂完整 E 来源上下文：";
  result.dependencies=result.dependencies.filter(row=>!row.id.startsWith(prefix));result.assumptions=result.assumptions.filter(row=>!row.startsWith(assumptionPrefix));
  const ascension=ascensionOf(result),reasons:string[]=[],fullReasons:string[]=[],fullCast=result.scope==="one-cast"&&result.hits.every(hit=>result.selectedHitIds.includes(hit.id));
  if(ascension===undefined)reasons.push("缺少明确突破阶段，不能确定地区队友A4是否解锁。");
  if((ascension===undefined||ascension>=4)&&context.nonFontaineTeammates===undefined)reasons.push("缺少实际非枫丹其他队友人数，不能把未知人数当作0。");
  if(ascension!==undefined&&ascension<4&&context.a4IncludedInPanel)reasons.push("突破4尚未解锁，不能声明增伤已含A4。");
  if(game.constellation>=6)reasons.push("C6还会因外部普攻/重击命中聚焦标记目标而新增独立伤害，本完整E尚未接入该分支。");
  if(fullCast&&context.markUninterrupted!==true)fullReasons.push("完整标记需要明确目标存活、标记未替换/提前删除，且无额外命中停顿延长至新tick。");
  if(fullCast&&context.statsStableAcrossHits!==true)fullReasons.push("初击与各标记tick取样时点不同，完整输入须明确除已逐击声明C2差值外的其他进攻面板、装备及目标状态稳定。");
  const id=`${prefix}a4`,fullId=`${prefix}full-mark`;
  result.dependencies.push({id,status:reasons.length?"missing":"provisional",reason:reasons.join("；")||"A4实际人数与面板记账已恢复，C0–5范围；C2逐击条件独立检查。",sourceRefs:CHARLOTTE_SKILL_SOURCE_REFS},{id:fullId,status:fullReasons.length?"missing":"provisional",reason:fullReasons.join("；")||"所选完整动作按明确未中断、未额外延长标记和稳定取样条件合计。",sourceRefs:CHARLOTTE_SKILL_SOURCE_REFS});
  const c2Active=game.constellation>=2&&game.constellation<=5;
  if(c2Active)context.c2HitStacks??={};
  const baseAttack=result.build.mode==="equipment-derived"?result.build.characterBaseAtk+result.build.weaponBaseAtk:context.c2BaseAttack;
  if(c2Active&&result.build.mode==="equipment-derived")context.c2BaseAttack=baseAttack;
  for(const hit of result.hits){
    hit.dependencies=hit.dependencies.filter(dep=>!dep.startsWith(prefix));hit.dependencies.push(id);if(fullCast)hit.dependencies.push(fullId);
    if(hit.kind!=="ordinary")continue;
    if(context.nonFontaineTeammates!==undefined)hit.damageBonusFormula=createCharlotteA4SkillFormula(context.nonFontaineTeammates,context.a4IncludedInPanel);else delete hit.damageBonusFormula;
    if(c2Active){
      const actual=context.c2HitStacks?.[hit.id],included=context.c2IncludedStacks,c2Reasons:string[]=[],c2Id=`${prefix}c2:${hit.id}`;
      if(actual===undefined)c2Reasons.push("缺少本命中取样时的实际C2层数，不能由本次E命中人数或其他tick状态倒填。");
      if(included===undefined)c2Reasons.push("缺少共同面板已含的C2份额，不能默认未含或已满层。");
      if(actual!==undefined&&included!==undefined&&actual!==included&&baseAttack===undefined)c2Reasons.push("本击C2与已含层数不同，但最终面板未提供明确基础攻击力（角色白值＋武器白值），不能从最终ATK反推。");
      hit.dependencies.push(c2Id);
      result.dependencies.push({id:c2Id,status:c2Reasons.length?"missing":"provisional",reason:c2Reasons.join("；")||"本击实际C2与共同面板已含份额明确，按基础攻击修正；未推演增益刷新或过期。",sourceRefs:CHARLOTTE_SKILL_SOURCE_REFS});
      if(actual!==undefined&&included!==undefined&&(actual===included||baseAttack!==undefined))hit.attackAdjustment={formula:createCharlotteC2AttackFormula(baseAttack,actual,included),accounting:"add-to-panel"};else delete hit.attackAdjustment;
    }else if(hit.attackAdjustment?.formula.ruleId.startsWith("charlotte-c2-"))delete hit.attackAdjustment;
  }
  result.assumptions.push(`${assumptionPrefix}点按标记按90帧间隔，在408帧基础期限内落4tick；长按774帧内落8tick。完整仅指无刷新、无死亡、无额外延长至下一tick且全部实际命中的此次数条件。`,`${assumptionPrefix}初击在起手取快照，标记各tick重新取样；本完整输入要求除逐击C2差值以外的共享面板/装备/目标条件稳定。单选一个已发生命中不要求未选后续tick继续存在。`,`${assumptionPrefix}A4只计除夏洛蒂外非枫丹队友人数×5%冰伤；枫丹其他队友对应治疗加成，不误作冰伤。C1只有治疗；C2–5按每击实际层数和共同面板已含份额补差。C3只增Q等级、C4只影响Q，C5使用已显式填写的有效E等级，不重复加3。C6仍阻塞。`,`${assumptionPrefix}C2每层为基础攻击的10%，最多三层；初击起手快照可以含此前C2，不由本次初击回调倒填。标记每tick按其实际取样状态填写，长按第8tick不能默认仍有C2。12秒StatMod受角色卡肉和刷新影响，本计算不自动推演时钟或状态。`);
  return result;
}
export function resetCharlottePanelAccounting(document:CalculatorDocument,mode:"fresh-equipment"|"imported-final"):void {
  if(!isCharlotteSkillAction(document))return;
  const context=document.gameContext!.charlotteSkill??{a4IncludedInPanel:false},ascension=ascensionOf(document);
  const next:CharlotteSkillContext={...context,a4IncludedInPanel:mode==="fresh-equipment"?false:ascension===undefined?context.a4IncludedInPanel:ascension>=4};
  if(mode==="fresh-equipment")next.c2IncludedStacks=0;else {delete next.c2IncludedStacks;delete next.c2BaseAttack;}
  document.gameContext!.charlotteSkill=next;
}
export function prepareColleiCharlotteSkillDocument(document:CalculatorDocument):CalculatorDocument {
  if(isColleiSkillAction(document))return applyColleiSkillContext(document,document.gameContext?.colleiSkill??{});
  if(isCharlotteSkillAction(document))return applyCharlotteSkillContext(document,document.gameContext?.charlotteSkill??{a4IncludedInPanel:false});
  return document;
}
