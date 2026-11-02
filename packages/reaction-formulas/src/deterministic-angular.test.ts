import { describe, expect, it, vi } from "vitest";
import { SeededRandom } from "../../sim-core/src/energy";
import { deterministicAtan2, deterministicCos, deterministicSin } from "./deterministic-angular";

const view = new DataView(new ArrayBuffer(8));
const SIGN = 1n << 63n;
const FRACTION = (1n << 52n) - 1n;
const SCALE_BITS = 384;
const SCALE = 1n << BigInt(SCALE_BITS);

function bits(value: number): bigint {
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false);
}

function fromBits(value: bigint): number {
  view.setBigUint64(0, value, false);
  return view.getFloat64(0, false);
}

function neighbors(value: number): number[] {
  const encoded = bits(value);
  return [-2n, -1n, 0n, 1n, 2n].map((step) => fromBits(encoded + step));
}

function orderedBits(value: number): bigint {
  const encoded = bits(value);
  return encoded & SIGN ? SIGN - (encoded & (SIGN - 1n)) : SIGN + encoded;
}

function ulps(actual: number, expected: number): bigint {
  const difference = orderedBits(actual) - orderedBits(expected);
  return difference < 0n ? -difference : difference;
}

function dyadic(value: number): { mantissa: bigint; exponent: number } {
  const encoded = bits(Math.abs(value));
  const exponent = Number((encoded >> 52n) & 0x7ffn);
  return {
    mantissa: (encoded & FRACTION) | (exponent === 0 ? 0n : 1n << 52n),
    exponent: exponent === 0 ? -1074 : exponent - 1075
  };
}

function toFixed(value: number): bigint {
  const { mantissa, exponent } = dyadic(value);
  const shift = exponent + SCALE_BITS;
  const magnitude = shift < 0 ? mantissa >> BigInt(-shift) : mantissa << BigInt(shift);
  return value < 0 ? -magnitude : magnitude;
}

function fromFixed(value: bigint): number {
  return Number(value) / Number(SCALE);
}

/**
 * Independent 384-bit fixed-point Maclaurin oracle, evaluated on the original
 * binary64 input without fdlibm's coefficients or pi/2 reduction. The recurrences
 * are DLMF 4.19.1 and 4.19.2: https://dlmf.nist.gov/4.19 . Division truncation and
 * the omitted final term are far below one binary64 ulp for these test inputs.
 * Small inputs use |sin(x)-x| <= |x|^3/6 and |cos(x)-1| <= x^2/2 instead.
 */
function oracleSinCos(value: number): { sin: number; cos: number } {
  if (Math.abs(value) < 2 ** -27) return { sin: value, cos: 1 };
  const x = toFixed(value);
  const square = x * x / SCALE;
  let sinTerm = x;
  let sin = x;
  let cosTerm = SCALE;
  let cos = SCALE;
  for (let n = 1; sinTerm !== 0n || cosTerm !== 0n; n += 1) {
    if (n > 200) throw new Error("Oracle sine/cosine series did not converge");
    sinTerm = -sinTerm * square / (SCALE * BigInt(2 * n * (2 * n + 1)));
    cosTerm = -cosTerm * square / (SCALE * BigInt((2 * n - 1) * 2 * n));
    sin += sinTerm;
    cos += cosTerm;
  }
  return { sin: fromFixed(sin), cos: fromFixed(cos) };
}

/** DLMF 4.24.3: https://dlmf.nist.gov/4.24.E3 ; |value/SCALE| <= 1/5. */
function atanSeries(value: bigint): bigint {
  const square = value * value / SCALE;
  let power = value;
  let sum = value;
  for (let n = 1; power !== 0n; n += 1) {
    if (n > 200) throw new Error("Oracle arctangent series did not converge");
    power = -power * square / SCALE;
    sum += power / BigInt(2 * n + 1);
  }
  return sum;
}

// Machin's identity supplies pi independently of the production split constants.
const PI_FIXED = 16n * atanSeries(SCALE / 5n) - 4n * atanSeries(SCALE / 239n);

function integerSqrt(value: bigint): bigint {
  let root = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
  for (;;) {
    const next = (root + value / root) / 2n;
    if (next >= root) return root;
    root = next;
  }
}

function fixedRatio(numerator: number, denominator: number): bigint {
  const n = dyadic(numerator);
  const d = dyadic(denominator);
  const shift = n.exponent - d.exponent + SCALE_BITS;
  return shift < 0
    ? n.mantissa / (d.mantissa << BigInt(-shift))
    : (n.mantissa << BigInt(shift)) / d.mantissa;
}

/**
 * Independent atan2 oracle: exact input dyadics, two half-angle transformations
 * atan(t) = 2 atan(t/(1+sqrt(1+t^2))), then the convergent Maclaurin series.
 * No production coefficients/reduction, native atan/atan2, or native sqrt.
 * The tested nonzero ratios are >= 2^-100; separate exact fixtures cover smaller
 * ratios and binary64 underflow, for which this 384-bit scale is unsuitable.
 */
