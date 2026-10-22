import { describe, expect, it, vi } from "vitest";
import { teamTemplates } from "../../../packages/game-data/src/team-templates";
import { filterTeamCandidates, renderTeamCandidatesPanel } from "./team-candidates-panel";

/** Small DOM boundary for this string-rendered panel; no browser or extra DOM dependency. */
function panelRoot() {
  type Button = { dataset: { teamCandidateUse: string }; disabled: boolean; onclick: (() => Promise<void>) | null };
  let buttons: Button[] = [];
  let markup = "";
  const search = { value: "", oninput: null as (() => void) | null };
  const count = { textContent: "" };
  const status = { textContent: "" };
  const list = {
    set innerHTML(value: string) {
      markup = value;
      buttons = Array.from(value.matchAll(/data-team-candidate-use="([^"]+)"/g), match => ({
        dataset: { teamCandidateUse: match[1]! }, disabled: false, onclick: null,
      }));
    },
    querySelectorAll: () => buttons,
  };
  const elements: Record<string, unknown> = {
    "[data-team-candidates-search]": search,
    "[data-team-candidates-count]": count,
    "[data-team-candidates-status]": status,
    "[data-team-candidates-list]": list,
  };
  const root = { innerHTML: "", querySelector: (selector: string) => elements[selector] } as unknown as HTMLElement;
  return { root, search, status, count, buttons: () => buttons, markup: () => markup };
}

describe("team candidates panel", () => {
  it("filters by actual character names and Chinese reaction, preserving pinned identities and order", () => {
    expect(filterTeamCandidates("  行秋 夜兰 ").map(template => template.id)).toEqual(["vaporize-hydro-pyro", "hyperbloom-kuki"]);
    expect(filterTeamCandidates("月感电")).toEqual(teamTemplates.filter(template => template.reaction === "lunar-charged"));
    expect(filterTeamCandidates("VAPORIZE")[0]).toBe(teamTemplates[0]);
    expect(filterTeamCandidates("没有这个队伍")).toEqual([]);
    expect(filterTeamCandidates(" ")).toEqual(teamTemplates);
  });

  it("renders real member names and passes the selected card's original ID after filtering", async () => {
    const panel = panelRoot();
    const select = vi.fn<(id: string) => void>();
    renderTeamCandidatesPanel(panel.root, { onSelect: select });
    expect(panel.buttons().map(button => button.dataset.teamCandidateUse)).toEqual(teamTemplates.map(template => template.id));
    expect(panel.markup()).toContain("胡桃 · 行秋 · 夜兰 · 钟离");
    expect(panel.markup()).not.toMatch(/character:\d+/);
    panel.search.value = "月感电";
    panel.search.oninput!();
    const selected = panel.buttons().at(-1)!;
    await selected.onclick!();
    expect(select).toHaveBeenCalledExactlyOnceWith(teamTemplates.filter(template => template.reaction === "lunar-charged").at(-1)!.id);
    expect(selected.disabled).toBe(false);
  });

  it("shows the actual load failure and allows retry", async () => {
    const panel = panelRoot();
    renderTeamCandidatesPanel(panel.root, { onSelect: async () => { throw new Error("当前来源缺少角色映射。"); } });
    await panel.buttons()[0]!.onclick!();
    expect(panel.status.textContent).toBe("当前来源缺少角色映射。");
    expect(panel.buttons().every(button => !button.disabled)).toBe(true);
  });
});
