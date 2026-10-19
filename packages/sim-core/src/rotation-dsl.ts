import { staminaCostSchema, type AbilityDefinition, type AuraElement, type LegalTimelineCommand, type SimConfig, type StaminaCost } from "@genshin-dps-lab/schemas";
import { compileLegalTimeline } from "./legal-timeline";
import { assertComposableSourceAbilities, deriveSourceBackedRotationMappings } from "./source-action-library";

export interface RotationDslMappings {
  /** Ordered inputs, not damage hits. Never inferred from array order or labels. */
  normalChains?: Record<string, string[]>;
  /** Opt in only for source chains whose successful-input reset rules are fixed. */
  normalChainSemantics?: Record<string, "accepted-input-default-reset-v1">;
  /** Character-specific tokens such as E.hold map to an existing definition. */
  aliases?: Record<string, Record<string, string>>;
  /** D/J/W are accepted only when their occupancy has been explicitly supplied. */
  movementFrames?: { dash?: number; jump?: number; walk?: number };
}

export interface RotationDslInput extends RotationDslMappings {
  initialActiveCharacterId: string;
  characterIds: string[];
  abilities: AbilityDefinition[];
}

export class RotationDslError extends Error {
  constructor(message: string, public readonly tokenIndex: number) {
    super(`轮转 DSL 第 ${tokenIndex + 1} 个词：${message}`);
    this.name = "RotationDslError";
  }
}

