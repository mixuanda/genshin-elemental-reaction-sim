import {
  createGraduationBuildPlaceholder,
  parseEnkaShowcase,
  presets
} from "@genshin-dps-lab/game-data";
import {
  ConfigMigrationError,
  migrateConfig,
  type DamageEvent,
  type GraduationBuildPlaceholder,
  type ImportedShowcase,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { simulate } from "@genshin-dps-lab/sim-core";

const ELEMENT_LABELS: Record<string, string> = {
  pyro: "火",
  cryo: "冰",
  hydro: "水",
  electro: "雷",
  anemo: "风",
  geo: "岩",
  dendro: "草",
  physical: "物理"
};

const ELEMENT_COLORS: Record<string, string> = {
  pyro: "#ff8b72",
  cryo: "#8ed8ff",
  hydro: "#6fa8ff",
  electro: "#bd91ff",
  anemo: "#72e0c1",
  geo: "#e9bd68",
  dendro: "#9edc72",
  physical: "#b9c0cb"
};

const REACTION_LABELS: Record<string, string> = {
  none: "无",
  melt: "融化",
  reverseMelt: "反向融化",
  vaporize: "蒸发",
  reverseVaporize: "反向蒸发"
};

function byId<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as TElement;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function numericInput(id: string, fallback: number): number {
  const parsed = Number(byId<HTMLInputElement>(id).value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: number, digits = 1): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits
  }).format(value || 0);
}

function compact(value: number): string {
  const number = value || 0;
  if (Math.abs(number) >= 1e8) return `${(number / 1e8).toFixed(2)}亿`;
  if (Math.abs(number) >= 1e4) return `${(number / 1e4).toFixed(2)}万`;
  return formatNumber(number, 0);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[character] ?? character
  );
}

let currentConfig: SimConfig = migrateConfig(presets[0]);
let lastResult: SimulationResult | null = null;
let currentPage = 1;
let selectedHitId: number | null = null;
let timelineSecondFilter: number | null = null;
let importedShowcase: ImportedShowcase | null = null;
let graduationBuild: GraduationBuildPlaceholder | null = null;

function populatePresetSelect(): void {
  byId<HTMLSelectElement>("presetSelect").innerHTML = presets
    .map(
      (preset, index) =>
        `<option value="${index}">${escapeHtml(preset.meta.name)}</option>`
    )
    .join("");
}

function syncControlsFromConfig(): void {
  byId<HTMLInputElement>("durationInput").value = String(
    currentConfig.duration
  );
  byId<HTMLInputElement>("cycleInput").value = String(
    currentConfig.cycleLength
  );
  byId<HTMLInputElement>("enemyLevelInput").value = String(
    currentConfig.enemy.level
  );
  byId<HTMLInputElement>("resInput").value = String(
    round(currentConfig.enemy.resistance * 100, 2)
  );
  byId<HTMLTextAreaElement>("jsonEditor").value = JSON.stringify(
    currentConfig,
    null,
    2
  );
}

function syncConfigFromControls(): void {
  currentConfig.duration = clamp(
    numericInput("durationInput", 120),
    1,
    600
  );
  currentConfig.cycleLength = clamp(
    numericInput("cycleInput", 20),
    0.1,
    120
  );
  currentConfig.enemy.level = clamp(
    numericInput("enemyLevelInput", 110),
    1,
    200
  );
  currentConfig.enemy.resistance = numericInput("resInput", 10) / 100;
}

function runSimulation(): void {
  try {
    syncConfigFromControls();
    currentConfig = migrateConfig(currentConfig);
    lastResult = simulate(currentConfig, {
      energyMode: byId<HTMLSelectElement>("energyModeInput").value as
        | "configured"
        | "zero"
        | "full",
      critMode: byId<HTMLSelectElement>("critModeInput").value as
        | "average"
        | "allCrit"
        | "noCrit",
      compatibilityMode: "legacy-v0.1"
    });
    currentPage = 1;
    selectedHitId = null;
    timelineSecondFilter = null;
    byId<HTMLTextAreaElement>("jsonEditor").value = JSON.stringify(
      currentConfig,
      null,
      2
    );
    byId<HTMLElement>("jsonError").hidden = true;
    renderAll();
  } catch (error) {
    showConfigError(error);
  }
}

