import type { SourceSingleSkillDraft } from "./source-single-skill";

const revision = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";

/** Explanation of existing shared rules only. No damage, hit count, energy or
 * missing combat state is calculated or supplied by this presentation helper. */
export function renderNeuvilletteSourceFormulaHelp(input: SourceSingleSkillDraft): string {
  if (input.source.hostVariant !== "classic" || input.source.revision !== revision
    || input.member.characterKey !== "neuvillette" || input.member.constellation !== 0) return "";
  const charge = input.action.kind === "charge" && (input.action.params?.short ?? 0) === 0;
  if (!charge && input.action.kind !== "burst") return "";
  const base = charge
    ? `<tr><th>衡平推裁单波基伤</th><td>普攻天赋倍率 × 对应生命上限 × 遗龙之荣倍率</td><td>突破1解锁后逐波读取生命上限与实际层数；尚未解锁时保留蓄力初始基伤。</td></tr><tr><th>遗龙之荣</th><td>0／1／2／3层遗龙之荣对应1／1.1／1.25／1.6倍</td><td>以引擎实际反应状态为准，不默认满层。</td></tr>`
    : `<tr><th>Q初击基伤</th><td>Q初击天赋倍率 × 这段起手时读取的生命上限</td><td>Q起手独立读取并保留基伤，不用后续命中时的生命上限替换。</td></tr><tr><th>Q水瀑单段基伤</th><td>Q水瀑天赋倍率 × 这段起手时读取的生命上限</td><td>水瀑有自己的起手读取；后续进攻快照和A4另行取样。Q不乘遗龙之荣。</td></tr>`;
  return `<details data-neuvillette-formula-help><summary>查看本次${charge ? "衡平推裁" : "Q"}的公式与统计范围</summary><p data-neuvillette-observed-scope>观察区间小计只累加该关联下已结算命中的公式伤害（扣除目标剩余生命前），保留这次种子的暴击结果；它不是随机均值、完整施放伤害或循环DPS。</p><div class="table-wrap"><table><thead><tr><th>阶段</th><th>公式</th><th>取样条件</th></tr></thead><tbody>${base}<tr><th>突破4水伤</th><td>min(0.3, max(0, (实际生命比例 − 0.3) × 0.6))</td><td>仅解锁后生效，使用本击进攻快照适用的生命状态；生命变化可改变此项，不重复计入。</td></tr><tr><th>每次实际伤害</th><td>本击基伤 × 增伤区 × 防御区 × 抗性区 × 本次暴击与反应等适用倍率</td><td>逐击数值、来源与代入见下方计算详情；不把一次暴击伤害当作期望伤害。</td></tr></tbody></table></div><p>固定来源的蓄力、碰撞和取样时序仍有近似与未核实项；本说明不补造观察窗以外的命中，也不改变初始能量。</p></details>`;
}
