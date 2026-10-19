import {
  availablePreviewDatasets, comparePreviewWorkspaces, loadPreviewWorkspace, runtimeSelection, updateStatus, type RuntimeDatasetMetadata, type RuntimeWorkspace
} from "@genshin-dps-lab/game-data";
import { renderUpdateOperationPanel } from "./update-operation-panel";

const esc = (v: unknown): string => String(v ?? "未知").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const labels: Record<string,string> = { characters:"角色身份记录",talentSets:"天赋集（含形态）",abilities:"技能与被动元数据",weapons:"武器记录（含剧情试用）",artifactSets:"圣遗物套装",constellationSets:"命座集" };
export function renderUpdatePanel(root: HTMLElement): void {
  const s=updateStatus;
  const live=s.latestObservedOfficialRelease;
  const catalog=s.activeCatalog;
  const characters=s.coverage.conditionalCharacterSupport;
  const equipment=s.coverage.conditionalEquipmentSupport;
  const composable=s.coverage.composableSourceSupport;
  const previewComposable=s.coverage.previewComposableSourceSupport;
  const composableHtml=composable ? `<section data-composable-source-coverage><h3>可加入队伍的来源动作</h3><p>${composable.executableCharacters}个来源角色的${composable.executableActions}个动作、${composable.executableHitDefinitions}个命中模板可在明确条件下组合执行；另${composable.sourceOnlyActions}个动作只有来源记录，执行依赖尚未补齐。正式验证定义${composable.formallyVerifiedActions}，不增加上方已验证团队数量。</p><p>来源注册版本 ${esc(composable.registryVersion)}；对应已发布目录 ${esc(composable.datasetId)}。</p><p>隔离预览：${previewComposable ? `${previewComposable.executableActions}个匹配预览身份的可组合来源动作。` : "尚无匹配的可组合来源覆盖，不沿用已发布数值。"}</p></section>` : "<p>活动目录尚无匹配的可组合来源动作摘要；不从其他目录借用覆盖。</p>";
  const categories=s.coverage.inventoryValidation.categories??{};
  root.innerHTML=`<div class="workspace-stack"><article class="card"><h2>更新状态</h2><p>状态来自通过校验的本地清单；页面计算不会实时抓取 Wiki。版本观察与已验证数据集分别记录。</p><div class="workspace-fields"><div><h3>已观察官方版本</h3><strong>${esc(live?.version)}</strong><p>观察时间 ${esc(live?.observedAt)}</p></div><div><h3>活动目录</h3><strong>${esc(catalog?.gameVersion)}</strong><p>${esc(catalog?.label)} · ${esc(catalog?.releaseStatus)}</p></div><div><h3>活动已验证数据集</h3><strong>${s.activeVerifiedDataset ? esc(s.activeVerifiedDataset.label) : "尚无"}</strong><p>目录解析成功不表示完成机制验证。</p></div></div>${live?.version !== catalog?.gameVersion ? '<p class="notice">活动目录落后于已观察官方版本；不能将旧目录称作当前全量游戏数据。</p>' : ""}<p>最近成功同步 ${esc(s.lastSuccessfulSync)}；最近尝试 ${esc(s.lastAttemptedSync)}；状态 ${esc(s.lastSyncStatus)}。此同步是可访问源快照的同步，并不证明最新版本已覆盖。</p></article><article class="card"><h2>数据覆盖与就绪范围</h2><div class="table-wrap"><table><thead><tr><th>目录类型</th><th>已解析数量</th><th>说明</th></tr></thead><tbody>${Object.entries(s.coverage.catalog ?? {}).map(([k,v])=>`<tr><td>${esc(labels[k]??k)}</td><td>${v}</td><td>本地源快照记录；不是完整可执行定义</td></tr>`).join("")}</tbody></table></div><p>已核验数值字段 ${s.coverage.numericallyVerified}；已核验机制字段 ${s.coverage.mechanicsVerified}；已评估字段 ${s.coverage.assessedFields}；缺失字段 ${s.coverage.missingFields}。</p><p>已验证单击定义 ${s.coverage.hitReady}；完整单技能 ${s.coverage.skillReady}；行动序列 ${s.coverage.sequenceReady}；团队模拟 ${s.coverage.teamReady}。附带假设可用的临时分类命中 ${s.coverage.provisionalClassifiedHits}。</p><p>已验证可执行武器定义 ${s.coverage.executableWeaponDefinitions}；已验证可执行圣遗物定义 ${s.coverage.executableArtifactDefinitions}。</p>${characters ? `<h3>有来源的条件计算</h3><p>${characters.charactersWithHits} 个角色有 ${characters.classifiedHits} 个分类命中，${characters.completeActions} 个完整动作、${characters.partialActions} 个部分动作；${characters.blockedMappings} 个映射因字段依赖阻塞。此范围不会升级为全角色／全队机制验证。</p><p>映射 ${esc(characters.mappingVersion)}；数据 ${esc(characters.datasetId)}。</p>` : ""}${equipment ? `<p>已执行条件条款涉及 ${equipment.weaponDefinitions} 把武器、${equipment.refinementVariants} 个精炼版本；${equipment.twoPieceArtifactDefinitions} 种二件套和 ${equipment.fourPieceArtifactDefinitions} 种四件套。只按用户明确启用的条款与条件执行，未实现的其他条款仍会说明。</p>` : ""}${composableHtml}<h3>独立名册核对</h3><p>${s.coverage.expectedInventory ? "已提供独立来源名册，按分类报告范围；名册相符不是机制完成率。" : "尚未建立，不报告完成百分比。"}</p>${Object.keys(categories).length ? `<div class="table-wrap"><table><thead><tr><th>类别</th><th>独立预期</th><th>源记录</th><th>状态／范围</th></tr></thead><tbody>${Object.entries(categories).map(([key,value])=>`<tr><td>${esc(labels[key]??key)}</td><td>${value.expectedCount}</td><td>${value.observedCount}</td><td>${esc(value.status)} / ${esc(value.completeness)}</td></tr>`).join("")}</tbody></table></div>` : ""}</article><article class="card"><h2>其他候选与隔离预览</h2>${s.candidateSnapshots.map(c=>`<details><summary>${esc(c.gameVersion)} · ${esc(c.releaseStatus)} · 已取得结构化候选</summary><p>${esc(c.snapshotId)}</p><p>角色记录 ${c.counts.characters}；天赋集 ${c.counts.talentSets}；技能/被动 ${c.counts.abilities}；武器 ${c.counts.weapons}；圣遗物套装 ${c.counts.artifactSets}；命座集 ${c.counts.constellationSets}。Schema ${c.schemaValid ? "通过" : "未通过"}；数值证据 ${esc(c.numericEvidenceStatus)}；机制证据 ${esc(c.mechanicEvidenceStatus)}。</p><p>保持隔离，不成为默认已发布数据。</p></details>`).join("")}${s.officialNextCandidates.map(c=>`<p><strong>${esc(c.version)} · ${esc(c.releaseStatus)}</strong> ${esc(c.note)}</p>`).join("")||"<p>无已观察候选。</p>"}<p>预览快照 ${s.previewSnapshots.length}；归档快照 ${s.archivedSnapshots.length}；当前预览工作区 ${esc(s.previewWorkspaceSnapshotId)}。</p><p>尚未取得可靠快照的请求预览保持缺失；不会生成空的「同步成功」预览。</p></article><article class="card"><h2>剩余阻塞</h2><ul>${s.blockers.map(b=>`<li>${esc(b)}</li>`).join("")}</ul><details><summary>来源与完整状态清单</summary><p>${esc(live?.evidenceNote)}</p>${(live?.sourceUrls??[]).map(url=>`<p><a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(url)}</a></p>`).join("")}<pre>${esc(JSON.stringify(s,null,2))}</pre></details></article></div>`;
  const operationHost = document.createElement("article");
  operationHost.className = "card";
  root.querySelector(".workspace-stack")!.insertBefore(operationHost, root.querySelector(".workspace-stack")!.children[1] ?? null);
  renderUpdateOperationPanel(operationHost, s);
  const previewHost = document.createElement("article");
  previewHost.className = "card";
  root.querySelector(".workspace-stack")!.insertBefore(previewHost, root.querySelector(".workspace-stack")!.lastElementChild);
  renderPreviewWorkspacePanel(previewHost);
}