function renderAll(): void {
  if (!lastResult) return;
  renderMetrics();
  renderCharacterBreakdown();
  renderSkillTable();
  renderEnergy();
  renderHitFilters();
  renderHitTable();
  renderTimeline();
  renderDamageCurve();
  renderHitDetail();
  const status = lastResult.config.meta.verificationStatus;
  byId<HTMLElement>("notice").innerHTML =
    `<strong>${escapeHtml(lastResult.config.meta.name)}</strong> ` +
    `<span class="badge warn">${escapeHtml(status)}</span> · ` +
    `${escapeHtml(lastResult.config.meta.note ?? "")}`;
}

function renderMetrics(): void {
  if (!lastResult) return;
  const result = lastResult;
  const fullCycles = Math.floor(
    result.config.duration / result.config.cycleLength
  );
  const metrics = [
    ["队伍 DPS", compact(result.dps), `${formatNumber(result.dps, 0)} / 秒`],
    [
      `${result.config.duration}秒总伤`,
      compact(result.totalDamage),
      formatNumber(result.totalDamage, 0)
    ],
    [
      "有效命中",
      formatNumber(result.damageEvents.length, 0),
      `${result.reactedHits} 段手工增幅反应`
    ],
    [
      "执行循环",
      formatNumber(fullCycles, 0),
      `循环轴 ${result.config.cycleLength}s`
    ],
    [
      "跳过行动",
      formatNumber(result.skippedActions.length, 0),
      result.skippedActions.length ? "存在断能量/断轴" : "无能量阻塞"
    ]
  ];
  byId<HTMLElement>("metricGrid").innerHTML = metrics
    .map(
      ([label, value, sub]) =>
        `<div class="metric"><div class="label">${label}</div>` +
        `<div class="value">${value}</div><div class="sub">${sub}</div></div>`
    )
    .join("");
}

function renderCharacterBreakdown(): void {
  if (!lastResult) return;
  const result = lastResult;
  const characterMap = new Map(
    result.config.characters.map((character) => [character.id, character])
  );
  const rows = result.characterSummaries.map((summary) => ({
    character: characterMap.get(summary.characterId),
    summary
  }));
  byId<HTMLElement>("characterSummary").textContent =
    `${rows.filter(({ summary }) => summary.damage > 0).length} 名角色产生伤害`;
  byId<HTMLElement>("characterBreakdown").innerHTML = rows
    .map(({ character, summary }) => {
      if (!character) return "";
      return (
        `<div class="breakdown-row">` +
        `<div class="breakdown-name"><span class="dot" style="background:${escapeHtml(character.color)}"></span>` +
        `<strong>${escapeHtml(character.name)}</strong></div>` +
        `<div class="bar-track"><div class="bar-fill" style="width:${summary.share * 100}%;background:${escapeHtml(character.color)}"></div></div>` +
        `<div class="breakdown-value">${compact(summary.damage)}` +
        `<small>${(summary.share * 100).toFixed(1)}% · ${compact(summary.dps)} DPS · ${summary.hits} 段</small></div></div>`
      );
    })
    .join("");
}

function renderSkillTable(): void {
  if (!lastResult) return;
  const result = lastResult;
  const characters = new Map(
    result.config.characters.map((character) => [character.id, character])
  );
  byId<HTMLTableSectionElement>("skillTableBody").innerHTML =
    result.bySkill
      .map((skill) => {
        const character = characters.get(skill.creditId);
        return (
          `<tr><td><span class="dot" style="display:inline-block;background:${escapeHtml(character?.color ?? "#999")}"></span> ` +
          `${escapeHtml(character?.name ?? skill.creditId)}</td>` +
          `<td>${escapeHtml(skill.actionName)}</td><td>${skill.hits}</td>` +
          `<td>${compact(skill.damage)}</td>` +
          `<td>${compact(skill.dps)}</td>` +
          `<td>${(skill.share * 100).toFixed(1)}%</td></tr>`
        );
      })
      .join("") || `<tr><td colspan="6">没有伤害事件。</td></tr>`;
}

function renderEnergy(): void {
  if (!lastResult) return;
  const result = lastResult;
  byId<HTMLElement>("energyStatus").innerHTML = result.config.characters
    .map((character) => {
      const energy = result.energyStats[character.id];
      if (!energy) return "";
      const percentage = character.energyMax
        ? (energy.final / character.energyMax) * 100
        : 0;
      const status = energy.skipped
        ? `<span class="badge warn">跳过 ${energy.skipped}</span>`
        : `<span class="badge good">正常</span>`;
      return (
        `<div class="energy-item"><div class="energy-head">` +
        `<strong>${escapeHtml(character.name)}</strong>${status}</div>` +
        `<div class="energy-track"><div class="energy-fill" style="width:${percentage}%;background:${escapeHtml(character.color)}"></div></div>` +
        `<small>初始 ${round(energy.initial, 1)} · 获得 ${round(energy.gained, 1)} · ` +
        `消耗 ${round(energy.spent, 1)} · 最终 ${round(energy.final, 1)}/${character.energyMax}</small></div>`
      );
    })
    .join("");
}

