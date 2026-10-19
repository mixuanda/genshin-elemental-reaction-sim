export const SOURCE_EXECUTION_PROFILE_VERSION = "source-action-delay-v1";
export const SOURCE_DELAY_KEYS = ["swap", "attack", "charge", "skill", "burst", "jump", "dash", "aim_delay"] as const;
export type SourceDelayKey = typeof SOURCE_DELAY_KEYS[number];
export type SourceExecutionProfileMode = "ideal" | "practical" | "conservative" | "custom";
export interface SourceExecutionProfile {
  version: typeof SOURCE_EXECUTION_PROFILE_VERSION;
  mode: SourceExecutionProfileMode;
  delays: Record<SourceDelayKey, number>;
}

export const SOURCE_EXECUTION_PROFILE_DEFAULTS: Record<Exclude<SourceExecutionProfileMode, "custom">, Record<SourceDelayKey, number>> = {
  ideal: { swap: 0, attack: 0, charge: 0, skill: 0, burst: 0, jump: 0, dash: 0, aim_delay: 0 },
  practical: { swap: 8, attack: 5, charge: 5, skill: 5, burst: 5, jump: 5, dash: 5, aim_delay: 5 },
  conservative: { swap: 12, attack: 8, charge: 8, skill: 8, burst: 8, jump: 8, dash: 8, aim_delay: 8 }
};

export const defaultSourceExecutionProfile = (): SourceExecutionProfile => ({
  version: SOURCE_EXECUTION_PROFILE_VERSION,
  mode: "practical",
  delays: { ...SOURCE_EXECUTION_PROFILE_DEFAULTS.practical }
});

export function normalizeSourceExecutionProfile(profile: SourceExecutionProfile | undefined): SourceExecutionProfile {
  if (!profile) return defaultSourceExecutionProfile();
  if (profile.version !== SOURCE_EXECUTION_PROFILE_VERSION || !["ideal", "practical", "conservative", "custom"].includes(profile.mode)) {
    throw new Error("动作执行难度预设版本不受支持，请重新选择。 ");
  }
  const delays = {} as Record<SourceDelayKey, number>;
  for (const key of SOURCE_DELAY_KEYS) {
    const value = profile.delays?.[key];
    if (!Number.isInteger(value) || value < 0 || value > 120) throw new Error(`${key} 延迟须为 0–120 帧的整数。`);
    delays[key] = value;
  }
  const mode = profile.mode;
  if (mode !== "custom" && SOURCE_DELAY_KEYS.some(key => delays[key] !== SOURCE_EXECUTION_PROFILE_DEFAULTS[mode][key])) {
    throw new Error("预设档位的延迟与固定定义不符；如需调整，请改选自定义。 ");
  }
  return { version: SOURCE_EXECUTION_PROFILE_VERSION, mode: profile.mode, delays };
}

export const sourceExecutionProfileComment = (profile: SourceExecutionProfile): string =>
  `# Execution profile: ${profile.version} mode=${profile.mode} ${SOURCE_DELAY_KEYS.map(key => `${key === "aim_delay" ? key : `${key}_delay`}=${profile.delays[key]}`).join(" ")}`;
