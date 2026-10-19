import { gameDataCatalog } from "../../../packages/game-data/src/catalog";
import type { EquipmentBuildInput } from "../../../packages/game-data/src/equipment-build";
import type { ImportedEditableBuild } from "../../../packages/game-data/src/build-import";
import type { SourceHostVariant, SourceTeamDraft, SourceTeamInventory } from "./source-team-builder";

export interface ImportedRosterMetadata {
  constellation: number;
  baseTalentLevels: { auto: number; skill: number; burst: number };
  label: string;
}

export interface ImportedRosterEntry {
  input: EquipmentBuildInput;
  metadata: ImportedRosterMetadata;
  characterKey: string;
}

interface Options {
  root: HTMLElement;
  builds: readonly ImportedEditableBuild[];
  loadInventory(variant: SourceHostVariant): Promise<SourceTeamInventory>;
  convert(input: EquipmentBuildInput, metadata: ImportedRosterMetadata & { characterKey: string }, inventory: SourceTeamInventory): SourceTeamDraft["members"][number];
  validate(members: SourceTeamDraft["members"], inventory: SourceTeamInventory): void;
  addRoster(entries: ImportedRosterEntry[], source: { hostVariant: SourceHostVariant; revision: string }, mode: "merge" | "replace"): Promise<void>;
}

const esc = (value: unknown): string => String(value ?? "未知").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

function rowProblems(build: ImportedEditableBuild): string[] {
  const problems = build.diagnostics.filter(issue => issue.severity === "error").map(issue => issue.message);
  if (!build.equipmentInput) problems.push("装备身份或必需装备数据不完整");
  if (build.constellation === null) problems.push("命座数据缺失");
  if (Object.values(build.baseTalentLevels).some(level => level === null)) problems.push("普攻、E、Q基础天赋等级未完整取得");
  return [...new Set(problems)];
}

