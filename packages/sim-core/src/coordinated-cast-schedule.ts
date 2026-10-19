/**
 * Explicit, single-target C0 schedules from gcsim b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541.
 * Frames are relative to the start of the cast. Animation intervals are [start,
 * end); status expiry follows each source's actual helper (not a blanket rule).
 * This module compiles events, never estimates attack frequency or
 * recursively feeds its generated attacks back into the input event stream.
 */
export const COORDINATED_CAST_KINDS = [
  "coordinated-xingqiu-burst-c0", "coordinated-yelan-burst-c0", "coordinated-thoma-burst-c0",
  "coordinated-aether-electro-burst-c0", "coordinated-lumine-electro-burst-c0",
  "coordinated-raiden-skill-c0", "coordinated-yoimiya-burst-c0", "coordinated-albedo-skill-c0",
  "coordinated-dehya-skill-fresh-c0", "coordinated-dehya-skill-reposition-c0",
  "coordinated-fischl-skill-c0", "coordinated-fischl-burst-c0",
] as const;
export type CoordinatedCastKind = typeof COORDINATED_CAST_KINDS[number];
export type CoordinatedDamageTag = "normal" | "charged" | "plunge" | "skill" | "skill-hold" | "burst"
  | "electro-charged" | "burning" | "hydro-swirl" | "other";

export interface CoordinatedNormalState {
  id: string;
  startFrame: number;
  endFrame: number;
  actorId?: string | undefined;
  onField?: boolean | undefined;
  /** Actual AnimationXingqiuN0StartDelay or AnimationYelanN0StartDelay for this actor. */
  animationStartDelayFrames?: number | undefined;
  /** Source NormalCounter == 1; only needed by a ticker during an animation's start delay. */
  firstNormalInChain?: boolean | undefined;
}

export interface CoordinatedDamageEvent {
  id: string;
  frame: number;
  actorId?: string | undefined;
  activeActorId?: string | undefined;
  tag?: CoordinatedDamageTag | undefined;
  /** A confirmed enemy hit may have zero damage; only some source hooks require nonzero damage. */
  damagePositive?: boolean | undefined;
  targetId?: string | undefined;
  /** Whether the damaged enemy lies within the current Albedo/Dehya field. */
  inRange?: boolean | undefined;
  strikeType?: "slash" | "other" | undefined;
  /** Exact source ability name, e.g. Lingering Lifeline. */
  sourceAbility?: string | undefined;
  origin?: "external" | "this-cast" | undefined;
}

export interface CoordinatedPriorField {
  snapshotId?: string | undefined;
  /** The existing field's snapshot precedes this reposition action, so its frame is negative. */
  snapshotFrame?: number | undefined;
  remainingLifetimeFrames?: number | undefined;
  remainingCooldownFrames?: number | undefined;
}

/** Optional inputs stay unknown. Supplying an explicit empty event array means no such events occurred. */
export interface CoordinatedCastScheduleContext {
  casterId?: string | undefined;
  targetId?: string | undefined;
  normalStates?: CoordinatedNormalState[] | undefined;
  damageEvents?: CoordinatedDamageEvent[] | undefined;
  fullObservedLifetime?: boolean | undefined;
  observedThroughFrame?: number | undefined;
  noHitlag?: boolean | undefined;
  noReplacement?: boolean | undefined;
  noInterruption?: boolean | undefined;
  /** No prior instance, cooldown, mark or residual buff from this ability at frame zero. */
  freshCastConfirmed?: boolean | undefined;
  /** Confirms that every generated projectile/initial attack actually hits the selected enemy. */
  allGeneratedHitsConfirmed?: boolean | undefined;
  dehyaPrior?: CoordinatedPriorField | undefined;
  /** Source's default is 10 frames; callers explicitly state the travel used by their observation. */
  fischlOzTravelFrames?: number | undefined;
  noFischlA4?: boolean | undefined;
  noFischlHexerei?: boolean | undefined;
  noEarlySwapBeforeOz?: boolean | undefined;
}

