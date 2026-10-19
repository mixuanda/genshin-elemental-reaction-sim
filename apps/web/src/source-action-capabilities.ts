/** Static source methods describe available inputs, not current combat eligibility. */
export type SourceCharacterActionKind = "skill" | "burst" | "attack" | "charge" | "aim" | "low_plunge" | "high_plunge" | "dash" | "jump";
export interface SourceActionReference { path: string; line: number }
export interface SourceActionCapability {
  kind: SourceCharacterActionKind;
  status: "implemented" | "unsupported" | "unresolved";
  source?: SourceActionReference;
  method: string;
  parameters: Array<{ key: string; source: SourceActionReference }>;
}
export interface SourceActionCapabilities {
  schemaVersion: 1;
  actions: SourceActionCapability[];
  normalChain: { length: number | null; source?: SourceActionReference };
}
export const sourceActionLabels: Record<SourceCharacterActionKind | "wait", string> = {
  skill: "E 技能", burst: "Q 爆发", attack: "A 普攻", charge: "CA 重击", aim: "瞄准",
  dash: "冲刺", jump: "跳跃", low_plunge: "低空下落", high_plunge: "高空下落", wait: "等待",
};
export function sourceActionCapability(capabilities: SourceActionCapabilities | undefined, kind: SourceCharacterActionKind): SourceActionCapability | undefined {
  return capabilities?.schemaVersion === 1 ? capabilities.actions.find(action => action.kind === kind) : undefined;
}
