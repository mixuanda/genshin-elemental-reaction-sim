/** Source-owned same-hit FlatDmg from Citlali through Faruzan. Native Go keeps
 * each event gate, stack mutation, log and the original same-hit += operation. */
import { expr } from "./calculation-trace";
import type { SourceHostCharacterAdditiveDescriptor } from "./source-host-character-additive-formula";

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const n = expr.value;
const v = expr.input;

export const characterAdditiveGroupA = {
  "char-add-citlali-c1": {
    character: "citlali", title: "茜特菈莉 C1 星之刃附加伤害", sourceFile: "internal/characters/citlali/cons.go", sourceCommits: both, phase: "hit",
    inputs: { em: { label: "来源持有者本次真实元素精通", unit: "EM" } },
    statLeaf: { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" },
    expression: expr.mul(n(2), v("em")),
    explanation: "原在场队友、攻击标签和剩余星之刃门槛通过后，仅以茜特菈莉当次精通的两倍追加到同击；原生扣除一层。",
  },
  "char-add-clorinde-a1": {
    character: "clorinde", title: "克洛琳德 A1 夜巡之契附加伤害", sourceFile: "internal/characters/clorinde/asc.go", sourceCommits: both, phase: "hit",
    inputs: {
      snapshotAtk: { label: "本次攻击快照总攻击力", unit: "ATK" },
      stacks: { label: "当前独立反应层数", unit: "stack", integer: true, minimum: 0, maximum: 3 },
      c2: { label: "二命创建时选择的倍率与上限分支", unit: "flag", integer: true, choices: [{ value: 0, label: "原 A1" }, { value: 1, label: "C2 强化" }] },
    },
    snapshotLeaf: { stateKey: "snapshotAtk", getter: "total-atk" },
    expression: expr.condition("equal", v("c2"), n(1),
      expr.min(expr.mul(v("snapshotAtk"), n(.3), v("stacks")), n(2700)),
      expr.min(expr.mul(v("snapshotAtk"), n(.2), v("stacks")), n(1800))),
    explanation: "沿用原 a1 初始化时 C2 对 c.a1BuffPercent 与 c.a1Cap 的选择：普通 20%/1800，C2 为 30%/2700；只读取攻击已有快照，正常/爆发标签、元素门槛及反应层生命周期仍在 Go。",
  },
  "char-add-durin-c1-white": {
    character: "durin", title: "杜林 C1 白爆发协同附加伤害", sourceFile: "internal/characters/durin/cons.go", sourceCommits: both, phase: "hit",
    inputs: { totalAtk: { label: "杜林本次真实总攻击力", unit: "ATK" } },
    statLeaf: { stateKey: "totalAtk", getter: "total-atk", actor: "holder" },
    expression: expr.mul(n(.6), v("totalAtk")),
    explanation: "原队友在场、白爆发及目标 Tag 门槛后，先按原 C4 倍率消费 Tag，再以杜林一次总攻击力读取计算 60% 同击附加值。",
  },
  "char-add-durin-c1-black": {
    character: "durin", title: "杜林 C1 黑爆发附加伤害", sourceFile: "internal/characters/durin/cons.go", sourceCommits: both, phase: "hit",
    inputs: { totalAtk: { label: "杜林本次真实总攻击力", unit: "ATK" } },
    statLeaf: { stateKey: "totalAtk", getter: "total-atk", actor: "holder" },
    expression: expr.mul(n(1.5), v("totalAtk")),
    explanation: "原本人爆发、黑爆发状态及 Tag 门槛后，先按原 C4 倍率消费 Tag，再以杜林一次总攻击力读取计算 150% 同击附加值。",
  },
  "char-add-escoffier-c2": {
    character: "escoffier", title: "爱可菲 C2 冷盘附加伤害", sourceFile: "internal/characters/escoffier/cons.go", sourceCommits: both, phase: "hit",
    inputs: { totalAtk: { label: "爱可菲本次真实总攻击力", unit: "ATK" } },
    statLeaf: { stateKey: "totalAtk", getter: "total-atk", actor: "holder" },
    expression: expr.mul(v("totalAtk"), n(2.4)),
    explanation: "原其他在场角色的冰元素攻击和冷盘次数门槛后，读取爱可菲一次总攻击力并扣除一次冷盘；同击加入 240% 攻击力。",
  },
  "char-add-faruzan-a4": {
    character: "faruzan", title: "珐露珊 A4 飓风护持附加伤害", sourceFile: "internal/characters/faruzan/asc.go", sourceCommits: both, phase: "hit",
    inputs: { baseAtk: { label: "珐露珊本次真实基础攻击力", unit: "ATK" } },
    statLeaf: { stateKey: "baseAtk", getter: "stat", statIndex: 24, actor: "holder" },
    expression: expr.mul(n(.32), v("baseAtk")),
    explanation: "保留原风元素攻击标签、爆发状态和 48 帧 ICD 门槛；读取一次基础攻击力，在同击追加 32% 并维持原 ICD 更新。",
  },
} as const satisfies Record<string, SourceHostCharacterAdditiveDescriptor>;
