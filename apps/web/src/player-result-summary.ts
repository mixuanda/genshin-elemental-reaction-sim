/** A skill result has no verified observation window or per-frame team timeline.
 * Do not infer DPS from cooldowns, animations, or an arbitrary duration. */
export function renderSkillTimingNotice(): string {
  return `<p class="calculator-hint player-timing-notice" data-skill-timing-unavailable data-dps-status="unavailable" data-curve-status="unavailable">For DPS and damage over time, <a href="/source-simulation">run a timed team simulation</a>.</p>`;
}
