# Batch 114 event-source audit: Ororon A1 and Columbina Gravity

Scope: source-pinned audit of the selected native event paths only. This records source behavior and instrumentation design; it makes no game-mechanics verification claim.

## Frozen roots and provenance

- Classic root: `/Users/evan/Library/Caches/gidps-source-host/build-2OdtDV/source`; receipt `frozen/batch114/classic/receipt.json`; revision `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`; frozen tree snapshot `15965fb70c98aba229279056e9dc98a4ce2c042919135b807e5cbcb1651f0ad7`.
- Stellar root: `/Users/evan/Library/Caches/gidps-source-host/stellar-build-4ao2p7/source`; receipt `frozen/batch114/stellar/receipt.json`; revision `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`; frozen tree JSON `df033c73db725aa999692b167c8c0c7d762f97c1cd217a5f489140cf4a9140b6`.
- Both roots were read-only. The Ororon private changes are generated in this cache directory, against copied source files.

## Ororon A1: finite direct queue, count 0..3

Classic `internal/characters/ororon/asc.go` SHA-256: `9b3f8641a552247caefe42e786a076b0d612e8769f685550642d6b992d64e2ae`. Stellar SHA-256: `a905749b14cd91d807d810b7c43fea2063fecc0136fccbc857c2fec7bda40f7b`; its NightSoul tag uses the stellar AttackTag type while classic uses AdditionalTag, so hashes differ.

- Listener registration is A1 `event.OnEnemyDamage`, key `ororon-a1-ns` (`asc.go:34-40,88-98`). It filters out Ororon as attacker and requires NightSoul on the actual triggering attack (`:91-97`).
- The shared A1 proc helper requires at least 10 NightSoul points and an inactive 1.8 s damage ICD; on success it starts the blessing if needed, consumes 10 points, and calls Hypersense (`:101-114`). It is also reached from OnElectroCharged and OnLunarCharged, so instrumentation must be scoped to this OnEnemyDamage call.
- Hypersense searches within radius 15 of the trigger attack pattern's position. The source loop is `for i := 0; len(enemies) < 4 && i < len(enemies); i++`, so it queues exactly n attacks for 1 <= n <= 3 and zero when n is 0 or at least 4 (`:116-146`). Do not fix this control flow as part of source instrumentation.
- Each queued attack uses ability `Hypersense`, `AttackTagNone`, Electro, NightSoul additional tag, multiplier 1.6, a 0.2-by-0.2 box at that selected enemy's current position, and 12-frame snapshot and damage delays (`:116-145`). It calls C6 stack logic after the loop (`:146`); that C6 state change stays native and outside this direct-attack count.
- A minimal per-listener direct queue recipe is source-supported with exact source-known count 0..3. Queue identities and target deliveries come from the native event/attack receipt; an event fact starts at zero and is set to i+1 immediately before each instrumented queue. No action/cast ownership is inferred. Existing NightSoul, blessing-task, C6, RNG, and resource behavior is left to its current native execution and snapshots.

Private native patches:

- `classic/ororon-a1-event.patch`
- `stellar/ororon-a1-event.patch`

They add listener site `ororon.a1.enemy-damage`, queue site `ororon.a1.hypersense-attack`, and count fact `ororon.a1.enemy-damage.attack-count`. The shared helper accepts an explicit scope fact; only the selected listener passes it. Other shared-helper callers and C6's separate Hypersense call pass the empty scope and retain ordinary queue behavior. Both patches passed `git apply --check` against their own private baseline copies; no source builds or tests were run.

## Columbina Gravity: lifecycle gap; exclude from direct event components

Frozen stellar source:

- `internal/characters/columbina/skill.go` SHA-256 `8cce6dc322a1e5361085f501da2f0e8ed69c2224aaa88d43dc7ea096430e73bb`.
- `internal/characters/columbina/asc.go` SHA-256 `67eb339a97a9b21e0f8f88e7a8276d2e0d8ce3a941cb23a6dc947c3047226967`.

In `skill.go:47-83`, OnLunarCharged, OnLunarBloom and OnLunarCrystallize callbacks, plus `columbina-gravity-on-dmg`, update the last reaction/status and can start `gravityAccum`; they do not directly queue an attack. `gravityAccum` recurs on a 3-frame native task while gravity and skill status are active, accumulates reaction-specific resource, and invokes `gravityTick(true)` at total >=60 (`:100-125`). `gravityTick` makes a reaction choice, can clear resource, runs A1/C1/C2 work, and queues a reaction-dependent list of delayed hitmark tasks that eventually queue damage attacks (`:154-245+`). `asc.go:63-83` shows A1 only increments its CR stack to a cap of 3 and refreshes its 10-second modifier from a gravity tick.

The same observed event call therefore begins or updates a recurring resource lifecycle whose eventual attacks may occur later and may follow multiple triggers. Correct future coverage needs explicit resource-generator ownership, last-reaction/resource state, recurring task creation and closure, tick selection, delayed child attack identities, C1/C2 branches, and preserved seed/RNG snapshots. The source itself notes tie selection is branch-sensitive/randomized at `skill.go:155-156`. A finite per-listener direct queue would wrongly attribute all that later lifecycle to one event call. Exclude Columbina Gravity from the direct event-component registry until that lifecycle is separately specified and evidenced; do not infer ownership from the event listener alone.

