import type {
  SourceHostEventListenerCall, SourceHostEventProducer, SourceHostEventQueuedAttack,
} from "./source-host-event-types";
import type { SourceHostTaskLifecycle } from "./source-host-task-lifecycle";

const listenerSite = "chiori.c4.enemy-damage";
const expirySite = "chiori.c4.kinu.expiry-task";
const tickSite = "chiori.c4.kinu.tick-task";
const attackSite = "chiori.c4.kinu.attack-task";

/** One C4-created Kinu, including its native expiry and any already scheduled no-op tick. */
export function analyzeSourceHostEventTaskTree(input: {
  call: SourceHostEventListenerCall;
  producers: SourceHostEventProducer[];
  taskLifecycle: SourceHostTaskLifecycle | undefined;
  observationEndFrame: number | undefined;
}): { reasons: string[]; attacks: SourceHostEventQueuedAttack[]; closed: boolean } {
  const { call, producers, taskLifecycle, observationEndFrame } = input;
  const reasons: string[] = [];
  const roots = producers.filter(row => row.parentProducerId === undefined);
  const expectedRoots = call.entryFacts?.[`${listenerSite}.producer-count`];
  if (expectedRoots !== 0 && expectedRoots !== 2)
    reasons.push("千织 C4 缺少实际分支的初始任务数读数。");
  if (roots.length !== expectedRoots
    || expectedRoots === 0 && producers.length !== 0
    || expectedRoots === 2 && (roots.filter(row => row.siteId === expirySite).length !== 1
      || roots.filter(row => row.siteId === tickSite).length !== 1))
    reasons.push("千织 C4 的初始过期任务与首次检查任务不符合实际生成分支。");
  if (call.queuedAttacks.length)
    reasons.push("千织 C4 监听器应由 Kinu 任务发出攻击，出现了未经审阅的直接攻击。");
  if (producers.length && !taskLifecycle)
    reasons.push("千织 C4 缺少 Kinu 任务的原生生命周期。");

  for (const producer of producers) {
    const parent = producer.parentProducerId === undefined ? undefined
      : producers.find(row => row.id === producer.parentProducerId);
    const children = producers.filter(row => row.parentProducerId === producer.id);
    const isRoot = producer.parentProducerId === undefined;
    const expectedDelay = isRoot ? producer.siteId === expirySite ? 180 : producer.siteId === tickSite ? 36 : undefined
      : producer.siteId === tickSite ? 30 : producer.siteId === attackSite ? 5 : undefined;
    if (producer.listenerCallId !== call.id || expectedDelay === undefined
      || isRoot && producer.queuedFrame !== call.startedFrame
      || !isRoot && (!parent || parent.siteId !== tickSite || parent.state !== "completed"
        || parent.runFrame !== producer.queuedFrame))
      reasons.push(`Kinu 任务 #${producer.id} 的监听器、父任务、来源点或登记帧不符。`);

    const matchingTasks = taskLifecycle?.tasks.filter(row => row.id === producer.taskId) ?? [];
    const task = matchingTasks.length === 1 ? matchingTasks[0] : undefined;
    const queue = task === undefined ? undefined : taskLifecycle?.queues.find(row => row.id === task.queueId);
    if (!task || !queue || queue.kind !== "core" || task.queuedFrame !== producer.queuedFrame
      || task.dueClock - task.queuedClock !== expectedDelay || task.state !== producer.state
      || task.runFrame !== producer.runFrame || task.completedFrame !== producer.completedFrame
      || !isRoot && task.parentTaskId !== parent?.taskId)
      reasons.push(`Kinu 任务 #${producer.id} 缺少相同编号、父任务与准确延迟的原生核心队列回执。`);

    if (producer.state === "pending") {
      if (producer.runFrame !== undefined || producer.completedFrame !== undefined
        || producer.queuedAttacks.length || children.length || producer.entryFacts !== undefined)
        reasons.push(`待执行 Kinu 任务 #${producer.id} 却已有执行结果或子任务。`);
      reasons.push(`Kinu 任务 #${producer.id} 仍待执行；已命中也不能跳过剩余检查或过期任务。`);
      continue;
    }
    if (producer.runFrame === undefined || producer.completedFrame !== producer.runFrame
      || expectedDelay === undefined || producer.runFrame !== producer.queuedFrame + expectedDelay
      || observationEndFrame === undefined || producer.completedFrame > observationEndFrame)
      reasons.push(`Kinu 任务 #${producer.id} 的实际执行帧或观察终点不符。`);

    const childCount = producer.entryFacts?.[`${producer.siteId}.child-count`];
    const attackCount = producer.entryFacts?.[`${producer.siteId}.attack-count`];
    const branchKnown = producer.siteId === expirySite ? childCount === 0 && attackCount === 0
      : producer.siteId === tickSite ? (childCount === 0 || childCount === 2) && attackCount === 0
        : producer.siteId === attackSite ? childCount === 0 && (attackCount === 0 || attackCount === 1) : false;
    if (!branchKnown || children.length !== childCount || producer.queuedAttacks.length !== attackCount)
      reasons.push(`Kinu 任务 #${producer.id} 的实际分支、子任务数或攻击数不完整。`);
    if (producer.siteId === tickSite && childCount === 2
      && (children.filter(row => row.siteId === tickSite).length !== 1
        || children.filter(row => row.siteId === attackSite).length !== 1))
      reasons.push(`存活 Kinu 检查任务 #${producer.id} 缺少唯一的攻击尝试与下一次检查。`);
    for (const attack of producer.queuedAttacks) {
      if (producer.siteId !== attackSite || attack.frame !== producer.runFrame)
        reasons.push(`Kinu 攻击队列 #${attack.queueId} 不在唯一攻击尝试任务的执行帧。`);
    }
  }
  return { reasons, attacks: producers.flatMap(row => row.queuedAttacks), closed: reasons.length === 0 };
}