/** Batch handoff from a parsed GOOD/Enka roster. Every member is resolved and validated before a single callback. */
export function renderImportedRosterControls(options: Options): void {
  const { root, builds } = options;
  const checked = new Set<number>();
  const selectedKeys = new Map<number, string>();
  let inventory: SourceTeamInventory | null = null;
  let variant: SourceHostVariant = "classic";
  let inventoryRequest = 0;
  root.innerHTML = `<section class="card" data-imported-roster><h3>批量加入来源队伍</h3><p>从本次导入的真实配装中选择最多四位角色。必须有完整装备、命座、基础天赋及明确来源形态；缺项会逐条标出。合并会替换同角色装备并保留队伍动作；新建队伍会替换当前来源草稿并从空动作开始。</p><p class="calculator-hint">导入只传入实际角色、武器和圣遗物数据。它不会把独立计算器的“装备被动关闭”状态带进来源模拟；来源执行器会按其规则执行对应装备机制，未明确映射的条款会显示限制。</p><div class="workspace-fields"><label>来源规则<select data-roster-source><option value="classic">普通／月曜 · b4</option><option value="stellar">星辉 · a7</option></select></label><label>处理当前队伍<select data-roster-mode><option value="merge">合并到当前队伍</option><option value="replace">以所选角色创建新队伍</option></select></label></div><div data-roster-rows></div><button type="button" data-roster-submit disabled>批量加入所选角色</button><p data-roster-status role="status" aria-live="polite"></p></section>`;
  const sourceSelect = root.querySelector<HTMLSelectElement>("[data-roster-source]")!;
  const modeSelect = root.querySelector<HTMLSelectElement>("[data-roster-mode]")!;
  const rows = root.querySelector<HTMLElement>("[data-roster-rows]")!;
  const submit = root.querySelector<HTMLButtonElement>("[data-roster-submit]")!;
  const status = root.querySelector<HTMLElement>("[data-roster-status]")!;

  const problemsFor = (index: number) => rowProblems(builds[index]!);
  const mappingProblem = (index: number): string | null => {
    const build = builds[index]!;
    const input = build.equipmentInput;
    const levels = build.baseTalentLevels;
    const characterKey = selectedKeys.get(index) ?? (availableForms(index).length === 1 ? availableForms(index)[0]!.key : "");
    if (!inventory || !input || build.constellation === null || levels.auto === null || levels.skill === null || levels.burst === null || !characterKey) return null;
    try {
      const member = options.convert(input, { constellation: build.constellation, baseTalentLevels: { auto: levels.auto, skill: levels.skill, burst: levels.burst }, label: build.name, characterKey }, inventory);
      options.validate([member], inventory);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  const availableForms = (index: number) => {
    const build = builds[index]!;
    const character = build.equipmentInput && gameDataCatalog.characters.find(item => item.id === build.equipmentInput!.characterId);
    return character ? inventory?.characters.filter(item => item.sourceGameId === character.avatarId) ?? [] : [];
  };
  const drawRows = () => {
    rows.innerHTML = builds.length ? builds.map((build, index) => {
      const problems = problemsFor(index);
      const forms = availableForms(index);
      const selectedKey = selectedKeys.get(index) ?? (forms.length === 1 ? forms[0]!.key : "");
      if (forms.length === 1 && !selectedKeys.has(index)) selectedKeys.set(index, selectedKey);
      const mappingProblemText = mappingProblem(index);
      const valid = !problems.length && !!inventory && forms.length > 0 && (forms.length === 1 || !!selectedKey) && !mappingProblemText;
      const formOptions = forms.map(item => `<option value="${esc(item.key)}"${item.key === selectedKey ? " selected" : ""}>${esc(item.name)} · ${esc(item.key)}</option>`).join("");
      const formControl = inventory
        ? forms.length > 1
          ? `<label>来源角色形态<select data-roster-form="${index}"><option value="">请选择精确形态</option>${formOptions}</select></label>`
          : forms.length === 1
            ? `<p>精确来源形态：${esc(forms[0]!.name)} · <code>${esc(forms[0]!.key)}</code></p>`
            : `<p class="notice">当前来源没有匹配的角色形态；此角色不能加入。</p>`
        : `<p>正在载入来源身份…</p>`;
      const warnings = build.diagnostics.filter(issue => issue.severity === "warning").map(issue => issue.message);
      return `<article class="card" data-roster-entry="${index}"><label><input type="checkbox" data-roster-check="${index}"${checked.has(index) ? " checked" : ""}${valid ? "" : " disabled"}>选择 ${esc(build.name)}</label><p>来源记录：${esc(build.sourceKey)} · ${esc(build.name)}</p>${formControl}${problems.length ? `<p class="notice">不能加入：${problems.map(esc).join("；")}</p>` : mappingProblemText ? `<p class="notice">此来源无法接收：${esc(mappingProblemText)}</p>` : warnings.length ? `<p class="calculator-hint">导入提示：${warnings.map(esc).join("；")}</p>` : ""}</article>`;
    }).join("") : "<p>本次导入没有可用角色记录。</p>";
    rows.querySelectorAll<HTMLInputElement>("[data-roster-check]").forEach(input => input.addEventListener("change", () => {
      const index = Number(input.dataset.rosterCheck);
      if (input.checked) checked.add(index); else checked.delete(index);
      refreshSubmit();
    }));
    rows.querySelectorAll<HTMLSelectElement>("[data-roster-form]").forEach(select => select.addEventListener("change", () => {
      const index = Number(select.dataset.rosterForm);
      selectedKeys.set(index, select.value);
      if (!select.value) checked.delete(index);
      drawRows();
      refreshSubmit();
    }));
    refreshSubmit();
  };
  const refreshSubmit = () => {
    const indices = [...checked];
    const mapped = indices.map(index => selectedKeys.get(index) ?? (availableForms(index).length === 1 ? availableForms(index)[0]!.key : ""));
    const unique = new Set(mapped).size === mapped.length;
    const gameIdentities = mapped.map(key => inventory?.characters.find(character => character.key === key)?.sourceGameId)
      .map(id => id === 10000005 || id === 10000007 ? "traveler" : id)
      .filter((id): id is number | "traveler" => id !== undefined);
    const uniqueGameIdentities = new Set(gameIdentities).size === gameIdentities.length;
    submit.disabled = !inventory || indices.length < 1 || indices.length > 4 || mapped.some(key => !key) || !unique || !uniqueGameIdentities || indices.some(index => problemsFor(index).length > 0 || !!mappingProblem(index));
    if (indices.length > 4) status.textContent = "来源队伍最多四名角色；请减少选择。";
    else if (!unique) status.textContent = "所选记录指向重复的来源角色形态；请检查选择。";
    else if (!uniqueGameIdentities) status.textContent = "所选形态属于同一游戏角色身份（包括不同元素旅行者）；请只选其中一项。";
    else status.textContent = indices.length ? `已选 ${indices.length}/4 位；批量转换和队伍验证会全部成功后才一次提交。` : "请选择 1–4 套完整配装。";
  };
  const load = async () => {
    const request = ++inventoryRequest;
    variant = sourceSelect.value as SourceHostVariant;
    inventory = null;
    submit.disabled = true;
    drawRows();
    status.textContent = `正在读取${variant === "classic" ? "b4" : "a7"}来源角色身份…`;
    try {
      const next = await options.loadInventory(variant);
      if (request !== inventoryRequest || sourceSelect.value !== variant) return;
      inventory = next;
      for (const index of [...selectedKeys.keys()]) if (!availableForms(index).some(item => item.key === selectedKeys.get(index))) selectedKeys.delete(index);
      for (const index of [...checked]) if (!availableForms(index).some(item => item.key === (selectedKeys.get(index) ?? ""))) checked.delete(index);
      drawRows();
    } catch (error) {
      if (request !== inventoryRequest) return;
      drawRows();
      status.textContent = `来源名册载入失败：${error instanceof Error ? error.message : String(error)}`;
    }
  };
  sourceSelect.addEventListener("change", () => { checked.clear(); selectedKeys.clear(); void load(); });
  modeSelect.addEventListener("change", () => {
    status.textContent = modeSelect.value === "replace" ? "将替换当前来源草稿；新队伍动作列表为空。" : "将合并到当前队伍；同角色装备会替换，现有动作保留。";
  });
  submit.addEventListener("click", async () => {
    if (!inventory) return;
    const indices = [...checked];
    submit.disabled = true;
    try {
      const entries: ImportedRosterEntry[] = indices.map(index => {
        const build = builds[index]!;
        const input = build.equipmentInput;
        const constellation = build.constellation;
        const levels = build.baseTalentLevels;
        if (!input || constellation === null || levels.auto === null || levels.skill === null || levels.burst === null) throw new Error(`${build.name} 缺少装备、命座或基础天赋，不能批量提交。`);
        const characterKey = selectedKeys.get(index) ?? (availableForms(index).length === 1 ? availableForms(index)[0]!.key : "");
        if (!characterKey) throw new Error(`${build.name} 尚未选择精确来源角色形态。`);
        return { input, metadata: { constellation, baseTalentLevels: { auto: levels.auto, skill: levels.skill, burst: levels.burst }, label: build.name }, characterKey };
      });
      const members = entries.map(entry => options.convert(entry.input, { ...entry.metadata, characterKey: entry.characterKey }, inventory!));
      options.validate(members, inventory);
      await options.addRoster(entries, { hostVariant: variant, revision: inventory.revision }, modeSelect.value as "merge" | "replace");
      status.textContent = `${entries.length} 位角色已一次性加入${modeSelect.value === "merge" ? "当前队伍，原动作保留" : "新队伍；当前草稿已替换且动作为空"}。`;
    } catch (error) {
      refreshSubmit();
      status.textContent = `未提交任何角色：${error instanceof Error ? error.message : String(error)}`;
    }
  });
  void load();
}
