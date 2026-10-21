import { batchSeed, batchStatistics } from "./batch-statistics";
import { simulate, applyExecutionProfile, FAVONIUS_PROFILE, SACRIFICIAL_PROFILE } from "@genshin-dps-lab/sim-core";
import { NORMAL_HIT_ENERGY_PROFILE } from "../../../packages/sim-core/src/normal-hit-energy";
import { hasRandomWeaponProc, WEAPON_PROC_RANDOM_PROFILE } from "../../../packages/sim-core/src/weapon-proc";
import type { WorkerRequest, WorkerResponse, SimulationBatchSummary } from "./worker-client";

// An explicit small surface avoids adding WebWorker and DOM conflicting globals.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (response: WorkerResponse) => void;
};

scope.onmessage = (event): void => {
  const request = event.data;
  try {
    if (request.type === "prepare") {
      scope.postMessage({type: "progress", completed: 0, total: 1});
      const appliedProfile = request.executionProfile ? applyExecutionProfile(request.config, request.executionProfile, request.options) : null;
      const config = appliedProfile?.config ?? request.config;
      const timelineExecution = request.resolveTimeline ? simulate(config, request.options).timelineExecution : undefined;
      scope.postMessage({type: "progress", completed: 1, total: 1});
      scope.postMessage({type: "prepared", config, appliedProfile, ...(timelineExecution === undefined ? {} : {timelineExecution})});
      return;
    }
    if (!Number.isInteger(request.iterations) || request.iterations < 1 || request.iterations > 10000) {
      throw new RangeError("迭代次数必须是 1 至 10000 的整数。");
    }
    const start = request.sampleStart ?? 0, total = request.totalIterations ?? request.iterations;
    if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(total) || total > 10000 || start + request.iterations > total) throw new RangeError("批量采样区间无效。");
    const started = performance.now();
    scope.postMessage({ type: "progress", completed: 0, total: request.iterations });
    const appliedProfile = request.executionProfile ? applyExecutionProfile(request.config, request.executionProfile, request.options) : undefined;
    const config = appliedProfile?.config ?? request.config;
    const randomWeaponProcs = hasRandomWeaponProc(config.weaponProcModel);
    const seed = request.options.randomSeed ?? config.randomSeed;
    const values: number[] = [];
    let result: ReturnType<typeof simulate> | undefined;
    for (let index = 0; index < request.iterations; index += 1) {
      const current = simulate(config, {
        ...request.options,
        execution: { captureHits: true, ...request.options.execution },
        randomSeed: batchSeed(seed, start + index, total)
      });
      if (current.mechanicsStatus !== "complete") throw new Error("模拟含未完成机制，不能汇总为完整批量结果。");
      result ??= current;
      values.push(current.totalDamage);
      scope.postMessage({ type: "progress", completed: index + 1, total: request.iterations });
    }
    if (!result) throw new Error("模拟没有生成结果。");
    const summary: SimulationBatchSummary = {
      iterations: values.length,
      seed,
      rngPolicy: config.favoniusModel || config.sacrificialModel || randomWeaponProcs ? "seeded-particles-and-declared-independent-streams-v1" : config.normalHitEnergyModel
        ? request.options.execution?.criticalSampling === "seeded-random-v1"
          ? "seeded-particles-crit-and-normal-energy-mulberry32-v1" : "seeded-particles-and-normal-energy-mulberry32-v1"
        : request.options.execution?.criticalSampling === "seeded-random-v1"
          ? "seeded-particles-and-crit-mulberry32-v1" : "seeded-particles-mulberry32-v1",
      ...(config.normalHitEnergyModel ? { normalHitEnergyPolicy: {
        sourceProfileId: NORMAL_HIT_ENERGY_PROFILE.id,
        rngStream: NORMAL_HIT_ENERGY_PROFILE.rngStream,
        rngAlgorithm: NORMAL_HIT_ENERGY_PROFILE.rngAlgorithm,
        matchesGcsimRandomSequence: NORMAL_HIT_ENERGY_PROFILE.matchesGcsimRandomSequence,
      } } : {}),
      ...(config.favoniusModel ? { favoniusPolicy: {
        sourceProfileId: FAVONIUS_PROFILE.id, rngStream: FAVONIUS_PROFILE.rngStream,
        rngAlgorithm: FAVONIUS_PROFILE.rngAlgorithm,
        matchesGcsimRandomSequence: FAVONIUS_PROFILE.matchesGcsimRandomSequence,
        cooldownClock: FAVONIUS_PROFILE.cooldownClock,
      } } : {}),
      ...(config.sacrificialModel ? { sacrificialPolicy: {
        sourceProfileId: SACRIFICIAL_PROFILE.id, rngStream: SACRIFICIAL_PROFILE.rngStream,
        rngAlgorithm: SACRIFICIAL_PROFILE.rngAlgorithm,
        matchesGcsimRandomSequence: SACRIFICIAL_PROFILE.matchesGcsimRandomSequence,
        cooldownClock: SACRIFICIAL_PROFILE.cooldownClock,
      } } : {}),
      ...(randomWeaponProcs ? {weaponProcPolicy: WEAPON_PROC_RANDOM_PROFILE} : {}),
      criticalPolicy: request.options.execution?.criticalSampling ?? request.options.critMode ?? "average",
      ...batchStatistics(values),
      elapsedMilliseconds: performance.now() - started,
      warnings: [
        ...(randomWeaponProcs ? ["武器随机追击按来源顺序处理实际普通伤害回调、门禁与抽样，使用独立 independent-weapon-proc-v1 流；吃虎鱼刀成功条件为 roll ≤ 0.5，试作古华与霜葬为严格小于概率。霜葬的冰／冻结倍率取触发目标实际状态，同次范围追击共用。采用无角色卡肉的来源参考时钟，不与 gcsim 同种子序列等同；当前完整检查点未覆盖这条随机流，本批次不认证随机稳态。"] : []),
        ...(config.sacrificialModel ? ["祭礼按真实战技伤害回调与串行充能队列执行，使用独立 sacrificial-v1 随机流；成功可能改变后续战技、产球与能量。采用无角色卡肉的固定来源参考时钟，不与 gcsim 同 seed 序列等同，也不认证随机稳态。"] : []),
        ...(config.favoniusModel ? ["西风被动按实际暴击、在场和冷却产生微粒，使用独立favonius-v1随机流；仅覆盖无角色卡肉的来源参考时钟，不与gcsim同seed序列等同，也不认证随机稳态。"] : []),
        ...(config.normalHitEnergyModel ? ["已启用普通命中随机回能，使用独立 normal-hit-energy-v1 子流；概率与共享间隔按来源假定执行，不与 gcsim 同种子轨迹等同。暴击模式不关闭该随机回能；本批次没有执行分布预热或证明随机稳态。"] : []),
        ...(appliedProfile?.baselineRuntimeOptions ? [`执行延迟请求表按参考种子 ${appliedProfile.baselineRuntimeOptions.randomSeed} 生成一次；各次迭代共用该表，不随迭代种子或随机结果改写输入。`] : []),
        request.options.execution?.criticalSampling === "seeded-random-v1"
          ? "随机样本覆盖粒子、已建模空间随机和独立逐命中暴击；尚未实现的暴击触发反馈不会被假定存在。"
          : "本次暴击使用所选非暴击/全暴击/解析期望模式；可另选带种子随机暴击。",
        "分位数描述单次模拟的离散程度；均值置信区间是至少 30 次采样时的正态近似，两者含义不同。",
        "result 是第一轮完整轨迹；summary 汇总全部轮次。"
      ]
    };
    scope.postMessage({ type: "result", result, summary, samples: values, ...(appliedProfile === undefined ? {} : {appliedProfile}) });
  } catch (error) {
    scope.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