function renderHitFilters(): void {
  if (!lastResult) return;
  const result = lastResult;
  const characterFilter = byId<HTMLSelectElement>("hitCharacterFilter");
  const previousCharacter = characterFilter.value || "all";
  characterFilter.innerHTML =
    `<option value="all">全部归属角色</option>` +
    result.config.characters
      .map(
        (character) =>
          `<option value="${escapeHtml(character.id)}">${escapeHtml(character.name)}</option>`
      )
      .join("");
  if (
    [...characterFilter.options].some(
      (option) => option.value === previousCharacter
    )
  ) {
    characterFilter.value = previousCharacter;
  }

  const reactionFilter = byId<HTMLSelectElement>("hitReactionFilter");
  const previousReaction = reactionFilter.value || "all";
  const reactions = [...new Set(result.damageEvents.map((hit) => hit.reaction))];
  reactionFilter.innerHTML =
    `<option value="all">全部反应</option>` +
    reactions
      .map(
        (reaction) =>
          `<option value="${escapeHtml(reaction)}">${escapeHtml(REACTION_LABELS[reaction] ?? reaction)}</option>`
      )
      .join("");
  if (
    [...reactionFilter.options].some(
      (option) => option.value === previousReaction
    )
  ) {
    reactionFilter.value = previousReaction;
  }
}

function filteredHits(): DamageEvent[] {
  if (!lastResult) return [];
  const character =
    byId<HTMLSelectElement>("hitCharacterFilter").value || "all";
  const reaction =
    byId<HTMLSelectElement>("hitReactionFilter").value || "all";
  const search = byId<HTMLInputElement>("hitSearch").value
    .trim()
    .toLowerCase();
  return lastResult.damageEvents.filter((hit) => {
    if (character !== "all" && hit.creditOwnerId !== character) return false;
    if (reaction !== "all" && hit.reaction !== reaction) return false;
    if (
      timelineSecondFilter !== null &&
      hit.second !== timelineSecondFilter
    ) {
      return false;
    }
    if (
      search &&
      !`${hit.actionName} ${hit.hitLabel} ${hit.sourceActorName} ${hit.creditOwnerName}`
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }
    return true;
  });
}

function renderHitTable(): void {
  const hits = filteredHits();
  const pageSize = Number(byId<HTMLSelectElement>("pageSizeInput").value) || 50;
  const totalPages = Math.max(1, Math.ceil(hits.length / pageSize));
  currentPage = clamp(currentPage, 1, totalPages);
  const pageHits = hits.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  byId<HTMLTableSectionElement>("hitTableBody").innerHTML =
    pageHits
      .map(
        (hit) =>
          `<tr data-hit-id="${hit.id}" class="${selectedHitId === hit.id ? "selected" : ""}">` +
          `<td>${hit.timeSeconds.toFixed(3)}s <span class="muted">/ ${hit.frame}f</span></td>` +
          `<td>${escapeHtml(hit.sourceActorName)}</td>` +
          `<td>${escapeHtml(hit.scalingOwnerName)}</td>` +
          `<td>${escapeHtml(hit.creditOwnerName)}</td>` +
          `<td>${escapeHtml(hit.actionName)} <span class="muted">/ ${escapeHtml(hit.hitLabel)}</span></td>` +
          `<td><span style="color:${ELEMENT_COLORS[hit.element] ?? "#ccc"}">${ELEMENT_LABELS[hit.element] ?? hit.element}</span></td>` +
          `<td>${hit.reaction === "none" ? "—" : `<span class="badge">${REACTION_LABELS[hit.reaction] ?? hit.reaction}</span>`}</td>` +
          `<td>${hit.scaling.toFixed(3)} × ${hit.scalingStat.toUpperCase()}</td>` +
          `<td>${formatNumber(hit.baseDamage, 0)}</td>` +
          `<td>×${hit.critFactor.toFixed(3)}</td>` +
          `<td><strong>${formatNumber(hit.displayDamage, 0)}</strong></td></tr>`
      )
      .join("") ||
    `<tr><td colspan="11">没有符合筛选条件的伤害事件。</td></tr>`;

  byId<HTMLElement>("pageInfo").textContent =
    `${currentPage} / ${totalPages} · 共 ${hits.length} 段` +
    (timelineSecondFilter !== null
      ? ` · 已锁定第 ${timelineSecondFilter}s`
      : "");
  byId<HTMLButtonElement>("prevPage").disabled = currentPage <= 1;
  byId<HTMLButtonElement>("nextPage").disabled = currentPage >= totalPages;
  document
    .querySelectorAll<HTMLTableRowElement>("#hitTableBody tr[data-hit-id]")
    .forEach((row) => {
      row.addEventListener("click", () => {
        selectedHitId = Number(row.dataset.hitId);
        renderHitTable();
        renderHitDetail();
      });
    });
}