export interface CoordinatedTriggerProvenance {
  kind: "cast" | "normal-state" | "normal-tick" | "damage-event" | "autonomous";
  eventId: string;
  frame: number;
  actorId?: string | undefined;
}

export interface CoordinatedHitInstance {
  id: string;
  templateRole: "initial" | "proc";
  frame: number;
  snapshotFrame: number;
  snapshotId: string;
  targetId: string;
  trigger: CoordinatedTriggerProvenance;
  /** One-based projectile number within this trigger, never a damage multiplier. */
  projectile: number;
}

export interface CoordinatedScheduleDecision {
  eventId: string;
  frame: number;
  accepted: boolean;
  reason: string;
}

export interface CoordinatedCastSchedule {
  instances: CoordinatedHitInstance[];
  issues: string[];
  decisions: CoordinatedScheduleDecision[];
  lifecycleStartFrame: number;
  lifecycleEndFrame: number;
  /** Plain StatusIsActive includes the expiry frame; core.Status and constructs do not. */
  lifecycleEndInclusive: boolean;
  /** Includes already queued projectiles that land after the status/entity expires. */
  requiredObservedThroughFrame: number;
  complete: boolean;
}

const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
const nonnegative = (value: unknown): value is number => integer(value) && value >= 0;
const named = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const directTags = new Set<CoordinatedDamageTag>(["normal", "charged", "plunge", "skill", "skill-hold", "burst"]);

