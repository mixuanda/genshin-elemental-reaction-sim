import { z } from "zod";
import type { LegalTimelineCommand, SourceAbilityBinding } from "./types";
import { getSourceNormalChainMetadata } from "./source-normal-family";

/** A generic input's configured ability is only its chain anchor. Resolve its
 * actual bound segment before replaying energy, hits or particles; the separate
 * counter integrity facet proves that this segment was the next accepted one. */
export function resolveTimelineCommandAbilityId(
  command: LegalTimelineCommand,
  executedAbilityId: string | null,
  bindings: readonly SourceAbilityBinding[] | undefined
): string | undefined {
  if (!("abilityId" in command)) return undefined;
  if (command.type !== "normal" || command.sourceNormalChain !== "next-v1") return command.abilityId;
  const chainId = (abilityId: string | null): string | undefined => {
    const binding = bindings?.find(binding => binding.actorId === command.actorId && binding.abilityId === abilityId);
    return binding === undefined ? undefined : getSourceNormalChainMetadata(binding.sourceActionId)?.id;
  };
  const anchorChain = chainId(command.abilityId);
  return executedAbilityId !== null && anchorChain !== undefined && chainId(executedAbilityId) === anchorChain
    ? executedAbilityId : undefined;
}

export const SOURCE_NORMAL_CHAIN_PROFILE_ID = "gcsim-b4ae769-normal-chain-v1" as const;
export const SOURCE_NORMAL_CHAIN_SOURCE_REFS = ["internal/characters/amber/attack.go", "internal/template/character/character.go", "pkg/core/player/exec.go",
  "pkg/core/player/player.go", "pkg/core/player/animation/animation.go", "pkg/core/action/action.go", "pkg/simulation/run.go", "internal/frames/frames.go"]
  .map(path => `https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/${path}`);
const id = z.string().trim().min(1), frame = z.number().int().nonnegative();
export const sourceNormalChainStateSchema = z.object({ actors: z.array(z.object({
  actorId: id, chainId: id, length: z.number().int().positive(), nextIndex: z.number().int().positive(),
}).strict()) }).strict().superRefine((state, context) => {
  const actors = new Set<string>();
  state.actors.forEach((actor, index) => {
    if (actors.has(actor.actorId)) context.addIssue({ code: "custom", path: ["actors", index, "actorId"], message: "normal-chain actors must be unique" });
    actors.add(actor.actorId);
    if (actor.nextIndex > actor.length) context.addIssue({ code: "custom", path: ["actors", index, "nextIndex"], message: "next normal input must belong to its source chain" });
  });
});
export const sourceNormalChainLogEntrySchema = z.object({
  id: frame, profileId: z.literal(SOURCE_NORMAL_CHAIN_PROFILE_ID), frame,
  timeSeconds: z.number().finite().nonnegative(), eventPriority: z.number().finite(), eventSequence: frame, intraEventSequence: frame,
  kind: z.enum(["normal-accepted", "non-normal-reset", "swap-start-reset", "swap-complete-reset"]),
  actorId: id, actionId: id.nullable(), sourceAbilityId: id.nullable(),
  timelineCommandIndex: frame.nullable(), actionLogIndex: frame.nullable(), normalIndex: z.number().int().positive().nullable(),
  stateBefore: sourceNormalChainStateSchema, stateAfter: sourceNormalChainStateSchema, sourceRefs: z.array(id).min(1),
}).strict();
export type SourceNormalChainState = z.infer<typeof sourceNormalChainStateSchema>;
export type SourceNormalChainLogEntry = z.infer<typeof sourceNormalChainLogEntrySchema>;