function renderHitDetail(): void {
  const detail = byId<HTMLElement>("hitDetail");
  if (!lastResult || selectedHitId === null) {
    detail.className = "formula-detail empty";
    detail.textContent = "尚未选择伤害事件。";
    return;
  }
  const hit = lastResult.damageEvents.find(
    (candidate) => candidate.id === selectedHitId
  );
  if (!hit) return;
  const statusText = hit.activeStatuses.length
    ? hit.activeStatuses.map((status) => status.label).join("、")
    : "无";
  const factors = [
    ["实际施放者", `${hit.sourceActorName} (${hit.sourceActorId})`],
    ["缩放面板", `${hit.scalingOwnerName} (${hit.scalingOwnerId})`],
    ["伤害归属", `${hit.creditOwnerName} (${hit.creditOwnerId})`],
    ["行动 / 命中 ID", `${hit.actionId} / ${hit.hitId}`],
    [
      "倍率基准",
      `${hit.scaling.toFixed(3)} × ${hit.scalingStat.toUpperCase()} (${formatNumber(hit.scalingValue, 0)})`
    ],
    ["附加基础伤害", formatNumber(hit.flat, 0)],
    ["基础伤害", formatNumber(hit.baseDamage, 0)],
    [
      "增伤区",
      `×${hit.bonusFactor.toFixed(3)} (${(hit.dmgBonus * 100).toFixed(1)}%)`
    ],
    [
      "防御区",
      `×${hit.defenseFactor.toFixed(4)} · 无视 ${(hit.defIgnore * 100).toFixed(0)}%`
    ],
    [
      "抗性区",
      `×${hit.resFactor.toFixed(4)} · 有效抗性 ${(hit.effectiveRes * 100).toFixed(1)}%`
    ],
    [
      "暴击期望",
      `×${hit.critFactor.toFixed(4)} · ${(hit.critRate * 100).toFixed(1)}/${(hit.critDmg * 100).toFixed(1)}`
    ],
    [
      "反应区",
      `×${hit.reactionFactor.toFixed(4)} · ${REACTION_LABELS[hit.reaction] ?? hit.reaction}`
    ],
    [
      "反应判定来源",
      hit.reactionAudit.model === "manual-override"
        ? "命中配置手工指定"
        : hit.reactionAudit.model === "aura-engine"
          ? "Aura / ICD 引擎"
          : "未触发"
    ],
    [
      "敌方 Aura（命中前）",
      hit.reactionAudit.auraBefore === null
        ? "未模拟（兼容模式）"
        : hit.reactionAudit.auraBefore
            .map((aura) => `${aura.element} ${aura.gaugeUnits}U`)
            .join("、") || "无"
    ],
    [
      "敌方 Aura（命中后）",
      hit.reactionAudit.auraAfter === null
        ? "未模拟（兼容模式）"
        : hit.reactionAudit.auraAfter
            .map((aura) => `${aura.element} ${aura.gaugeUnits}U`)
            .join("、") || "无"
    ],
    [
      "ICD / 附着",
      hit.reactionAudit.icdAllowed === null
        ? "未模拟"
        : hit.reactionAudit.icdAllowed
          ? "允许附着"
          : "ICD 阻止附着"
    ],
    [
      "元素精通",
      `${formatNumber(hit.em, 0)} · 加成 ${(hit.emBonus * 100).toFixed(1)}%`
    ],
    ["反应增伤", `${(hit.reactionBonus * 100).toFixed(1)}%`],
    ["有效状态", statusText],
    [
      "结算方式",
      hit.snapshot === "action" ? "行动开始快照" : "命中时动态"
    ],
    ["时间", `${hit.timeSeconds.toFixed(3)}s / ${hit.frame}f`],
    ["最终伤害（整数显示）", formatNumber(hit.displayDamage, 0)],
    ["核心原始值", hit.finalDamage.toFixed(6)]
  ];
  detail.className = "formula-detail";
  detail.innerHTML = factors
    .map(
      ([key, value]) =>
        `<div class="factor"><div class="k">${escapeHtml(key)}</div>` +
        `<div class="v">${escapeHtml(value)}</div></div>`
    )
    .join("");
}

