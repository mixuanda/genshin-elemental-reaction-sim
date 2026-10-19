import type { IdleStanceScheduleContext } from "./idle-stance-context";
export type { IdleStanceScheduleContext } from "./idle-stance-context";

export const IDLE_STANCE_CAST_KINDS = [
  "idle-razor-burst-c0", "idle-zhongli-hold-skill-c0", "idle-tartaglia-skill-c0", "idle-yanfei-burst-c0",
  "idle-ayato-skill-c0", "idle-nilou-skill-c0", "idle-wanderer-skill-c0", "idle-alhaitham-skill-c0",
  "idle-mika-hold-skill-c0", "idle-kaveh-burst-c0", "idle-gaming-burst-c0", "idle-chiori-skill-c0",
] as const;
export type IdleStanceCastKind = typeof IDLE_STANCE_CAST_KINDS[number];
export type IdleStanceTemplateRole = "initial" | "hold" | "pillar" | "resonance" | "illusion" | "doll";
export interface IdleStanceHitInstance {
  id: string; templateRole: IdleStanceTemplateRole; frame: number; snapshotFrame: number; snapshotId: string; targetId: string;
  scalingSnapshotFrame?: number; scalingSnapshotId?: string;
}
export interface IdleStanceCandidate extends IdleStanceHitInstance { contact: boolean | undefined }
export interface IdleStanceDecision { eventId: string; frame: number; accepted: boolean; reason: string }
export interface IdleStanceSchedule {
  instances: IdleStanceHitInstance[]; candidates: IdleStanceCandidate[]; issues: string[]; decisions: IdleStanceDecision[];
  lifecycleEndFrame: number; requiredObservedThroughFrame: number; complete: boolean;
}
const frame = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Pinned b4ae769; explicit empty input logs close these restricted stance branches. */
export function compileIdleStanceSchedule(kind: IdleStanceCastKind, context: IdleStanceScheduleContext): IdleStanceSchedule {
  const issues: string[] = [], candidates: IdleStanceCandidate[] = [], instances: IdleStanceHitInstance[] = [], decisions: IdleStanceDecision[] = [];
  const issue = (message: string) => { if (!issues.includes(message)) issues.push(message); };
  const require = (condition: boolean, message: string) => { if (!condition) issue(message); };
  require(IDLE_STANCE_CAST_KINDS.includes(kind), "未知的姿态完整分支。");
  require(!!context.casterId?.trim(), "请明确施放角色标识。");
  require(!!context.targetId?.trim(), "请明确所选敌人标识。");
  for (const [key, message] of [
    ["freshCastConfirmed", "请确认全新施放，没有原有姿态、召唤物、标记或触发冷却残留。"],
    ["noHitlag", "此固定时点分支需要明确全程没有卡肉延长。"],
    ["noInterruption", "请确认施放与声明的状态过程未被中断。"],
    ["noReplacement", "请确认没有本分支之外的重施放、替换、重置或角色死亡。"],
    ["fullObservedLifetime", "请确认观察覆盖完整状态及所有已发出攻击的尾段。"],
  ] as const) require(context[key] === true, message);
  require(Array.isArray(context.followupActions), "请显式填写完整后续动作记录；没有后续输入时填写空数组，不能将缺失记录当作没有动作。");
  const actions = context.followupActions ?? [], ids = new Set<string>();
  for (const action of actions) {
    require(!ids.has(action.id), `后续动作标识 ${action.id} 重复。`); ids.add(action.id);
    require(frame(action.frame), `动作 ${action.id} 需要非负整数帧。`);
    require(action.actorId === context.casterId, `动作 ${action.id} 必须来自本次施放角色；外部动作不属于此封闭输入分支。`);
  }
  const wanderer = kind === "idle-wanderer-skill-c0";
  if (!wanderer) require(actions.length === 0, "本分支明确没有后续攻击或技能输入；存在后续动作时不能省略其触发伤害并声称完整。");
  const queue = (id: string, templateRole: IdleStanceTemplateRole, at: number, snapshotFrame = at, scalingSnapshotFrame?: number) => {
    const hit: IdleStanceHitInstance = { id, templateRole, frame: at, snapshotFrame, snapshotId: `sample:${snapshotFrame}`, targetId: context.targetId ?? "",
      ...(scalingSnapshotFrame === undefined ? {} : { scalingSnapshotFrame, scalingSnapshotId: `scaling:${scalingSnapshotFrame}` }) };
    const contact = context.targetContacts?.[id];
    candidates.push({ ...hit, contact });
    if (contact === undefined) issue(`请明确第 ${at} 帧候选 ${id} 是否实际命中所选敌人。`);
    else {
      if (contact) instances.push(hit);
      decisions.push({ eventId: id, frame: at, accepted: contact, reason: contact ? "已明确实际接触所选敌人。" : "已明确落空；不补造伤害。" });
    }
  };
  let lifecycleEndFrame = 0;
  switch (kind) {
    case "idle-razor-burst-c0":
      require(context.razor?.hexerei === false, "此分支需要明确未启用魔导强化（hexerei=false）。");
      queue("initial", "initial", 32); lifecycleEndFrame = 933;
      break;
    case "idle-zhongli-hold-skill-c0":
      require(context.zhongli?.noOtherGeoConstructs === true, "请确认此前及全程没有其他岩造物，避免额外共鸣或已有岩脊影响新建资格。");
      require(context.zhongli?.steleSurvives === true, "请确认本次新岩脊确实建立并保留至1908帧自然销毁，未破坏、替换或因位置失效。");
      require(context.zhongli?.shieldUnbroken === true, "请确认本次玉璋护盾从48帧完整保留至1248帧，未破裂或覆盖。");
      require(context.zhongli?.insideShieldRadius === true, "此分支需要所选敌人全程处于护盾减抗的7.5米范围；岩脊接触仍逐击单独填写。");
      queue("hold", "hold", 48, 0); queue("pillar", "pillar", 48);
      for (let n = 1; n <= 15; n++) queue(`resonance-${n}`, "resonance", 48 + 120 * n, 48);
      lifecycleEndFrame = 1908;
      break;
    case "idle-tartaglia-skill-c0":
      require(context.tartaglia?.startsFromIdle === true, "此近战切换分支从静止起手；移动或冲刺起手具有不同命中帧。");
      require(context.tartaglia?.noRiptideOrProjectiles === true, "请确认没有原有断流、在途箭或后续断流击杀链，不能忽略其额外伤害。");
      queue("initial", "initial", 16); lifecycleEndFrame = 1801;
      break;
    case "idle-yanfei-burst-c0":
      require(context.yanfei?.priorA1Inactive === true, "此分支需要此前消耗丹火印产生的突破1火伤增益未激活。");
      queue("initial", "initial", 24, 0); lifecycleEndFrame = 1501;
      break;
    case "idle-ayato-skill-c0": {
      const delay = context.ayato?.illusionDelay;
      require(frame(delay) && delay >= 35 && delay <= 360, "请明确本次水影实际爆炸参数为35至360帧，不能将施放帧当作水影破裂帧。");
      if (frame(delay) && delay >= 35 && delay <= 360) queue("illusion", "illusion", delay);
      lifecycleEndFrame = 361;
      break;
    }
    case "idle-nilou-skill-c0":
      require(context.nilou?.noPriorBounty === true, "不续舞分支需要没有前次金杯的丰馈或丰穰之核状态残留。");
      queue("initial", "initial", 16, 16, 0); lifecycleEndFrame = 601;
      break;
    case "idle-wanderer-skill-c0": {
      require(context.wanderer?.noAbsorption === true, "此分支需要本次E没有水火冰雷吸收，不能隐去初击前已生效的攻击、暴击或空居力变化。");
      require(context.wanderer?.panelExcludesAbsorptionBonuses === true, "请确认输入面板没有本次未触发的元素吸收攻击/暴击增益。");
      require(actions.length === 1 && actions[0]?.kind === "terminate-skill", "此分支需要且仅允许一次明确终止E；源码不会在600帧自动调用姿态结束，不能省略终止输入。");
      const end = actions[0];
      require(!!end && frame(end.frame) && end.frame >= 28 && end.frame < 600, "终止E必须在第28至599帧启动，位于初始动作完成后、空居力耗尽前。");
      if (end && frame(end.frame) && end.frame >= 28 && end.frame < 600) {
        lifecycleEndFrame = end.frame + 26;
        decisions.push({ eventId: end.id, frame: end.frame, accepted: end.kind === "terminate-skill", reason: "明确终止同一空居姿态，终止E不造成伤害；26帧落地过程已纳入观察。" });
      }
      queue("initial", "initial", 2);
      break;
    }
    case "idle-alhaitham-skill-c0": {
      require(context.alhaitham?.hold !== undefined, "请明确艾尔海森本次E为点按还是长按。");
      require(context.alhaitham?.initialMirrors === 0, "此新鲜分支需要施放前琢光镜数量明确为0。");
      const hold = context.alhaitham?.hold === true;
      queue("initial", "initial", hold ? 28 : 19, hold ? 28 : 19, 0);
      lifecycleEndFrame = (hold ? 23 : 15) + 233 * 2;
      break;
    }
    case "idle-mika-hold-skill-c0":
      require(context.mika?.initialTargetIsEnemy === true, "请确认霜星信标首发对象为所选敌人。");
      require(context.mika?.eligibleOtherEnemyCount === 0, "此单敌分支需要明确10米内除首发目标以外没有可选敌人；存在其他敌人时必须计算其星霜碎片，不能把碎片回加到首发目标。");
      queue("initial", "initial", 15, 12); lifecycleEndFrame = 733;
      break;
    case "idle-kaveh-burst-c0":
      require(context.kaveh?.noDendroCores === true, "请确认本次Q范围内没有现存草原核，避免遗漏立即迸发的核伤害。");
      require(context.kaveh?.initialCreatesNoDendroCore === true, "请确认Q初击没有新生成草原核；仅声明施放前无核不足以关闭本击后的强制迸发。");
      queue("initial", "initial", 36); lifecycleEndFrame = 757;
      break;
    case "idle-gaming-burst-c0": {
      const delay = context.gaming?.manChaiReturnDelay;
      require(context.gaming?.noPriorManChai === true, "请确认此前没有仍在场的文仔，本次Q可以正常派出并返回。");
      require(frame(delay) && delay > 0, "请明确文仔返回延迟（固定来源默认100帧），不能从伤害初击推断已返回。");
      queue("initial", "initial", 60);
      lifecycleEndFrame = Math.max(757, frame(delay) ? 61 + delay : 757);
      break;
    }
    case "idle-chiori-skill-c0": {
      require(context.chiori?.hold !== undefined, "请明确千织本次E为点按还是长按。");
      require(context.chiori?.noGeoConstructs === true, "此单人偶分支需要全程没有岩造物；否则会产生第二只袖和可能的突破4增伤。");
      require(context.chiori?.priorA4Inactive === true, "请确认此前20%岩伤突破4增益未激活。");
      const hold = context.chiori?.hold === true, spawn = hold ? 34 : 19;
      queue("initial", "initial", hold ? 37 : 21);
      for (let n = 0; n < 5; n++) queue(`doll-${n + 1}`, "doll", spawn + 36 + 216 * n + 5);
      lifecycleEndFrame = spawn + 1050;
      break;
    }
  }
  const requiredObservedThroughFrame = Math.max(lifecycleEndFrame, ...candidates.map(hit => hit.frame));
  require(frame(context.observedThroughFrame) && context.observedThroughFrame >= requiredObservedThroughFrame,
    `观察记录须明确覆盖至少第 ${requiredObservedThroughFrame} 帧，包含完整状态及最后已发出攻击。`);
  if (issues.length === 0 && !wanderer) decisions.push({ eventId: "closed-input-window", frame: lifecycleEndFrame, accepted: true, reason: "完整窗口明确没有后续动作；自动攻击已全部展开，条件回调没有合法触发输入。" });
  return { instances, candidates, issues, decisions, lifecycleEndFrame, requiredObservedThroughFrame, complete: issues.length === 0 };
}
