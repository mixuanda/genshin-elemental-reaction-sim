import type {SourceHostDamageRequest} from '../../../packages/sim-core/src/source-host-wire';

/** Reviewed Classic implementation, not a claim about every source/version. */
export const WANDERER_TEAM_STATE_SOURCE = {
 revision: 'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541',
 files: [
  {path:'internal/characters/nicole/cons.go',sha256:'b2e16ca7ada85446c2c37eead77aad0190a19e786302d5058a25366b576293ff'},
  {path:'internal/characters/nicole/burst.go',sha256:'4c23d0f594b2309677629233fbe99ab1d3365899ba277aa472a2ef34fd67bf72'},
 ],
} as const;
export interface WandererTeamProjectionAttribution {
 source:'协同投影（妮可Q）'|'命座投影（妮可C1）';
 provider:'nicole';
 mechanism:'nicole-q-projection'|'nicole-c1-projection';
 parentAttackId:number;
}
export interface WandererTeamProjectionApplication {
 calculationId:number;attackId:number;frame:number;origin?:SourceHostDamageRequest['origin'];
}
const owners:Record<string,string>={wanderer:'anemo',faruzan:'anemo',nicole:'pyro',durin:'pyro'};
const projections = {
 'Arcane Projection': {eventKey:'nicole-burst-hook',source:'协同投影（妮可Q）',mechanism:'nicole-q-projection'},
 'Arcane Projection: Unity': {eventKey:'nicole-c1',source:'命座投影（妮可C1）',mechanism:'nicole-c1-projection'},
} as const;

/** Classifies the generating mechanic, preserving the emitting attack owner.
 * Both upstream projections are AttackTagNone, never ordinary Q-tag damage.
 * Unknown/legacy origins stay unknown; a display name alone is insufficient.
 * A reaction hit is a legal parent: do not infer its owner from its Pyro element.
 */
export function classifyWandererTeamProjection(sourceCommit:string,request:SourceHostDamageRequest,
 parents:readonly SourceHostDamageRequest[],application:WandererTeamProjectionApplication):WandererTeamProjectionAttribution|undefined {
 if(sourceCommit!==WANDERER_TEAM_STATE_SOURCE.revision
  ||request.sourceCommit!==undefined&&request.sourceCommit!==sourceCommit)return;
 const rule=Object.hasOwn(projections,request.ability)?projections[request.ability as keyof typeof projections]:undefined;
 if(!rule||request.damageCategory!=='ordinary'||request.attackTag!==0||request.attackTagName!=='AttackTagNone')return;
 const origin=request.origin,raw=request.rawAttack,parentId=origin?.parentAttackId;
 if(application.calculationId!==request.id||application.attackId!==request.attackId||application.frame!==request.frame
  ||!application.origin||!origin||(['parentAttackId','eventKey','via','triggerActionSequence'] as const)
   .some(key=>application.origin![key]!==origin[key]))return;
 if(!origin||origin.via!=='task'||origin.eventKey!==rule.eventKey||!Number.isInteger(origin.parentAttackId)
  ||parentId===undefined||parentId<=0||!Number.isInteger(request.actorIndex)||request.actorIndex<0
  ||owners[request.actorKey]!==request.element||raw.ActorIndex!==request.actorIndex||raw.Abil!==request.ability
  ||raw.AttackTag!==0||raw.Element!==request.element||raw.Durability!==0
  ||request.frame!==request.sourceFrame||request.frame!==request.snapshotFrame)return;
 const parent=parents.find(parent=>parent.attackId===origin.parentAttackId&&parent.actorIndex===request.actorIndex
  &&parent.actorKey===request.actorKey&&parent.rawAttack.ActorIndex===parent.actorIndex
  &&parent.targetKey===request.targetKey&&parent.frame+30===request.frame);
 if(!parent)return;
 return {source:rule.source,provider:'nicole',mechanism:rule.mechanism,parentAttackId:origin.parentAttackId!};
}
