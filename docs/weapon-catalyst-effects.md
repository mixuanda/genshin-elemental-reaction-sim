# Remaining catalyst numeric clauses

This batch reviews all 42 catalysts outside the earlier static, formula, conditional and 33-weapon numeric groups. It adds **27 weapons with at least one representable numeric clause**. It keeps **15 excluded**, including two weapons without passives. This is a partial mechanics inventory, not a claim that 27 weapons have complete combat implementations.

Production entry: `packages/game-data/src/weapon-catalyst-effects.ts`. Integration is owned separately; this batch does not modify the dispatcher, shared schemas, UI, existing modules, generators or tests. No checks, builds, simulations or tests were run in this batch. The examples below and `expected-fixtures.json` are hand-calculated expectations, not observed execution results.

## Fixed evidence

- Active catalog snapshot: `953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`.
- Chinese genshin-db: `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`; the raw Chinese weapon JSON includes every R1–R5 description and values array.
- Gcsim: `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`. The supplied source tree is an extracted archive, without `.git`; provenance uses the supplied pinned commit, and archived bytes have independently computed SHA-256 hashes.
- Genshin Optimizer `180a0a1015cb725c7570cd828eb086749960df98` additionally corroborates Kagura through the actual `libs/gi/sheets/src/Weapons/Catalyst/KagurasVerity/index.tsx`, `allElementKeys` in `libs/gi/consts/src/character.ts`, and all-five Chinese descriptions. Its separate formula-directory TODO stub is not treated as implementation evidence.
- `packages/game-data/sources/weapon-catalyst-effects/manifest.json` lists each raw file, archive-relative `path`/`file`, upstream path, immutable browser/raw URLs, SHA-256 and byte count. Original MIT licenses from all three projects are included. `reviewed-catalog.json` preserves an exact projection for runtime description/value guards.
- Damage bucket and conversion evidence additionally archives `pkg/enemy/damage.go`, `pkg/core/combat/reaction.go`, `pkg/core/player/character/{mods,stats}.go`, `pkg/core/attacks/attack.go`, and `pkg/modifier/modifier.go`.

Every enabled rule compares the selected active description and refinement values with the pinned reviewed projection. Catalog-only new weapons 14435, 14436, 14437 and 14524 are excluded: a new description alone does not establish a reviewed implementation.

## Owner and snapshot contract

The selected character is the weapon wearer and the only recipient whose panel/hit is restored. Team grants are applied only where that same wearer is a legitimate recipient; outgoing buffs and another wielder's incoming buff are not invented. `characterId` resolves the real catalog element for Hakushin Ring, Jadefall's Splendor and A Thousand Floating Dreams. There is no user-editable element identity.

Every window means the effect has already triggered legally and is still valid before the evaluated hit. Missing values remain blocked; they do not default to zero. Selecting a skill, reaction, shield or team size never generates triggers. After-hit buffs do not retroactively benefit the hit that triggers them. Current on/off-field receiving rules differ from trigger-time requirements; Cashflow, Tome, Sunny Morning and Jadefall do not lose an already-valid window merely because the wearer later leaves the field. Tulaytullah explicitly clears on swap.

Ordinary generic and elemental damage bonuses share the ordinary damage bucket. They are not separate multipliers and do not boost transformative or lunar reaction damage. Bloom/Hyperbloom/Burgeon bonuses use `reactionBonuses` metadata. Typed attack critical damage, healing, base-additive damage, extra attacks, speed, energy, particles, cooldown changes and automatic timelines retain explicit blockers.

## Numeric review at all five refinements

Each bracket lists independently read R1, R2, R3, R4, R5 values. Percent signs indicate additive ratios. Only the clauses named in the second column are executed.

