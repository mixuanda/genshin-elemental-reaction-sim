import { replayArtifactUtility, type ArtifactUtilityElement, type ArtifactUtilityEvent, type ArtifactUtilityScenario, type ArtifactUtilitySetId } from "../../../packages/sim-core/src/artifact-utility-runtime";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const labels: Record<ArtifactUtilitySetId, string> = {
  10004: "奇迹", 10010: "冒险家", 10011: "幸运儿", 10013: "游医",
  15009: "祭火之人", 15010: "祭水之人", 15011: "祭雷之人", 15013: "祭冰之人",
};
const elements: ArtifactUtilityElement[] = ["pyro", "hydro", "electro", "cryo", "anemo", "geo", "dendro"];
const eventLabels: Record<ArtifactUtilityEvent["kind"], string> = {
  "elemental-hit": "无护盾实际元素受击", "tiny-resistance-observed": "奇迹抗性窗口观察", "incoming-heal": "实际治疗", "burst-cast": "实际爆发施放", "chest-open": "开启宝箱",
  "chest-heal-tick": "宝箱窗口实际治疗段", "mora-pickup": "拾取摩拉", "elemental-status": "实际元素附着（仅显示证据边界）",
};
const numeric = (root: HTMLElement, name: string): number => {
  const field = root.querySelector<HTMLInputElement>(`[data-artifact-utility-field="${name}"]`);
  if (!field || !field.value.trim() || !field.checkValidity()) throw new Error(`${name}须填写有效数值。`);
  return field.valueAsNumber;
};
const input = (key: string, label: string, value: number, extra = ""): string =>
  `<label>${label}<input type="number" step="any" required ${extra} data-artifact-utility-field="${key}" value="${value}"></label>`;