/** Each result with issues is a partial preview only and must not be presented as a complete cast. */
export function compileSchedule(kind: CoordinatedCastKind, context: CoordinatedCastScheduleContext): CoordinatedCastSchedule {
  const instances: CoordinatedHitInstance[] = [];
  const issues: string[] = [];
  const decisions: CoordinatedScheduleDecision[] = [];
  const issue = (message: string) => { if (!issues.includes(message)) issues.push(message); };
  const decide = (eventId: string, frame: number, accepted: boolean, reason: string) => {
    decisions.push({ eventId, frame, accepted, reason });
  };
  const is = (name: string) => kind === `coordinated-${name}-c0`;
  const xingqiu = is("xingqiu-burst"), yelan = is("yelan-burst"), thoma = is("thoma-burst");
  const traveler = is("aether-electro-burst") || is("lumine-electro-burst");
  const raiden = is("raiden-skill"), yoimiya = is("yoimiya-burst"), albedo = is("albedo-skill");
  const dehyaFresh = is("dehya-skill-fresh"), dehyaReposition = is("dehya-skill-reposition");
  const fischlSkill = is("fischl-skill"), fischlBurst = is("fischl-burst");
  const minazuki = xingqiu || yelan || thoma;
  const fischl = fischlSkill || fischlBurst;
  if (!(COORDINATED_CAST_KINDS as readonly string[]).includes(kind)) issue("尚不支持此协同施放分支。");
  if (!named(context.casterId)) issue("缺少施放角色的标识。");
  if (!named(context.targetId)) issue("缺少所选敌人的标识。");
  if (!dehyaReposition && context.freshCastConfirmed !== true) issue("请明确这是全新施放，且没有上次技能遗留的实体、触发冷却、标记或增益。");
  for (const [key, message] of [
    ["fullObservedLifetime", "请确认事件记录覆盖实际持续时间，以及到期后仍会命中的已发出攻击。"],
    ["noHitlag", "此来源日程需要明确确认没有卡肉延长。"],
    ["noReplacement", "请确认本分支之外没有发生替换、再次施放、重置、实体被摧毁、角色死亡或目标标记转移。"],
    ["noInterruption", "请确认施放及其所需实体的持续过程没有中断。"],
    ["allGeneratedHitsConfirmed", "请确认日程生成的每次攻击均实际命中所选敌人；满足触发条件并不代表后续攻击必定命中。"],
  ] as const) if (context[key] !== true) issue(message);

  let start = 0, end = 0, cooldown = 0, initialFrame: number | undefined, initialSnapshot = 0;
  let initialSnapshotKnown = true;
  const endInclusive = !traveler && !albedo;
  let initialSnapshotId = "cast:0", procSnapshot = 0, procSnapshotId = "cast:0", firstReady = 0;
  if (xingqiu) end = 933;
  if (yelan) { start = 76; end = 976; initialFrame = initialSnapshot = 76; initialSnapshotId = "cast:76"; }
  if (thoma) { end = 900; initialFrame = initialSnapshot = 40; initialSnapshotId = "cast:40"; }
  if (traveler) { end = 720; initialFrame = 37; cooldown = 30; }
  if (raiden) { start = 66; end = 1566; initialFrame = initialSnapshot = 51; initialSnapshotId = "cast:51"; cooldown = 54; }
  if (yoimiya) { start = initialFrame = 75; end = 675; cooldown = 120; }
  if (albedo) { start = initialFrame = 25; end = 1825; cooldown = 120; }
  if (dehyaFresh) {
    initialFrame = 20; start = 21; end = 741; cooldown = 150;
    firstReady = 22; // The initial-block status expires at 21 and remains active on that frame.
    procSnapshot = 21; procSnapshotId = "field:21";
  }
  if (dehyaReposition) {
    initialFrame = 40; start = procSnapshot = 41; cooldown = 150; procSnapshotId = "field:41";
    const prior = context.dehyaPrior;
    if (!named(prior?.snapshotId) || !integer(prior?.snapshotFrame) || prior.snapshotFrame >= 0) {
      issue("迪希雅重新放置领域需要前次领域的快照标识，以及早于本次施放的快照帧。");
      initialSnapshotKnown = false;
    } else { initialSnapshot = prior.snapshotFrame; initialSnapshotId = prior.snapshotId; }
    if (!integer(prior?.remainingLifetimeFrames) || prior.remainingLifetimeFrames <= 0 || prior.remainingLifetimeFrames > 720) {
      issue("迪希雅重新放置领域需要首个领域的实际剩余持续时间（1–720 帧）。");
      end = start;
      firstReady = Number.POSITIVE_INFINITY;
    } else end = start + prior.remainingLifetimeFrames + 24;
    if (!nonnegative(prior?.remainingCooldownFrames) || prior.remainingCooldownFrames > 150) {
      issue("迪希雅重新放置领域需要前次领域的剩余触发冷却（0–150 帧）。");
      firstReady = Number.POSITIVE_INFINITY;
    } else firstReady = Math.max(firstReady, 41 + prior.remainingCooldownFrames);
  }
  if (fischl) {
    start = procSnapshot = fischlSkill ? 18 : 113;
    end = start + 600; procSnapshotId = `oz:${start}`;
    initialFrame = fischlSkill ? 38 : 18; initialSnapshot = 18; initialSnapshotId = "cast:18";
    if (context.noFischlA4 !== true) issue("此奥兹分支需要明确确认没有菲谢尔突破 4 被动产生的额外反应追击。");
    if (context.noFischlHexerei !== true) issue("此奥兹分支需要明确确认没有菲谢尔的魔导效果。");
    if (fischlBurst && context.noEarlySwapBeforeOz !== true) issue("菲谢尔完整元素爆发需要确认在第 113 帧奥兹生成前没有换人。");
    if (!nonnegative(context.fischlOzTravelFrames)) issue("请填写实际观察到的奥兹弹体飞行帧数（来源默认值为 10 帧）。");
  }

  const emit = (role: "initial" | "proc", frame: number, snapshotFrame: number, snapshotId: string,
    trigger: CoordinatedTriggerProvenance, projectile = 1) => {
    instances.push({
      id: `${kind}:${role}:${trigger.kind}:${trigger.eventId}:${trigger.frame}:${projectile}`,
      templateRole: role, frame, snapshotFrame, snapshotId, targetId: context.targetId ?? "", trigger, projectile,
    });
  };
  if (initialFrame !== undefined && initialSnapshotKnown) emit("initial", initialFrame, initialSnapshot, initialSnapshotId,
    { kind: "cast", eventId: "cast", frame: 0, actorId: context.casterId });

  const stateIds = new Set<string>();
  const states = (context.normalStates ?? []).filter(state => {
    if (!named(state.id) || stateIds.has(state.id)) { issue("普攻状态事件标识不能为空或重复。"); return false; }
    stateIds.add(state.id);
    if (!nonnegative(state.startFrame) || !integer(state.endFrame) || state.endFrame <= state.startFrame) {
      issue(`普攻状态 ${state.id} 的起始帧必须为非负整数，结束帧必须为更大的整数；结束帧不包含在状态内。`); return false;
    }
    return true;
  }).slice().sort((a, b) => a.startFrame - b.startFrame);
  if (minazuki) {
    if (!context.normalStates) issue("请填写实际普攻动画状态区间；若没有进入普攻状态，请明确填写空数组。");
    for (let i = 0; i < states.length; i++) {
      const state = states[i]!;
      if (i > 0 && states[i - 1]!.endFrame > state.startFrame) issue("普攻动画状态区间不能重叠。");
      if (state.startFrame > end || (state.endFrame <= start && nonnegative(state.animationStartDelayFrames) && state.startFrame + state.animationStartDelayFrames < start)) continue;
      if (state.onField === false) continue;
      if (!named(state.actorId) || state.onField === undefined) issue(`普攻状态 ${state.id} 需要明确角色，并确认该角色在场上。`);
      if (!nonnegative(state.animationStartDelayFrames)) issue(`普攻状态 ${state.id} 缺少来源规则对应的实际动画起始延迟。`);
    }

    // minazuki does NOT start an independent periodic sequence for every state.
    // A cooldown-rejected entry leaves the old ticker alive; a successful entry
    // invalidates it. Delayed state-entry callbacks still run after state exit.
    type Check = { frame: number; state: CoordinatedNormalState; kind: "entry" | "tick"; source: number };
    const queue: Check[] = states.filter(state => named(state.actorId) && state.onField === true && nonnegative(state.animationStartDelayFrames))
      .map(state => ({ frame: state.startFrame + state.animationStartDelayFrames!, state, kind: "entry", source: -1 }));
    let tickerSource = -1, ready = 0, wave = 0;
    while (queue.length > 0) {
      queue.sort((a, b) => a.frame - b.frame || (a.kind === b.kind ? 0 : a.kind === "entry" ? -1 : 1));
      const check = queue.shift()!;
      if (check.frame > end) continue;
      if (check.frame < start) { decide(check.state.id, check.frame, false, "对应状态尚未生效。"); continue; }
      let current = check.state;
      if (check.kind === "tick") {
        if (check.source !== tickerSource) continue;
        const active = states.find(state => state.startFrame <= check.frame && check.frame < state.endFrame);
        if (!active) { decide(check.state.id, check.frame, false, "当前不处于普攻状态，持续触发检查已停止。"); continue; }
        current = active;
        if (!named(current.actorId) || current.onField !== true || !nonnegative(current.animationStartDelayFrames)) continue;
        if (check.frame - current.startFrame < current.animationStartDelayFrames) {
          if (current.firstNormalInChain === undefined) issue(`普攻状态 ${current.id} 需要明确是否为连段首击（firstNormalInChain），才能判定动画起始延迟内的持续触发检查。`);
          if (current.firstNormalInChain !== false) { decide(current.id, check.frame, false, "当前仍在普攻连段首击的动画起始延迟内，持续触发检查已停止。"); continue; }
        }
      } else if (check.frame < ready) { decide(current.id, check.frame, false, "进入普攻状态时，60 帧触发冷却尚未结束，本次未触发。"); continue; }

      // At equal frames, source task insertion order can affect a ticker crossing
      // a new state. Do not silently select an unobserved engine ordering.
      const collision = check.kind === "entry" && queue.some(next => next.frame === check.frame && next.kind === "tick" && next.source === tickerSource);
      if (collision) issue(`普攻状态 ${current.id} 与前一轮持续触发检查发生在同一帧；当前记录未明确其先后顺序，无法确定结果。`);
      const trigger: CoordinatedTriggerProvenance = {
        kind: check.kind === "entry" ? "normal-state" : "normal-tick", eventId: current.id, frame: check.frame, actorId: current.actorId,
      };
      wave++;
      if (xingqiu) for (let projectile = 1; projectile <= (wave % 2 === 1 ? 2 : 3); projectile++) {
        emit("proc", check.frame + 20, check.frame, `trigger:${check.frame}`, trigger, projectile);
      }
      if (yelan) for (let projectile = 1; projectile <= 3; projectile++) {
        emit("proc", check.frame + 20 + (projectile - 1) * 6, check.frame, `trigger:${check.frame}`, trigger, projectile);
      }
      if (thoma) emit("proc", check.frame + 11, check.frame, `trigger:${check.frame}`, trigger);
      decide(current.id, check.frame, true, check.kind === "entry" ? "进入普攻状态时成功触发。" : "持续处于普攻状态，定时检查成功触发。");
      // StatusIsActive uses expiry >= currentFrame. Entry at +60 is still on
      // cooldown, whereas the separately scheduled ticker deliberately bypasses it.
      ready = check.frame + 61;
      if (check.kind === "entry") tickerSource = check.frame;
      queue.push({ frame: check.frame + 60, state: current, kind: "tick", source: tickerSource });
    }
  }

  const needsDamageEvents = yelan || traveler || raiden || yoimiya || albedo || dehyaFresh || dehyaReposition;
  if (needsDamageEvents && !context.damageEvents) issue("请填写完整的外部敌人受伤事件记录；若没有此类事件，请明确填写空数组。");
  const damageIds = new Set<string>();
  // Array order is explicit tie-breaking order for multiple damage events on one frame.
  const events = (context.damageEvents ?? []).filter(event => {
    if (!named(event.id) || damageIds.has(event.id)) { issue("伤害事件标识不能为空或重复。"); return false; }
    damageIds.add(event.id);
    if (!nonnegative(event.frame)) { issue(`伤害事件 ${event.id} 的发生帧必须为非负整数。`); return false; }
    return true;
  }).slice().sort((a, b) => a.frame - b.frame);
  let ready = firstReady;
  for (const event of events) {
    if (!needsDamageEvents) break;
    if (event.frame < start || event.frame > end || (!endInclusive && event.frame === end)) {
      decide(event.id, event.frame, false, "事件发生在来源状态或领域的有效持续时间之外。"); continue;
    }
    if (!yelan && event.frame < ready) { decide(event.id, event.frame, false, "触发冷却尚未结束。"); continue; }
    if (event.origin === "this-cast") { decide(event.id, event.frame, false, "本次施放生成的攻击不会再次作为外部事件递归触发。"); continue; }
    // A known disqualifier is enough to reject an event. Do not demand unrelated
    // unknown fields from a zero-damage/out-of-field/wrong-tag event.
    const wrongTag = event.tag !== undefined && (
      (traveler && event.tag !== "normal" && event.tag !== "charged")
      || (raiden && ["electro-charged", "burning", "hydro-swirl"].includes(event.tag))
      || (yoimiya && !directTags.has(event.tag)) || (yelan && event.tag !== "skill")
    );
    const wrongActor = named(event.actorId) && named(context.casterId) && (
      (yoimiya && event.actorId === context.casterId) || (yelan && event.actorId !== context.casterId)
      || (raiden && event.actorId === context.casterId && event.tag === "skill" && event.strikeType === "slash")
    );
    const wrongActiveActor = traveler && named(event.actorId) && named(event.activeActorId) && event.actorId !== event.activeActorId;
    const wrongAbility = (albedo && event.sourceAbility === "Abiogenesis: Solar Isotoma (Initial)")
      || (yelan && named(event.sourceAbility) && event.sourceAbility !== "Lingering Lifeline");
    const wrongDamage = (raiden || albedo || dehyaFresh || dehyaReposition) && event.damagePositive === false;
    const wrongRange = (albedo || dehyaFresh || dehyaReposition) && event.inRange === false;
    const wrongMarkedTarget = yoimiya && named(event.targetId) && named(context.targetId) && event.targetId !== context.targetId;
    if (wrongTag || wrongActor || wrongActiveActor || wrongAbility || wrongDamage || wrongRange || wrongMarkedTarget) {
      decide(event.id, event.frame, false, "已明确的来源条件不满足，本次不触发。"); continue;
    }
    if (event.origin !== "external") { issue(`伤害事件 ${event.id} 需要明确来自外部攻击，还是本次施放生成的攻击。`); continue; }
    if (!named(event.actorId) || !named(event.targetId)) { issue(`伤害事件 ${event.id} 缺少实际来源角色或受击敌人。`); continue; }
    const reject = (reason: string) => decide(event.id, event.frame, false, reason);
    if (traveler) {
      if (event.tag === undefined) { issue(`伤害事件 ${event.id} 缺少攻击类型标签。`); continue; }
      if (event.tag !== "normal" && event.tag !== "charged") { reject("雷元素旅行者的追击需要普攻或重击命中。"); continue; }
      if (!named(event.activeActorId)) { issue(`伤害事件 ${event.id} 缺少命中时的场上角色。`); continue; }
      if (event.activeActorId !== event.actorId) { reject("此次普攻或重击命中并非来自当时的场上角色。"); continue; }
    }
    if (raiden) {
      if (event.tag === undefined) { issue(`伤害事件 ${event.id} 缺少攻击类型标签。`); continue; }
      if (["electro-charged", "burning", "hydro-swirl"].includes(event.tag)) { reject("雷电将军的协同攻击不接受此类以敌人为来源的反应伤害。"); continue; }
      if (event.actorId === context.casterId && event.tag === "skill") {
        if (event.strikeType === undefined) { issue(`雷电将军自身的元素战技事件 ${event.id} 缺少打击类型（strikeType），无法排除协同斩击自触发。`); continue; }
        if (event.strikeType === "slash") { reject("雷电将军的元素战技协同斩击不能触发自身。"); continue; }
      }
    }
    if (yoimiya) {
      if (event.targetId !== context.targetId) { reject("此次伤害没有命中带有标记的敌人。"); continue; }
      if (event.actorId === context.casterId) { reject("宵宫自身的攻击不能触发琉金火光。"); continue; }
      if (event.tag === undefined) { issue(`伤害事件 ${event.id} 缺少攻击类型标签。`); continue; }
      if (!directTags.has(event.tag)) { reject("琉金火光需要符合来源规则的直接攻击类型。"); continue; }
    }
    if (yelan) {
      if (event.actorId !== context.casterId) { reject("只有夜兰自身的络命丝命中能够使用此额外触发路径。"); continue; }
      if (event.tag === undefined) { issue(`夜兰的伤害事件 ${event.id} 缺少攻击类型标签。`); continue; }
      if (event.tag !== "skill") { reject("此事件并非夜兰的元素战技伤害。"); continue; }
      if (!named(event.sourceAbility)) { issue(`夜兰的元素战技事件 ${event.id} 缺少来源技能名称（sourceAbility），无法确认是否为萦络纵命索。`); continue; }
      if (event.sourceAbility !== "Lingering Lifeline") { reject("只有萦络纵命索的命中回调能够触发此额外玲珑掷。"); continue; }
    }
    if (albedo) {
      if (!named(event.sourceAbility)) { issue(`伤害事件 ${event.id} 缺少来源技能名称（sourceAbility），无法排除阿贝多施放初击的自触发。`); continue; }
      if (event.sourceAbility === "Abiogenesis: Solar Isotoma (Initial)") { reject("阿贝多的施放初击不能触发刹那之花。"); continue; }
    }
    if (raiden || albedo || dehyaFresh || dehyaReposition) {
      if (event.damagePositive === undefined) { issue(`伤害事件 ${event.id} 需要明确实际伤害是否非零。`); continue; }
      if (!event.damagePositive) { reject("此来源触发规则需要敌人实际受到非零伤害。"); continue; }
    }
    if (raiden && event.frame === end) {
      // skillKey is an AttackMod rather than a plain status. Ordinary damage
      // removes expired AttackMods before emitting OnEnemyDamage; reaction tags
      // can bypass that pruning, so the coarse "other" tag is insufficient here.
      if (event.tag === "other") issue(`雷电将军的事件 ${event.id} 恰好位于状态到期帧；当前分支没有记录判定所需的反应类型及攻击修正移除顺序。`);
      else reject("此次直接攻击会先移除已到期的雷罚恶曜之眼攻击修正，再执行伤害回调，因此不会触发协同攻击。");
      continue;
    }
    if (yoimiya && event.frame === start) {
      issue(`琉金火光事件 ${event.id} 与施放初击处于同一帧；当前记录没有明确标记附着回调的先后顺序。`);
      continue;
    }
    if (albedo || dehyaFresh || dehyaReposition) {
      if (event.inRange === undefined) { issue(`伤害事件 ${event.id} 需要明确受击敌人是否实际位于领域范围内。`); continue; }
      if (!event.inRange) { reject("受击敌人位于领域范围外。"); continue; }
    }
    if (!yelan && event.targetId !== context.targetId) {
      issue(`伤害事件 ${event.id} 命中了另一名敌人；此分支不会推测跨目标的范围伤害是否重叠。`); continue;
    }
    const trigger: CoordinatedTriggerProvenance = { kind: "damage-event", eventId: event.id, frame: event.frame, actorId: event.actorId };
    if (yelan) {
      for (let projectile = 1; projectile <= 3; projectile++) {
        emit("proc", event.frame + 20 + (projectile - 1) * 6, event.frame, `trigger:${event.frame}`, trigger, projectile);
      }
      decide(event.id, event.frame, true, "络命丝的独立命中回调已触发；它不检查或重置普攻状态触发的冷却。");
      continue;
    }
    if (traveler) emit("proc", event.frame + 1, 0, "cast:0", trigger);
    if (raiden) emit("proc", event.frame + 5, event.frame + 5, `impact:${event.frame + 5}`, trigger);
    if (yoimiya) emit("proc", event.frame + 1, event.frame, `trigger:${event.frame}`, trigger);
    if (albedo) emit("proc", event.frame + 1, 0, "cast:0", trigger);
    if (dehyaFresh || dehyaReposition) emit("proc", event.frame + 2, procSnapshot, procSnapshotId, trigger);
    ready = event.frame + cooldown + (traveler || raiden ? 0 : 1);
    decide(event.id, event.frame, true, "敌人受伤事件满足条件，已触发协同攻击。");
  }

  if (fischl && nonnegative(context.fischlOzTravelFrames)) {
    for (let frame = start + (fischlSkill ? 64 : 69), tick = 1; frame <= end; frame += 59, tick++) {
      emit("proc", frame + context.fischlOzTravelFrames, procSnapshot, procSnapshotId,
        { kind: "autonomous", eventId: `oz-tick-${tick}`, frame, actorId: context.casterId });
    }
  }
  instances.sort((a, b) => a.frame - b.frame);
  const requiredObservedThroughFrame = Math.max(end + (endInclusive ? 1 : 0), ...instances.map(instance => instance.frame));
  if (!nonnegative(context.observedThroughFrame) || context.observedThroughFrame < requiredObservedThroughFrame) {
    issue(`观察记录至少需要覆盖至第 ${requiredObservedThroughFrame} 帧，包括状态到期后仍会命中的已发出攻击。`);
  }
  return {
    instances, issues, decisions, lifecycleStartFrame: start, lifecycleEndFrame: end, lifecycleEndInclusive: endInclusive,
    requiredObservedThroughFrame, complete: issues.length === 0,
  };
}