| ID / weapon | Executed clauses and R1–R5 values | Conditions and source boundaries |
|---|---|---|
| 14305 Twin Nephrite | ATK [12,14,16,18,20]% | Known 15s owner-on-field kill window; movement speed blocked. |
| 14402 Widsith | One song: ATK [60,75,90,105,120]%; seven-element DMG [48,60,72,84,96]%; EM [240,300,360,420,480] | `catalystSong` 0 none, 1 ATK, 2 elemental, 3 EM. Never combine songs or substitute a random average. |
| 14410 Wine and Song | ATK [20,25,30,35,40]% | Known 5s dash window; stamina reduction blocked. |
| 14413 Dodoco Tales | Charged DMG [16,20,24,28,32]%; ATK [8,10,12,14,16]% | Independent 6s windows from prior owner Normal and Charged hits respectively. |
| 14414 Hakushin Ring | Owner's inherent-element DMG [10,12.5,15,17.5,20]% | Known qualifying 6s recipient window after on-field owner Electro-related reaction. Not every reaction element is granted to every character. Shared keys prohibit same-name stacking. |
| 14416 Wandering Evenstar | Flat ATK = sampled non-conversion EM × [24,30,36,42,48]% | Latest legal 10s periodic sample, valid 12s window, conversion phase. Own outgoing 30% team share is not added back to self. |
| 14425 Flowing Purity | Skill elemental DMG [8,10,12,14,16]%; cleared-bond HP/1000 × [2,2.5,3,3.5,4]%, capped [12,15,18,21,24]% | Independent 15s windows; explicit fully cleared bond amount. Does not manufacture bond/heal events or infer cleared amount from current HP. Source repeat-cast debt bookkeeping remains a caveat. |
| 14430 Waveriding Whirl | Window HP [20,25,30,35,40]% + Hydro count × [12,15,18,21,24]%, extra capped [24,30,36,42,48]% | Valid 10s window; count includes eligible owner and accepts 0–4, bonus stops after two members. Swimming and 15s trigger ICD blocked. |
| 14431 Ring of Yaxche | Normal DMG = trigger HP/1000 × [0.6,0.7,0.8,0.9,1]%, capped [16,20,24,28,32]% | Valid 10s skill window; source snapshots maximum HP at trigger, not hit. |
| 14432 Etherlight Spindlelute | EM [100,125,150,175,200] | Valid 20s owner skill window. |
| 14433 Blackmarrow Lantern | Ordinary Bloom reaction coefficient [48,60,72,84,96]% | Unconditional wearer reaction clause. Lunar Bloom and Ascendant Gleam lunar increase blocked; never ordinary DMG Bonus. |
| 14434 Dawning Frost | EM [72,90,108,126,144] + EM [48,60,72,84,96] | Independent 10s Charged-hit and Skill-hit windows; source requires wearer on-field at trigger. |
| 14505 Jadefall's Splendor | Own-element DMG = trigger HP/1000 × [0.3,0.5,0.7,0.9,1.1]%, capped [12,20,28,36,44]% | 3s after owner burst or owner-created shield. HP is trigger snapshot, including then-valid maximum-HP modifiers. Energy and its source 142-frame scheduling versus catalog 150-frame wording are not implemented. |
| 14509 Kagura's Verity | Skill DMG per stack [12,15,18,21,24]%; at three stacks seven-element DMG [12,15,18,21,24]% | Current Chinese catalogs both say 24s; old gcsim says 16s. User supplies known valid 0–3 stacks. Actual fixed Optimizer sheet and element constants corroborate all five coefficients and seven-element filter; gcsim erroneously includes Physical. Star Superconduct has an Optimizer clause but is outside the current reaction engine and remains blocked. |
| 14511 A Thousand Floating Dreams | EM per other same-element teammate [32,40,48,56,64]; own-element DMG per other different-element teammate [10,14,18,22,26]% | Both counts 0–3; sum ≤3; exclude wearer. Self never receives its own outgoing [40,42,44,46,48] EM team grant. |
| 14512 Tulaytullah's Remembrance | Normal DMG per effective unit [4.8,6,7.2,8.4,9.6]%, capped [48,60,72,84,96]% | Valid 14s skill window and still on-field. Unit count 0–10: elapsed tick +1, eligible Normal hit +2; no automatic counting. Source bookkeeping outside window does not authorize a bonus. Normal speed blocked. |
| 14513 Cashflow Supervision | ATK [16,20,24,28,32]%; per stack Normal DMG [16,20,24,28,32]%, Charged [14,17.5,21,24.5,28]% | Known 0–3 active 4s HP-change stacks; actual HP change and on-field at trigger. Source has no new Star Superconduct clause. Speed and HP-event timing blocked. |
| 14514 Tome of the Eternal Flow | HP [16,20,24,28,32]%; per stack Charged DMG [14,18,22,26,30]% | Known 0–3 active 4s HP-change stacks; full overheal does not trigger. Energy and 12s resource ICD blocked. |
| 14515 Crane's Echoing Call | Plunge DMG [28,41,54,67,80]% | Known owner-triggered 20s window; self is a valid party recipient. Other party members and energy propagation blocked. Shared key replaces rather than sums providers. |
| 14516 Surf's Up | HP [20,25,30,35,40]%; Normal DMG per active stack [12,15,18,21,24]% | Explicit current effective stacks 0–4, already accounting for the 14s window. No automatic skill activation, Vaporize gain or Normal loss. Source's temporary fifth bookkeeping stack never gives fifth damage stack. |
| 14517 Starcaller's Watch | EM [100,125,150,175,200]; ordinary DMG [28,35,42,49,56]% | Valid 15s owner-created-shield effect, nearby target, wearer as current on-field recipient. Source requires on-field shield creation but marks that restriction TODO; catalog does not expressly require it. Independent legal-window assertion required. |
| 14518 Sunny Morning Sleep-In | EM [120,150,180,210,240] + [96,120,144,168,192] + [32,40,48,56,64] | Three independent ordinary-Swirl 6s / Skill-hit 9s / Burst-hit 30s windows. On-field at trigger, existing windows persist after swap. Fixed source lacks new Star Swirl event. |
| 14519 Vivid Notions | ATK [28,35,42,49,56]% | Plunge-only critical damage [28,35,42,49,56]% and [40,50,60,70,80]% blocked; never global critical damage or ordinary DMG. Source trigger subscriptions also lack wearer checks, so are not copied. |
| 14520 Nightweaver's Looking Glass | Each EM window [60,75,90,105,120]; both active → Bloom reaction [120,150,180,210,240]%, Hyperbloom/Burgeon [80,100,120,140,160]% | Separate owner Hydro/Dendro Skill-hit 4.5s and nearby party Lunar-Bloom 10s windows. Self slice only; same-name not stacked. Lunar damage and team propagation blocked. |
| 14521 Reliquary of Truth | CR [8,10,12,14,16]%; Skill-window EM [80,100,120,140,160]; Lunar-Bloom-hit-window global CD [24,30,36,42,48]% | Independent 12s/4s windows; if both active, conditional EM and CD each ×1.5. Passive CR is not amplified. Trigger is lunar, but resulting CD is a global StatMod. |
| 14522 Nocturne's Curtain Call | HP [10,12,14,16,18]% + active-window HP [14,16,18,20,22]% | Own legal lunar trigger/damage 12s window. Source lunar-crystallize subscription commented; lunar damage handler remains. Lunar-only CD and energy blocked; unsuffixed source crit-key defect not ported. |
| 14523 Angelos Heptades | ATK [12,15,18,21,24]%; sampled ATK/1000 × [10,13,16,19,22]%, capped [26,34,42,50,58]% | Valid 20s owner-created-shield window. Latest 0.5s sample excludes conversion-derived ATK. Owner on-field gets full bonus; eligible off-field owner gets half. `catalystHexerei` asserts all catalog background-recipient requirements, including applicable Secret Rite; source itself checks only IsHexerei and has no independent team rite gate. |