function renderPreviewWorkspacePanel(root: HTMLElement): void {
  const datasets = availablePreviewDatasets;
  const selected = runtimeSelection.previewWorkspaceSnapshotId;
  const initial = datasets.some((dataset) => dataset.snapshotId === selected) ? selected : datasets[0]?.snapshotId ?? "";
  const option = (dataset: RuntimeDatasetMetadata) => `<option value="${esc(dataset.snapshotId)}">${esc(dataset.gameVersion)} · ${esc(dataset.catalogVersion)} · ${esc(dataset.snapshotId.slice(0, 24))}…</option>`;
  root.innerHTML = `<h2>隔离预览工作区</h2><p class="notice">选择并载入指定历史预览。内容只用于浏览或计算，不修改活动目录或已验证指针；各快照保留原证据状态，目录记录不代表可执行机制。</p><div class="workspace-fields"><label>要打开的预览快照<select data-preview-load-choice ${datasets.length ? "" : "disabled"}>${datasets.map(option).join("")}</select></label><button type="button" data-open-preview ${datasets.length ? "" : "disabled"}>载入所选预览</button></div><div data-preview-metadata aria-live="polite"></div><div data-preview-content></div><hr><h3>比较两个预览快照</h3><p>比较字段值与来源身份，不会修改当前选择或目录指针。</p><div class="workspace-fields"><label>较早／基准快照<select data-preview-compare-from ${datasets.length ? "" : "disabled"}>${datasets.map(option).join("")}</select></label><label>对比快照<select data-preview-compare-to ${datasets.length ? "" : "disabled"}>${datasets.map(option).join("")}</select></label><button type="button" data-compare-previews ${datasets.length ? "" : "disabled"}>比较所选快照</button></div><div data-preview-comparison aria-live="polite"></div>`;
  const loadSelect = root.querySelector<HTMLSelectElement>("[data-preview-load-choice]")!;
  const button = root.querySelector<HTMLButtonElement>("[data-open-preview]")!;
  const content = root.querySelector<HTMLElement>("[data-preview-content]")!;
  const metadata = root.querySelector<HTMLElement>("[data-preview-metadata]")!;
  const fromSelect = root.querySelector<HTMLSelectElement>("[data-preview-compare-from]")!;
  const toSelect = root.querySelector<HTMLSelectElement>("[data-preview-compare-to]")!;
  const compareButton = root.querySelector<HTMLButtonElement>("[data-compare-previews]")!;
  const comparisonHost = root.querySelector<HTMLElement>("[data-preview-comparison]")!;
  if (initial) loadSelect.value = initial;
  const baseline = datasets.find((dataset) => dataset.snapshotId !== initial)?.snapshotId ?? initial;
  if (baseline) fromSelect.value = baseline;
  const second = datasets.find((dataset) => dataset.snapshotId !== initial)?.snapshotId ?? initial;
  if (second) toSelect.value = second;
  let loadRequest = 0;
  let compareRequest = 0;
  loadSelect.addEventListener("change", () => {
    loadRequest++;
    button.disabled = false;
    button.textContent = "载入所选预览";
    metadata.textContent = "所选快照已更改；请载入以查看其内容与证据身份。";
    content.replaceChildren();
  });
  for (const select of [fromSelect, toSelect]) select.addEventListener("change", () => {
    compareRequest++;
    compareButton.disabled = false;
    comparisonHost.textContent = "比较选择已更改；请重新比较。";
  });
  button.addEventListener("click", async () => {
    const request = ++loadRequest;
    const snapshotId = loadSelect.value;
    button.disabled = true;
    content.textContent = "正在载入并核对所选预览…";
    try {
      const workspace = await loadPreviewWorkspace(snapshotId);
      if (request !== loadRequest) return;
      if (!workspace) {
        metadata.textContent = "所选快照目前不可载入；不会改用已发布目录代替。";
        content.replaceChildren();
        return;
      }
      renderPreviewMetadata(metadata, workspace.metadata);
      renderPreviewCatalog(content, workspace);
      button.textContent = "已载入此预览";
    } catch (error) {
      if (request !== loadRequest) return;
      content.textContent = `预览目录无法加载：${error instanceof Error ? error.message : String(error)}`;
      button.disabled = false;
    } finally {
      if (request === loadRequest) button.disabled = false;
    }
  });
  compareButton.addEventListener("click", async () => {
    const request = ++compareRequest;
    const from = fromSelect.value;
    const to = toSelect.value;
    compareButton.disabled = true;
    comparisonHost.textContent = "正在比较字段并核对两侧来源身份…";
    try {
      const result = await comparePreviewWorkspaces(from, to);
      if (request !== compareRequest) return;
      renderPreviewComparison(comparisonHost, result);
    } catch (error) {
      if (request === compareRequest) comparisonHost.textContent = `无法比较所选快照：${error instanceof Error ? error.message : String(error)}`;
    } finally {
      if (request === compareRequest) compareButton.disabled = false;
    }
  });
}