function renderTimeline(): void {
  if (!lastResult) return;
  const canvas = byId<HTMLCanvasElement>("timelineCanvas");
  const context = canvas.getContext("2d");
  if (!context) return;
  const pixelRatio = window.devicePixelRatio || 1;
  const cssWidth = Math.max(320, canvas.clientWidth);
  const cssHeight = 360;
  canvas.width = cssWidth * pixelRatio;
  canvas.height = cssHeight * pixelRatio;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const padding = { left: 60, right: 18, top: 18, bottom: 42 };
  const width = cssWidth - padding.left - padding.right;
  const height = cssHeight - padding.top - padding.bottom;
  const characters = lastResult.config.characters;
  const data = lastResult.perSecond;
  const totals = data.map((bucket) =>
    Object.values(bucket).reduce((sum, value) => sum + value, 0)
  );
  const maximum = Math.max(1, ...totals);
  context.strokeStyle = "#293243";
  context.fillStyle = "#8f9bad";
  context.font = "12px system-ui";
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + height - (height * index) / 4;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(cssWidth - padding.right, y);
    context.stroke();
    context.fillText(compact((maximum * index) / 4), 6, y + 4);
  }

  const barWidth = Math.max(1, width / data.length);
  data.forEach((bucket, second) => {
    let bottom = padding.top + height;
    characters.forEach((character) => {
      const value = bucket[character.id] ?? 0;
      if (!value) return;
      const barHeight = (value / maximum) * height;
      context.fillStyle = character.color;
      context.fillRect(
        padding.left + second * barWidth,
        bottom - barHeight,
        Math.max(1, barWidth - 0.35),
        barHeight
      );
      bottom -= barHeight;
    });
  });
  context.fillStyle = "#8f9bad";
  const step = data.length > 180 ? 30 : data.length > 90 ? 20 : 10;
  for (let second = 0; second <= data.length; second += step) {
    const x = padding.left + second * barWidth;
    context.fillText(`${second}s`, x - 8, cssHeight - 16);
  }
  if (timelineSecondFilter !== null) {
    const x = padding.left + timelineSecondFilter * barWidth;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(
      x,
      padding.top,
      Math.max(2, barWidth),
      height
    );
  }
  canvas.onclick = (event) => {
    const rectangle = canvas.getBoundingClientRect();
    const x = event.clientX - rectangle.left;
    if (x < padding.left || x > cssWidth - padding.right) return;
    const second = clamp(
      Math.floor((x - padding.left) / barWidth),
      0,
      data.length - 1
    );
    timelineSecondFilter =
      timelineSecondFilter === second ? null : second;
    currentPage = 1;
    renderTimeline();
    activateTab("hits");
    renderHitTable();
  };
  byId<HTMLElement>("timelineLegend").innerHTML = characters
    .map(
      (character) =>
        `<span class="legend-item"><span class="dot" style="background:${escapeHtml(character.color)}"></span>` +
        `${escapeHtml(character.name)}</span>`
    )
    .join("");
}

