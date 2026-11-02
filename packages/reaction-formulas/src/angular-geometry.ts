import { deterministicSin, deterministicCos, deterministicAtan2 } from "./deterministic-angular";

/** Versioned angular primitives only. Distances retain their existing policy. */
export const ANGULAR_GEOMETRY_SEMANTICS = "fdlibm-angular-v1" as const;
export type AngularGeometrySemantics = typeof ANGULAR_GEOMETRY_SEMANTICS;
export interface AngularGeometryMath {
  sin(radians: number): number;
  cos(radians: number): number;
  atan2(y: number, x: number): number;
}

const nativeAngularMath: Readonly<AngularGeometryMath> = Object.freeze({ sin: Math.sin, cos: Math.cos, atan2: Math.atan2 });
const deterministicAngularMath: Readonly<AngularGeometryMath> = Object.freeze({ sin: deterministicSin, cos: deterministicCos, atan2: deterministicAtan2 });

/** Absence is the historical native-JS algorithm, never a fresh-run default. */
export function resolveAngularGeometry(semantics?: AngularGeometrySemantics): Readonly<AngularGeometryMath> {
  if (semantics === undefined) return nativeAngularMath;
  if (semantics !== ANGULAR_GEOMETRY_SEMANTICS) throw new RangeError("Unsupported angular geometry semantics.");
  return deterministicAngularMath;
}