/** Parses only explicit executable definitions; it creates no talent or frame data. */
export function parseRotationDsl(source: string, input: RotationDslInput): LegalTimelineCommand[] {
  const tokens = source.replace(/#[^\n]*/g, "").match(/[{}]|[^\s{};]+/g) ?? [];
  let cursor = 0;
  type Node = { repeat: number; children: Node[] } | { tokens: string[]; index: number; at?: string; actor?: string; staminaCost?: StaminaCost };
  function fail(message: string, index = cursor): never { throw new RotationDslError(message, index); }
  const parseNodes = (depth = 0): Node[] => {
    if (depth > 8) fail("repeat 嵌套最多 8 层。");
    const nodes: Node[] = [];
    while (cursor < tokens.length && tokens[cursor] !== "}") {
      const index = cursor;
      let token = tokens[cursor++]!;
      let at: string | undefined;
      if (token === "at") {
        at = tokens[cursor++];
        token = tokens[cursor++] ?? "";
        if (!at || !token || ["repeat", "wait", "at", "{", "}"].includes(token)) fail("at <帧数> 必须紧接一条非 wait 行动。", index);
      }
      if (token === "repeat") {
        const countText = tokens[cursor++];
        if (!countText || !/^[1-9]\d*$/.test(countText) || Number(countText) > 1000) {
          fail("repeat 次数必须是 1 至 1000 的整数。", index);
        }
        if (tokens[cursor++] !== "{") fail("repeat 后需要 {。", index);
        const children = parseNodes(depth + 1);
        if (tokens[cursor++] !== "}") fail("repeat 缺少闭合 }。", index);
        nodes.push({ repeat: Number(countText), children });
      } else {
        if (token === "{") fail("意外的 {。", index);
        const args = [token];
        if (["swap", "wait", "action", "plunge", "dash", "jump", "walk", "pickup"].includes(token)) {
          const arg = tokens[cursor++];
          if (!arg || arg === "{" || arg === "}") fail(`${token} 缺少参数。`, index);
          args.push(arg);
        }
        let actor: string | undefined;
        if (tokens[cursor] === "for") {
          cursor++;
          actor = tokens[cursor++];
          if ((!/^N\d*$/.test(token) && !["action", "plunge", "P", "dash", "jump", "walk", "D", "J", "W"].includes(token)) || !actor || !input.characterIds.includes(actor)) fail("for <角色ID> 只用于 N / action / plunge / dash / jump / walk，且角色须存在。", index);
        }
        let staminaCost: StaminaCost | undefined;
        if (tokens[cursor] === "stamina") {
          if (!["dash", "jump", "walk", "D", "J", "W"].includes(token)) fail("stamina 后缀只用于移动行动；技能费用来自已定义行动。", index);
          cursor++;
          const encoded = tokens[cursor++];
          if (!encoded) fail("stamina 缺少已编码的费用定义。", index);
          let value: unknown;
          try { value = JSON.parse(decodeURIComponent(encoded)); }
          catch { fail("stamina 费用定义必须是 URI 编码的 JSON。", index); }
          const parsed = staminaCostSchema.safeParse(value);
          if (!parsed.success) fail("stamina 费用定义不符合数值、扣除帧与来源要求。", index);
          staminaCost = { amount: parsed.data.amount, consumeFrame: parsed.data.consumeFrame, source: parsed.data.source,
            ...(parsed.data.consumeWhenZero === undefined ? {} : { consumeWhenZero: parsed.data.consumeWhenZero }) };
        }
        nodes.push({ tokens: args, index, ...(at === undefined ? {} : { at }), ...(actor === undefined ? {} : { actor }),
          ...(staminaCost === undefined ? {} : { staminaCost }) });
      }
    }
    return nodes;
  };
  const nodes = parseNodes();
  if (cursor !== tokens.length) fail("没有对应 repeat 的 }。");
  if (!input.characterIds.includes(input.initialActiveCharacterId)) fail("初始前台角色不存在。", 0);
  const abilityById = new Map(input.abilities.map((ability) => [ability.id, ability]));
  if (abilityById.size !== input.abilities.length) fail("行动 ID 重复。", 0);
  let active = input.initialActiveCharacterId;
  const commands: LegalTimelineCommand[] = [];
  const append = (command: LegalTimelineCommand, index: number): void => {
    if (commands.length >= 10000) fail("展开后最多 10000 个指令。", index);
    commands.push(command);
  };
  const abilityCommand = (id: string, index: number, actor = active, requiredKind?: AbilityDefinition["kind"]): void => {
    const ability = abilityById.get(id);
    if (!ability) fail(`未找到行动 ${id}。`, index);
    if (ability.actorId !== actor) fail(`行动 ${id} 不属于角色 ${actor}。`, index);
    if (requiredKind !== undefined && ability.kind !== requiredKind) fail(`行动 ${id} 不是 ${requiredKind} 行动。`, index);
    append({ type: ability.kind, actorId: actor, abilityId: ability.id }, index);
  };
  const frameArgument = (text: string | undefined, index: number): number => {
    if (!text || !/^\d+f$/.test(text)) fail("帧数必须使用非负整数 f，例如 12f。", index);
    const frames = Number(text.slice(0, -1));
    if (!Number.isSafeInteger(frames) || frames > 36000) fail("帧数超出 0 至 36000。", index);
    return frames;
  };
  let expansionSteps = 0;
  const visit = (items: Node[]): void => {
    // Count visits even for empty blocks; nested empty repeats must not create
    // unbounded work without ever reaching the emitted-command limit.
    if (++expansionSteps > 20000) fail("repeat 展开复杂度超过 20000 次。", 0);
    for (const node of items) {
      if ("repeat" in node) {
        for (let count = 0; count < node.repeat; count += 1) visit(node.children);
        continue;
      }
      const [token, arg] = node.tokens;
      const start = commands.length;
      if (token === "swap") {
        if (!input.characterIds.includes(arg!)) fail(`未找到角色 ${arg}。`, node.index);
        append({ type: "swap", characterId: arg! }, node.index);
        active = arg!;
      } else if (token === "wait") {
        append({ type: "wait", frames: frameArgument(arg, node.index) }, node.index);
      } else if (token === "action" || token === "plunge") {
        abilityCommand(arg!, node.index, node.actor, token === "plunge" ? "plunge" : undefined);
      } else if (token === "pickup") {
        if (!["any", "pyro", "hydro", "cryo", "electro"].includes(arg!)) fail("pickup 只接受 any / pyro / hydro / cryo / electro。", node.index);
        append({ type: "pickUpCrystallize", element: arg as AuraElement | "any" }, node.index);
      } else if (token === "dash" || token === "jump" || token === "walk" || token === "D" || token === "J" || token === "W") {
        const type = token === "D" || token === "dash" ? "dash" : token === "J" || token === "jump" ? "jump" : "walk";
        const frames = arg === undefined ? input.movementFrames?.[type] : frameArgument(arg, node.index);
        if (frames === undefined || !Number.isInteger(frames) || frames < 1 || frames > 36000) {
          fail(`${token} 必须提供明确的 ${type} 占用帧数；例如 ${type} 12f。`, node.index);
        }
        append({ type, actorId: node.actor ?? active, frames,
          ...(node.staminaCost === undefined ? {} : { staminaCost: node.staminaCost }) }, node.index);
      } else if (/^N\d*$/.test(token!)) {
        const count = token === "N" ? 1 : Number(token!.slice(1));
        const actor = node.actor ?? active, chain = input.normalChains?.[actor];
        if (!chain || count < 1 || count > chain.length) {
          fail(`${actor} 未定义合法的 ${token} 普攻输入序列。`, node.index);
        }
        for (let ordinal = 0; ordinal < count; ordinal++) {
          const generic = input.normalChainSemantics?.[actor] === "accepted-input-default-reset-v1";
          const id = chain[generic ? 0 : ordinal]!;
          if (abilityById.get(id)?.kind !== "normal") fail(`普攻序列 ${id} 不是 normal 行动。`, node.index);
          if (generic) append({ type: "normal", actorId: actor, abilityId: id, sourceNormalChain: "next-v1" }, node.index);
          else abilityCommand(id, node.index, actor);
        }
      } else {
        const actor = node.actor ?? active;
        const alias = input.aliases?.[actor]?.[token!];
        if (alias) {
          abilityCommand(alias, node.index, actor, token === "P" ? "plunge" : undefined);
        } else {
          const kind = token === "E" ? "skill" : token === "Q" ? "burst" : token === "C" ? "charge" : token === "P" ? "plunge" : null;
          if (!kind) fail(`不支持 ${token}；使用 action <行动ID>。逐段命中选择器不能充当行动。`, node.index);
          const candidates = input.abilities.filter((ability) => ability.actorId === actor && ability.kind === kind);
          if (candidates.length !== 1) fail(`${actor} 的 ${token} 没有唯一行动定义，请配置别名或使用 action。`, node.index);
          abilityCommand(candidates[0]!.id, node.index, actor, kind);
        }
      }
      if (node.at !== undefined) {
        // A combo prefix has one requested start; later inputs retain their
        // normal occupancy instead of all being forced onto the same frame.
        const command = commands[start]!;
        if (command.type !== "wait") command.atFrame = frameArgument(node.at, node.index);
      }
    }
  };
  visit(nodes);
  return commands;
}

/** Canonical editable notation preserves explicit request times and movement. */
export function serializeRotationDsl(commands: readonly LegalTimelineCommand[]): string {
  return commands.map(command => {
    if (command.type === "wait") return `wait ${command.frames}f`;
    const at = command.atFrame === undefined ? "" : `at ${command.atFrame}f `;
    if (command.type === "swap") return `${at}swap ${command.characterId}`;
    if (command.type === "pickUpCrystallize") return `${at}pickup ${command.element}`;
    if (command.type === "normal" && command.sourceNormalChain === "next-v1") return `${at}N for ${command.actorId}`;
    if ("abilityId" in command) return `${at}${command.type === "plunge" ? "plunge" : "action"} ${command.abilityId} for ${command.actorId}`;
    const stamina = command.staminaCost === undefined ? "" : ` stamina ${encodeURIComponent(JSON.stringify(command.staminaCost))}`;
    return `${at}${command.type} ${command.frames}f for ${command.actorId}${stamina}`;
  }).join("\n");
}

export function compileRotationDsl(config: SimConfig, source: string, mappings: RotationDslMappings = {}): ReturnType<typeof compileLegalTimeline> {
  if (!config.timeline) throw new Error("需要含已定义 abilities 的 legal-frame-v1 配置；不会自动编造角色行动。");
  assertComposableSourceAbilities(config);
  const boundMappings = deriveSourceBackedRotationMappings(config);
  const aliases = { ...boundMappings?.aliases };
  for (const [actorId, actorAliases] of Object.entries(mappings.aliases ?? {})) aliases[actorId] = { ...aliases[actorId], ...actorAliases };
  const commands = parseRotationDsl(source, {
    ...mappings,
    normalChains: { ...boundMappings?.normalChains, ...mappings.normalChains },
    normalChainSemantics: { ...boundMappings?.normalChainSemantics, ...mappings.normalChainSemantics },
    aliases,
    initialActiveCharacterId: config.timeline.initialActiveCharacterId,
    characterIds: config.characters.map((character) => character.id),
    abilities: config.timeline.abilities
  });
  return compileLegalTimeline({ ...config, timeline: { ...config.timeline, commands } });
}
