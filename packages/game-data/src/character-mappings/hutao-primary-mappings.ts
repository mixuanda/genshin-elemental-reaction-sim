import type { SourceHitMapping } from './types';
import manifest from '../../sources/hutao-primary/manifest.json';

export const hutaoPrimarySourceEvidence = manifest;
const labels = ['普攻第一段', '普攻第二段', '普攻第三段', '普攻第四段', '普攻第五段第一击', '普攻第五段第二击', '普攻第六段', '重击'];
export const hutaoPrimaryMappings: SourceHitMapping[] = manifest.coefficients.map((row, index) => ({
  id: `hutao-paramita-${row.action}-hit`, skillId: `hutao-paramita-${row.action}-c0-c1`,
  skillLabel: `蝶引来生·${labels[index]}（单击）`, hitLabel: `彼岸蝶舞·${labels[index]}`,
  characterSlug: 'hutao', talentSetId: 'talent-set:hutao', abilityKey: 'combat1', parameterKey: row.parameterKey,
  sourceCoefficientValues: row.values, coefficientTolerance: 0, attackTag: index === 7 ? 'charged' : 'normal',
  element: 'pyro', scalingStat: 'atk', sourceRepository: 'genshinsim/gcsim', sourceCommit: manifest.revision,
  sourcePaths: manifest.files.map(file => file.path), completeAction: false,
  assumptions: [
    '实际处于彼岸蝶舞，C0–C6选定的一次火元素命中；普攻与有效E等级独立，各使用一次，C3已含于有效E等级。',
    '未计入攻击面板时，E增攻为施放E时最大生命×独立E系数，上限为角色加武器基础攻击的400%；按固定攻击追加，不再乘攻击力百分比。',
    'A4仅按本击取样时实际生命比例和已含增伤补差；跨半血状态须已稳定，不能从开E前生命或当前最大生命反推旧E加成。',
  ],
  exclusions: [
    '第五段两击分别列出；本入口不代表整个普攻段、完整循环或E状态总伤。',
    '不附加血梅香、Q、产球、能量、冷却、体力事件或PP slide延长；C1仅改变重击体力消耗，本击数值不变。',
    'C2仅改变血梅香，C4只给队友暴击，C5只给Q等级；本单击不包含这些其他输出或队友增益。',
    'C6仅按实际生效状态与输入CR已含份额补差，不根据当前血量推算触发、免死、持续/冷却或源轮询近似。',
  ],
}));