function oracleAtan2(y: number, x: number): number {
  const inverted = Math.abs(y) > Math.abs(x);
  let ratio = inverted ? fixedRatio(x, y) : fixedRatio(y, x);
  for (let n = 0; n < 2; n += 1) {
    ratio = ratio * SCALE / (SCALE + integerSqrt(SCALE * SCALE + ratio * ratio));
  }
  let angle = 4n * atanSeries(ratio);
  if (inverted) angle = PI_FIXED / 2n - angle;
  if (x < 0) angle = PI_FIXED - angle;
  return fromFixed(y < 0 ? -angle : angle);
}

function expectUlps(actual: number, expected: number, limit: bigint, label: string): bigint {
  const error = ulps(actual, expected);
  expect(error, `${label}: ${actual} vs independent oracle ${expected}`).toBeLessThanOrEqual(limit);
  return error;
}

const boundaryAngles = [
  ...Array.from({ length: 12 }, (_, n) => (n + 1) * Math.PI / 4).flatMap(neighbors),
  ...[2 ** -27, fromBits(0x3fd3333300000000n), 0.78125].flatMap(neighbors),
  ...Array.from({ length: 6 }, (_, n) => (n + 1) * Math.PI / 2).flatMap((center) =>
    [2 ** -15, 2 ** -16, 2 ** -17].flatMap((delta) => [center - delta, center + delta])
  ),
  2.382987774834482
].filter((angle) => angle >= 0 && angle <= 3 * Math.PI).flatMap((angle) => [angle, -angle]);

