import { parseSimConfig, type EnemyElementalResistances, type EnemyProfile, type EnemyTargetProfile, type SimConfig, type TargetHealthModel } from "@genshin-dps-lab/schemas";
import "./target-controls.css";

export interface TargetControlsApi {
  getConfig(): SimConfig;
  setConfig(config: SimConfig): void;
}

const elements = ["pyro", "hydro", "electro", "cryo", "anemo", "geo", "dendro", "physical"] as const;
const particleElements = [["neutral", "无元素"], ["pyro", "火"], ["hydro", "水"], ["electro", "雷"], ["cryo", "冰"], ["anemo", "风"], ["geo", "岩"], ["dendro", "草"]] as const;
const auraElements = ["pyro", "hydro", "electro", "cryo", "dendro"] as const;
const labels: Record<string, string> = { pyro: "火", hydro: "水", electro: "雷", cryo: "冰", anemo: "风", geo: "岩", dendro: "草", physical: "物理" };
const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const table = (scalar: number): EnemyElementalResistances => Object.fromEntries(elements.map((element) => [element, scalar])) as unknown as EnemyElementalResistances;
const field = (label: string, path: string, value: number | string | undefined, attributes = ""): string => `<label>${esc(label)}<input data-target-path="${esc(path)}" type="number" ${attributes.includes("step=") ? "" : 'step="any"'} value="${value === undefined || typeof value === "number" && !Number.isFinite(value) ? "" : esc(value)}" ${attributes}></label>`;
const textField = (label: string, path: string, value: string): string => `<label>${esc(label)}<input data-target-path="${esc(path)}" type="text" value="${esc(value)}"></label>`;
const selectField = (label: string, path: string, value: string, options: readonly (readonly [string, string])[]): string => `<label>${esc(label)}<select data-target-path="${esc(path)}">${options.map(([key, title]) => `<option value="${esc(key)}" ${key === value ? "selected" : ""}>${esc(title)}</option>`).join("")}</select></label>`;

const healthField = (label: string, path: string, value: number, attributes = ""): string => field(label, path, value, `${attributes} required`).replace("data-target-path", "data-target-health-path");
const healthText = (label: string, path: string, value: string): string => textField(label, path, value).replace("data-target-path", "data-target-health-path");
const healthSelect = (label: string, path: string, value: string, options: readonly (readonly [string, string])[]): string => selectField(label, path, value, options).replace("data-target-path", "data-target-health-path");

/** Find explicit references without changing any hit, phase, or movement. */
function targetReferences(config: SimConfig, targetId: string): string[] {
  const references: string[] = [];
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) { value.forEach((entry, index) => visit(entry, `${path}[${index}]`)); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (key === "targetId" && entry === targetId) references.push(next);
      else visit(entry, next);
    }
  };
  visit(config, "");
  return references;
}

