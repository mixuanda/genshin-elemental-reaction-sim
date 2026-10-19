export interface LogPageFilter<T> {
  label: string;
  options: readonly { value: string; label: string }[];
  value(entry: T): string;
}

const PAGE_SIZE = 25;
const esc = (value: string): string => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderPagedLog<T>(options: {
  body: HTMLElement;
  entries: readonly T[];
  label: string;
  searchPlaceholder: string;
  searchText(entry: T): string;
  filters: readonly LogPageFilter<T>[];
  renderRow(entry: T): string;
  emptyHtml: string;
}): void {
  const { body, entries, label, filters } = options;
  const document = body.ownerDocument;
  const controlsId = `${body.id}Controls`;
  let controls = document.getElementById(controlsId);
  if (!controls) {
    controls = document.createElement("div");
    controls.id = controlsId;
    controls.className = "log-page-controls";
    (body.closest(".table-wrap") ?? body).before(controls);
  }
  const savedSearch = controls.querySelector<HTMLInputElement>("[data-log-search]")?.value ?? "";
  const savedSelections = [...controls.querySelectorAll<HTMLSelectElement>("[data-log-filter]")].map(select => select.value);
  const savedPage = Number(controls.dataset.logPage ?? 0);
  controls.innerHTML = `<div class="workspace-fields"><label>${esc(label)}检索<input type="search" data-log-search placeholder="${esc(options.searchPlaceholder)}" aria-controls="${esc(body.id)}"></label>${filters.map(filter => `<label>${esc(filter.label)}<select data-log-filter aria-controls="${esc(body.id)}"><option value="">全部</option>${filter.options.map(option => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join("")}</select></label>`).join("")}</div><div class="editor-actions"><button type="button" data-log-previous aria-label="${esc(label)}上一页" aria-controls="${esc(body.id)}">上一页</button><button type="button" data-log-next aria-label="${esc(label)}下一页" aria-controls="${esc(body.id)}">下一页</button></div><p data-log-status role="status" aria-live="polite"></p><p class="calculator-hint">筛选与分页只影响此处显示；完整模拟记录导出仍包含全部日志。</p>`;

  const search = controls.querySelector<HTMLInputElement>("[data-log-search]")!;
  const selections = [...controls.querySelectorAll<HTMLSelectElement>("[data-log-filter]")];
  const previous = controls.querySelector<HTMLButtonElement>("[data-log-previous]")!;
  const next = controls.querySelector<HTMLButtonElement>("[data-log-next]")!;
  const status = controls.querySelector<HTMLElement>("[data-log-status]")!;
  search.value = savedSearch;
  selections.forEach((select, index) => {
    const saved = savedSelections[index] ?? "";
    select.value = [...select.options].some(option => option.value === saved) ? saved : "";
  });
  let page = savedPage;
  let matched: readonly T[] = entries;

  const render = (): void => {
    const focused = document.activeElement;
    const start = page * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, matched.length);
    const pageCount = Math.ceil(matched.length / PAGE_SIZE);
    controls!.dataset.logPage = String(page);
    body.innerHTML = matched.length ? matched.slice(start, end).map(entry => options.renderRow(entry)).join("") : options.emptyHtml;
    previous.disabled = page === 0;
    next.disabled = page + 1 >= pageCount;
    status.textContent = `${label}：匹配 ${matched.length} / 共 ${entries.length} 条；显示第 ${matched.length ? start + 1 : 0}–${end} 条；第 ${matched.length ? page + 1 : 0} / ${pageCount} 页，每页 ${PAGE_SIZE} 条。`;
    if (focused === previous && previous.disabled) (next.disabled ? search : next).focus();
    else if (focused === next && next.disabled) (previous.disabled ? search : previous).focus();
  };
  const filter = (resetPage = true): void => {
    const query = search.value.trim().toLocaleLowerCase();
    const selected = selections.map(select => select.value);
    matched = entries.filter(entry =>
      (!query || options.searchText(entry).toLocaleLowerCase().includes(query)) &&
      filters.every((item, index) => !selected[index] || item.value(entry) === selected[index])
    );
    page = resetPage ? 0 : Math.max(0, Math.min(page, Math.ceil(matched.length / PAGE_SIZE) - 1));
    render();
  };
  search.addEventListener("input", () => filter());
  selections.forEach(select => select.addEventListener("change", () => filter()));
  previous.addEventListener("click", () => { page -= 1; render(); });
  next.addEventListener("click", () => { page += 1; render(); });
  filter(false);
}