function renderDamageCurve(): void {
  if (!lastResult) return;
  const canvas = byId<HTMLCanvasElement>("damageCurveCanvas");
  const context = canvas.getContext("2d");
  if (!context) return;
  const pixelRatio = window.devicePixelRatio || 1;
  const cssWidth = Math.max(320, canvas.clientWidth);
  const cssHeight = 320;
  canvas.width = cssWidth * pixelRatio;
  canvas.height = cssHeight * pixelRatio;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const padding = { left: 70, right: 18, top: 18, bottom: 42 };
  const width = cssWidth - padding.left - padding.right;
  const height = cssHeight - padding.top - padding.bottom;
  const maximum = Math.max(1, lastResult.totalDamage);
  const duration = lastResult.config.duration;
  const points = lastResult.damageCurve;
  const characters = lastResult.config.characters;

  context.strokeStyle = "#293243";
  context.fillStyle = "#8f9bad";
  context.font = "12px system-ui";
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + height - (height * index) / 4;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(cssWidth - padding.right, y);
    context.stroke();
    context.fillText(compact((maximum * index) / 4), 6, y + 4);
  }
  const secondStep = duration > 180 ? 30 : duration > 90 ? 20 : 10;
  for (let second = 0; second <= duration; second += secondStep) {
    const x = padding.left + (second / duration) * width;
    context.fillText(`${second}s`, x - 8, cssHeight - 16);
  }

  const drawCurve = (
    color: string,
    valueAt: (point: (typeof points)[number]) => number,
    lineWidth: number
  ): void => {
    context.beginPath();
    context.moveTo(padding.left, padding.top + height);
    points.forEach((point) => {
      const x = padding.left + (point.timeSeconds / duration) * width;
      const y =
        padding.top + height - (valueAt(point) / maximum) * height;
      context.lineTo(x, y);
    });
    if (points.length) {
      const lastPoint = points[points.length - 1];
      if (lastPoint) {
        const lastY =
          padding.top + height - (valueAt(lastPoint) / maximum) * height;
        context.lineTo(padding.left + width, lastY);
      }
    }
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  };

  characters.forEach((character) => {
    drawCurve(
      character.color,
      (point) => point.cumulativeByCharacter[character.id] ?? 0,
      1.5
    );
  });
  drawCurve("#f2f6ff", (point) => point.cumulativeDamage, 2.4);

  context.fillStyle = "#f2f6ff";
  points.forEach((point) => {
    const x = padding.left + (point.timeSeconds / duration) * width;
    const y =
      padding.top +
      height -
      (point.cumulativeDamage / maximum) * height;
    context.fillRect(x - 1, y - 1, 2, 2);
  });

  canvas.onclick = (event) => {
    const rectangle = canvas.getBoundingClientRect();
    const x = event.clientX - rectangle.left;
    if (x < padding.left || x > cssWidth - padding.right) return;
    const second = clamp(
      Math.floor(((x - padding.left) / width) * duration),
      0,
      Math.ceil(duration) - 1
    );
    timelineSecondFilter =
      timelineSecondFilter === second ? null : second;
    currentPage = 1;
    renderTimeline();
    renderDamageCurve();
    activateTab("hits");
    renderHitTable();
  };

  byId<HTMLElement>("curveLegend").innerHTML =
    `<span class="legend-item"><span class="dot" style="background:#f2f6ff"></span>全队累计</span>` +
    characters
      .map(
        (character) =>
          `<span class="legend-item"><span class="dot" style="background:${escapeHtml(character.color)}"></span>${escapeHtml(character.name)}累计</span>`
      )
      .join("");
}

function renderShowcase(): void {
  const summary = byId<HTMLElement>("showcaseSummary");
  const container = byId<HTMLElement>("showcaseCharacters");
  if (!importedShowcase) {
    summary.innerHTML = "";
    container.innerHTML = "";
    return;
  }
  const showcase = importedShowcase;
  summary.innerHTML =
    `<span class="badge good">Enka 公开展示</span>` +
    `<strong> UID ${escapeHtml(showcase.uid)}</strong> · ` +
    `冒险等阶 ${showcase.playerLevel ?? "—"} · 世界等级 ${showcase.worldLevel ?? "—"} · ` +
    `${showcase.characters.length} 名角色 · 抓取于 ${escapeHtml(new Date(showcase.fetchedAt).toLocaleString("zh-CN"))}`;
  if (showcase.visibility === "closed-or-empty") {
    container.innerHTML =
      `<div class="empty-state">该账号未返回公开角色。请确认游戏内“角色详情显示”已开启，或稍后重试。</div>`;
    return;
  }
  container.innerHTML = showcase.characters
    .map((character) => {
      const weapon = character.weapon
        ? `武器 ID ${character.weapon.itemId} · Lv.${character.weapon.level} · 精${character.weapon.refinement}`
        : "未返回武器";
      const skills =
        Object.entries(character.skillLevels)
          .map(([id, level]) => `${id}: ${level}`)
          .join(" · ") || "未返回天赋";
      const bonuses = Object.entries(character.stats.damageBonuses)
        .filter(([, value]) => value > 0)
        .map(([element, value]) => `${ELEMENT_LABELS[element] ?? element}伤 ${(value * 100).toFixed(1)}%`)
        .join(" · ");
      const artifactLevels = character.artifacts.length
        ? character.artifacts.map((artifact) => `+${artifact.level}`).join(" / ")
        : "无";
      return (
        `<article class="showcase-character">` +
        `<div class="showcase-character-head"><div><span class="badge">avatarId</span>` +
        `<h3>${character.avatarId}</h3></div><strong>Lv.${character.level} · C${character.constellation}</strong></div>` +
        `<p>${escapeHtml(weapon)}</p>` +
        `<dl><dt>面板</dt><dd>HP ${formatNumber(character.stats.maxHp, 0)} · ATK ${formatNumber(character.stats.attack, 0)} · DEF ${formatNumber(character.stats.defense, 0)} · EM ${formatNumber(character.stats.elementalMastery, 0)}</dd>` +
        `<dt>暴击 / 充能</dt><dd>${(character.stats.critRate * 100).toFixed(1)}% / ${(character.stats.critDamage * 100).toFixed(1)}% · ER ${(character.stats.energyRecharge * 100).toFixed(1)}%</dd>` +
        `<dt>伤害加成</dt><dd>${escapeHtml(bonuses || "无")}</dd>` +
        `<dt>技能等级</dt><dd>${escapeHtml(skills)}</dd>` +
        `<dt>圣遗物</dt><dd>${character.artifacts.length} 件 · ${escapeHtml(artifactLevels)}</dd></dl>` +
        `<button data-graduation-avatar="${character.avatarId}">设为毕业站位占位</button>` +
        `</article>`
      );
    })
    .join("");
  container
    .querySelectorAll<HTMLButtonElement>("[data-graduation-avatar]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const avatarId = Number(button.dataset.graduationAvatar);
        const character = importedShowcase?.characters.find(
          (candidate) => candidate.avatarId === avatarId
        );
        if (!character) return;
        graduationBuild = createGraduationBuildPlaceholder(character);
        renderGraduationPlaceholder();
      });
    });
}

