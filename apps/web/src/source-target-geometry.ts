export interface SourceTargetGeometry {
  radius: number;
  x: number;
  y: number;
}

export const defaultSourceTargetGeometry: SourceTargetGeometry = { radius: 2, x: 0, y: 2.4 };

/** A missing legacy geometry uses the prior target clause; an explicit one must be complete. */
export function resolveSourceTargetGeometry(geometry?: SourceTargetGeometry): SourceTargetGeometry {
  if (geometry === undefined) return { ...defaultSourceTargetGeometry };
  if (geometry === null || typeof geometry !== "object"
    || !Number.isFinite(geometry.radius) || !Number.isFinite(geometry.x) || !Number.isFinite(geometry.y)
    || geometry.radius <= 0) {
    throw new Error("目标几何须提供有限的 radius、x、y 数值，且 radius 必须大于零。");
  }
  return { radius: geometry.radius, x: geometry.x, y: geometry.y };
}

/** GCSL's numeric lexer accepts decimal digits and a point, but no exponent. */
export function sourceDecimal(value: number): string {
  if (Object.is(value, -0)) return "-0";
  const shortest = value.toString();
  const marker = shortest.search(/[eE]/);
  if (marker < 0) return shortest;
  const negative = shortest.startsWith("-");
  const mantissa = shortest.slice(negative ? 1 : 0, marker);
  const exponent = Number(shortest.slice(marker + 1));
  const point = mantissa.indexOf(".");
  const digits = mantissa.replace(".", "");
  const position = (point < 0 ? mantissa.length : point) + exponent;
  const decimal = position <= 0 ? `0.${"0".repeat(-position)}${digits}`
    : position >= digits.length ? `${digits}${"0".repeat(position - digits.length)}`
      : `${digits.slice(0, position)}.${digits.slice(position)}`;
  return negative ? `-${decimal}` : decimal;
}

export function sourceTargetGeometryClause(geometry?: SourceTargetGeometry): string {
  const { radius, x, y } = resolveSourceTargetGeometry(geometry);
  return `radius=${sourceDecimal(radius)} pos=${sourceDecimal(x)},${sourceDecimal(y)}`;
}
