/*!
 * The polynomial coefficients and evaluation schemes, pi/2 reduction, and
 * arctangent/quadrant algorithms below are adapted from fdlibm 5.3:
 * https://netlib.org/fdlibm/k_sin.c
 * https://netlib.org/fdlibm/k_cos.c
 * https://netlib.org/fdlibm/e_rem_pio2.c
 * https://netlib.org/fdlibm/s_atan.c
 * https://netlib.org/fdlibm/e_atan2.c
 *
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 */

/**
 * Versioned angular arithmetic for simulation geometry. The operation order is
 * part of its replay contract: do not reassociate these expressions or substitute
 * native transcendental functions. ECMAScript's binary64 arithmetic and explicit
 * DataView word access avoid host libm and machine byte-order dependencies.
 *
 * This is an accurate fdlibm approximation, not a correctly rounded libm. The
 * independent high-precision tests allow one ulp for sin/cos and two for atan2.
 * That numerical accuracy bound is unrelated to exact simulation replay checks.
 * No final-value quantization is performed. Distances are outside this module.
 */
const words = new DataView(new ArrayBuffer(8));
const PI = 3.14159265358979311600e+00;
const HALF_PI = 1.57079632679489655800e+00;
const QUARTER_PI = 7.85398163397448279000e-01;
const PI_LO = 1.22464679914735317720e-16;

// Schema angles are at most +/-360 degrees; sector edges can add +/-180.
const MAX_RADIANS = 3 * PI;

function highWord(value: number): number {
  words.setFloat64(0, value, false);
  return words.getUint32(0, false);
}

function fromHighWord(high: number): number {
  words.setUint32(0, high, false);
  words.setUint32(4, 0, false);
  return words.getFloat64(0, false);
}

interface ReducedAngle {
  quadrant: number;
  hi: number;
  lo: number;
}

/** fdlibm's medium reduction, retaining its cancellation corrections. */
function reduceRadians(value: number): ReducedAngle {
  const magnitude = Math.abs(value);
  if (!Number.isFinite(value) || magnitude > MAX_RADIANS) {
    throw new RangeError("Deterministic geometry angles must be finite and within [-3*pi, 3*pi].");
  }
  if (magnitude <= QUARTER_PI) return { quadrant: 0, hi: value, lo: 0 };

  const n = Math.trunc(magnitude * 6.36619772367581382433e-01 + 0.5);
  let r = magnitude - n * 1.57079632673412561417e+00;
  let w = n * 6.07710050650619224932e-11;
  let hi = r - w;
  const exponent = (highWord(magnitude) >>> 20) & 0x7ff;
  const lostBits = () => exponent - ((highWord(hi) >>> 20) & 0x7ff);
  if (lostBits() > 16) {
    let previous = r;
    w = n * 6.07710050630396597660e-11;
    r = previous - w;
    w = n * 2.02226624879595063154e-21 - ((previous - r) - w);
    hi = r - w;
    if (lostBits() > 49) {
      previous = r;
      w = n * 2.02226624871116645580e-21;
      r = previous - w;
      w = n * 8.47842766036889956997e-32 - ((previous - r) - w);
      hi = r - w;
    }
  }
  const lo = (r - hi) - w;
  return value < 0
    ? { quadrant: -n, hi: -hi, lo: -lo }
    : { quadrant: n, hi, lo };
}

function kernelSin(x: number, tail: number, reduced: boolean): number {
  if (Math.abs(x) < 7.450580596923828125e-09) return x;
  const z = x * x;
  const v = z * x;
  const s1 = -1.66666666666666324348e-01;
  const r = 8.33333333332248946124e-03 + z * (
    -1.98412698298579493134e-04 + z * (
      2.75573137070700676789e-06 + z * (
        -2.50507602534068634195e-08 + z * 1.58969099521155010221e-10
      )
    )
  );
  return reduced
    ? x - ((z * (0.5 * tail - v * r) - tail) - v * s1)
    : x + v * (s1 + z * r);
}

function kernelCos(x: number, tail: number): number {
  const ix = highWord(x) & 0x7fffffff;
  if (ix < 0x3e400000) return 1;
  const z = x * x;
  const r = z * (4.16666666666666019037e-02 + z * (
    -1.38888888888741095749e-03 + z * (
      2.48015872894767294178e-05 + z * (
        -2.75573143513906633035e-07 + z * (
          2.08757232129817482790e-09 + z * -1.13596475577881948265e-11
        )
      )
    )
  ));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * tail));
  const qx = ix > 0x3fe90000 ? 0.28125 : fromHighWord(ix - 0x00200000);
  const hz = 0.5 * z - qx;
  const a = 1 - qx;
  return a - (hz - (z * r - x * tail));
}