function renderPreviewMetadata(root: HTMLElement, metadata: RuntimeDatasetMetadata): void {
  root.innerHTML = `<p><strong>当前载入：</strong>${esc(metadata.gameVersion)} · 目录 ${esc(metadata.catalogVersion)} · 发布标记 ${esc(metadata.releaseStatus)}；数值证据 ${esc(metadata.numericEvidenceStatus)}，机制证据 ${esc(metadata.mechanicEvidenceStatus)}。</p><p>快照 ID <code>${esc(metadata.snapshotId)}</code><br>内容 SHA-256 <code>${esc(metadata.contentSha256)}</code><br>来源身份 ${metadata.sourceIds.map(esc).join("、")}</p><p>预览定义未获验证；载入不会更改活动或已验证目录。</p>`;
}

type PreviewComparison = Awaited<ReturnType<typeof comparePreviewWorkspaces>>;
function renderPreviewComparison(root: HTMLElement, result: PreviewComparison): void {
  const sourceIdentity = (title: string, metadata: RuntimeDatasetMetadata, sources: PreviewComparison["from"]["sources"]) => `<section><h4>${title}</h4><p>${esc(metadata.gameVersion)} · ${esc(metadata.catalogVersion)} · ${esc(metadata.releaseStatus)}<br>快照 <code>${esc(metadata.snapshotId)}</code><br>内容 SHA-256 <code>${esc(metadata.contentSha256)}</code><br>数值/机制证据 ${esc(metadata.numericEvidenceStatus)} / ${esc(metadata.mechanicEvidenceStatus)}</p><ul>${sources.map((source) => `<li>${esc(source.id)} · ${esc(source.revision)} · ${esc(source.contentSha256 ?? "无来源哈希")}</li>`).join("")}</ul></section>`;
  const shown = result.changes.slice(0, 200);
  const rows = shown.map((change) => `<tr><td>${esc(change.path)}</td><td>${change.kind === "added" ? "新增" : change.kind === "removed" ? "移除" : "变更"}</td><td>${change.before === undefined ? "—" : esc(JSON.stringify(change.before))}</td><td>${change.after === undefined ? "—" : esc(JSON.stringify(change.after))}</td><td>${change.numericDelta === undefined ? "—" : esc(change.numericDelta)}</td></tr>`).join("");
  const identityDifferent = result.from.metadata.snapshotId !== result.to.metadata.snapshotId
    || result.from.metadata.contentSha256 !== result.to.metadata.contentSha256;
  root.innerHTML = `<div class="workspace-fields">${sourceIdentity("基准快照身份", result.from.metadata, result.from.sources)}${sourceIdentity("对比快照身份", result.to.metadata, result.to.sources)}</div><p>${result.changes.length ? `发现 ${result.changes.length} 个字段变化；以下最多显示前 ${Math.min(200, result.changes.length)} 项。` : `字段内容无差异。${identityDifferent ? "但快照或来源身份不同，仍应分别审阅上方身份信息。" : "两侧快照身份相同。"}`}</p>${rows ? `<div class="table-wrap"><table><thead><tr><th>字段路径</th><th>变化</th><th>旧值</th><th>新值</th><th>数值差</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}<button type="button" data-export-preview-comparison>导出完整比较 JSON（含全部 ${result.changes.length} 项）</button>`;
  root.querySelector<HTMLButtonElement>("[data-export-preview-comparison]")!.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `preview-comparison-${result.from.metadata.snapshotId.slice(9, 21)}-${result.to.metadata.snapshotId.slice(9, 21)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

function renderPreviewCatalog(root: HTMLElement, workspace: RuntimeWorkspace): void {
  const { catalog, metadata, evidence, supplemental } = workspace;
  const abilities = catalog.talentSets.flatMap((talents) => talents.abilities.map((ability) => ({ talents, ability })));
  const options = (rows: readonly { id: string; name: string }[]) => rows.map((entry) => `<option value="${esc(entry.id)}">${esc(entry.name)}</option>`).join("");
  root.innerHTML = `<div class="workspace-stack"><p class="notice"><strong>当前通道：隔离预览</strong> · 原始发布状态 ${esc(metadata.releaseStatus)} · 版本 ${esc(metadata.gameVersion)}。此处数量表示目录记录，不表示机制已验证。</p><p>快照 ${esc(metadata.snapshotId)}<br>目录 ${esc(metadata.catalogVersion)}<br>内容 SHA-256 ${esc(metadata.contentSha256)}</p><p>数值证据 ${esc(metadata.numericEvidenceStatus)}；机制证据 ${esc(metadata.mechanicEvidenceStatus)}。</p><p>角色 ${catalog.characters.length}；武器 ${catalog.weapons.length}；技能／被动 ${abilities.length}；圣遗物套装 ${supplemental.artifactSets.length}；命座集 ${supplemental.constellationSets.length}。</p><p><a href="/calculator?workspace=preview&snapshot=${encodeURIComponent(metadata.snapshotId)}">在独立技能计算器中使用此隔离预览目录</a></p><div class="workspace-fields"><label>预览角色<select data-preview-character ${catalog.characters.length ? "" : "disabled"}>${options(catalog.characters)}</select></label><label>预览武器<select data-preview-weapon ${catalog.weapons.length ? "" : "disabled"}>${options(catalog.weapons)}</select></label><label>预览技能／被动<select data-preview-ability ${abilities.length ? "" : "disabled"}>${abilities.map(({ talents, ability }) => `<option value="${esc(ability.id)}">${esc(talents.name)} · ${esc(ability.name)}</option>`).join("")}</select></label></div><div data-preview-records></div><details><summary>预览来源与证据身份</summary><ul>${evidence.sources.map((source) => `<li><a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.id)}</a> · ${esc(source.revision)} · 获取于 ${esc(source.retrievedAt)}<br>来源 SHA-256 ${esc(source.contentSha256)}</li>`).join("")}</ul></details></div>`;
  const characterSelect = root.querySelector<HTMLSelectElement>("[data-preview-character]")!;
  const weaponSelect = root.querySelector<HTMLSelectElement>("[data-preview-weapon]")!;
  const abilitySelect = root.querySelector<HTMLSelectElement>("[data-preview-ability]")!;
  const records = root.querySelector<HTMLElement>("[data-preview-records]")!;
  const drawRecords = () => {
    const character = catalog.characters.find((entry) => entry.id === characterSelect.value);
    const weapon = catalog.weapons.find((entry) => entry.id === weaponSelect.value);
    const ability = abilities.find((entry) => entry.ability.id === abilitySelect.value)?.ability;
    const record = (label: string, entry: unknown) => entry
      ? `<details><summary>${esc(label)}</summary><pre>${esc(JSON.stringify(entry, null, 2))}</pre></details>`
      : `<p>${esc(label)}：目录未提供记录。</p>`;
    records.innerHTML = record("所选角色的已解析目录字段", character)
      + record("所选武器的已解析目录字段", weapon)
      + record("所选技能的倍率、等级与未映射机制", ability);
  };
  for (const select of [characterSelect, weaponSelect, abilitySelect]) select.addEventListener("change", drawRecords);
  drawRecords();
}