const download = (value: unknown): void => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "artifact-utility-calculation.json"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Mount in a calculator panel. The exported JSON is the complete replay input plus AST output. */
export function renderArtifactUtilityCalculator(root: HTMLElement, initial?: ArtifactUtilityScenario): void {
  let scenario: ArtifactUtilityScenario = initial ? structuredClone(initial) : { incomingDamageMode: "unshielded-hp-only", setId: 10004, pieces: 4, maxHp: 10000, initialHp: 5000, events: [] };
  let syntheticExample = initial === undefined;
  let kind: ArtifactUtilityEvent["kind"] = "elemental-hit";
  const eventFields = (): string => {
    const frame = input("frame", "实际事件帧（60帧/秒）", scenario.events.at(-1)?.frame ?? 0, 'min="0" step="1"');
    const element = `<label>实际元素<select data-artifact-utility-element>${elements.map(item => `<option value="${item}">${item}</option>`).join("")}</select></label>`;
    switch (kind) {
      case "elemental-hit": return frame + element + input("damageBeforeResistance", "无护盾：防御后、抗性前伤害", 1000, 'min="0"') + input("baseResistance", "角色原有该元素抗性（小数）", 0);
      case "tiny-resistance-observed": return frame + element + `<label>观察到的抗性窗口结束帧（不含）<input type="number" min="1" step="1" required data-artifact-utility-field="expiresFrame"></label><label>观察到的冷却结束帧（可留空）<input type="number" min="0" step="1" data-artifact-utility-field="cooldownExpiresFrame"></label>`;
      case "incoming-heal": return frame + input("baseHealing", "基础治疗量", 1000, 'min="0"') + input("healingBonus", "治疗来源加成（小数）", 0) + input("otherIncomingHealingBonus", "其他受治疗加成（小数）", 0);
      case "burst-cast": return frame + input("healingBonus", "本次游医自疗来源加成（显式输入）", 0) + input("otherIncomingHealingBonus", "其他受治疗加成（小数）", 0);
      case "chest-heal-tick": return frame + input("fractionOfMaxHp", "该次实际治疗段占最大生命比例", 0.1, 'min="0" max="0.3"');
      case "elemental-status": return frame + element + input("baseDurationFrames", "外部给出的原附着持续帧", 600, 'min="0"');
      default: return frame;
    }
  };
  const parseNewEvent = (): ArtifactUtilityEvent => {
    const frame = numeric(root, "frame");
    if (!Number.isInteger(frame) || frame < 0) throw new Error("事件帧必须是非负整数。");
    const element = root.querySelector<HTMLSelectElement>("[data-artifact-utility-element]")?.value as ArtifactUtilityElement;
    switch (kind) {
      case "elemental-hit": return { kind, frame, element, damageBeforeResistance: numeric(root, "damageBeforeResistance"), baseResistance: numeric(root, "baseResistance") };
      case "tiny-resistance-observed": {
        const cooldown = root.querySelector<HTMLInputElement>('[data-artifact-utility-field="cooldownExpiresFrame"]')!;
        if (cooldown.value.trim() && !cooldown.checkValidity()) throw new Error("观察到的冷却结束帧无效。");
        return { kind, frame, element, expiresFrame: numeric(root, "expiresFrame"), ...(cooldown.value.trim() ? { cooldownExpiresFrame: cooldown.valueAsNumber } : {}) };
      }
      case "incoming-heal": return { kind, frame, baseHealing: numeric(root, "baseHealing"), healingBonus: numeric(root, "healingBonus"), otherIncomingHealingBonus: numeric(root, "otherIncomingHealingBonus") };
      case "burst-cast": return { kind, frame, healingBonus: numeric(root, "healingBonus"), otherIncomingHealingBonus: numeric(root, "otherIncomingHealingBonus") };
      case "chest-open": case "mora-pickup": return { kind, frame };
      case "chest-heal-tick": return { kind, frame, fractionOfMaxHp: numeric(root, "fractionOfMaxHp") };
      case "elemental-status": return { kind, frame, element, baseDurationFrames: numeric(root, "baseDurationFrames") };
    }
  };
  const draw = (): void => {
    root.innerHTML = `<article class="card"><h2>低星圣遗物 · 生存与探索事件</h2><p>对已装备的一名角色逐事件重放。受击情景明确为<strong>无护盾，抗性后伤害直接扣除生命</strong>；有护盾时请使用来源宿主的护盾计算。奇迹四件套只读取已观察到的抗性窗口，不从受击推断激活或冷却。开箱与摩拉为探索事件，不计入伤害输出。祭冠附着时长缺独立执行来源，保持阻塞。</p>
      ${syntheticExample ? "<p>初始 10000 最大生命、5000 起始生命与奇迹四件套是可编辑的合成示例；此处独立输入，不会自动读取上方角色配装。</p>" : "<p>此处是已导入的独立计算输入，不会自动读取上方角色配装。</p>"}
      <div class="calculator-fields"><label>套装<select data-artifact-utility-set>${Object.entries(labels).map(([id, label]) => `<option value="${id}"${scenario.setId === Number(id) ? " selected" : ""}>${label}</option>`).join("")}</select></label>${input("pieces", "装备件数", scenario.pieces, 'min="0" max="5" step="1"')}${input("maxHp", "最大生命", scenario.maxHp, 'min="1"')}${input("initialHp", "起始生命", scenario.initialHp, 'min="0"')}</div>
      <h3>添加实际事件</h3><label>事件类型<select data-artifact-utility-kind>${Object.entries(eventLabels).map(([id, label]) => `<option value="${id}"${kind === id ? " selected" : ""}>${label}</option>`).join("")}</select></label><div class="calculator-fields" data-artifact-utility-event-fields>${eventFields()}</div><div class="editor-actions"><button type="button" data-artifact-utility-add>添加事件并重放</button><button type="button" data-artifact-utility-export>导出独立计算 JSON</button><label>导入独立计算 JSON<input type="file" accept="application/json,.json" data-artifact-utility-import></label></div>
      <p>宝箱效果只在开箱后5秒窗口内接收明确的治疗分段，单窗口合计至多30%；不推定治疗间隔。所有同帧事件按列表顺序执行。</p>
      <div data-artifact-utility-status role="status"></div><div data-artifact-utility-steps></div></article>`;
    update();
  };
  const update = (): void => {
    const status = root.querySelector<HTMLElement>("[data-artifact-utility-status]")!;
    const host = root.querySelector<HTMLElement>("[data-artifact-utility-steps]")!;
    try {
      const result = replayArtifactUtility(scenario);
      status.textContent = `当前生命 ${result.finalHp} / ${scenario.maxHp}；实际事件 ${result.steps.length} 项。来源状态：固定版本、机制暂定。`;
      host.innerHTML = `<details><summary>固定版本来源</summary><ul>${result.sourceRefs.map(ref => `<li><a href="${esc(ref)}" target="_blank" rel="noopener noreferrer">${esc(ref)}</a></li>`).join("")}</ul></details>` + result.steps.map((step, index) => `<details><summary>${index + 1}. ${esc(eventLabels[step.event.kind])} · ${step.event.frame}f · HP ${step.hpBefore} → ${step.hpAfter}</summary>
        <p>${step.incomingDamage === undefined ? "" : `本次抗性 ${step.resistance}；入伤 ${step.incomingDamage}。`}${step.requestedHealing === undefined ? "" : `请求治疗 ${step.requestedHealing}；实际回复 ${step.actualHealing}。`}${step.statusDurationFrames === undefined ? "" : `状态持续 ${step.statusDurationFrames}f。`}</p>
        <p>${step.notes.map(esc).join("；")}</p>${renderTraceHtml(step.trace)}<pre>${esc(JSON.stringify(step.event, null, 2))}</pre><button type="button" data-artifact-utility-remove="${index}">移除本事件</button></details>`).join("") || "<p>尚未加入实际事件。</p>";
    } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); host.replaceChildren(); }
  };
  root.onchange = event => {
    const target = event.target as HTMLElement;
    if (target.matches("[data-artifact-utility-import]")) {
      const file = (target as HTMLInputElement).files?.[0];
      if (!file) return;
      void file.text().then(content => {
        const value: unknown = JSON.parse(content);
        if (typeof value !== "object" || value === null || !("schemaVersion" in value) || value.schemaVersion !== "artifact-utility-calculator-v2" || !("scenario" in value)) throw new Error("不是受支持的圣遗物独立计算 JSON。");
        const imported = value.scenario as ArtifactUtilityScenario;
        replayArtifactUtility(imported);
        scenario = structuredClone(imported);
        syntheticExample = false;
        draw();
      }).catch(error => { root.querySelector<HTMLElement>("[data-artifact-utility-status]")!.textContent = error instanceof Error ? error.message : String(error); });
      return;
    }
    if (target.matches("[data-artifact-utility-kind]")) { kind = (target as HTMLSelectElement).value as ArtifactUtilityEvent["kind"]; root.querySelector<HTMLElement>("[data-artifact-utility-event-fields]")!.innerHTML = eventFields(); return; }
    try {
      if (target.matches("[data-artifact-utility-set]")) scenario.setId = Number((target as HTMLSelectElement).value) as ArtifactUtilitySetId;
      if (target.matches('[data-artifact-utility-field="pieces"]')) scenario.pieces = numeric(root, "pieces");
      if (target.matches('[data-artifact-utility-field="maxHp"]')) scenario.maxHp = numeric(root, "maxHp");
      if (target.matches('[data-artifact-utility-field="initialHp"]')) scenario.initialHp = numeric(root, "initialHp");
      update();
    } catch (error) { root.querySelector<HTMLElement>("[data-artifact-utility-status]")!.textContent = error instanceof Error ? error.message : String(error); }
  };
  root.onclick = event => {
    const target = event.target as HTMLElement;
    try {
      if (target.closest("[data-artifact-utility-add]")) {
        const candidate = parseNewEvent();
        replayArtifactUtility({ ...scenario, events: [...scenario.events, candidate] });
        scenario.events.push(candidate); update();
      }
      const remove = target.closest<HTMLElement>("[data-artifact-utility-remove]");
      if (remove) { scenario.events.splice(Number(remove.dataset.artifactUtilityRemove), 1); update(); }
      if (target.closest("[data-artifact-utility-export]")) download({ schemaVersion: "artifact-utility-calculator-v2", scenario, replay: replayArtifactUtility(scenario) });
    } catch (error) { root.querySelector<HTMLElement>("[data-artifact-utility-status]")!.textContent = error instanceof Error ? error.message : String(error); }
  };
  draw();
}
