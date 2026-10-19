import {
  ARTIFACT_SLOTS, ARTIFACT_SLOT_LABELS, ARTIFACT_MAIN_STATS, ARTIFACT_SUB_STATS, ARTIFACT_STAT_LABELS,
  ARTIFACT_MAX_LEVEL, ARTIFACT_INITIAL_SUBSTATS, artifactStatSource, artifactMainStatValue, artifactSubstatTiers,
  type ArtifactPieceInput, type ArtifactSlot, type ArtifactRarity, type ArtifactStatKey, type ArtifactSubstatKey
} from "@genshin-dps-lab/game-data/artifact-build";
import { equipmentArtifactSets, type EquipmentDataset } from "@genshin-dps-lab/game-data/equipment-build";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]!);
const display = (key: string, value: number): string => key.endsWith("_") ? `${(value * 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%` : String(value);

export function mountArtifactControls(container: HTMLElement, dataset?: EquipmentDataset): { getArtifacts(): ArtifactPieceInput[]; setArtifacts(pieces: ArtifactPieceInput[]): void } {
  const artifactSetCatalog = equipmentArtifactSets(dataset);
  let pieces: ArtifactPieceInput[] = [];
  const pieceFor = (slot: ArtifactSlot) => pieces.find(piece => piece.slot === slot);
  const options = (keys: readonly string[], selected: string, labels: Record<string, string> = {}) => keys.map(key => `<option value="${esc(key)}"${selected === key ? " selected" : ""}>${esc(labels[key] ?? key)}</option>`).join("");

  function mainStatHint(piece: ArtifactPieceInput): string {
    if (piece.observed) return `导入实际词条：${piece.observed.source}。聚合副词条直接参与计算，不推测强化档位或认证掉落合法性。主词条${piece.observed.mainStatValue === undefined ? "逐等级查表" : `保留导入值 ${display(piece.mainStat, piece.observed.mainStatValue)}`}。`;
    let mainValue = "输入尚未匹配精确等级表";
    try { mainValue = display(piece.mainStat, artifactMainStatValue(piece.rarity, piece.level, piece.mainStat)); } catch { /* Core gives the actionable error on apply. */ }
    const count = Number.isInteger(piece.level) && piece.level >= 0 && piece.level <= ARTIFACT_MAX_LEVEL[piece.rarity]
      ? String(piece.initialSubstats + Math.floor(piece.level / 4)) : "未知（请填写合法等级）";
    return `主词条查表结果：${mainValue}。当前必须共有 ${count} 次初始／强化档位；四条词条解锁前必须新增词条。`;
  }

  function readPiece(slot: ArtifactSlot): ArtifactPieceInput | undefined {
    const root = container.querySelector<HTMLElement>(`[data-artifact="${slot}"]`)!;
    const field = (name: string) => root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-artifact-field="${name}"]`)!;
    const setId = field("set").value;
    if (!setId) return undefined;
    const previous = pieceFor(slot);
    if (previous?.observed) {
      const mainStat = field("main").value as ArtifactStatKey;
      const mainInput = field("observed-main").value.trim();
      return {
        slot, setId, rarity: Number(field("rarity").value) as ArtifactRarity,
        level: field("level").value.trim() ? Number(field("level").value) : NaN,
        mainStat, initialSubstats: 0, substats: [],
        observed: {
          source: previous.observed.source,
          ...(mainInput ? { mainStatValue: Number(mainInput) / (mainStat.endsWith("_") ? 100 : 1) } : {}),
          substats: [0, 1, 2, 3].flatMap(index => {
            const stat = field(`sub-${index}`).value as ArtifactSubstatKey;
            if (!stat) return [];
            const input = field(`value-${index}`).value.trim();
            return [{ stat, value: input ? Number(input) / (stat.endsWith("_") ? 100 : 1) : NaN }];
          })
        }
      };
    }
    return {
      slot, setId, rarity: Number(field("rarity").value) as ArtifactRarity,
      level: field("level").value.trim() ? Number(field("level").value) : NaN, mainStat: field("main").value as ArtifactStatKey,
      initialSubstats: Number(field("initial").value),
      substats: [0, 1, 2, 3].flatMap(index => {
        const stat = field(`sub-${index}`).value;
        if (!stat) return [];
        const value = field(`rolls-${index}`).value.trim();
        return [{ stat: stat as ArtifactSubstatKey, rolls: value ? value.split(/[,，\s]+/).filter(Boolean).map(Number) : [] }];
      })
    };
  }

  function render(): void {
    const opened = new Set(Array.from(container.querySelectorAll<HTMLDetailsElement>("details[open]")).map(element => element.dataset.artifact));
    container.innerHTML = `<h4>圣遗物实际词条与强化档位</h4><p class="calculator-hint">可装备 0–5 件。导入词条可直接修改实际数值；手动示例使用初始／强化档位推导。新选择套装时使用明确的 +0 低档位示例，不表示你的实际掉落。</p>` +
      `<p class="calculator-hint">套装列表来自当前工作区；主／副词条固定表来源：${esc(artifactStatSource.source)} · ${esc(artifactStatSource.id)}（提交 ${esc(artifactStatSource.sourceCommit)}，游戏版本 ${esc(artifactStatSource.gameVersion)}，发布状态 ${esc(artifactStatSource.releaseStatus)}）。</p>` + ARTIFACT_SLOTS.map(slot => {
      const piece = pieceFor(slot);
      const sets = artifactSetCatalog.filter(set => set.slots.some(entry => entry.slot === slot));
      const set = sets.find(entry => entry.id === piece?.setId);
      const head = `<details data-artifact="${slot}"${opened.has(slot) ? " open" : ""}><summary>${ARTIFACT_SLOT_LABELS[slot]} · ${esc(set?.name ?? "不装备")}${piece ? ` ${piece.rarity} 星 +${piece.level}` : ""}</summary><label>套装<select data-artifact-field="set"><option value="">不装备</option>${sets.map(entry => `<option value="${esc(entry.id)}"${entry.id === piece?.setId ? " selected" : ""}>${esc(entry.name)}</option>`).join("")}</select></label>`;
      if (!piece || !set) return `${head}</details>`;
      return head + `<div class="calculator-fields"><label>星级<select data-artifact-field="rarity">${options(set.rarityList.map(String), String(piece.rarity))}</select></label>` +
        `<label>强化等级<input data-artifact-field="level" type="number" min="0" max="${ARTIFACT_MAX_LEVEL[piece.rarity]}" step="1" value="${piece.level}"></label>` +
        `<label>主词条<select data-artifact-field="main">${options(ARTIFACT_MAIN_STATS[slot], piece.mainStat, ARTIFACT_STAT_LABELS)}</select></label>` +
        (piece.observed ? `<label>导入主词条${piece.mainStat.endsWith("_") ? "（%）" : ""}<input data-artifact-field="observed-main" type="number" min="0" step="any" placeholder="留空按等级查表" value="${piece.observed.mainStatValue === undefined ? "" : piece.observed.mainStatValue * (piece.mainStat.endsWith("_") ? 100 : 1)}"></label>` : `<label>初始副词条数量<select data-artifact-field="initial">${options(ARTIFACT_INITIAL_SUBSTATS[piece.rarity].map(String), String(piece.initialSubstats))}</select></label>`) + `</div>` +
        `<p class="calculator-hint" data-artifact-main-hint>${esc(mainStatHint(piece))}</p>` +
        [0, 1, 2, 3].map(index => {
          if (piece.observed) {
            const sub = piece.observed.substats[index];
            return `<div class="calculator-fields"><label>副词条 ${index + 1}<select data-artifact-field="sub-${index}"><option value="">未解锁／不选择</option>${options(ARTIFACT_SUB_STATS.filter(key => key !== piece.mainStat), sub?.stat ?? "", ARTIFACT_STAT_LABELS)}</select></label><label>实际数值${sub?.stat.endsWith("_") ? "（%）" : ""}<input data-artifact-field="value-${index}" type="number" min="0" step="any" value="${sub ? sub.value * (sub.stat.endsWith("_") ? 100 : 1) : ""}"></label></div>`;
          }
          const sub = piece.substats[index];
          const tierText = sub ? artifactSubstatTiers(piece.rarity, sub.stat).map((value, tier) => `${tier}＝${display(sub.stat, value)}`).join("；") : "选择词条后显示精确档位。";
          return `<div class="calculator-fields"><label>副词条 ${index + 1}<select data-artifact-field="sub-${index}"><option value="">未解锁／不选择</option>${options(ARTIFACT_SUB_STATS.filter(key => key !== piece.mainStat), sub?.stat ?? "", ARTIFACT_STAT_LABELS)}</select></label><label>每次档位编号<input data-artifact-field="rolls-${index}" value="${esc(sub?.rolls.join(",") ?? "")}" placeholder="例如 0,3,2"></label></div><p class="calculator-hint">${esc(tierText)}</p>`;
        }).join("") + `<button type="button" data-artifact-example="${slot}">填入当前等级的合法低档位示例</button><p class="calculator-hint">此按钮只生成明确的配装示例，不表示你的掉落／导入记录。</p></details>`;
    }).join("");
  }

  function setPiece(slot: ArtifactSlot, value: ArtifactPieceInput | undefined): void {
    pieces = [...pieces.filter(piece => piece.slot !== slot), ...(value ? [value] : [])];
  }

  function fillLegalRolls(piece: ArtifactPieceInput): void {
    // Validate before allocating roll arrays: a blank or enormous level must not
    // become a zero-level artifact or a loop that locks the browser.
    artifactMainStatValue(piece.rarity, piece.level, piece.mainStat);
    if (piece.observed) { delete piece.observed; piece.initialSubstats = ARTIFACT_INITIAL_SUBSTATS[piece.rarity][0]!; }
    if (!ARTIFACT_INITIAL_SUBSTATS[piece.rarity].includes(piece.initialSubstats)) throw new Error("请先选择该星级允许的初始副词条数量。");
    const count = piece.initialSubstats + Math.floor(piece.level / 4);
    piece.substats = ARTIFACT_SUB_STATS.filter(stat => stat !== piece.mainStat).slice(0, Math.min(4, count)).map(stat => ({ stat, rolls: [0] }));
    for (let i = piece.substats.length; i < count; i++) piece.substats[0]!.rolls.push(0);
  }

  container.addEventListener("change", event => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const slot = target.closest<HTMLElement>("[data-artifact]")?.dataset.artifact as ArtifactSlot | undefined;
    if (!slot) return;
    if (target.dataset.artifactField === "set") {
      const set = artifactSetCatalog.find(entry => entry.id === target.value);
      if (!set) setPiece(slot, undefined);
      else {
        const rarity = Math.max(...set.rarityList) as ArtifactRarity;
        const piece: ArtifactPieceInput = { slot, setId: set.id, rarity, level: 0, mainStat: ARTIFACT_MAIN_STATS[slot][0]!, initialSubstats: ARTIFACT_INITIAL_SUBSTATS[rarity][0]!, substats: [] };
        fillLegalRolls(piece);
        setPiece(slot, piece);
      }
    } else {
      const piece = readPiece(slot);
      if (piece) {
        if (piece.observed && ["level", "rarity", "main"].includes(target.dataset.artifactField ?? "")) delete piece.observed.mainStatValue;
        if (target.dataset.artifactField === "rarity") { piece.level = Math.min(piece.level, ARTIFACT_MAX_LEVEL[piece.rarity]); piece.initialSubstats = ARTIFACT_INITIAL_SUBSTATS[piece.rarity][0]!; }
        setPiece(slot, piece);
        if (target instanceof HTMLInputElement) {
          // A blur-triggered change must not replace the next focused control or
          // remove the example button between pointerdown and click.
          const root = target.closest<HTMLElement>("[data-artifact]")!;
          root.querySelector("[data-artifact-main-hint]")!.textContent = mainStatHint(piece);
          const set = artifactSetCatalog.find(entry => entry.id === piece.setId)!;
          root.querySelector("summary")!.textContent = `${ARTIFACT_SLOT_LABELS[slot]} · ${set.name} ${piece.rarity} 星 +${Number.isFinite(piece.level) ? piece.level : "?"}`;
          return;
        }
      }
    }
    render();
  });
  container.addEventListener("click", event => {
    const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-artifact-example]")?.dataset.artifactExample as ArtifactSlot | undefined;
    if (!slot) return;
    const piece = readPiece(slot);
    if (piece) {
      try { fillLegalRolls(piece); setPiece(slot, piece); render(); }
      catch (error) {
        container.querySelector("[data-artifact-error]")?.remove();
        const message = document.createElement("p");
        message.dataset.artifactError = "true";
        message.setAttribute("role", "alert");
        message.textContent = error instanceof Error ? error.message : "圣遗物输入无效。";
        container.append(message);
      }
    }
  });
  render();
  return {
    getArtifacts: () => ARTIFACT_SLOTS.flatMap(slot => { const piece = readPiece(slot); return piece ? [piece] : []; }),
    setArtifacts: value => { pieces = structuredClone(value); render(); }
  };
}
