import type {CalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
import {resolveCalculatorStats} from '../../../packages/sim-core/src/calculator';
import {alhaithamUnstableC2EquipmentRules} from '../../../packages/sim-core/src/alhaitham-damage-formulas';

/** A blocked source model can be replaced by explicit user observations. This
 * opens unconfirmed inputs; it does not certify or materialize that model. */
export function canCreateAlhaithamActualPanelDraft(document:CalculatorDocument):boolean {
  return document.build.mode==='equipment-derived'&&alhaithamUnstableC2EquipmentRules(document).length>0
    &&document.hits.every(hit=>hit.kind!=='ordinary'||!hit.finalSnapshot&&hit.effectiveCritRate===undefined&&hit.effectiveCritDamage===undefined&&!hit.finalizedEquipmentEffects?.length);
}
export function createAlhaithamActualPanelDraft(document:CalculatorDocument):CalculatorDocument {
  if(!canCreateAlhaithamActualPanelDraft(document))throw new Error('仅未结算的跨阶段精通配装可打开此实际面板草稿；历史结果不能改写。');
  const result=structuredClone(document),ascension=document.build.mode==='equipment-derived'?document.build.equipment?.ascension:undefined;
  result.build={mode:'manual-final',stats:resolveCalculatorStats(document.build),...(ascension===undefined?{}:{ascension}),source:'未确认的实际面板草稿：预填值仅保留原构筑便于录入，并非成功转换结果。请填写本击实际属性和各段增伤，再确认。'};
  const context=result.gameContext!.alhaithamDamage!;
  delete context.finalizedHitStates;
  context.c2OtherSnapshotStatsFinal=false;
  context.c2RequiresActualPanelConfirmation=true;
  // Nothing was converted: no finalized effects or hit snapshots are produced.
  result.dataIdentity.evidenceStatus='provisional';
  result.assumptions=[...result.assumptions,'当前最终面板是用户需补充的未确认草稿，不是已验证的跨阶段配装转换；须提供实际快照属性及每段适用增伤。'];
  return result;
}
