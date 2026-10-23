import type {SourceHitMapping} from './types';
import manifest from '../../sources/gaming-damage/manifest.json';
export const gamingDamageSourceEvidence=manifest;
const shared={characterSlug:'gaming',talentSetId:'talent-set:gaming',element:'pyro' as const,scalingStat:'atk' as const,
 sourceRepository:'genshinsim/gcsim' as const,sourceCommit:manifest.revision,sourcePaths:manifest.files.map(row=>row.path),coefficientTolerance:0,completeAction:true,
 assumptions:['只计算实际命中目标的一击；有效天赋已含命座加级，不重复增加C3/C5。','使用命中时实际面板和生命，C2、A4与C6份额由专属公式核对。'],
 exclusions:['不生成生命消耗、治疗、猊兽返回、冷却重置、产球或完整循环。','特殊下落命中取样在第32帧，固定源扣血在第33帧；不能用扣血后生命反推该击。','Q初次冲击不包含后续E特殊下落；普通下落不使用E天赋倍率或C6专属双暴。']};
export const gamingDamageMappings:SourceHitMapping[]=[
 {...shared,id:'gaming-charmed-cloudstrider-hit',abilityKey:'combat2',parameterKey:'param1',sourceCoefficientValues:manifest.coefficients.find(r=>r.sourceTable==='skill')!.values,skillId:'gaming-charmed-cloudstrider',skillLabel:'瑞兽登高·踏云献瑞（E后特殊下落）',hitLabel:'踏云献瑞·火元素落地一击',attackTag:'plunge'},
 {...shared,id:'gaming-burst-opening-hit',abilityKey:'combat3',parameterKey:'param1',sourceCoefficientValues:manifest.coefficients.find(r=>r.sourceTable==='burst')!.values,skillId:'gaming-burst-opening',skillLabel:'璨焰金猊舞·猊兽初次冲击',hitLabel:'猊兽初次冲击',attackTag:'burst'},
];
