import { expect, it } from "vitest";
import { resolveSourceTargetScene, sourceTargetSceneClauses, type SourceTargetSceneInput } from "./source-target-scene";

const target = { level: 90, resistance: 0.1, geometry: { radius: 2, x: 0, y: 2.4 } };

it("preserves the one-target legacy default and ordered target declarations", () => {
  expect(resolveSourceTargetScene({ target })).toEqual({ targets: [target], primaryTargetIndex: 0 });
  expect(sourceTargetSceneClauses({ target })).toEqual(["target lvl=90 resist=0.1 radius=2 pos=0,2.4;"]);
  const second = { level: 95, resistance: 0.2, geometry: { radius: 2, x: 0, y: 2.4 } };
  const scene: SourceTargetSceneInput = { target, additionalTargets: [second], primaryTargetIndex: 1 };
  expect(sourceTargetSceneClauses(scene)).toEqual([
    "target lvl=90 resist=0.1 radius=2 pos=0,2.4;",
    "target lvl=95 resist=0.2 radius=2 pos=0,2.4;",
  ]);
  expect(resolveSourceTargetScene(scene).primaryTargetIndex).toBe(1);
});

it("requires explicit HP on every target when native global HP mode is selected", () => {
  expect(() => resolveSourceTargetScene({ target: { ...target, hp: 100 }, additionalTargets: [target] })).toThrow(/所有目标/);
  expect(() => resolveSourceTargetScene({ target, additionalTargets: [{ ...target, hp: 100 }] })).toThrow(/所有目标/);
  expect(sourceTargetSceneClauses({ target: { ...target, hp: 100 }, additionalTargets: [{ ...target, hp: 200 }] }))
    .toEqual(["target lvl=90 resist=0.1 radius=2 pos=0,2.4 hp=100;", "target lvl=90 resist=0.1 radius=2 pos=0,2.4 hp=200;"]);
});

it("rejects malformed extra targets, invalid selected index and invalid member profiles", () => {
  expect(() => resolveSourceTargetScene({ target, additionalTargets: null } as never)).toThrow(/数组/);
  expect(() => resolveSourceTargetScene({ target, primaryTargetIndex: 1 })).toThrow(/索引/);
  expect(() => resolveSourceTargetScene({ target, primaryTargetIndex: null } as never)).toThrow(/索引/);
  expect(() => resolveSourceTargetScene({ target, additionalTargets: [{ ...target, resistance: Number.NaN }] })).toThrow(/有限/);
});