function renderGraduationPlaceholder(): void {
  const container = byId<HTMLElement>("graduationPlaceholder");
  if (!graduationBuild) return;
  const weapon = graduationBuild.retainedWeapon
    ? `保留展示柜武器 ID ${graduationBuild.retainedWeapon.itemId}，Lv.${graduationBuild.retainedWeapon.level}，精${graduationBuild.retainedWeapon.refinement}`
    : "未返回可保留的武器";
  container.className = "graduation-placeholder";
  container.innerHTML =
    `<strong>站位角色 avatarId ${graduationBuild.avatarId}</strong>` +
    `<span class="badge warn">${graduationBuild.status}</span>` +
    `<p>来源等级 Lv.${graduationBuild.sourceLevel} · ${escapeHtml(weapon)}</p>` +
    `<p>${escapeHtml(graduationBuild.note)}</p>`;
}

async function importShowcase(): Promise<void> {
  const uid = byId<HTMLInputElement>("showcaseUidInput").value.trim();
  const button = byId<HTMLButtonElement>("showcaseImportButton");
  const status = byId<HTMLElement>("showcaseStatus");
  if (!/^[1-9]\d{8,9}$/.test(uid)) {
    status.textContent = "UID 必须是 9–10 位数字。";
    return;
  }
  button.disabled = true;
  status.textContent = "正在读取公开展示柜…";
  try {
    const response = await fetch(`/api/showcase/${encodeURIComponent(uid)}`);
    const envelope = (await response.json()) as {
      data?: unknown;
      fetchedAt?: string;
      cache?: string;
      error?: string;
    };
    if (!response.ok || envelope.data === undefined) {
      throw new Error(envelope.error ?? `HTTP ${response.status}`);
    }
    importedShowcase = parseEnkaShowcase(envelope.data, {
      uid,
      ...(envelope.fetchedAt === undefined
        ? {}
        : { fetchedAt: envelope.fetchedAt })
    });
    graduationBuild = null;
    status.textContent =
      `导入成功 · ${importedShowcase.characters.length} 名公开角色 · ` +
      `${envelope.cache === "hit" ? "使用 TTL 缓存" : "刚刚刷新"}`;
    byId<HTMLElement>("graduationPlaceholder").className =
      "graduation-placeholder muted";
    byId<HTMLElement>("graduationPlaceholder").textContent =
      "请选择一名展示角色建立毕业站位占位。占位不会自动编造圣遗物词条。";
    renderShowcase();
  } catch (error) {
    importedShowcase = null;
    renderShowcase();
    status.textContent =
      error instanceof Error ? `导入失败：${error.message}` : "导入失败。";
  } finally {
    button.disabled = false;
  }
}

