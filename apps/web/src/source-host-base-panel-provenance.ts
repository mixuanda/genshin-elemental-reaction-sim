import { SOURCE_HOST_STAT_NAMES, type SourceHostBasePanel } from "../../../packages/sim-core/src/source-host-base-panel";
import type { SourceHostStatReadReceipt } from "../../../packages/sim-core/src/source-host-stat-provenance";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[c]!);
function collectBasePanels(rootRead: SourceHostStatReadReceipt): Array<{ panel: SourceHostBasePanel; role: string }> {
  const panels: Array<{ panel: SourceHostBasePanel; role: string }> = [];
  const seen = new Set<string>();
  const visit = (read: SourceHostStatReadReceipt, isRoot = false): void => {
    if (read.basePanel) {
      const identity = JSON.stringify(read.basePanel);
      if (!seen.has(identity)) {
        seen.add(identity);
        panels.push({ panel: read.basePanel, role: isRoot ? "快照根读取" : "关联读取（支持角色／依赖）" });
      }
    }
    for (const step of read.steps) for (const dependency of step.dependencies) visit(dependency);
  };
  visit(rootRead, true);
  return panels;
}

function configuredVector(panel: SourceHostBasePanel): string {
  return panel.configuredStats.map((value, index) => `<li>${esc(SOURCE_HOST_STAT_NAMES[index])}：${esc(value)}</li>`).join("");
}

function labelNames(panel: SourceHostBasePanel): string {
  const names = Object.keys(panel.configuredLabels ?? {});
  return names.length ? `<p>配置标签：${names.map(name => esc(name || "未命名")).join("、")}。各项算式和数值见共享属性轨迹。</p>` : "";
}

export function renderSourceHostBasePanelProvenance(rootRead: SourceHostStatReadReceipt | null | undefined): string {
  const panels = rootRead ? collectBasePanels(rootRead) : [];
  if (!panels.length) return `<section data-source-base-panel><h4>原生基础面板配置来源</h4><p>本条记录未保存基础面板配置配方；这不表示属性为零。</p></section>`;
  return `<section data-source-base-panel><h4>原生基础面板配置来源</h4>
    ${panels.map(({ panel, role }) => `<details><summary>${esc(role)} · ${esc(panel.characterKey)} · 角色索引 ${panel.actorIndex}</summary>
      <p>配方 ${esc(panel.version)}；输入来源：${panel.inputOrigin === "configured-stats" ? "用户配置属性" : "来源运行采样属性"}。</p>
      <p>角色 ${esc(panel.characterKey)} · 等级 ${panel.characterLevel} / ${panel.characterMaxLevel}；武器 ${esc(panel.weaponKey)} · 等级 ${panel.weaponLevel} / ${panel.weaponMaxLevel} · 精炼 ${panel.weaponRefinement}。</p>
      <p>构筑属性 ${panel.configuredStats.length} 项；角色构成步骤 ${panel.characterSteps.length} 项；武器构成步骤 ${panel.weaponSteps.length} 项。</p>
      ${labelNames(panel)}
      <details><summary>记录的构筑属性向量</summary><ul>${configuredVector(panel)}</ul></details>
      <p class="calculator-hint">数值算术和属性来源定义见共享轨迹。编辑最终面板不会改写这份历史回执；其存在不等于来源机制已通过正式服完整核验。</p>
    </details>`).join("")}
  </section>`;
}
