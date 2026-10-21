import { createCoreHandoff, type ImportSnapshot, type PlayerBuild } from '../../../packages/player-import/src/index';
import { resolveEquipmentBuild } from '@genshin-dps-lab/game-data/equipment-build';
import type { BuildHandoffMetadata } from './build-workshop';

/** Equipment and final panel are alternative accounting routes. This bridge uses equipment only. */
export function preparePlayerEquipment(build: PlayerBuild, source: ImportSnapshot['source']) {
  const handoff = createCoreHandoff(build, source, 'physical');
  const e = handoff.equipment;
  if (e.status !== 'ready' || !e.equipmentInput) throw new Error(e.reasons.join('；') || '配装不完整。');
  if (build.identity.state !== 'known' || build.identity.value?.id !== e.equipmentInput.characterId) throw new Error('角色身份不一致。');
  const { auto, skill, burst } = e.baseTalentLevels;
  for (const n of [auto, skill, burst]) if (n === null || !Number.isInteger(n) || n < 1 || n > 10) throw new Error('缺少合法基础天赋，不能以有效等级或默认值代替。');
  if (e.constellation === null || !Number.isInteger(e.constellation) || e.constellation < 0 || e.constellation > 6) throw new Error('缺少合法命座，不能默认为 C0。');
  const input = structuredClone(e.equipmentInput);
  // The existing core checks identities, weapon compatibility and observed artifact values.
  resolveEquipmentBuild(input);
  const metadata: BuildHandoffMetadata = {
    constellation: e.constellation, baseTalentLevels: { auto: auto!, skill: skill!, burst: burst! },
    label: `${build.identity.value.name} · ${source.kind} · ${source.scope} · ${source.importedAt}${source.fixture ? ' · 合成测试数据' : ''} · 装备推导（未叠加最终面板；装备条件效果关闭）`
  };
  return { input, metadata };
}