function activateTab(tabName: string): void {
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  document.querySelectorAll<HTMLElement>(".tab-panel").forEach((panel) => {
    panel.classList.remove("active");
  });
  byId<HTMLElement>(`${tabName}Panel`).classList.add("active");
  if (tabName === "timeline") {
    requestAnimationFrame(() => {
      renderTimeline();
      renderDamageCurve();
    });
  }
}

function downloadJson(): void {
  syncConfigFromControls();
  const blob = new Blob([JSON.stringify(currentConfig, null, 2)], {
    type: "application/json"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${(currentConfig.meta.name || "genshin-sim").replace(/[^\w\u4e00-\u9fa5-]+/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function showConfigError(error: unknown): void {
  const errorBox = byId<HTMLElement>("jsonError");
  errorBox.hidden = false;
  errorBox.textContent =
    error instanceof ConfigMigrationError
      ? error.message
      : error instanceof Error
        ? error.stack ?? error.message
        : String(error);
  activateTab("config");
}

function applyEditorJson(): void {
  try {
    currentConfig = migrateConfig(
      JSON.parse(byId<HTMLTextAreaElement>("jsonEditor").value) as unknown
    );
    byId<HTMLElement>("jsonError").hidden = true;
    syncControlsFromConfig();
    runSimulation();
  } catch (error) {
    showConfigError(error);
  }
}

function initEvents(): void {
  byId<HTMLSelectElement>("presetSelect").addEventListener(
    "change",
    (event) => {
      const selected = Number((event.currentTarget as HTMLSelectElement).value);
      const preset = presets[selected];
      if (!preset) return;
      currentConfig = migrateConfig(deepClone(preset));
      syncControlsFromConfig();
      runSimulation();
    }
  );
  byId<HTMLButtonElement>("runButton").addEventListener(
    "click",
    runSimulation
  );
  byId<HTMLButtonElement>("exportButton").addEventListener(
    "click",
    downloadJson
  );
  byId<HTMLInputElement>("importInput").addEventListener(
    "change",
    async (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      try {
        currentConfig = migrateConfig(
          JSON.parse(await file.text()) as unknown
        );
        syncControlsFromConfig();
        runSimulation();
      } catch (error) {
        showConfigError(error);
      } finally {
        input.value = "";
      }
    }
  );
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((button) => {
    button.addEventListener("click", () =>
      activateTab(button.dataset.tab ?? "overview")
    );
  });
  ["hitCharacterFilter", "hitReactionFilter", "pageSizeInput"].forEach(
    (id) => {
      byId<HTMLSelectElement>(id).addEventListener("change", () => {
        currentPage = 1;
        renderHitTable();
      });
    }
  );
  byId<HTMLInputElement>("hitSearch").addEventListener("input", () => {
    currentPage = 1;
    renderHitTable();
  });
  byId<HTMLButtonElement>("prevPage").addEventListener("click", () => {
    currentPage -= 1;
    renderHitTable();
  });
  byId<HTMLButtonElement>("nextPage").addEventListener("click", () => {
    currentPage += 1;
    renderHitTable();
  });
  byId<HTMLButtonElement>("applyJsonButton").addEventListener(
    "click",
    applyEditorJson
  );
  byId<HTMLButtonElement>("formatJsonButton").addEventListener("click", () => {
    try {
      const editor = byId<HTMLTextAreaElement>("jsonEditor");
      editor.value = JSON.stringify(JSON.parse(editor.value), null, 2);
      byId<HTMLElement>("jsonError").hidden = true;
    } catch (error) {
      showConfigError(error);
    }
  });
  byId<HTMLButtonElement>("showcaseImportButton").addEventListener(
    "click",
    () => {
      void importShowcase();
    }
  );
  byId<HTMLInputElement>("showcaseUidInput").addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") void importShowcase();
    }
  );
  window.addEventListener("resize", () => {
    if (byId<HTMLElement>("timelinePanel").classList.contains("active")) {
      renderTimeline();
      renderDamageCurve();
    }
  });
}

declare global {
  interface Window {
    GenshinDpsLab: {
      simulate: typeof simulate;
      presets: typeof presets;
      getConfig: () => SimConfig;
      getLastResult: () => SimulationResult | null;
    };
  }
}

populatePresetSelect();
initEvents();
syncControlsFromConfig();
runSimulation();

window.GenshinDpsLab = {
  simulate,
  presets,
  getConfig: () => deepClone(currentConfig),
  getLastResult: () => deepClone(lastResult)
};
