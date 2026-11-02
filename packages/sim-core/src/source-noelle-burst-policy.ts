import { SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT } from "./source-host-wire";

export interface SourceNoelleBurstParameterInput {
  sourceRevision: string;
  characterKey: string;
  constellation: number;
  actionKind: string;
  parameters?: Readonly<Record<string, number>>;
}

export interface SourceNoelleBurstParameterResolution {
  parameters: Record<string, number>;
  extension?: {
    seconds: number;
    origin: "default-zero" | "explicit";
    message: string;
  };
}

/**
 * Ordinary team drafts do not establish Noelle's C6 kill/off-field extension.
 * Both pinned burst.go files otherwise default an omitted `extend` to ten
 * seconds before observing any combat event. Make zero extension explicit in
 * newly compiled ordinary scripts, while preserving an explicit user value.
 *
 * This is an input policy, not a replacement for native C6 event mechanics.
 * Do not apply it to saved GCSL/results or the advanced source editor.
 */
export function resolveSourceNoelleBurstParameters(input: SourceNoelleBurstParameterInput): SourceNoelleBurstParameterResolution {
  const parameters = { ...input.parameters };
  if (input.characterKey !== "noelle" || input.actionKind !== "burst") return { parameters };
  if (!Number.isInteger(input.constellation) || input.constellation < 0 || input.constellation > 6) {
    throw new Error("诺艾尔命之座须为 0–6 的整数。");
  }
  if (input.constellation < 6) return { parameters };
  if (input.sourceRevision !== SOURCE_HOST_COMMIT && input.sourceRevision !== SOURCE_HOST_STELLAR_COMMIT) {
    throw new Error("当前来源尚未核对诺艾尔 C6 的延长参数；不能推断爆发持续时间。");
  }

  const explicit = Object.prototype.hasOwnProperty.call(parameters, "extend");
  if (explicit && (!Number.isInteger(parameters.extend) || parameters.extend! < 0 || parameters.extend! > 10)) {
    throw new Error("诺艾尔 C6 本次爆发延长秒数须为 0–10 的整数；未知时不填写。");
  }
  const seconds = explicit ? parameters.extend! : 0;
  parameters.extend = seconds;
  return {
    parameters,
    extension: {
      seconds,
      origin: explicit ? "explicit" : "default-zero",
      message: explicit
        ? `诺艾尔 C6 本次延长 ${seconds} 秒，使用本步填写的值；不自动推断击杀或后台延长。`
        : "诺艾尔 C6 本次未计额外延长（0 秒）；若已确认延长，可在本步填写 0–10 秒。",
    },
  };
}