/** Sine in radians, inclusive domain [-3*pi, 3*pi]; throws outside it. */
export function deterministicSin(radians: number): number {
  const { quadrant, hi, lo } = reduceRadians(radians);
  switch (quadrant & 3) {
    case 0: return kernelSin(hi, lo, quadrant !== 0);
    case 1: return kernelCos(hi, lo);
    case 2: return -kernelSin(hi, lo, true);
    default: return -kernelCos(hi, lo);
  }
}

/** Cosine in radians, inclusive domain [-3*pi, 3*pi]; throws outside it. */
export function deterministicCos(radians: number): number {
  const { quadrant, hi, lo } = reduceRadians(radians);
  switch (quadrant & 3) {
    case 0: return kernelCos(hi, lo);
    case 1: return -kernelSin(hi, lo, true);
    case 2: return -kernelCos(hi, lo);
    default: return kernelSin(hi, lo, true);
  }
}

const ATAN_HI = [
  4.63647609000806093515e-01,
  7.85398163397448278999e-01,
  9.82793723247329054082e-01,
  1.57079632679489655800e+00
] as const;
const ATAN_LO = [
  2.26987774529616870924e-17,
  3.06161699786838301793e-17,
  1.39033110312309984516e-17,
  6.12323399573676603587e-17
] as const;

/** fdlibm arctangent, reduced onto intervals with |x| <= 7/16. */
function atan(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude >= 7.3786976294838206464e+19) return value < 0 ? -HALF_PI : HALF_PI;
  if (magnitude < 1.86264514923095703125e-09) return value;
  let x = value;
  let id: 0 | 1 | 2 | 3 | undefined;
  if (magnitude >= 0.4375) {
    x = magnitude;
    if (x < 1.1875) {
      if (x < 0.6875) {
        id = 0;
        x = (2 * x - 1) / (2 + x);
      } else {
        id = 1;
        x = (x - 1) / (x + 1);
      }
    } else if (x < 2.4375) {
      id = 2;
      x = (x - 1.5) / (1 + 1.5 * x);
    } else {
      id = 3;
      x = -1 / x;
    }
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (3.33333333333329318027e-01 + w * (
    1.42857142725034663711e-01 + w * (
      9.09088713343650656196e-02 + w * (
        6.66107313738753120669e-02 + w * (
          4.97687799461593236017e-02 + w * 1.62858201153657823623e-02
        )
      )
    )
  ));
  const s2 = w * (-1.99999999998764832476e-01 + w * (
    -1.11111104054623557880e-01 + w * (
      -7.69187620504482999495e-02 + w * (
        -5.83357013379057348645e-02 + w * -3.65315727442169155270e-02
      )
    )
  ));
  if (id === undefined) return x - x * (s1 + s2);
  const result = ATAN_HI[id] - ((x * (s1 + s2) - ATAN_LO[id]) - x);
  return value < 0 ? -result : result;
}

/** atan2(y, x), including signed zero, infinities, NaN, and extreme ratios. */
export function deterministicAtan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (x === 1) return atan(y);
  const negativeY = y < 0 || Object.is(y, -0);
  const negativeX = x < 0 || Object.is(x, -0);
  if (y === 0) return negativeX ? (negativeY ? -PI : PI) : y;
  if (x === 0) return negativeY ? -HALF_PI : HALF_PI;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax === Infinity) {
    const result = ay === Infinity
      ? (negativeX ? 3 * QUARTER_PI : QUARTER_PI)
      : (negativeX ? PI : 0);
    return negativeY ? -result : result;
  }
  if (ay === Infinity) return negativeY ? -HALF_PI : HALF_PI;

  const exponentDifference = ((highWord(ay) - highWord(ax)) >> 20);
  const z = exponentDifference > 60
    ? HALF_PI + 0.5 * PI_LO
    : negativeX && exponentDifference < -60 ? 0 : atan(Math.abs(y / x));
  if (!negativeX) return negativeY ? -z : z;
  return negativeY ? (z - PI_LO) - PI : PI - (z - PI_LO);
}
