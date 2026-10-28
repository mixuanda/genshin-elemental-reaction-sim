import type { SourceHitMapping } from './types';
import manifest from '../../sources/cyno-damage/manifest.json';

export const cynoDamageSourceEvidence = manifest;

/** Each entry is one contact, including the two independently sampled N4 contacts. */
export const cynoDamageMappings: SourceHitMapping[] = manifest.coefficients.map((row, index) => ({
  id: `cyno-q-${row.action}-hit`,
  characterSlug: 'cyno', talentSetId: 'talent-set:cyno', abilityKey: 'combat3',
  parameterKey: row.parameterKey, sourceCoefficientValues: row.values, coefficientTolerance: 0,
  skillId: `cyno-q-${row.action}-c0`,
  skillLabel: index === 6 ? '启途誓使·重击（单击）' : `启途誓使·${['普攻第一段', '普攻第二段', '普攻第三段', '普攻第四段第一击', '普攻第四段第二击', '普攻第五段'][index]}（单击）`,
  hitLabel: index === 6 ? '启途誓使·重击' : `启途誓使·${['N1', 'N2', 'N3', 'N4第一击', 'N4第二击', 'N5'][index]}`,
  element: 'electro', scalingStat: 'atk', attackTag: index === 6 ? 'charged' : 'normal',
  sourceRepository: 'genshinsim/gcsim', sourceCommit: manifest.revision,
  sourcePaths: manifest.files.map(file => file.path), completeAction: false,
  assumptions: [
    '仅C0实际启途誓使的一次命中；使用独立有效Q天赋等级，不使用普攻天赋或再次增加命座等级。',
    'Q提供100精通；是否已含于输入面板必须明确，专属公式只补差一次。',
    index === 6 ? '重击在动作开始时快照，27帧命中；不享受A4普攻150%精通加值。' : 'A4在该段动作开始时读取精通；ATK与反应精通在本击命中帧快照。只有明确精通稳定时才共用精通值。',
  ],
  exclusions: [
    '第四段两个命中分别列出，不把共同面板冒充整段、完整普攻循环或18秒Q总伤。',
    '末途真眼的35%增伤只属于对应E主击；渡荒之雷属于现有E分支，均不并入本普攻或重击。',
    '不生成Q生命周期、攻速、体力、元素附着、反应次数、产能或队友伤害；激化等反应须逐击显式选择。',
  ],
}));
