import type { SourceAbilityBinding } from "@genshin-dps-lab/schemas";
import { SOURCE_NORMAL_CHAIN_PROFILE_ID, SOURCE_NORMAL_CHAIN_SOURCE_REFS, type SourceNormalChainLogEntry, type SourceNormalChainState } from "../../schemas/src/source-normal-chain";
import { getComposableSourceAbility } from "../../game-data/src/source-ability-registry";

export const SOURCE_NORMAL_CHAIN_PROFILE = {
  id: SOURCE_NORMAL_CHAIN_PROFILE_ID, evidenceStatus: "source-assumed",
  sourceRefs: SOURCE_NORMAL_CHAIN_SOURCE_REFS,
  assumptions: [
    "只为明确采用默认 ResetNormalCounter/AdvanceNormalIndex 的来源链启用；其他角色自定义连段不得自动套用。",
    "成功普攻在动作构造后立即推进，命中、落空和飞行尾段不改变连段。成功非普攻重置全队；真实换人起手及完成各重置一次。",
    "等待、动画自然结束和拒绝输入不重置；无连段超时。当前来源弓链固定无攻速修正、无卡肉，箭在发射帧取样，已排队箭不因取消撤销。",
    "来源模式即使配置零帧换人，也由下一次Player.Tick执行完成回调：实际换人至少1帧。通用N按已接受历史选段，失败动作不偷用较早的取消窗口。",
  ],
} as const;

export interface SourceNormalChainDefinition { actorId: string; chainId: string; length: number; abilityIds: string[] }
/** Full chains make an ordinary input resolvable without inventing an unbound segment. */
export function sourceNormalChainDefinitions(bindings: readonly SourceAbilityBinding[] = []): SourceNormalChainDefinition[] {
  const chains = new Map<string, SourceNormalChainDefinition>();
  for (const binding of bindings) {
    const source = getComposableSourceAbility(binding.sourceActionId), chain = source?.normalChain;
    if (!chain) continue;
    const existing = chains.get(binding.actorId) ?? { actorId: binding.actorId, chainId: chain.id, length: chain.length, abilityIds: [] };
    if (existing.chainId !== chain.id || existing.length !== chain.length) throw new Error(`${binding.actorId} 的来源普攻连段定义冲突。`);
    if (existing.abilityIds[chain.index - 1] !== undefined) throw new Error(`${binding.actorId} 的来源 N${chain.index} 重复绑定。`);
    existing.abilityIds[chain.index - 1] = binding.abilityId;
    chains.set(binding.actorId, existing);
  }
  for (const chain of chains.values()) if (Array.from({ length: chain.length }, (_, index) => chain.abilityIds[index]).some(id => id === undefined)) {
    throw new Error(`${chain.actorId} 必须完整绑定来源 N1–N${chain.length}；不能以任意段号代替实际连段。`);
  }
  return [...chains.values()];
}

export type SourceNormalChainDecision = Pick<SourceNormalChainLogEntry, "profileId" | "kind" | "actorId" | "normalIndex" | "stateBefore" | "stateAfter" | "sourceRefs">;
/** Called only after an input is actually accepted. Failed/no-op inputs and
 * wait/delay never call this runtime. There are no damage or expiry callbacks. */
export class SourceNormalChainRuntime {
  private readonly definitions: SourceNormalChainDefinition[];
  private readonly next = new Map<string, number>();
  constructor(definitions: readonly SourceNormalChainDefinition[]) {
    this.definitions = structuredClone([...definitions]);
    for (const definition of definitions) this.next.set(definition.actorId, 1);
  }
  captureState(): SourceNormalChainState {
    return { actors: this.definitions.map(({ actorId, chainId, length }) => ({ actorId, chainId, length, nextIndex: this.next.get(actorId)! })) };
  }
  nextAbilityId(actorId: string): string | undefined {
    const definition = this.definitions.find(row => row.actorId === actorId);
    return definition?.abilityIds[this.next.get(actorId)! - 1];
  }
  acceptAction(input: { actorId: string; kind: string; sourceAbilityId?: string }): SourceNormalChainDecision | undefined {
    if (input.kind === "wait" || input.kind === "pickUpCrystallize") return undefined;
    if (input.kind !== "normal") return this.reset(input.actorId, "non-normal-reset");
    const definition = this.definitions.find(row => row.actorId === input.actorId);
    if (!definition) return undefined;
    const normalIndex = this.next.get(input.actorId)!;
    if (input.sourceAbilityId !== definition.abilityIds[normalIndex - 1]) {
      throw new Error(`${input.actorId} 实际下一次普攻为 N${normalIndex}（${definition.abilityIds[normalIndex - 1]}），不能执行 ${input.sourceAbilityId ?? "未绑定普攻"}。`);
    }
    const stateBefore = this.captureState();
    this.next.set(input.actorId, normalIndex === definition.length ? 1 : normalIndex + 1);
    return { profileId: SOURCE_NORMAL_CHAIN_PROFILE_ID, kind: "normal-accepted", actorId: input.actorId, normalIndex,
      stateBefore, stateAfter: this.captureState(), sourceRefs: [...SOURCE_NORMAL_CHAIN_PROFILE.sourceRefs] };
  }
  reset(actorId: string, kind: "non-normal-reset" | "swap-start-reset" | "swap-complete-reset"): SourceNormalChainDecision {
    const stateBefore = this.captureState();
    for (const actor of this.definitions) this.next.set(actor.actorId, 1);
    return { profileId: SOURCE_NORMAL_CHAIN_PROFILE_ID, kind, actorId, normalIndex: null,
      stateBefore, stateAfter: this.captureState(), sourceRefs: [...SOURCE_NORMAL_CHAIN_PROFILE.sourceRefs] };
  }
}
