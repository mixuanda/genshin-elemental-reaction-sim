import { readSourceTargetGeometryControls, renderSourceTargetGeometryControls } from "./source-target-geometry-controls";
import { readSourceTargetProfileControls, renderSourceTargetProfileControls } from "./source-target-profile-controls";
import { resolveSourceTargetGeometry, type SourceTargetGeometry } from "./source-target-geometry";
import { validateSourceTargetProfile, type SourceTargetProfile } from "./source-target-profile";
import type { SourceTargetSceneInput } from "./source-target-scene";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const numberText = (value: number): string => String(value);

function sceneDiagram(targets: SourceTargetProfile[], primaryTargetIndex: number | undefined): string {
  const geometries: SourceTargetGeometry[] = targets.map(target => resolveSourceTargetGeometry(target.geometry));
  const maxValue = Math.max(1, ...geometries.flatMap(geometry => [Math.abs(geometry.x), Math.abs(geometry.y), geometry.radius]));
  const points = geometries.map(geometry => ({ x: geometry.x / maxValue, y: -geometry.y / maxValue, radius: geometry.radius / maxValue }));
  const edge = 0.2;
  const left = Math.min(-0.3 / maxValue - edge, ...points.map(point => point.x - point.radius - edge));
  const right = Math.max(0.3 / maxValue + edge, ...points.map(point => point.x + point.radius + edge));
  const top = Math.max(0.3 / maxValue + edge, ...points.map(point => point.y + point.radius + edge));
  const bottom = Math.min(-0.3 / maxValue - edge, ...points.map(point => point.y - point.radius - edge));
  const spanX = right - left, spanY = top - bottom;
  const width = 460, height = 250, margin = 26;
  const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY);
  const ox = (width - spanX * scale) / 2, oy = (height - spanY * scale) / 2;
  const position = (x: number, y: number) => ({ x: ox + (x - left) * scale, y: oy + (top - y) * scale });
  const player = position(0, 0), playerRadius = Math.max(3, (0.3 / maxValue) * scale);
  const targetCircles = points.map((point, index) => {
    const center = position(point.x, point.y), radius = point.radius * scale;
    const chosen = index === primaryTargetIndex;
    const stroke = chosen ? "#d16a2f" : "#62758b";
    return `<circle cx="${center.x}" cy="${center.y}" r="${radius}" fill="${chosen ? "#d16a2f" : "#62758b"}" fill-opacity=".10" stroke="${stroke}" stroke-width="${chosen ? 3 : 2}" />
      <circle cx="${center.x}" cy="${center.y}" r="3" fill="${stroke}" />
      <text x="${center.x}" y="${center.y - 8}" text-anchor="middle" font-size="11" fill="currentColor">${index + 1}</text>`;
  }).join("");
  const legend = geometries.map((geometry, index) => `<li>目标 ${index + 1}${index === primaryTargetIndex ? " · 统计目标" : ""}：初始中心 (${esc(numberText(geometry.x))}, ${esc(numberText(geometry.y))})，半径 ${esc(numberText(geometry.radius))}</li>`).join("");
  return `<div class="source-target-scene__diagram" data-target-scene-diagram><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="所有目标的初始来源坐标示意；统计目标已用颜色区分，不代表锁定或命中范围">
      <line x1="${ox}" y1="${player.y}" x2="${width - ox}" y2="${player.y}" stroke="currentColor" opacity=".18" />
      <line x1="${player.x}" y1="${oy}" x2="${player.x}" y2="${height - oy}" stroke="currentColor" opacity=".18" />
      ${targetCircles}<circle cx="${player.x}" cy="${player.y}" r="${playerRadius}" fill="none" stroke="#5687dc" stroke-width="2"/><circle cx="${player.x}" cy="${player.y}" r="3" fill="#5687dc"/>
      <text x="${player.x}" y="${player.y - 8}" text-anchor="middle" font-size="11" fill="currentColor">角色</text>
    </svg><ul>${legend}</ul><p>初始来源坐标使用来源单位，不声明为米。圆形只表示目标初始几何，不表示任何技能命中范围；统计目标选择不自动更改原生锁定、朝向或后续移动。</p></div>`;
}

function basicTargetControls(target: SourceTargetProfile, index: number): string {
  return `<div class="workspace-fields"><label>目标 ${index + 1} 等级<input type="number" min="1" max="200" step="1" required data-target-scene-field="level" value="${esc(target.level)}"></label>
    <label>目标 ${index + 1} 共用抗性<input type="number" step="any" required data-target-scene-field="resistance" value="${esc(target.resistance)}"></label></div>`;
}

