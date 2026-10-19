import "./source-host-inventory.css";

type PackageKind = "character" | "weapon" | "artifact";
interface SourceRef { path: string; line?: number }
interface SourceRegistration { kind: PackageKind; importPath: string; sourcePath: string; sourceLine: number }
interface InventoryManifest { source: { repository: string; revision: string }; sourceInventory: { registeredSourcePackages: SourceRegistration[]; counts?: Partial<Record<PackageKind, number>> } }
interface SourceKey {
  configurationKey: string; symbol: string; nameZh: string | null;
  aliases: Array<{ key: string; source: SourceRef }>;
  registrationRef: SourceRef; catalogRef: SourceRef; shortcutRef: SourceRef; localizationRef: SourceRef;
  sourceGameId?: number; element?: string; weaponClass?: string; maximumLevel?: number;
}
interface PackageMetadata extends SourceRegistration {
  packagePath: string; packageName: string; keyStatus: "source-registration-and-parser-confirmed" | "unresolved";
  resolved?: SourceKey; keyGap?: string; implementationFiles: string[];
  todoMarkers: Array<SourceRef & { text: string; sharedImplementation: boolean }>;
}
interface InventoryMetadata { schemaVersion: number; source: { repository: string; revision: string }; packages: PackageMetadata[]; syntaxEvidence: SourceRef[] }
interface InventoryEntry extends SourceRegistration { metadata?: PackageMetadata }
export interface SourceHostInventoryOptions { hostVariant?: "classic" | "stellar"; /** Called only after the user chooses a confirmed, editable fragment. */ onInsertSnippet?: (snippet: string) => void }
const kindLabels: Record<PackageKind, string> = { character: "角色", weapon: "武器", artifact: "圣遗物套装" };
const weaponClasses: Record<string, string> = { WEAPON_SWORD_ONE_HAND: "单手剑", WEAPON_CLAYMORE: "双手剑", WEAPON_POLE: "长柄武器", WEAPON_BOW: "弓", WEAPON_CATALYST: "法器" };
const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const packageName = (entry: InventoryEntry): string => entry.metadata?.packageName ?? entry.importPath.replace(/^github\.com\/genshinsim\/gcsim\/internal\/(?:characters|weapons|artifacts)\//, "");
const displayName = (entry: InventoryEntry): string => entry.metadata?.resolved?.nameZh ?? packageName(entry);
const idOf = (entry: SourceRegistration): string => `${entry.kind}:${entry.importPath}`;

/** Reads the actual built host manifest. Auxiliary key metadata never replaces
 * that inventory and is ignored when its pinned revision or registration differs.
 * Returns a disposer for callers that mount/unmount the host panel. */
export function renderSourceHostInventory(root: HTMLElement, options: SourceHostInventoryOptions = {}): () => void {
  const abort = new AbortController(); let disposed = false;
  root.innerHTML = '<section class="card source-inventory"><h2>固定来源注册名册</h2><p role="status" aria-live="polite">正在读取本地宿主的实际注册包…</p></section>';
  const loadJson = async (path: string): Promise<unknown> => {
    const response = await fetch(path, { signal: abort.signal });
    if (!response.ok) throw new Error(`${path}：HTTP ${response.status}`);
    return response.json();
  };
  const base = options.hostVariant === "stellar" ? "/source-host-stellar" : "/source-host";
  void Promise.allSettled([loadJson(`${base}/manifest.json`), loadJson(`${base}/inventory-metadata.json`)]).then(results => {
    if (disposed) return;
    const manifestResult = results[0]!, metadataResult = results[1]!;
    if (manifestResult.status !== "fulfilled") throw manifestResult.reason;
    const manifest = manifestResult.value as InventoryManifest;
    if (!manifest?.source?.revision || !Array.isArray(manifest.sourceInventory?.registeredSourcePackages)) throw new Error("宿主清单缺少注册名册；不能用示例或旧数量代替。");
    const maybeMetadata = metadataResult.status === "fulfilled" ? metadataResult.value as InventoryMetadata : undefined;
    const metadata = maybeMetadata?.schemaVersion === 1 && maybeMetadata.source?.revision === manifest.source.revision && maybeMetadata.source.repository === manifest.source.repository && Array.isArray(maybeMetadata.packages) ? maybeMetadata : undefined;
    const metadataById = new Map(metadata?.packages.map(entry => [idOf(entry), entry]));
    const entries: InventoryEntry[] = manifest.sourceInventory.registeredSourcePackages.map(registration => {
      const extra = metadataById.get(idOf(registration));
      return extra && extra.sourcePath === registration.sourcePath && extra.sourceLine === registration.sourceLine ? { ...registration, metadata: extra } : registration;
    });
    const counts = Object.fromEntries(Object.keys(kindLabels).map(kind => [kind, entries.filter(entry => entry.kind === kind).length])) as Record<PackageKind, number>;
    const countDrift = Object.keys(kindLabels).some(kind => manifest.sourceInventory.counts?.[kind as PackageKind] !== counts[kind as PackageKind]);
    const confirmed = entries.filter(entry => entry.metadata?.keyStatus === "source-registration-and-parser-confirmed" && entry.metadata.resolved);
    const characters = confirmed.filter(entry => entry.kind === "character");
    const todoCount = entries.reduce((sum, entry) => sum + (entry.metadata?.todoMarkers.length ?? 0), 0);
    const todoPackages = entries.filter(entry => entry.metadata?.todoMarkers.length).length;
    const uniqueTodoCount = new Set(entries.flatMap(entry => entry.metadata?.todoMarkers.map(todo => `${todo.path}:${todo.line}`) ?? [])).size;
    const metadataCount = entries.filter(entry => entry.metadata).length;
    const sourceUrl = (ref: SourceRef): string => `${(manifest.source.repository.startsWith("https://") ? manifest.source.repository : `https://github.com/${manifest.source.repository}`).replace(/\/$/, "")}/blob/${encodeURIComponent(manifest.source.revision)}/${ref.path.split("/").map(encodeURIComponent).join("/")}${ref.line ? `#L${ref.line}` : ""}`;
    const sourceLink = (ref: SourceRef, label = `${ref.path}${ref.line ? `:${ref.line}` : ""}`): string => `<a href="${esc(sourceUrl(ref))}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
    let query = "", kind = "all", gap = "all", page = 0, pageSize = 12, selectedId: string | undefined, chosenActorKey = "";
    root.innerHTML = `<section class="card source-inventory" aria-label="固定来源注册名册"><h2>固定来源注册名册</h2>
      <p>本宿主实际导入 <strong>${entries.length}</strong> 个来源包：角色 ${counts.character}、武器 ${counts.weapon}、圣遗物套装 ${counts.artifact}。这是包注册数，包含不同形态；不是最新角色总数，也不代表每个分支均已验证。</p>
      <p>固定提交 <code>${esc(manifest.source.revision)}</code> · ${sourceLink({ path: "pkg/simulation/imports.character.dm.go" }, "角色注册")} · ${sourceLink({ path: "pkg/simulation/imports.weapon.dm.go" }, "武器注册")} · ${sourceLink({ path: "pkg/simulation/imports.artifact.dm.go" }, "套装注册")}。</p>
      <p>${confirmed.length} 个包的配置键已由注册函数、来源目录与解析器别名表共同确定；${entries.length - confirmed.length} 个配置键仍待查。${metadataCount ? `已取得 ${metadataCount} 个包的实现元数据：${todoPackages} 个包涉及 ${uniqueTodoCount} 处明确 TODO／未实现标记，按包展开为 ${todoCount} 条（共享文件会重复列出）。` : "TODO 扫描元数据尚未取得，数量保持未知。"}${countDrift ? "清单汇总与实际条目数量不同，以上按实际条目统计。" : ""}${!metadata ? "辅助元数据未取得或版本不匹配：仍列出全部注册包，配置键保持待查。" : ""}</p>
      <div class="source-inventory__filters"><label>搜索名称、配置键、包路径或 TODO 原文<input type="search" data-source-inventory-search placeholder="例如：神里绫华、ayaka、archaic、hitlag" autocomplete="off"></label><label>类型<select data-source-inventory-kind><option value="all">全部（${entries.length}）</option>${Object.entries(kindLabels).map(([key, name]) => `<option value="${key}">${name}（${counts[key as PackageKind]}）</option>`).join("")}</select></label><label>来源说明<select data-source-inventory-gap><option value="all">全部条目</option><option value="todo">有明确 TODO／未实现标记</option><option value="unresolved">配置键仍待查</option></select></label><label>每页条目<select data-source-inventory-size><option value="12">12</option><option value="24">24</option></select></label></div>
      <p data-source-inventory-count role="status" aria-live="polite" aria-atomic="true"></p><ul class="source-inventory__list" data-source-inventory-list></ul>
      <nav class="source-inventory__pager" aria-label="来源名册分页"><button type="button" data-source-inventory-prev>上一页</button><span data-source-inventory-page></span><button type="button" data-source-inventory-next>下一页</button></nav>
      <section class="source-inventory__selection" data-source-inventory-selection aria-label="所选来源包"><p>选择一个条目，即可查看注册键、固定源码与具体 TODO。生成单角色或单件装备的配置片段无需先填写完整队伍。</p></section>
      <p><a href="/calculator">打开独立技能计算器</a>；其来源映射与本宿主注册范围分别记录，不能把包注册数当作独立计算器的完整动作数。</p></section>`;
    const search = root.querySelector<HTMLInputElement>("[data-source-inventory-search]")!;
    const kindInput = root.querySelector<HTMLSelectElement>("[data-source-inventory-kind]")!;
    const gapInput = root.querySelector<HTMLSelectElement>("[data-source-inventory-gap]")!;
    const sizeInput = root.querySelector<HTMLSelectElement>("[data-source-inventory-size]")!;
    const list = root.querySelector<HTMLElement>("[data-source-inventory-list]")!;
    const selectedHost = root.querySelector<HTMLElement>("[data-source-inventory-selection]")!;
    const previous = root.querySelector<HTMLButtonElement>("[data-source-inventory-prev]")!, next = root.querySelector<HTMLButtonElement>("[data-source-inventory-next]")!;
    const notice = (message: string) => { const status = selectedHost.querySelector<HTMLElement>("[data-source-inventory-snippet-status]"); if (status) status.textContent = message; };
    const numberField = (key: string, label: string, value: number, min: number, max: number): string => `<label>${esc(label)}<input data-source-inventory-number="${key}" type="number" min="${min}" max="${max}" step="1" value="${value}" required></label>`;
    const selectEntry = (entry: InventoryEntry) => {
      selectedId = idOf(entry); renderList();
      const detail = entry.metadata, key = detail?.keyStatus === "source-registration-and-parser-confirmed" ? detail.resolved : undefined;
      if (entry.kind === "character" && key) chosenActorKey = key.configurationKey;
      const compatibleActors = characters.filter(actor => entry.kind !== "weapon" || !key?.weaponClass || actor.metadata!.resolved!.weaponClass === key.weaponClass);
      if (!compatibleActors.some(actor => actor.metadata!.resolved!.configurationKey === chosenActorKey)) chosenActorKey = "";
      const levelMaximum = key?.maximumLevel ?? 90;
      const editorFields = !key ? "" : entry.kind === "character"
        ? numberField("level", "角色等级（明确示例值，可改）", Math.min(90, levelMaximum), 1, levelMaximum) + numberField("levelCap", "当前突破等级上限", Math.min(90, levelMaximum), 1, levelMaximum) + numberField("constellation", "命座", 0, 0, 6) + numberField("normal", "普通攻击天赋等级", 1, 1, 15) + numberField("skill", "元素战技天赋等级", 1, 1, 15) + numberField("burst", "元素爆发天赋等级", 1, 1, 15)
        : `<label>使用此${entry.kind === "weapon" ? "武器" : "套装"}的角色<select data-source-inventory-owner required><option value="">选择一个已确认来源键的角色</option>${compatibleActors.map(actor => { const value = actor.metadata!.resolved!.configurationKey; return `<option value="${esc(value)}"${value === chosenActorKey ? " selected" : ""}>${esc(displayName(actor))} · ${esc(value)}</option>`; }).join("")}</select></label>` + (entry.kind === "weapon" ? numberField("level", "武器等级", Math.min(90, levelMaximum), 1, levelMaximum) + numberField("levelCap", "武器突破等级上限", Math.min(90, levelMaximum), 1, levelMaximum) + numberField("refinement", "精炼等级", 1, 1, 5) : numberField("pieces", "套装件数（按实际方案填写）", 2, 1, 5));
      selectedHost.innerHTML = `<h3 tabindex="-1" data-source-inventory-selected-heading>${esc(displayName(entry))} · ${kindLabels[entry.kind]}</h3><p>来源包 <code>${esc(packageName(entry))}</code>${key ? `；GCSL 配置键 <code>${esc(key.configurationKey)}</code>${key.weaponClass ? `；${esc(weaponClasses[key.weaponClass] ?? key.weaponClass)}` : ""}` : "；配置键待查"}。</p>
        ${key ? `<p>数值由你明确填写，默认值只是可编辑的声明。片段不会自动补齐武器、属性、目标或行动序列，也不代表经验证的构筑。</p><div class="source-inventory__fields">${editorFields}</div><label>可复制的 GCSL 配置片段<textarea data-source-inventory-snippet rows="4" readonly spellcheck="false"></textarea></label><div class="source-inventory__actions"><button type="button" data-source-inventory-copy disabled>复制片段</button>${options.onInsertSnippet ? '<button type="button" data-source-inventory-insert disabled>插入来源脚本</button>' : ""}</div><p data-source-inventory-snippet-status role="status" aria-live="polite"></p><p>${entry.kind === "weapon" ? "角色列表只列固定来源中武器类型一致的角色；脚本中还须有该角色的 char 声明。" : entry.kind === "artifact" ? "脚本中还须有该角色的 char 声明。件数只是配置输入；某件数是否有条款及其触发要求，应结合下方具体实现查看。" : "此片段仅声明所选角色，不自动生成行动。"}插入前请检查脚本中是否已有同一声明。</p>` : `<p>${esc(detail?.keyGap ?? "未取得与本次注册清单一致的配置键证据。")}不从目录名猜测键，也不生成可能无效的配置片段。</p>`}
        <details open><summary>固定来源与键的依据</summary><ul><li>${sourceLink({ path: entry.sourcePath, line: entry.sourceLine }, "宿主实际导入此包")}</li>${key ? `<li>${sourceLink(key.registrationRef, `注册函数：keys.${key.symbol}`)}</li><li>${sourceLink(key.catalogRef, "来源目录中的配置 Key")}</li><li>${sourceLink(key.shortcutRef, "解析器接受的配置键与别名")}</li><li>${sourceLink(key.localizationRef, "固定来源中文名称")}</li>` : ""}${metadata?.syntaxEvidence.map(ref => `<li>${sourceLink(ref, `GCSL 语法：${ref.path}:${ref.line}`)}</li>`).join("") ?? ""}</ul>${key ? `<p>同一来源键的别名：${key.aliases.map(alias => `<code>${esc(alias.key)}</code>`).join("、")}。</p>` : ""}</details>
        <details open><summary>具体 TODO／未实现标记（${detail?.todoMarkers.length ?? "未取得"}）</summary>${detail ? `<p>扫描本包及同族直接／传递引用的 ${detail.implementationFiles.length} 个 Go 实现文件，排除测试文件。保留来源原文；标记数量不是缺陷或完成率。</p>${detail.todoMarkers.length ? `<ul class="source-inventory__todos">${detail.todoMarkers.map(todo => `<li>${sourceLink(todo)}${todo.sharedImplementation ? " · 同族共享实现" : ""}<pre>${esc(todo.text)}</pre></li>`).join("")}</ul>` : "<p>该扫描范围内未发现上述显式文本标记；这不证明全部机制已经实现。</p>"}` : "<p>本次注册条目的实现元数据未取得，具体待补项尚不能列出。</p>"}</details>`;
      if (key) {
        const area = selectedHost.querySelector<HTMLTextAreaElement>("[data-source-inventory-snippet]")!, copy = selectedHost.querySelector<HTMLButtonElement>("[data-source-inventory-copy]")!, insert = selectedHost.querySelector<HTMLButtonElement>("[data-source-inventory-insert]");
        const fields = [...selectedHost.querySelectorAll<HTMLInputElement>("[data-source-inventory-number]")], owner = selectedHost.querySelector<HTMLSelectElement>("[data-source-inventory-owner]");
        const refreshSnippet = () => {
          const values = Object.fromEntries(fields.map(field => [field.dataset.sourceInventoryNumber!, field.valueAsNumber]));
          const valid = fields.every(field => field.checkValidity() && Number.isInteger(field.valueAsNumber)) && (!owner || !!owner.value) && (values.level === undefined || values.levelCap !== undefined && values.level <= values.levelCap);
          if (owner) chosenActorKey = owner.value;
          area.value = !valid ? "" : entry.kind === "character" ? `${key.configurationKey} char lvl=${values.level}/${values.levelCap} cons=${values.constellation} talent=${values.normal},${values.skill},${values.burst};`
            : entry.kind === "weapon" ? `${owner!.value} add weapon="${key.configurationKey}" refine=${values.refinement} lvl=${values.level}/${values.levelCap};`
            : `${owner!.value} add set="${key.configurationKey}" count=${values.pieces};`;
          copy.disabled = !valid; if (insert) insert.disabled = !valid;
          notice(valid ? "片段已按当前输入生成；这是配置声明，不会自动运行模拟。" : "请选择角色并填写合法整数；当前等级不能高于突破等级上限。");
        };
        fields.forEach(field => { field.oninput = refreshSnippet; }); if (owner) owner.onchange = refreshSnippet;
        copy.onclick = () => {
          const fallback = () => { area.focus(); area.select(); notice("浏览器未允许自动复制；片段已选中，可用键盘复制。"); };
          if (!navigator.clipboard?.writeText) { fallback(); return; }
          void navigator.clipboard.writeText(area.value).then(() => notice("已复制配置片段。"), fallback);
        };
        if (insert) insert.onclick = () => { if (!insert.disabled && area.value) { options.onInsertSnippet?.(area.value); notice("已将片段交给来源脚本编辑器；尚未运行。"); } };
        refreshSnippet();
      }
      selectedHost.querySelector<HTMLElement>("[data-source-inventory-selected-heading]")!.focus();
    };
    const renderList = () => {
      const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const matches = entries.filter(entry => {
        if (kind !== "all" && entry.kind !== kind) return false;
        if (gap === "todo" && !entry.metadata?.todoMarkers.length) return false;
        if (gap === "unresolved" && entry.metadata?.resolved) return false;
        const text = [displayName(entry), packageName(entry), entry.importPath, entry.metadata?.resolved?.configurationKey, ...(entry.metadata?.resolved?.aliases.map(alias => alias.key) ?? []), ...(entry.metadata?.todoMarkers.map(todo => todo.text) ?? [])].join(" ").toLocaleLowerCase();
        return terms.every(term => text.includes(term));
      });
      const pages = Math.max(1, Math.ceil(matches.length / pageSize)); page = Math.min(page, pages - 1);
      const start = page * pageSize, rows = matches.slice(start, start + pageSize);
      root.querySelector<HTMLElement>("[data-source-inventory-count]")!.textContent = `匹配 ${matches.length} / ${entries.length} 个来源包${matches.length ? `；显示第 ${start + 1}–${start + rows.length} 条` : "；可修改搜索或筛选条件"}。`;
      list.innerHTML = rows.length ? rows.map(entry => `<li><button type="button" class="source-inventory__choose" data-source-inventory-select="${esc(idOf(entry))}" aria-pressed="${selectedId === idOf(entry)}"><strong>${esc(displayName(entry))}</strong><span>${kindLabels[entry.kind]} · ${esc(packageName(entry))}</span><span>${entry.metadata?.resolved ? `配置键 ${esc(entry.metadata.resolved.configurationKey)}` : "配置键待查"}</span><small>${entry.metadata ? `明确 TODO／未实现标记 ${entry.metadata.todoMarkers.length} 条` : "实现元数据待查"}</small></button><p>${sourceLink({ path: entry.sourcePath, line: entry.sourceLine }, "查看固定注册行")}</p></li>`).join("") : '<li class="source-inventory__empty">没有匹配条目；这只表示当前筛选结果。</li>';
      root.querySelector<HTMLElement>("[data-source-inventory-page]")!.textContent = `第 ${page + 1} / ${pages} 页`; previous.disabled = page === 0; next.disabled = page + 1 >= pages;
    };
    list.onclick = event => { const button = (event.target as Element).closest<HTMLButtonElement>("[data-source-inventory-select]"); if (!button) return; const entry = entries.find(row => idOf(row) === button.dataset.sourceInventorySelect); if (entry) selectEntry(entry); };
    search.oninput = () => { query = search.value; page = 0; renderList(); };
    kindInput.onchange = () => { kind = kindInput.value; page = 0; renderList(); };
    gapInput.onchange = () => { gap = gapInput.value; page = 0; renderList(); };
    sizeInput.onchange = () => { pageSize = Number(sizeInput.value); page = 0; renderList(); };
    previous.onclick = () => { if (page > 0) { page--; renderList(); } }; next.onclick = () => { page++; renderList(); };
    renderList();
  }).catch(error => {
    if (disposed) return;
    root.innerHTML = `<section class="card source-inventory"><h2>固定来源注册名册</h2><p role="alert">无法读取名册：${esc(error instanceof Error ? error.message : error)}</p><p>尚未用旧计数或包名推断配置键。</p><button type="button" data-source-inventory-retry>重新读取</button></section>`;
    root.querySelector<HTMLButtonElement>("[data-source-inventory-retry]")!.onclick = () => { renderSourceHostInventory(root, options); };
  });
  return () => { disposed = true; abort.abort(); };
}