/** Editor for the existing enemy schema. Saving changes no target references. */
export function renderTargetControls(root: HTMLElement, api: TargetControlsApi): void {
  let draft: EnemyProfile = structuredClone(api.getConfig().enemy);
  let healthDraft: TargetHealthModel | undefined = structuredClone(api.getConfig().targetHealthModel);
  let notice = "编辑后点击保存；数值为自定义情景输入，不代表已核实的敌人资料。";
  const targets = (): EnemyTargetProfile[] => draft.targets ?? [{ id: "enemy-0", name: "默认目标" }];
  const materialize = (): EnemyTargetProfile[] => draft.targets ??= targets();
  const merged = (): SimConfig => {
    const next = { ...api.getConfig(), enemy: structuredClone(draft) };
    if (healthDraft === undefined) delete next.targetHealthModel;
    else next.targetHealthModel = structuredClone(healthDraft);
    return next;
  };
  const currentAura = (): string => api.getConfig().reactionEngine?.mode ?? "未启用附着引擎";
  const setStatus = (message: string): void => { notice = message; root.querySelector<HTMLElement>("[data-target-status]")!.textContent = message; };
  const targetOptions = (): [string, string][] => targets().map((target) => [target.id, `${target.name} · ${target.id}`]);
  const resistanceControls = (target: EnemyTargetProfile | null, index: number): string => {
    const prefix = target ? `targets.${index}.` : "";
    const source = target ?? draft;
    const mode = source.resistances ? "elements" : target && target.resistance === undefined ? "inherit" : "scalar";
    const choices = [...(target ? [["inherit", "继承共享抗性"]] : []), ["scalar", "全部元素相同"], ["elements", "分别设置八种抗性"]];
    return `<label>抗性设置<select data-resistance-mode="${index}">${choices.map(([key, title]) => `<option value="${key}" ${mode === key ? "selected" : ""}>${title}</option>`).join("")}</select></label>${mode === "scalar" ? field("全元素抗性（小数，0.1＝10%）", `${prefix}resistance`, source.resistance) : mode === "elements" ? elements.map((element) => field(`${labels[element]}抗性（小数）`, `${prefix}resistances.${element}`, source.resistances![element])).join("") : "<p>使用上方共享抗性；修改共享值会影响此目标。</p>"}`;
  };
  const dropFields = (drop: { id: string; element: string; kind: string; count: number; travelFrames: number; sourceRef: string }, path: string): string =>
    `${healthText("掉落规则 ID", `${path}.id`, drop.id)}${healthSelect("掉落元素", `${path}.element`, drop.element, particleElements)}${healthSelect("能量类型", `${path}.kind`, drop.kind, [["particle", "微粒"], ["orb", "晶球"]])}${healthField("数量（正整数）", `${path}.count`, drop.count, 'min="1" step="1"')}${healthField("飞行帧数", `${path}.travelFrames`, drop.travelFrames, 'min="0" step="1"')}${healthText("掉落依据／来源", `${path}.sourceRef`, drop.sourceRef)}`;
  const healthControls = (): string => `<details data-target-health-controls ${healthDraft ? "open" : ""}><summary>目标生命与显式掉落规则</summary><label><input type="checkbox" data-target-health-enabled ${healthDraft ? "checked" : ""}>启用声明的目标生命／外部掉落情景</label><p>自行填写生命值、数量、时点及来源。没有内置敌人生命或掉球表，空白字段不会补值。实际伤害立即扣除目标剩余生命，跨过阈值和击杀规则各触发一次；已死亡目标的后续攻击记为未命中。伤害与 DPS 保留实际结算的原始伤害，另列有效扣血和过量伤害。</p>${healthDraft ? `<div class="target-list">${targets().map(target => {
      const index = healthDraft!.targets.findIndex(entry => entry.targetId === target.id);
      const entry = healthDraft!.targets[index];
      return `<section data-target-health-target="${esc(target.id)}"><h3>${esc(target.name)} · ${esc(target.id)}</h3><label><input type="checkbox" data-target-health-toggle="${esc(target.id)}" ${entry ? "checked" : ""}>为此目标设置生命值</label>${entry ? `<div class="target-fields">${healthField("生命上限", `targets.${index}.maxHp`, entry.maxHp, 'min="0"')}${healthField("初始生命", `targets.${index}.initialHp`, entry.initialHp, 'min="0"')}${healthText("生命值依据／来源", `targets.${index}.sourceRef`, entry.sourceRef)}</div><p>阈值以生命上限的比例填写，例如 0.5 表示 50%。一次伤害可同时跨过多个阈值；每条规则只掉落一次。</p>${entry.drops.map((drop, dropIndex) => {
        const path = `targets.${index}.drops.${dropIndex}`;
        return `<section data-target-health-drop="${esc(drop.id)}"><div class="target-fields"><label>掉落条件<select data-target-health-trigger="${index}:${dropIndex}"><option value="hp-threshold" ${drop.trigger.kind === "hp-threshold" ? "selected" : ""}>生命跨过阈值</option><option value="defeat" ${drop.trigger.kind === "defeat" ? "selected" : ""}>目标被击败</option></select></label>${drop.trigger.kind === "hp-threshold" ? healthField("生命阈值比例", `${path}.trigger.hpRatio`, drop.trigger.hpRatio, 'min="0" max="1"') : ""}${dropFields(drop, path)}</div><button type="button" data-target-health-delete-drop="${index}:${dropIndex}">删除掉落规则</button></section>`;
      }).join("")}<button type="button" data-target-health-add-drop="${index}">添加阈值／击杀掉落</button>` : "<p>此目标继续使用未声明生命的既有行为。</p>"}</section>`;
    }).join("")}</div><h3>外部能量掉落</h3><p>时点为本次连续模拟的绝对帧；预热和观察窗口不会重复或重置此掉落。它不依赖角色施放动作或目标受击。</p>${healthDraft.externalDrops.map((drop, index) => `<section data-target-health-external="${esc(drop.id)}"><div class="target-fields">${healthField("生成绝对帧", `externalDrops.${index}.frame`, drop.frame, 'min="0" step="1"')}${dropFields(drop, `externalDrops.${index}`)}</div><button type="button" data-target-health-delete-external="${index}">删除外部掉落</button></section>`).join("")}<button type="button" data-target-health-add-external>添加外部掉落</button>` : ""}<p>这些是声明的场景规则，不代表固定来源程序逐次攻击的旧生命产球顺序。敌方元素护盾与破盾量仍未支持，伤害免疫也不等于护盾模拟。</p></details>`;
  const draw = (): void => {
    const durationFrames = Math.round(api.getConfig().duration * 60);
    root.classList.add("target-controls");
    root.innerHTML = `<article class="card"><h2>敌人与目标</h2><p>共享参数作为默认值；各目标的空白覆盖项继承共享值。抗性采用小数；防御调整沿用引擎约定：负数减防，例如 −0.3 表示降低 30%。</p>
      <details open><summary>共享敌人参数</summary><div class="target-fields">${field("等级", "level", draft.level, 'min="1" max="200" step="1" required')}${field("防御调整（有符号小数）", "defReduction", draft.defReduction, "required")}${field("冻结抗性（0 正常，1 免疫冻结耐久）", "freezeResistance", draft.freezeResistance, 'min="0" max="1" placeholder="默认 0"')}${resistanceControls(null, -1)}</div></details>
      <p>命中仍按现有技能的 targeting 或几何范围判定。添加目标不会自动把单目标技能改成群体技能。enemy-0 是无显式目标命中的兼容目标，不能删除。</p>
      <div class="target-list">${targets().map((target, index) => `<details open><summary>${esc(target.name)} · ${esc(target.id)}</summary><div class="target-fields">${textField("名称", `targets.${index}.name`, target.name)}${field("等级覆盖", `targets.${index}.level`, target.level, `min="1" max="200" step="1" placeholder="继承 ${draft.level}"`)}${field("防御调整覆盖", `targets.${index}.defReduction`, target.defReduction, `placeholder="继承 ${draft.defReduction}"`)}${field("冻结抗性覆盖", `targets.${index}.freezeResistance`, target.freezeResistance, `min="0" max="1" placeholder="继承 ${draft.freezeResistance ?? 0}"`)}${resistanceControls(target, index)}</div>
        <h3>初始附着</h3><p>当前引擎：${esc(currentAura())}。继承与明确无附着是两种不同设置。初始量为名义 U，由现有附着引擎处理。</p><label>附着设置<select data-aura-mode="${index}" ${!api.getConfig().reactionEngine ? "disabled" : ""}><option value="inherit" ${target.initialAura === undefined ? "selected" : ""}>继承情景初始附着</option><option value="custom" ${target.initialAura !== undefined ? "selected" : ""}>此目标自定义（全部留空＝无附着）</option></select></label>${target.initialAura !== undefined ? `<div class="target-fields">${auraElements.map((element) => `<label>${labels[element]}元素 U<input type="number" min="0" max="20" step="any" data-aura-target="${index}" data-aura-element="${element}" value="${target.initialAura!.find((aura) => aura.element === element)?.gaugeUnits ?? ""}" placeholder="无"></label>`).join("")}</div>` : ""}
        <h3>位置与命中体积</h3><label><input type="checkbox" data-position-toggle="${index}" ${target.position ? "checked" : ""}>设置世界坐标位置</label>${target.position ? `<div class="target-fields">${field("X 坐标", `targets.${index}.position.x`, target.position.x, "required")}${field("Y 坐标", `targets.${index}.position.y`, target.position.y, "required")}</div>` : ""}<div class="target-fields">${field("命中半径", `targets.${index}.hitboxRadius`, target.hitboxRadius, 'min="0" max="1000" placeholder="默认 0"')}</div>
        <button type="button" data-delete-target="${index}" ${target.id === "enemy-0" ? "disabled" : ""}>删除此目标</button></details>`).join("")}</div>
      <button type="button" data-add-target ${targets().length >= 32 ? "disabled" : ""}>添加自定义目标</button>
      <details ${draft.targetPhases?.length ? "open" : ""}><summary>目标阶段：伤害免疫、附着与命中触发</summary><p>60 FPS，区间为 [开始帧, 结束帧)，当前窗口 ${durationFrames} 帧。同一目标按开始帧排列且不重叠。每次命中的显式效果策略优先于阶段；脚本 miss 不会变成命中。</p><div class="target-list">${(draft.targetPhases ?? []).map((phase, index) => `<section><div class="target-fields">${textField("阶段名称", `targetPhases.${index}.label`, phase.label)}${selectField("目标", `targetPhases.${index}.targetId`, phase.targetId, targetOptions())}${field("开始帧（包含）", `targetPhases.${index}.startFrame`, phase.startFrame, `min="0" max="${durationFrames}" step="1" required`)}${field("结束帧（不包含）", `targetPhases.${index}.endFrame`, phase.endFrame, `min="1" max="${durationFrames}" step="1" required`)}${selectField("伤害", `targetPhases.${index}.effects.damage`, phase.effects.damage, [["normal", "正常"], ["immune", "免疫伤害"]])}${selectField("元素附着", `targetPhases.${index}.effects.aura`, phase.effects.aura, [["normal", "允许"], ["blocked", "阻止"]])}${selectField("命中触发", `targetPhases.${index}.effects.hitConfirm`, phase.effects.hitConfirm, [["normal", "允许"], ["blocked", "阻止"]])}${textField("情景依据／原因", `targetPhases.${index}.reason`, phase.reason)}</div><button type="button" data-delete-phase="${index}">删除阶段</button></section>`).join("")}</div><button type="button" data-add-phase>添加阶段</button></details>
      <details ${draft.targetMotions?.length ? "open" : ""}><summary>目标移动：已支持的线性运动</summary><p>目标须先有初始位置。运动区间内线性插值，空档保持上一位置，到结束帧精确到达终点。这里只配置现有运动模型，不推断敌人 AI 或无敌机制。</p><div class="target-list">${(draft.targetMotions ?? []).map((motion, index) => `<section><div class="target-fields">${textField("运动名称", `targetMotions.${index}.label`, motion.label)}${selectField("目标", `targetMotions.${index}.targetId`, motion.targetId, targetOptions())}${field("开始帧", `targetMotions.${index}.startFrame`, motion.startFrame, `min="0" max="${durationFrames}" step="1" required`)}${field("结束帧", `targetMotions.${index}.endFrame`, motion.endFrame, `min="1" max="${durationFrames}" step="1" required`)}${field("终点 X", `targetMotions.${index}.endPosition.x`, motion.endPosition.x, "required")}${field("终点 Y", `targetMotions.${index}.endPosition.y`, motion.endPosition.y, "required")}</div><button type="button" data-delete-motion="${index}">删除运动</button></section>`).join("")}</div><button type="button" data-add-motion>添加线性运动</button></details>
      ${healthControls()}
      <div class="target-actions"><button type="button" class="primary" data-save-targets>保存敌人配置</button><button type="button" data-reset-targets>重新载入当前配置</button></div><p data-target-status role="status">${esc(notice)}</p></article>`;
  };
  root.onchange = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
    if (input.hasAttribute("data-target-health-enabled") && input instanceof HTMLInputElement) {
      healthDraft = input.checked ? { mode: "declared-target-health-v1", targets: [], externalDrops: [] } : undefined;
      draw(); return;
    }
    if (input.dataset.targetHealthToggle !== undefined && input instanceof HTMLInputElement) {
      const targetId = input.dataset.targetHealthToggle;
      if (input.checked) healthDraft!.targets.push({ targetId, maxHp: NaN, initialHp: NaN, sourceRef: "", drops: [] });
      else healthDraft!.targets = healthDraft!.targets.filter(entry => entry.targetId !== targetId);
      draw(); return;
    }
    if (input.dataset.targetHealthTrigger !== undefined) {
      const [targetIndex, dropIndex] = input.dataset.targetHealthTrigger.split(":").map(Number);
      healthDraft!.targets[targetIndex!]!.drops[dropIndex!]!.trigger = input.value === "defeat" ? { kind: "defeat" } : { kind: "hp-threshold", hpRatio: NaN };
      draw(); return;
    }
    if (input.dataset.targetHealthPath) {
      const path = input.dataset.targetHealthPath.split(".");
      let object = healthDraft as unknown as Record<string, unknown>;
      for (const key of path.slice(0, -1)) object = object[key] as Record<string, unknown>;
      object[path.at(-1)!] = input instanceof HTMLInputElement && input.type === "number" ? input.value === "" ? NaN : Number(input.value) : input.value;
      return;
    }
    if (input.dataset.targetPath) {
      const path = input.dataset.targetPath.split(".");
      if (path[0] === "targets") materialize();
      let object = draft as unknown as Record<string, unknown>;
      for (const key of path.slice(0, -1)) object = object[key] as Record<string, unknown>;
      const key = path.at(-1)!;
      if (input instanceof HTMLInputElement && input.type === "number") {
        if (input.value === "" && !input.required) delete object[key];
        else object[key] = input.value === "" ? NaN : Number(input.value);
      } else object[key] = input.value;
      return;
    }
    if (input.dataset.resistanceMode !== undefined) {
      const index = Number(input.dataset.resistanceMode);
      const source = (index === -1 ? draft : materialize()[index]!) as { resistance?: number; resistances?: EnemyElementalResistances };
      const resolved = source.resistances ?? (source.resistance !== undefined ? table(source.resistance) : draft.resistances ?? table(draft.resistance));
      if (input.value === "elements") { source.resistances = structuredClone(resolved); if (index !== -1) delete source.resistance; }
      else if (input.value === "scalar") { source.resistance = source.resistance ?? resolved.physical; delete source.resistances; }
      else { delete source.resistance; delete source.resistances; }
      draw();
    } else if (input.dataset.auraMode !== undefined) {
      const target = materialize()[Number(input.dataset.auraMode)]!;
      if (input.value === "inherit") delete target.initialAura;
      else target.initialAura = structuredClone(api.getConfig().reactionEngine?.initialAura ?? []);
      draw();
    } else if (input.dataset.auraTarget !== undefined) {
      const target = materialize()[Number(input.dataset.auraTarget)]!;
      const element = input.dataset.auraElement as typeof auraElements[number];
      const prior = target.initialAura!.findIndex((aura) => aura.element === element);
      if (input.value === "" || Number(input.value) === 0) { if (prior >= 0) target.initialAura!.splice(prior, 1); }
      else if (prior >= 0) target.initialAura![prior]!.gaugeUnits = Number(input.value);
      else target.initialAura!.push({ element, gaugeUnits: Number(input.value) });
    } else if (input.dataset.positionToggle !== undefined && input instanceof HTMLInputElement) {
      const target = materialize()[Number(input.dataset.positionToggle)]!;
      if (input.checked) target.position = { x: 0, y: 0 };
      else delete target.position;
      draw();
    }
  };
  root.onclick = (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!button || !root.contains(button)) return;
    if (button.hasAttribute("data-save-targets")) {
      try {
        const next = merged();
        parseSimConfig(next);
        api.setConfig(next);
        setStatus("敌人配置已验证并保存。请到模拟结果重新运行；现有技能目标引用保持原样。");
      } catch (error) { setStatus(`未保存：${error instanceof Error ? error.message : String(error)}`); }
    } else if (button.hasAttribute("data-reset-targets")) {
      draft = structuredClone(api.getConfig().enemy); healthDraft = structuredClone(api.getConfig().targetHealthModel); notice = "已重新载入当前配置。"; draw();
    } else if (button.dataset.targetHealthAddDrop !== undefined || button.hasAttribute("data-target-health-add-external")) {
      const targetIndex = button.dataset.targetHealthAddDrop;
      const existing = [...healthDraft!.targets.flatMap(entry => entry.drops), ...healthDraft!.externalDrops];
      let index = 1;
      while (existing.some(entry => entry.id === `declared-drop-${index}`)) index++;
      const common = { id: `declared-drop-${index}`, element: "neutral" as const, kind: "particle" as const, count: NaN, travelFrames: NaN, sourceRef: "" };
      if (targetIndex === undefined) healthDraft!.externalDrops.push({ ...common, frame: NaN });
      else healthDraft!.targets[Number(targetIndex)]!.drops.push({ ...common, trigger: { kind: "hp-threshold", hpRatio: NaN } });
      draw();
    } else if (button.dataset.targetHealthDeleteDrop !== undefined) {
      const [targetIndex, dropIndex] = button.dataset.targetHealthDeleteDrop.split(":").map(Number);
      healthDraft!.targets[targetIndex!]!.drops.splice(dropIndex!, 1); draw();
    } else if (button.dataset.targetHealthDeleteExternal !== undefined) {
      healthDraft!.externalDrops.splice(Number(button.dataset.targetHealthDeleteExternal), 1); draw();
    } else if (button.hasAttribute("data-add-target")) {
      const list = materialize();
      let index = 1;
      while (list.some((target) => target.id === `enemy-${index}`)) index++;
      list.push({ id: `enemy-${index}`, name: `自定义目标 ${index + 1}` });
      notice = "已添加草稿目标，参数继承共享值；技能目标不会自动修改。"; draw();
    } else if (button.dataset.deleteTarget !== undefined) {
      const index = Number(button.dataset.deleteTarget);
      const target = targets()[index]!;
      const references = targetReferences(merged(), target.id);
      if (target.id === "enemy-0") { setStatus("enemy-0 是默认命中目标，不能删除。"); return; }
      if (references.length) { setStatus(`无法删除 ${target.id}：仍被 ${references.join("、")} 引用。请先调整对应命中目标、阶段、运动或生命掉落声明；本编辑器不会重设这些引用。`); return; }
      materialize().splice(index, 1); draw();
    } else if (button.hasAttribute("data-add-phase") || button.hasAttribute("data-add-motion")) {
      const isMotion = button.hasAttribute("data-add-motion");
      const target = isMotion ? targets().find((entry) => entry.position) : targets()[0];
      if (!target) { setStatus("请先为一个目标设置初始位置，再添加运动。"); return; }
      const existing = isMotion ? draft.targetMotions ?? [] : draft.targetPhases ?? [];
      const startFrame = Math.max(0, ...existing.filter((entry) => entry.targetId === target.id).map((entry) => entry.endFrame));
      const endFrame = Math.min(startFrame + 60, Math.round(api.getConfig().duration * 60));
      if (endFrame <= startFrame) { setStatus("该目标的已有区间已到模拟窗口末尾；请先编辑区间或延长模拟窗口。"); return; }
      let index = 1;
      const prefix = isMotion ? "custom-motion" : "custom-phase";
      while (existing.some((entry) => entry.id === `${prefix}-${index}`)) index++;
      const common = { id: `${prefix}-${index}`, label: `${isMotion ? "自定义运动" : "自定义免疫阶段"} ${index}`, targetId: target.id, startFrame, endFrame };
      if (isMotion) (draft.targetMotions ??= []).push({ ...common, endPosition: structuredClone(target.position!) });
      else (draft.targetPhases ??= []).push({ ...common, reason: "用户自定义情景", effects: { damage: "immune", aura: "normal", hitConfirm: "normal" } });
      draw();
    } else if (button.dataset.deletePhase !== undefined) { draft.targetPhases!.splice(Number(button.dataset.deletePhase), 1); draw(); }
    else if (button.dataset.deleteMotion !== undefined) { draft.targetMotions!.splice(Number(button.dataset.deleteMotion), 1); draw(); }
  };
  draw();
}