/** Renders extra target editors, selection of the statistics target, and the all-target initial-scene diagram. */
export function renderSourceTargetSceneControls(scene: SourceTargetSceneInput): string {
  const targets = [scene.target, ...(scene.additionalTargets ?? [])];
  const selectedIndex = scene.primaryTargetIndex ?? 0;
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= targets.length)
    throw new Error("统计目标索引须指向已声明的目标。");
  const mixedHp = targets.some(target => target.hp !== undefined) && targets.some(target => target.hp === undefined);
  const selector = `<label>统计目标<select data-target-scene-primary>${targets.map((_, index) => `<option value="${index}"${index === selectedIndex ? " selected" : ""}>目标 ${index + 1}${index === 0 ? " · 首个声明目标" : ""}${index === selectedIndex ? " · 当前统计" : ""}</option>`).join("")}</select></label>
    <p>此项只选择结果统计所用目标，不改变来源执行器的默认锁定、朝向或命中对象。</p>`;
  const extras = (scene.additionalTargets ?? []).map((target, extraIndex) => {
    const index = extraIndex + 1;
    return `<section data-target-scene-target="${index}"><h4>额外目标 ${index + 1}</h4>${basicTargetControls(target, index)}
      ${renderSourceTargetGeometryControls(target.geometry)}${renderSourceTargetProfileControls(target)}
      <div class="editor-actions"><button type="button" data-target-scene-action="copy" data-target-scene-index="${index}">复制此目标</button><button type="button" data-target-scene-action="remove" data-target-scene-index="${index}">删除此目标</button></div></section>`;
  }).join("");
  return `<section data-target-scene><h3>多目标初始场景</h3>${selector}
    ${mixedHp ? '<p role="alert">目标生命模式不一致；核心要求全部目标都显式提供 HP，或全部留空。当前值已保留，请逐个修正后再运行。</p>' : ""}
    ${sceneDiagram(targets, selectedIndex)}
    <div data-target-scene-additional>${extras}</div>
    <p>添加目标会复制当前首目标的全部参数为可编辑输入，不会套用或伪造新的敌人预设。</p>
    <button type="button" data-target-scene-action="add">添加目标（复制目标 1 参数）</button></section>`;
}

/** Replaces only the all-target diagram, keeping focused geometry/profile inputs mounted. */
export function updateSourceTargetSceneDiagram(root: HTMLElement, scene: SourceTargetSceneInput): void {
  const region = root.querySelector<HTMLElement>("[data-target-scene-diagram]");
  if (!region) return;
  const targets = [scene.target, ...(scene.additionalTargets ?? [])];
  const selected = scene.primaryTargetIndex;
  region.outerHTML = sceneDiagram(targets, selected);
}

/** Reads the extra targets and statistics selection, retaining the primary target supplied by its owner editor. */
export function readSourceTargetSceneControls(root: HTMLElement, scene: SourceTargetSceneInput): SourceTargetSceneInput {
  const targets: SourceTargetProfile[] = [structuredClone(scene.target)];
  const existing = scene.additionalTargets ?? [];
  for (let extraIndex = 0; extraIndex < existing.length; extraIndex++) {
    const index = extraIndex + 1;
    const section = root.querySelector<HTMLElement>(`[data-target-scene-target="${index}"]`);
    if (!section) throw new Error(`找不到额外目标 ${index + 1} 的输入区域。`);
    const readNumber = (field: string, label: string): number => {
      const input = section.querySelector<HTMLInputElement>(`[data-target-scene-field="${field}"]`);
      if (!input || !input.checkValidity() || !Number.isFinite(input.valueAsNumber)) throw new Error(`${label}须为有限数值。`);
      return input.valueAsNumber;
    };
    const current = structuredClone(existing[extraIndex]!);
    current.level = readNumber("level", `目标 ${index + 1} 等级`);
    current.resistance = readNumber("resistance", `目标 ${index + 1} 共用抗性`);
    current.geometry = readSourceTargetGeometryControls(section);
    targets.push(readSourceTargetProfileControls(section, current));
  }
  validateSourceTargetProfile(targets[0]!);
  const selector = root.querySelector<HTMLSelectElement>("[data-target-scene-primary]");
  if (!selector) throw new Error("找不到统计目标选择器。");
  const primaryTargetIndex = Number(selector.value);
  if (!Number.isInteger(primaryTargetIndex) || primaryTargetIndex < 0 || primaryTargetIndex >= targets.length)
    throw new Error("统计目标选择须对应当前场景中的一个目标。");
  return { target: targets[0]!, additionalTargets: targets.slice(1), primaryTargetIndex };
}

export type SourceTargetSceneControlAction = "add" | "copy" | "remove";
export interface SourceTargetSceneControlActionResult { scene: SourceTargetSceneInput; message?: string }

/** Returns a new scene after add/copy/remove, first reading visible edits so user values are not lost. */
export function sourceTargetSceneControlAction(
  root: HTMLElement,
  scene: SourceTargetSceneInput,
  action: SourceTargetSceneControlAction,
  index?: number,
): SourceTargetSceneControlActionResult {
  const current = readSourceTargetSceneControls(root, scene);
  const targets = [current.target, ...(current.additionalTargets ?? [])];
  let selected = current.primaryTargetIndex ?? 0;
  let message: string | undefined;
  if (action === "add") {
    targets.push(structuredClone(current.target));
    message = "已复制目标 1 的当前参数作为新目标输入；请按需编辑。未套用怪物预设。";
  } else if (action === "copy") {
    if (!Number.isInteger(index) || index! < 0 || index! >= targets.length) throw new Error("复制目标索引无效。");
    targets.push(structuredClone(targets[index!]!));
    message = `已复制目标 ${index! + 1} 的当前参数作为新目标输入；请按需编辑。未套用怪物预设。`;
  } else {
    if (!Number.isInteger(index) || index! <= 0 || index! >= targets.length) throw new Error("只能删除有效的额外目标；目标 1 保留为主编辑目标。");
    targets.splice(index!, 1);
    if (selected === index) {
      selected = 0;
      message = `已删除目标 ${index! + 1}；统计目标已重置为目标 1。原生锁定与朝向未更改。`;
    } else {
      if (selected > index!) selected--;
      message = `已删除目标 ${index! + 1}。`;
    }
  }
  const next: SourceTargetSceneInput = { target: targets[0]!, additionalTargets: targets.slice(1), primaryTargetIndex: selected };
  // Validate per-target shape, but leave cross-target HP-mode validation to the canonical scene resolver.
  for (const target of [next.target, ...(next.additionalTargets ?? [])]) validateSourceTargetProfile(target);
  return { scene: next, ...(message ? { message } : {}) };
}
