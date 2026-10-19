import { resolveSourceTargetGeometry, type SourceTargetGeometry } from "./source-target-geometry";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const exactNumberText = (value: number): string => String(value);

function diagramMarkup(geometry: SourceTargetGeometry, useDefault = false): string {
  const { x, y, radius } = geometry;
  // Normalize only the diagram coordinates, so any finite model input still
  // produces a finite SVG viewBox. Labels retain the exact source coordinates.
  const unit = Math.max(1, Math.abs(x), Math.abs(y), radius);
  const px = x / unit, py = y / unit, pr = radius / unit;
  const left = Math.min(-pr - 0.2, px - pr - 0.2);
  const right = Math.max(pr + 0.2, px + pr + 0.2);
  const top = Math.max(pr + 0.2, -py + pr + 0.2);
  const bottom = Math.min(-pr - 0.2, -py - pr - 0.2);
  const modelWidth = right - left, modelHeight = top - bottom;
  const svgWidth = 360, svgHeight = 210, margin = 24;
  const scale = Math.min((svgWidth - margin * 2) / modelWidth, (svgHeight - margin * 2) / modelHeight);
  const contentWidth = modelWidth * scale, contentHeight = modelHeight * scale;
  const ox = (svgWidth - contentWidth) / 2, oy = (svgHeight - contentHeight) / 2;
  const point = (a: number, b: number) => ({ x: ox + (a - left) * scale, y: oy + (top - b) * scale });
  const player = point(0, 0), target = point(px, -py), targetRadius = pr * scale, playerRadius = (0.3 / unit) * scale;
  return `<div class="source-target-geometry__diagram" data-target-geometry-diagram>${useDefault ? '<p data-target-geometry-default>未提供目标几何，沿用原有应用默认值。</p>' : ""}
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="初始来源场景几何示意；显示玩家初始中心和目标圆，不表示技能命中范围">
      <line x1="${ox}" y1="${player.y}" x2="${svgWidth - ox}" y2="${player.y}" stroke="currentColor" opacity=".18" />
      <line x1="${player.x}" y1="${oy}" x2="${player.x}" y2="${svgHeight - oy}" stroke="currentColor" opacity=".18" />
      <circle cx="${target.x}" cy="${target.y}" r="${targetRadius}" fill="none" stroke="currentColor" stroke-width="2" />
      <circle cx="${target.x}" cy="${target.y}" r="3" fill="currentColor" />
      <circle cx="${player.x}" cy="${player.y}" r="${Math.max(3, playerRadius)}" fill="none" stroke="#5687dc" stroke-width="2" />
      <circle cx="${player.x}" cy="${player.y}" r="3" fill="#5687dc" />
      <text x="${player.x}" y="${player.y - 9}" text-anchor="middle" font-size="11" fill="currentColor">角色</text>
      <text x="${target.x}" y="${target.y - 9}" text-anchor="middle" font-size="11" fill="currentColor">目标</text>
    </svg>
    <p>初始来源坐标（来源坐标单位，不声明为米）。角色：中心 (0, 0)，初始范围半径 0.3。目标：中心 (${esc(exactNumberText(x))}, ${esc(exactNumberText(y))})，目标半径 ${esc(exactNumberText(radius))}。目标圆不代表技能命中范围。图示只记录初始场景，不表示角色之后保持朝向或位置不变，也不判断某次动作是否命中。</p>
  </div>`;
}

/** Accessible numeric inputs plus a read-only diagram; omitted legacy geometry is labeled explicitly. */
export function renderSourceTargetGeometryControls(geometry?: SourceTargetGeometry): string {
  const resolved = resolveSourceTargetGeometry(geometry);
  return `<fieldset data-target-geometry-controls><legend>目标初始几何</legend>
    <div class="workspace-fields"><label>目标半径（须大于零）<input type="number" min="0" step="any" required data-target-geometry="radius" value="${esc(resolved.radius)}"></label>
      <label>目标初始来源坐标 x<input type="number" step="any" required data-target-geometry="x" value="${esc(resolved.x)}"></label>
      <label>目标初始来源坐标 y<input type="number" step="any" required data-target-geometry="y" value="${esc(resolved.y)}"></label></div>
    ${diagramMarkup(resolved, geometry === undefined)}
  </fieldset>`;
}

/** Reads a complete finite geometry; positive radii exclude native zero-radius errors and invalid negative circles. */
export function readSourceTargetGeometryControls(root: HTMLElement): SourceTargetGeometry {
  const read = (key: keyof SourceTargetGeometry): number => {
    const field = root.querySelector<HTMLInputElement>(`[data-target-geometry="${key}"]`);
    if (!field || !field.checkValidity() || !Number.isFinite(field.valueAsNumber)) {
      throw new Error(`目标几何 ${key} 须为有限数值。`);
    }
    return field.valueAsNumber;
  };
  return resolveSourceTargetGeometry({ radius: read("radius"), x: read("x"), y: read("y") });
}

/** Updates only the diagram region, leaving inputs and focus untouched while the user types. */
export function updateSourceTargetGeometryDiagram(root: HTMLElement, geometry: SourceTargetGeometry): void {
  const region = root.querySelector<HTMLElement>("[data-target-geometry-diagram]");
  if (!region) return;
  region.outerHTML = diagramMarkup(resolveSourceTargetGeometry(geometry));
}