## Excluded inventory

| IDs | Reason |
|---|---|
| 14101, 14201 | Apprentice's Notes / Pocket Grimoire have no passive. |
| 14302 | Thrilling Tales grants the next, different character ATK. Granting that effect to its own wearer would be an ownership error. Incoming teammate weapon attribution is outside this self-owner module. |
| 14303, 14401, 14403, 14406 | Otherworldly Story healing; Favonius particles; Sacrificial cooldown reset; Prototype Amber energy/healing are events outside current numeric panel/hit slots. Resource restoration is not Energy Recharge. |
| 14409 | Eye of Perception separate physical bounce attacks are unsupported. Source also uses `2.1*r*0.3` instead of catalog `2.1+0.3*r` and omits the 50% proc gate. |
| 14412, 14427 | Frostbearer's physical icicle and Ash-Graven Drinking Horn's HP-scaled physical AoE are independent extra hits. They must not become flat ATK or ordinary damage bonuses. |
| 14506 | Everlasting Moonglow healing and Normal base-additive damage cannot be represented by current targets. At 30,000 HP, R1/R5 add 300/900 to Normal base damage, not 1%/3% DMG Bonus; energy also blocked. |
| 14435, 14436, 14437, 14524 | Clash of Kings, Echoes of the Heart, Winter's Heavy Heart and Hymn of the Maelstrom have no fixed gcsim implementation in this tree. Catalog-only mechanics remain excluded, including otherwise simple numeric clauses. |

