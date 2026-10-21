import { expect, it } from "vitest";
import { PLAYBACK_SPEEDS, TimelinePlayback } from "./timeline-playback";
it.each(PLAYBACK_SPEEDS)("plays a fixed 120-second result at %sx without advancing simulation", speed => {
  const clock = new TimelinePlayback(7200);
  clock.setSpeed(speed, 0); clock.play(0);
  expect(clock.advance(1000)).toBe(60 * speed);
  expect(clock.advance(120000 / speed)).toBe(7200);
  expect(clock.playing).toBe(false);
});
it("preserves fractional frames and separates speed changes, pauses, seeks and direct results", () => {
  const clock = new TimelinePlayback(7200);
  clock.play(0);
  clock.advance(5); clock.advance(10);
  expect(clock.advance(20)).toBe(1);
  clock.setSpeed(4, 1000);
  expect(clock.advance(2000)).toBe(300);
  clock.pause(2000); expect(clock.advance(9000)).toBe(300);
  clock.seek(120, 9000); clock.play(9000);
  expect(clock.advance(9500)).toBe(240);
  clock.seek(7200, 9500); expect(clock.playing).toBe(false);
  expect(clock.advance(20000)).toBe(7200);
  clock.play(20000); expect(clock.advance(20250)).toBe(60);
  expect(() => clock.setSpeed(3, 21000)).toThrow("倍率");
});
