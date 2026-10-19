import { weaponHitStackSnapshotContextsForDamageEvent, weaponHitStackStateAt, type DamageEvent, type SimulationResult } from "@genshin-dps-lab/schemas";
import { calculateWeaponHitStackValues } from "./weapon-hit-stack-runtime";
import type { CalculationTraceNode } from "./calculation-trace";

/** Source contributions are already present in the captured panel. Reconstruct
 * their actual sampling context for explanation; do not add them a second time. */
export function weaponHitStackTraceForDamageEvent(result:SimulationResult,event:DamageEvent):CalculationTraceNode[]{
 return weaponHitStackSnapshotContextsForDamageEvent(result,event).flatMap(context=>{
  const snapshot=weaponHitStackStateAt(result,context.ownerId,context.point);
  if(snapshot===undefined)return[];
  const prefix=`weapon.snapshot.${context.role}${context.flatSourceIndex===undefined?"":`.${context.flatSourceIndex}`}`;
  const nodes=calculateWeaponHitStackValues(snapshot.actor,snapshot.state,context.point.frame,snapshot.shielded).trace;
  return nodes.map(node=>({...node,id:`${prefix}.${node.id}`,childIds:node.childIds.map(id=>`${prefix}.${id}`),
   inputs:node.inputs.map(input=>({...input,context:{...input.context,ownerId:context.ownerId,frame:context.point.frame,role:context.role,
    ...(context.flatSourceIndex===undefined?{}:{flatSourceIndex:context.flatSourceIndex})}})),
   applicabilityReason:"来自该伤害实际取样时的武器状态；贡献已包含于捕获面板。此处只解释，不推进叠层或再次加入属性。"}));
 });
}
