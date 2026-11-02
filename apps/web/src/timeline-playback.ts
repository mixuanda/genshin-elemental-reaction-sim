/** Presentation clock only: never accepts or mutates simulation input/results. */
export const PLAYBACK_SPEEDS = [1, 2, 4, 8, 16] as const;
export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];
export class TimelinePlayback {
  private position = 0;
  private lastTime = 0;
  playing = false;
  speed: PlaybackSpeed = 1;
  constructor(readonly endFrame: number) {
    if (!Number.isSafeInteger(endFrame) || endFrame < 0) throw new Error("回放终点须为非负整数帧。");
  }
  get frame(): number { return Math.floor(this.position); }
  advance(now: number): number {
    if (!Number.isFinite(now)) throw new Error("回放时钟无效。");
    if (this.playing) {
      this.position = Math.min(this.endFrame, this.position + Math.max(0, now - this.lastTime) * 60 * this.speed / 1000);
      if (this.position >= this.endFrame) this.playing = false;
    }
    this.lastTime = now;
    return this.frame;
  }
  play(now: number): void {
    if (this.position >= this.endFrame) this.position = 0;
    this.lastTime = now;
    this.playing = this.endFrame > 0;
  }
  pause(now: number): void { this.advance(now); this.playing = false; }
  seek(frame: number, now: number): void {
    if (!Number.isFinite(frame)) throw new Error("回放位置无效。");
    this.position = Math.min(this.endFrame, Math.max(0, frame));
    this.lastTime = now;
    if (this.position === this.endFrame) this.playing = false;
  }
  setSpeed(speed: number, now: number): void {
    if (!PLAYBACK_SPEEDS.includes(speed as PlaybackSpeed)) throw new Error("不支持的回放倍率。");
    this.advance(now);
    this.speed = speed as PlaybackSpeed;
  }
}
