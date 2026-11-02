# Real Shatter acceptance inputs

Kaeya / Barbara / Noelle C0, Lv90, T1; R1 Lv90 Skyrider Sword / Otherworldly Story / White Iron Greatsword. Five legal +0 artifacts per actor, three initial substats, five different sets (no set bonuses). This is an explicit correctness input, not a recommended build, real account, graduation preset, or full roster claim.

`real-shatter-team.spec.ts` validates the pieces with the existing artifact/equipment resolvers, compiles their actual contributions to native GCSL, then uses the source simulation page. Timing, attachment, Freeze/Shatter, cooldowns and RNG remain native. Native weapon effects still execute; the `effectsDisabled` field is used only for the independent equipment validation route, not to suppress native mechanics.

Classic source commit b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541. See docs/integration/REAL-SHATTER-TEAM-20261022.zh-CN.md for evidence and limitations.