后续实施说明（2026-09-24）：上表14302仍正确地排除在“持有者自身条款”模块之外。讨龙现在另由[独立计算器的外部逐击记账](validation/thrilling-tales-calculator.md)与[普通团队真实切人模型](validation/thrilling-tales-runtime.md)执行，作用于实际接收者，不给持有者自身加攻；R1–R5、已含份额和来源归属共用同一公式定义。真实取样、有限检查点及外部/本地对照的范围见相应专项，角色卡肉与未接入的特殊宿主仍未完成。原批次27条/15项排除、静态手算和未执行声明保留当时范围，不改写为当时已实现或已测试，也不将这条外部效果计作新增自身配装条款。

后续祭礼说明（2026-09-24）：上表14403的排除仍是本批“数值面板/命中条款”模块的范围。祭礼残章现与祭礼剑、大剑、弓另用显式合法时间线模型，操作持有者真实共享E充能队列；成功仅恢复一层并重启剩余队首，不能改成ER、固定能量或伤害增益。共享来源与串行状态见 [队列专项](validation/sacrificial-shared-cooldown.md)，实际日志和冷却资格的独立重放见 [结果专项](validation/sacrificial-result-integrity.md)。无角色卡肉、独立本地随机流及完整检查点未覆盖的限制保留，不将此接线计作本表新增自身数值条款，也不改写原批次未执行记录。

## Manual acceptance material

`expected-fixtures.json` contains literal R1/R5 expectations for all 27 supported weapons, with additional independent-window, cap, owner-element, off-field and exclusive-song cases. It is not generated from the production resolver. It includes zero ordinary-damage expectations for reaction-only coefficients and negative attack/element filters. R2–R4 source formulas and Chinese values were separately read during the audit; the all-five-value table above records that review.

Examples: Flowing Purity with both windows and 3,000 cleared HP gives 14%/28% elemental bonus; Ring of Yaxche at its 20,000-HP trigger snapshot gives 12%/20% Normal bonus; Jadefall at 30,000 HP gives 9%/33% own-element bonus; Nightweaver with both windows gives 120/240 EM and distinct 120%/240% Bloom coefficients; Reliquary with both windows gives 120/240 EM and 36%/72% global CD; Angelos with sampled 2,000 non-conversion ATK gives 20%/44% on-field or 10%/22% for an eligible off-field recipient.

The known limitations above remain user-visible `effectBlockers`, even when a supported clause produces numbers. Missing required manual state additionally enters `missingConditions`. Passing the future focused integration check will establish execution correctness for that check's coverage only, not resolve the documented upstream conflicts or missing combat systems.
