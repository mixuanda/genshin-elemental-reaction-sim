import { gameDataCatalog } from "../../../packages/game-data/src/catalog";
import { teamTemplates } from "../../../packages/game-data/src/team-templates";

export interface TeamCandidatesPanelOptions {
  onSelect: (templateId: string) => void | Promise<void>;
}

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

const characterNames = new Map(gameDataCatalog.characters.map(character => [character.id, character.name]));
const reactionLabels: Record<string, string> = {
  vaporize: "蒸发", melt: "融化", overload: "超载", "electro-charged": "感电",
  aggravate: "激化", hyperbloom: "超绽放", burgeon: "烈绽放", bloom: "绽放",
  freeze: "冻结", physical: "物理", geo: "岩队", "lunar-crystallize": "月结晶",
  "mono-pyro": "纯火", anemo: "风队", "lunar-charged": "月感电", "lunar-bloom": "月绽放",
};

/** Keeps the pinned template order and identity; search does not rank teams. */
export function filterTeamCandidates(query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return teamTemplates.filter(template => {
    const text = [template.name, template.reaction, reactionLabels[template.reaction] ?? "",
      ...template.members.map(member => characterNames.get(member.characterId) ?? member.characterId),
    ].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}

/** Presents existing editable templates; source-team-builder owns applying and validating them. */
export function renderTeamCandidatesPanel(root: HTMLElement, options: TeamCandidatesPanelOptions): void {
  root.innerHTML = `<section aria-label="队伍候选">
    <h2>队伍候选</h2>
    <p class="muted">入门模板，可继续编辑；按现有模板顺序展示，不按 DPS 排名。</p>
    <label>查找队伍、角色或反应
      <input type="search" data-team-candidates-search placeholder="例如：胡桃、超绽放、行秋 夜兰" autocomplete="off">
    </label>
    <p class="muted" data-team-candidates-count aria-live="polite"></p>
    <p data-team-candidates-status role="status" aria-live="polite"></p>
    <div data-team-candidates-list style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px"></div>
  </section>`;

  const search = root.querySelector<HTMLInputElement>("[data-team-candidates-search]")!;
  const count = root.querySelector<HTMLElement>("[data-team-candidates-count]")!;
  const status = root.querySelector<HTMLElement>("[data-team-candidates-status]")!;
  const list = root.querySelector<HTMLElement>("[data-team-candidates-list]")!;
  let selecting = false;

  const renderCards = (): void => {
    const candidates = filterTeamCandidates(search.value);
    count.textContent = `显示 ${candidates.length} / ${teamTemplates.length} 支队伍`;
    list.innerHTML = candidates.length ? candidates.map(template => `<article class="card" data-team-candidate-id="${escapeHtml(template.id)}" style="display:flex;flex-direction:column;gap:10px">
      <div><h3 style="margin:0 0 8px">${escapeHtml(template.name)}</h3><span class="muted">${escapeHtml(reactionLabels[template.reaction] ?? template.reaction)} · 入门模板</span></div>
      <p style="margin:0">${template.members.map(member => escapeHtml(characterNames.get(member.characterId) ?? member.characterId)).join(" · ")}</p>
      <p class="muted" style="margin:0">${template.beginnerSequence.length} 步起手动作，载入后可调整配装与动作。</p>
      <div class="editor-actions" style="margin-top:auto"><button type="button" class="primary" data-team-candidate-use="${escapeHtml(template.id)}" aria-label="使用这支队伍：${escapeHtml(template.name)}">使用这支队伍</button></div>
    </article>`).join("") : `<p>没有找到匹配的队伍。试试角色名或反应名。</p>`;

    list.querySelectorAll<HTMLButtonElement>("[data-team-candidate-use]").forEach(button => {
      button.disabled = selecting;
      button.onclick = async () => {
        if (selecting) return;
        const template = candidates.find(candidate => candidate.id === button.dataset.teamCandidateUse);
        if (!template) return;
        selecting = true;
        status.textContent = `正在载入「${template.name}」…`;
        list.querySelectorAll<HTMLButtonElement>("[data-team-candidate-use]").forEach(item => { item.disabled = true; });
        try {
          await options.onSelect(template.id);
          status.textContent = `已选择「${template.name}」。`;
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : "载入队伍失败，请重试。";
        } finally {
          selecting = false;
          list.querySelectorAll<HTMLButtonElement>("[data-team-candidate-use]").forEach(item => { item.disabled = false; });
        }
      };
    });
  };

  search.oninput = renderCards;
  renderCards();
}
