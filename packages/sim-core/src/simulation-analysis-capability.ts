import type { SimConfig } from "@genshin-dps-lab/schemas";

export type SimulationAnalysisCapability =
  | { supported: true }
  | {
      supported: false;
      code: "EVENT_STEP_ANALYSIS_UNSUPPORTED";
      message: string;
    };

/** Analysis v1 cannot retain/reopen the current EC event-step witnesses.
 * Keep ordinary witnessed simulation available; never silently discard its
 * envelope or route an analysis through the historical/default simulator.
 */
export function getSimulationAnalysisCapability(
  config: Pick<SimConfig, "electroChargedPropagationModel">,
): SimulationAnalysisCapability {
  return config.electroChargedPropagationModel?.mode === "nearby-wet-radius-v1"
    ? {
        supported: false,
        code: "EVENT_STEP_ANALYSIS_UNSUPPORTED",
        message: "附近湿润目标感电的预热、随机起步与充能求解尚未支持：当前分析格式不能保存并重新验证事件步骤见证。请使用“运行模拟”取得固定时长结果，再用“测量窗口”、逐击还原或导出完整模拟记录；固定窗口 DPS 不等于稳态 DPS。",
      }
    : { supported: true };
}

export function assertSimulationAnalysisSupported(
  config: Pick<SimConfig, "electroChargedPropagationModel">,
): void {
  const capability = getSimulationAnalysisCapability(config);
  if (!capability.supported) {
    throw new Error(`[${capability.code}] ${capability.message}`);
  }
}
