import { importPlayerJson } from "../../packages/player-import/src/normalize";
import { importPlayerInput } from "../../packages/player-import/src/import";
import { applyPreview, createAuthorizedFixtureAdapter } from "../../packages/player-import/src/adapters";
import { MAX_INPUT_BYTES } from "../../packages/player-import/src/input";
import type { Field, ImportResult, ImportSnapshot, PlayerBuild, Stat } from "../../packages/player-import/src/model";
import good from "../../packages/player-import/fixtures/synthetic-good.json?raw";
import enka from "../../packages/player-import/fixtures/synthetic-enka.json?raw";
import hutao from "../../packages/player-import/fixtures/synthetic-hutao-multi.txt?raw";
import { mountEquipmentAuthorizationPanel } from "./authorization-panel";
import "./style.css";

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
mountEquipmentAuthorizationPanel(el("account-import"));
const input = el<HTMLTextAreaElement>("json-input"), status = el("status"), apply = el<HTMLButtonElement>("apply");
let preview: ImportResult | null = null, current: ImportSnapshot | null = null, generation = 0;
const display = (f: Field<unknown>) => f.state === "known" ? `${f.value}${f.unit === "ratio" ? "（比例）" : ""}` : `${f.state}：${f.note}`;
const append = (parent: HTMLElement, tag: string, text: string) => { const node = document.createElement(tag); node.textContent = text; parent.append(node); return node; };
function renderStats(parent: HTMLElement, title: string, stats: Stat[]): void {
  if (!stats.length) return;
  const details = append(parent, "details", ""); append(details, "summary", title);
  const table = append(details, "table", ""), header = append(append(table, "thead", ""), "tr", "");
  for (const label of ["词条", "观测值与单位", "来源"]) append(header, "th", label);
  const body = append(table, "tbody", "");
  for (const s of stats) {
    const tr = append(body, "tr", "");
    for (const value of [s.key.value ?? "未知", display(s.amount), s.amount.path]) append(tr, "td", value);
  }
}
function show(result: ImportResult): void {
  preview = result;
  const content = el("preview-content"); content.replaceChildren();
  apply.disabled = !result.ok || result.snapshot.builds.some(b => b.completeness.state !== "complete");
  if (!result.ok) {
    status.textContent = result.message;
    input.value = ""; el<HTMLInputElement>("file-input").value = "";
    el("normalized").textContent = "输入已清除；未保留错误原文。";
    return;
  }
  const source = result.snapshot.source;
  status.textContent = `${source.fixture ? "合成测试示例 · " : ""}预览 ${result.snapshot.builds.length} 个角色，尚未应用。`;
  append(content, "p", `来源：${source.kind} · 范围：${source.scope} · ${source.fixture ? "合成测试数据，非真实账号" : "用户提供/公开展示柜数据"}`);
  append(content, "p", `导入时间：${source.importedAt}；请求完成时间：${source.fetchedAt ?? "未知"}；游戏快照时间：未知。`);
  for (const notice of result.snapshot.notices) append(content, "p", notice);
  for (const b of result.snapshot.builds) renderBuild(content, b);
  el("normalized").textContent = JSON.stringify(result.snapshot, null, 2);
  input.value = "";
}
function renderBuild(parent: HTMLElement, b: PlayerBuild): void {
  const card = append(parent, "article", "");
  append(card, "h3", b.identity.value?.name ?? "未知角色");
  append(card, "p", `${b.completeness.state === "complete" ? "配装源字段完整" : "待确认"} · ${b.completeness.known}/${b.completeness.required} 必需字段。面板/计算能力单独判断。`);
  append(card, "p", `等级 ${display(b.level)} · 突破 ${display(b.ascension)} · 命座 ${display(b.constellation)}`);
  append(card, "p", `武器：${b.weapon.identity.value?.name ?? "未知"} · 等级 ${display(b.weapon.level)} · 突破 ${display(b.weapon.ascension)} · 精炼 ${display(b.weapon.refinement)} · 武器词条：${b.weapon.statsState}`);
  renderStats(card, "查看武器观测词条与单位", b.weapon.stats);
  const table = append(card, "table", ""), thead = append(table, "thead", ""), heading = append(thead, "tr", "");
  for (const title of ["天赋", "基础等级", "额外等级", "有效等级"]) append(heading, "th", title);
  const body = append(table, "tbody", "");
  for (const [name, t] of Object.entries(b.talents)) { const tr = append(body, "tr", ""); for (const value of [name, display(t.base), display(t.bonus), display(t.effective)]) append(tr, "td", value); }
  append(card, "p", "不根据命座再次增加天赋等级。GOOD 未导出额外/有效等级。百分数统一存为比例，详情包含源路径与换算说明。");
  const list = append(card, "ul", "");
  for (const a of b.artifacts) append(list, "li", `${a.slot} · ${a.identity.value?.name ?? "未知套装"} · +${display(a.level)} · ${a.main.key.value ?? "未知主词条"}：${display(a.main.amount)} · 副词条 ${a.substatsState.value ?? "未知"} 条`);
  append(card, "p", `面板观测：${b.panel.state}${b.panel.accounting ? " · 文本记账语义未核验" : ""}。未知面板项不补零，不与装备贡献叠加。`);
  renderStats(card, "查看面板观测、缺项与来源", b.panel.stats);
  if (b.completeness.issues.length) { const issues = append(card, "ul", ""); issues.className = "issues"; for (const i of b.completeness.issues) append(issues, "li", `${i.path}：${i.state} · ${i.note}`); }
}
el("preview").onclick = () => { generation++; show(importPlayerInput(input.value)); };
input.oninput = () => { generation++; preview = null; apply.disabled = true; status.textContent = "输入已变更，请重新预览。当前已应用数据保持。"; };
el("good-demo").onclick = () => { generation++; show(importPlayerJson(good, { fixture: true })); };
el("enka-demo").onclick = () => { generation++; show(importPlayerJson(enka, { fixture: true })); };
el("hutao-demo").onclick = () => { generation++; show(importPlayerInput(hutao, { fixture: true })); };
el("authorized-demo").onclick = async () => {
  const run = ++generation;
  const adapter = createAuthorizedFixtureAdapter(good);
  const result = await adapter.readCurrentEquipment({ provider: "miyoushe", purpose: "read-owned-current-equipment", consent: "user-initiated" });
  await adapter.disconnect();
  if (run === generation) show(result);
};
el<HTMLInputElement>("file-input").onchange = async event => {
  const run = ++generation, fileInput = event.target as HTMLInputElement, file = fileInput.files?.[0];
  if (!file) return;
  preview = null; apply.disabled = true;
  try {
    const result = file.size > MAX_INPUT_BYTES ? { ok: false, code: "invalid-input", message: "文件超过 2 MB 限制。旧数据保持。" } as const : importPlayerInput(await file.text());
    if (run === generation) show(result);
  } catch { if (run === generation) show({ ok: false, code: "invalid-input", message: "文件读取失败。旧数据保持。" }); }
  fileInput.value = "";
};
el<HTMLFormElement>("uid-form").onsubmit = async event => {
  event.preventDefault();
  const run = ++generation;
  preview = null; apply.disabled = true;
  const uid = el<HTMLInputElement>("uid").value;
  if (!/^[1-9]\d{8,9}$/.test(uid)) { show({ ok: false, code: "invalid-input", message: "UID 必须为 9–10 位数字。" }); return; }
  status.textContent = "正在获取公开展示柜……";
  try {
    const response = await fetch(`/api/player-showcase/${uid}`, { credentials: "omit", signal: AbortSignal.timeout(15_000) });
    const result: ImportResult = await response.json();
    if (run === generation) show(result);
  } catch { if (run === generation) show({ ok: false, code: "unavailable", message: "展示柜请求失败。旧数据保持。" }); }
};
apply.onclick = () => {
  if (!preview) return;
  const result = applyPreview(current, preview); current = result.current; status.textContent = result.message;
  if (current) el("current").textContent = `${current.source.fixture ? "合成测试数据 · " : ""}${current.builds.map(b => b.identity.value?.name ?? "未知").join("、")} · ${current.source.kind} · ${current.source.importedAt} · 仅本页内存`;
};