describe("versioned deterministic angular arithmetic", () => {
  it("pins exact replay bits for the discovered Node/Chromium disagreement and quadrants", () => {
    // mpmath 1.3.0, mp.dps=200, mp.sin(mp.mpf(binary64 input)) gives
    // .687909540875493887218633734745162932384880648576875297552993510094748759...
    // Its nearest binary64 is ...54f7. fdlibm's fixed approximation is ...54f6.
    expect(bits(oracleSinCos(2.382987774834482).sin)).toBe(0x3fe6035ade9554f7n);
    expect(bits(deterministicSin(2.382987774834482))).toBe(0x3fe6035ade9554f6n);
    expect(bits(deterministicSin(2.382987774834482) * 0.5)).toBe(0x3fd6035ade9554f6n);
    const cases: [number, bigint, bigint][] = [
      [0, 0n, 0x3ff0000000000000n],
      [-0, 0x8000000000000000n, 0x3ff0000000000000n],
      [Math.PI / 4, 0x3fe6a09e667f3bccn, 0x3fe6a09e667f3bcdn],
      [Math.PI / 2, 0x3ff0000000000000n, 0x3c91a62633145c07n],
      [Math.PI, 0x3ca1a62633145c07n, 0xbff0000000000000n],
      [2 * Math.PI, 0xbcb1a62633145c07n, 0x3ff0000000000000n],
      [3 * Math.PI, 0x3cba79394c9e8a0an, 0xbff0000000000000n]
    ];
    for (const [angle, sin, cos] of cases) {
      expect(bits(deterministicSin(angle))).toBe(sin);
      expect(bits(deterministicCos(angle))).toBe(cos);
    }
  });

  it("checks reduction boundaries and a domain grid against the independent 384-bit oracle", () => {
    const grid = Array.from({ length: 1025 }, (_, n) => -3 * Math.PI + n * 6 * Math.PI / 1024);
    for (const angle of [...boundaryAngles, ...grid]) {
      const expected = oracleSinCos(angle);
      expectUlps(deterministicSin(angle), expected.sin, 1n, `sin(${angle})`);
      expectUlps(deterministicCos(angle), expected.cos, 1n, `cos(${angle})`);
    }
  });

  it("checks existing seeded RNG angles and preserves the stream and conversion order", () => {
    for (const seed of ["replay:final59", "dendro-portable-v1", "crystallize-portable-v1", "angular-boundaries"]) {
      const random = new SeededRandom(seed);
      for (let n = 0; n < 256; n += 1) {
        const roll = random.next();
        // Both existing radian conversion expressions appear in the simulator.
        for (const angle of [roll * 2 * Math.PI, (roll * 360 * Math.PI) / 180]) {
          const expected = oracleSinCos(angle);
          expectUlps(deterministicSin(angle), expected.sin, 1n, `seeded sin(${angle})`);
          expectUlps(deterministicCos(angle), expected.cos, 1n, `seeded cos(${angle})`);
        }
      }
      expect(random.captureState().drawCount).toBe(256);
    }
  });

  it("checks arctangent interval boundaries, quadrants, and seeded sector directions", () => {
    const ratios = [2 ** -29, 0.4375, 0.6875, 1, 1.1875, 1.5, 2.4375, 2 ** 60, 2 ** 61, 2 ** 66]
      .flatMap(neighbors);
    const coordinates: [number, number][] = ratios.flatMap((ratio) =>
      [[ratio, 1], [ratio, 2], [1, ratio]] as [number, number][]
    );
    const random = new SeededRandom("angular-sectors:final59");
    for (let n = 0; n < 512; n += 1) {
      coordinates.push([random.next() * 100 + 0.01, random.next() * 100 + 0.01]);
    }
    for (const [y, x] of coordinates) {
      for (const signY of [-1, 1]) {
        for (const signX of [-1, 1]) {
          const sy = y * signY;
          const sx = x * signX;
          expectUlps(deterministicAtan2(sy, sx), oracleAtan2(sy, sx), 2n, `atan2(${sy}, ${sx})`);
        }
      }
    }
    // Identical directions when the input components are subnormal or enormous.
    for (const [y, x] of [[Number.MIN_VALUE, 2 * Number.MIN_VALUE], [Number.MAX_VALUE / 2, Number.MAX_VALUE]]) {
      expectUlps(deterministicAtan2(y!, x!), oracleAtan2(y!, x!), 2n, `scaled atan2(${y}, ${x})`);
    }
  });

  it("preserves signed zero, NaN/infinities, and extreme finite ratio behavior", () => {
    const cases: [number, number, number][] = [
      [0, 0, 0], [-0, 0, -0], [0, -0, Math.PI], [-0, -0, -Math.PI],
      [0, -1, Math.PI], [-0, -1, -Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2],
      [1, Infinity, 0], [-1, Infinity, -0], [1, -Infinity, Math.PI], [-1, -Infinity, -Math.PI],
      [Infinity, 1, Math.PI / 2], [-Infinity, 1, -Math.PI / 2],
      [Infinity, Infinity, Math.PI / 4], [-Infinity, Infinity, -Math.PI / 4],
      [Infinity, -Infinity, 3 * Math.PI / 4], [-Infinity, -Infinity, -3 * Math.PI / 4],
      [Number.MIN_VALUE, 1, Number.MIN_VALUE], [-Number.MIN_VALUE, 1, -Number.MIN_VALUE],
      [Number.MIN_VALUE, 2, 0], [-Number.MIN_VALUE, 2, -0],
      [Number.MIN_VALUE, Number.MAX_VALUE, 0], [-Number.MIN_VALUE, Number.MAX_VALUE, -0],
      [Number.MIN_VALUE, -Number.MAX_VALUE, Math.PI],
      [Number.MAX_VALUE, Number.MIN_VALUE, Math.PI / 2],
      [1e-300, 1e100, 0], [1e-280, 1e-300, Math.PI / 2]
    ];
    for (const [y, x, expected] of cases) expect(Object.is(deterministicAtan2(y, x), expected)).toBe(true);
    // Independently generated with mpmath 1.3.0 at 200 decimal digits.
    expect(bits(deterministicAtan2(1e-300, 1e-280))).toBe(0x3bc79ca10c924224n);
    for (const [y, x] of [[NaN, 1], [1, NaN], [NaN, Infinity]]) {
      expect(deterministicAtan2(y!, x!)).toBeNaN();
    }
    for (const value of [Number.MIN_VALUE, -Number.MIN_VALUE, 2 ** -1022, -(2 ** -1022), 0, -0]) {
      expect(Object.is(deterministicSin(value), value)).toBe(true);
      expect(deterministicCos(value)).toBe(1);
    }
  });

  it("rejects unsupported sine/cosine domains before evaluation", () => {
    for (const value of [NaN, Infinity, -Infinity, 10, -10, fromBits(bits(3 * Math.PI) + 1n)]) {
      expect(() => deterministicSin(value)).toThrow(RangeError);
      expect(() => deterministicCos(value)).toThrow(RangeError);
    }
    expectUlps(deterministicSin(-3 * Math.PI), oracleSinCos(-3 * Math.PI).sin, 1n, "lower endpoint");
    expectUlps(deterministicCos(3 * Math.PI), oracleSinCos(3 * Math.PI).cos, 1n, "upper endpoint");
  });

  it("does not call engine-native transcendental functions", () => {
    const spies = ["sin", "cos", "atan", "atan2", "sqrt", "hypot"].map((name) =>
      vi.spyOn(Math, name as "sin").mockImplementation(() => { throw new Error(`native Math.${name} called`); })
    );
    try {
      expect(bits(deterministicSin(2.382987774834482))).toBe(0x3fe6035ade9554f6n);
      expect(deterministicCos(Math.PI)).toBe(-1);
      expect(deterministicAtan2(1, -1)).toBe(3 * Math.PI / 4);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
