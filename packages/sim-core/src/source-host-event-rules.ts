/** Audited event components describe one listener call, never an E/Q cast lifecycle. */
export const sourceHostEventComponentIds = [
  "baizhu-c2-on-enemy-damage", "tartaglia-riptide-on-target-died",
  "albedo-skill-proc", "dehya-skill-followup", "raiden-eye-followup",
  "candace-c6-wave", "kirara-c4-cardamom", "kuki-c4-thundergrass",
  "clorinde-c1-shade", "chiori-a1-seize", "yoimiya-aurous-blaze-explosion",
  "traveler-electro-bellowing-thunder", "traveler-pyro-scorching-threshold", "odette-c4",
  "mona-burst-bubble", "mona-c2-followup", "nahida-trikarma-bloom",
  "charlotte-c6", "faruzan-c6-collapse", "ororon-a1-hypersense", "beidou-burst-proc", "chiori-c4-kinu",
] as const;
export type SourceHostEventComponentId = typeof sourceHostEventComponentIds[number];

export type SourceHostEventAttackTag = "AttackTagElementalArt" | "AttackTagElementalBurst" | "AttackTagNormal"
  | "AttackTagExtra" | "AttackTagNone" | "AttackTagDirectStellarConduct" | "AttackTagDirectStellarSwirl";

interface SourceHostEventComponentDescriptor {
  id: SourceHostEventComponentId;
  siteId: string;
  key: string;
  label: string;
  intro: string;
  sourceCommits: readonly string[];
  sourceRefs: readonly string[];
  scopeNotes: readonly string[];
  ability: string;
  attackTag: SourceHostEventAttackTag;
}

type SourceHostEventDirectCountRule = {
  /** Final source-known queue count, independent of the emitted-queue observer. */
  attackCountFact: string;
  attackVariant?: {
    fact: string;
    variants: readonly { value: number; ability: string; attackTag: SourceHostEventAttackTag }[];
  };
} & (
  | { attackCountMode?: "finite"; allowedAttackCounts: readonly number[] }
  | { attackCountMode: "source-loop" }
);

interface SourceHostEventDelayedAttacks {
  producerSite: string;
  producerEmitSite: string;
  /** Audited native core-queue delay and unconditional queues in each completed task. */
  producerDelayFrames: number;
  producerAttackCount: number;
}

export type SourceHostEventComponentRule = SourceHostEventComponentDescriptor & (
  | { kind: "baizhu-c2"; directEmitSite: string }
  | ({ kind: "tartaglia-riptide" } & SourceHostEventDelayedAttacks)
  | ({ kind: "delayed"; producerCountFact: string; allowedProducerCounts: readonly number[] } & SourceHostEventDelayedAttacks)
  | ({ kind: "direct"; directEmitSite: string } & SourceHostEventDirectCountRule)
  | ({ kind: "beidou-chain"; directEmitSite: string; callbackEmitSite: string } & SourceHostEventDirectCountRule)
  | { kind: "chiori-c4-tree"; producerCountFact: string; allowedProducerCounts: readonly number[]; treeAttackEmitSite: string }
);

const sourceCommits = [
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
] as const;

/** Hashes identify the reviewed stage after prior patches, before 113 and talent instrumentation. */
function directSourceRefs(path: string, sha256: string, refs: readonly string[]): readonly string[] {
  return [...refs,
    `classic-pre-113:${sourceCommits[0]}:${path}#sha256=${sha256}`,
    `stellar-pre-113:${sourceCommits[1]}:${path}#sha256=${sha256}`,
  ];
}

function batch114SourceRefs(path: string, hashes: { classic?: string; stellar?: string }, refs: readonly string[]): readonly string[] {
  return [...refs,
    ...(hashes.classic ? [`classic-pre-114:${sourceCommits[0]}:${path}#sha256=${hashes.classic}`] : []),
    ...(hashes.stellar ? [`stellar-pre-114:${sourceCommits[1]}:${path}#sha256=${hashes.stellar}`] : []),
  ];
}

const directScopeNote = "仅核对此次监听调用直接排队的攻击及其目标结算；既有状态或护盾的施加归属、生命周期、后续事件与回调派生伤害及完整 E/Q 均不由本组件闭合。";

export const sourceHostEventComponentRules = {
  "baizhu-c2-on-enemy-damage": {
    id: "baizhu-c2-on-enemy-damage", kind: "baizhu-c2",
    siteId: "baizhu.c2.enemy-damage", key: "baizhu-c2",
    label: "白术 C2 · 全局伤害事件组件",
    intro: "这是一次已登记的 OnEnemyDamage 监听调用及其实际攻击。它是全局事件组件，触发命中可能来自当前任意角色，不归属白术 E；该监听器相关治疗与 C6 护盾后续攻击也不由本组件闭合。",
    directEmitSite: "baizhu.c2.splice-attack",
    ability: "Gossamer Sprite: Splice. (C2)", attackTag: "AttackTagElementalArt", sourceCommits,
    sourceRefs: ["internal/characters/baizhu/cons.go:25-96", "pkg/enemy/attack.go:83-113"],
    scopeNotes: [
      "仅核对此次 OnEnemyDamage 监听器发出的 Splice 攻击。触发命中可能来自任意当前角色，不据此归属白术 E。",
      "同一监听器还会安排治疗；C6 命中可能建立护盾并引发后续 Spiritvein，这些生命周期不在本次攻击交付范围内。",
    ],
  },
  "tartaglia-riptide-on-target-died": {
    id: "tartaglia-riptide-on-target-died", kind: "tartaglia-riptide",
    siteId: "tartaglia.riptide.target-died", key: "tartaglia-on-enemy-death",
    label: "达达利亚 · 全局断流目标死亡事件组件",
    intro: "这是一次全局目标死亡监听调用及其延迟发出的 Riptide Burst。致死命中是触发者，不证明先前断流状态来自哪次 Q；断流状态、后续 C4 周期与完整 Q 生命周期不在本组件范围。",
    producerSite: "tartaglia.riptide.death-burst-task", producerEmitSite: "tartaglia.riptide.death-burst-attack",
    producerDelayFrames: 5, producerAttackCount: 1,
    ability: "Riptide Burst", attackTag: "AttackTagNormal", sourceCommits,
    sourceRefs: ["internal/characters/tartaglia/riptide.go:248-283", "pkg/enemy/attack.go:250-260"],
    scopeNotes: [
      "仅核对此次 OnTargetDied 监听器及其 +5 帧任务发出的 Riptide Burst；致死攻击是触发者，不是先前断流状态的来源证明。",
      "敌方断流状态来源、后续 C4 周期及完整 Q 生命周期不在本次事件组件范围内。",
    ],
  },
  "albedo-skill-proc": {
    id: "albedo-skill-proc", kind: "direct", siteId: "albedo.skill.enemy-damage", key: "albedo-skill",
    label: "阿贝多 · 阳华协同攻击事件组件",
    intro: "这是一次阳华伤害监听调用及其直接排队的刹那之花攻击；触发命中和既有阳华快照不证明其所属 E 施放。",
    directEmitSite: "albedo.skill.proc-attack", ability: "Abiogenesis: Solar Isotoma (Tick)",
    attackTag: "AttackTagElementalArt", attackCountFact: "albedo.skill.enemy-damage.attack-count",
    allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: directSourceRefs("internal/characters/albedo/skill.go",
      "dd0df91ea54c9ef5a9ea3a620cf7cc606ab20ba7f22ea008f5b8212c44d57825",
      ["internal/characters/albedo/albedo.go:37-41", "internal/characters/albedo/skill.go:27-63", "internal/characters/albedo/skill.go:92-157"]),
    scopeNotes: [directScopeNote, "阳华建立与消失、未来刹那之花、C2 层数及后续爆发不在范围内；保留原快照和产球回调，不扩展其归属。"],
  },
  "dehya-skill-followup": {
    id: "dehya-skill-followup", kind: "direct", siteId: "dehya.skill.enemy-damage", key: "dehya-skill",
    label: "迪希雅 · 净焰剑狱协同攻击事件组件",
    intro: "这是一次净焰剑狱伤害监听调用及其直接排队的协同攻击；已有领域与快照的先前施放归属仍在范围之外。",
    directEmitSite: "dehya.skill.followup-attack", ability: "Molten Inferno (DoT)",
    attackTag: "AttackTagElementalArt", attackCountFact: "dehya.skill.enemy-damage.attack-count",
    allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: directSourceRefs("internal/characters/dehya/skill.go",
      "d79583d0adc72345c62685587510a0b3368f6241aa8ec69bc4c41b74f3868493",
      ["internal/characters/dehya/dehya.go:48-52", "internal/characters/dehya/skill.go:19-35", "internal/characters/dehya/skill.go:125-161", "internal/characters/dehya/skill.go:238-278"]),
    scopeNotes: [directScopeNote, "监听器的 C2 标记清除任务和产球不排伤害；领域建立、延长与恢复、独立受伤监听器及赤鬃之血生命扣减均未纳入。"],
  },
  "raiden-eye-followup": {
    id: "raiden-eye-followup", kind: "direct", siteId: "raiden.eye.enemy-damage", key: "raiden-eye",
    label: "雷电将军 · 雷罚恶曜之眼协同攻击事件组件",
    intro: "这是一次雷罚恶曜之眼监听调用及其直接排队的协同攻击；快照与命中延迟由原生队列继续结算。",
    directEmitSite: "raiden.eye.followup-attack", ability: "Eye of Stormy Judgement (Strike)",
    attackTag: "AttackTagElementalArt", attackCountFact: "raiden.eye.enemy-damage.attack-count",
    allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: [...directSourceRefs("internal/characters/raiden/skill.go",
      "5286cf4c1e2cec0bb7aef1cbb952c5238b7a2b946dc138cd783e48a59ede659c",
      ["internal/characters/raiden/raiden.go:43-44", "internal/characters/raiden/skill.go:89-100", "internal/characters/raiden/skill.go:108-156"]),
    // Raw pinned source is distinct from the retained pre-113 patched-stage hash.
    ...sourceCommits.map(commit => `pinned-raw:${commit}:internal/characters/raiden/skill.go#sha256=c2e1872f174b2fd078608116cef65266ebc0474e468a83b756587f97b031b363`)],
    scopeNotes: [directScopeNote, "不推断已有恶曜之眼的施加者或 E 归属；初始斩击、增伤状态、未来协同攻击和产球生命周期均在范围之外。"],
  },
  "candace-c6-wave": {
    id: "candace-c6-wave", kind: "direct", siteId: "candace.c6.enemy-damage", key: "candace-c6",
    label: "坎蒂丝 C6 · 漫溢攻击事件组件",
    intro: "这是一次坎蒂丝 C6 监听调用及其直接排队的水波攻击；触发者的普攻不是坎蒂丝 Q 的施放归属证据。",
    directEmitSite: "candace.c6.overflow-wave", ability: "The Overflow (C6)",
    attackTag: "AttackTagElementalBurst", attackCountFact: "candace.c6.enemy-damage.attack-count",
    allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: directSourceRefs("internal/characters/candace/cons.go",
      "10c9994290c3e250b62a46947e482b35e58fa3c84d0d7f16d76e172ab1943d27",
      ["internal/characters/candace/cons.go:39-94"]),
    scopeNotes: [directScopeNote, "仅接入本次 C6 水波；赤冕祝祷的先前施加、持续时间及其他水波仍需各自证据。"],
  },
  "kirara-c4-cardamom": {
    id: "kirara-c4-cardamom", kind: "direct", siteId: "kirara.c4.enemy-damage", key: "kirara-c4",
    label: "绮良良 C4 · 协同攻击事件组件",
    intro: "这是一次绮良良 C4 监听调用及其直接排队的协同攻击；监听时已有护盾不证明护盾来自哪次 E。",
    directEmitSite: "kirara.c4.cardamom", ability: "Steed of Skanda",
    attackTag: "AttackTagElementalBurst", attackCountFact: "kirara.c4.enemy-damage.attack-count",
    allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: directSourceRefs("internal/characters/kirara/cons.go",
      "e4f6666f2905b05db1d100f3d04792faf5422d861e78dd159c5693102c9c1028",
      ["internal/characters/kirara/cons.go:29-61", "internal/characters/kirara/shield.go:36-48"]),
    scopeNotes: [directScopeNote, "护盾建立、持有者、持续时间与吸收伤害、其他攻击及完整 E/Q 不因本次 C4 命中而闭合。"],
  },
  "kuki-c4-thundergrass": {
    id: "kuki-c4-thundergrass", kind: "direct", siteId: "kuki.c4.enemy-damage", key: "kuki-c4",
    label: "久岐忍 C4 · 雷草标记事件组件",
    intro: "这是一次久岐忍 C4 监听调用及其直接排队的雷草标记攻击；已有越祓草轮状态的来源不由触发命中决定。",
    directEmitSite: "kuki.c4.thundergrass-mark", ability: "Thundergrass Mark (C4)",
    attackTag: "AttackTagElementalArt", attackCountFact: "kuki.c4.enemy-damage.attack-count",
    allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: directSourceRefs("internal/characters/kuki/cons.go",
      "9ad2b1e7eef798ca0551558c5602a51e60e317dea1194a5dd9681ffa1403edc9",
      ["internal/characters/kuki/cons.go:22-66", "internal/characters/kuki/skill.go:112-123"]),
    scopeNotes: [directScopeNote, "原产球回调保持不变；越祓草轮施加、周期攻击与治疗、生命消耗及完整 E 生命周期仍在范围之外。"],
  },
  "clorinde-c1-shade": {
    id: "clorinde-c1-shade", kind: "direct", siteId: "clorinde.c1.enemy-damage", key: "clorinde-c1",
    label: "克洛琳德 C1 · 夜巡之影事件组件",
    intro: "这是一次克洛琳德 C1 监听调用；进入原生排队分支时会排入两次夜巡之影攻击，逐目标结算数另行核对。",
    directEmitSite: "clorinde.c1.nightwatch-shade", ability: "Nightwatch Shade (C1)",
    attackTag: "AttackTagNormal", attackCountFact: "clorinde.c1.enemy-damage.attack-count",
    allowedAttackCounts: [0, 2], sourceCommits,
    sourceRefs: directSourceRefs("internal/characters/clorinde/cons.go",
      "c6222607c0c38cd696ccb0fc98d2470c71547669584242c6dea8b5d9ef47d6f2",
      ["internal/characters/clorinde/cons.go:39-77", "internal/characters/clorinde/skill.go:204-215"]),
    scopeNotes: [directScopeNote, "本次允许分支为零次或两次攻击排队；原产球回调保持不变，夜巡状态、生命之契和原始普攻的动作归属不由本组件闭合。"],
  },
  "chiori-a1-seize": {
    id: "chiori-a1-seize", kind: "direct", siteId: "chiori.a1.seize.enemy-damage", key: "chiori-seize-the-moment",
    label: "千织 A1 · 协同攻击事件组件",
    intro: "这是一次千织 A1 监听调用及其直接排队的协同攻击；单次监听最多排入一次攻击，不等于 A1 窗口的累计次数。",
    directEmitSite: "chiori.a1.seize.attack", ability: "Fluttering Hasode (Seize the Moment)",
    attackTag: "AttackTagElementalArt", attackCountFact: "chiori.a1.seize.enemy-damage.attack-count",
    allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: directSourceRefs("internal/characters/chiori/asc.go",
      "961b45439ff03d0d0ed4fd062dcbcca3895fbcfe716bfa7a6df718f9957c2a55",
      ["internal/characters/chiori/chiori.go:48-50", "internal/characters/chiori/asc.go:15-24", "internal/characters/chiori/asc.go:55-134", "internal/characters/chiori/asc.go:167-172"]),
    scopeNotes: [directScopeNote, "既有 A1 状态和触发窗口、袖与绢／C4、C6 及完整 E 均在范围之外；保留原快照与防御力附加伤害计算。"],
  },
  "yoimiya-aurous-blaze-explosion": {
    id: "yoimiya-aurous-blaze-explosion", kind: "direct", siteId: "yoimiya.aurous-blaze.enemy-damage", key: "yoimiya-burst-check",
    label: "宵宫 · 琉金火光爆炸事件组件",
    intro: "这是一次宵宫琉金火光监听调用及其直接排队的爆炸；当前目标的既有标记不证明其来自哪次 Q。",
    directEmitSite: "yoimiya.aurous-blaze.explosion", ability: "Aurous Blaze (Explode)",
    attackTag: "AttackTagElementalBurst", attackCountFact: "yoimiya.aurous-blaze.enemy-damage.attack-count",
    allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: directSourceRefs("internal/characters/yoimiya/burst.go",
      "f98879b748aa98274a451f5265739a63a46d8e8eb8a0b4378146bcfd0ee52f04",
      ["internal/characters/yoimiya/yoimiya.go:35-42", "internal/characters/yoimiya/burst.go:30-167", "internal/characters/yoimiya/cons.go:43-77"]),
    scopeNotes: [directScopeNote, "初始 Q、标记施加与转移／消失、C1 死亡效果及共享 C2 增益回调的生命周期仍在范围之外；C2 回调原样保留。"],
  },
  "traveler-electro-bellowing-thunder": {
    id: "traveler-electro-bellowing-thunder", kind: "direct",
    siteId: "traveler.electro.bellowing-thunder.enemy-damage", key: "travelerelectro-bellowingthunder",
    label: "雷旅行者 · 威光落雷事件组件",
    intro: "这是一次雷旅行者伤害监听调用及其直接排队的落雷，保留原爆发快照与原生攻击身份。",
    directEmitSite: "traveler.electro.bellowing-thunder.attack", ability: "Falling Thunder", attackTag: "AttackTagElementalBurst",
    attackCountFact: "traveler.electro.bellowing-thunder.enemy-damage.attack-count", allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: batch114SourceRefs("internal/characters/traveler/common/electro/burst.go", {
      classic: "a25732d15f266240f05c058b9310ee35152ee0f180f2cb1f5771699c9474fc56",
      stellar: "a25732d15f266240f05c058b9310ee35152ee0f180f2cb1f5771699c9474fc56",
    }, ["internal/characters/traveler/common/electro/travelerelectro.go:39-41", "internal/characters/traveler/common/electro/burst.go:61-155", "internal/characters/traveler/common/electro/cons.go:12-69"]),
    scopeNotes: [directScopeNote, "初始爆发、既有快照和威光状态归属、未来落雷、回能与减抗持续时间均在范围之外；源码没有零伤害守卫，不额外添加。"],
  },
  "traveler-pyro-scorching-threshold": {
    id: "traveler-pyro-scorching-threshold", kind: "direct",
    siteId: "traveler.pyro.scorching-threshold.enemy-damage", key: "travelerpyro-scorching-threshold",
    label: "火旅行者 · 灼火之槛事件组件",
    intro: "这是一次火旅行者灼火之槛监听调用及其直接排队的攻击；原始夜魂标签和十二帧快照／伤害延迟保持不变。",
    directEmitSite: "traveler.pyro.scorching-threshold.attack", ability: "Scorching Threshold", attackTag: "AttackTagElementalArt",
    attackCountFact: "traveler.pyro.scorching-threshold.enemy-damage.attack-count", allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: batch114SourceRefs("internal/characters/traveler/common/pyro/skill.go", {
      classic: "d7613291c372fa97fc93a67d2642ef88c65317f4331b01dd9d531ef4612b8416",
      stellar: "e60e46b54d91ba9ef3661c1d46267e00bd4f0dea87a07880df99fa214a52948c",
    }, ["internal/characters/traveler/common/pyro/travelerpyro.go:42-44", "internal/characters/traveler/common/pyro/skill.go:20-33", "internal/characters/traveler/common/pyro/skill.go:193-251"]),
    scopeNotes: [directScopeNote, "初始长按攻击、点按周期、夜魂消耗与到期及产球生命周期均未闭合；两来源各自的夜魂标签表示原样保留。"],
  },
  "odette-c4": {
    id: "odette-c4", kind: "direct", siteId: "odette.c4.enemy-damage", key: "odette-c4",
    label: "Odette C4 · Stellar 协同攻击事件组件",
    intro: "这是 Stellar 固定来源中的一次 Odette C4 监听调用；攻击名称与标签必须符合该次原生 Radiance 分支的配对读数。",
    directEmitSite: "odette.c4.attack", ability: "Odette C4 (Stellar-Conduct)", attackTag: "AttackTagDirectStellarConduct",
    attackCountFact: "odette.c4.enemy-damage.attack-count", allowedAttackCounts: [0, 1], sourceCommits: [sourceCommits[1]],
    attackVariant: { fact: "odette.c4.enemy-damage.attack-variant", variants: [
      { value: 0, ability: "Odette C4 (Stellar-Conduct)", attackTag: "AttackTagDirectStellarConduct" },
      { value: 1, ability: "Odette C4 (Stellar Swirl)", attackTag: "AttackTagDirectStellarSwirl" },
    ] },
    sourceRefs: batch114SourceRefs("internal/characters/odette/cons.go", {
      stellar: "736ee8fc6822b1ac484321075d54b13989f4d858c1094f1dc6a4333845850bab",
    }, ["internal/characters/odette/odette.go:35-41", "internal/characters/odette/cons.go:230-290", "internal/characters/odette/stellar.go:12-39"]),
    scopeNotes: [directScopeNote, "此组件仅允许已审阅 Stellar 提交；Radiance 状态、Dance Double、其他命座、未来协同攻击均在范围之外。分支读数沿用原 switch，不重复读取状态。"],
  },
  "mona-burst-bubble": {
    id: "mona-burst-bubble", kind: "direct", siteId: "mona.bubble.on-enemy-damage", key: "mona-bubble-check",
    label: "莫娜 · 泡影爆炸事件组件",
    intro: "这是一次莫娜伤害监听调用及其直接排队的泡影爆炸；已有泡影与星异状态的先前施加和持续时间仍需各自证据。",
    directEmitSite: "mona.bubble.explosion", ability: "Illusory Bubble (Explosion)", attackTag: "AttackTagElementalBurst",
    attackCountFact: "mona.bubble.on-enemy-damage.attack-count", allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: batch114SourceRefs("internal/characters/mona/burst.go", {
      classic: "6de6985b39b99c8b743c737bb41220b0ba48a38a878029e235ca0323711d5c04",
      stellar: "c8867e452791ca19fd7803697f972e4e36cd25c5730b157bc119c91afff546dc",
    }, ["internal/characters/mona/burst.go:127-172 (classic)", "internal/characters/mona/burst.go:129-184 (stellar)"]),
    scopeNotes: [directScopeNote, "仅标记监听器两个既有触发分支调用的爆炸排队语句；泡影删除、星异施加与刷新及完整 Q 生命周期均在范围之外。"],
  },
  "mona-c2-followup": {
    id: "mona-c2-followup", kind: "direct", siteId: "mona.c2.enemy-damage", key: "mona-c2-followup",
    label: "莫娜 C2 · 追加重击事件组件",
    intro: "这是一次莫娜 C2 监听调用及其直接排队的重击；普通重击动作走自己的原生路径，不归入此调用。",
    directEmitSite: "mona.c2.followup-charged-attack", ability: "Charge Attack", attackTag: "AttackTagExtra",
    attackCountFact: "mona.c2.enemy-damage.attack-count", allowedAttackCounts: [0, 1], sourceCommits,
    sourceRefs: [...batch114SourceRefs("internal/characters/mona/cons.go", {
      classic: "100c2a1d5ed3d3dd85d54c51c775c0c149a87a152a378134976c18b57acd3f1a",
      stellar: "7925726690cfdd9d9f4bcf906f0c0dd9de318a2d51e3c95908496a3088087c5f",
    }, ["internal/characters/mona/cons.go:115-138"]),
    ...batch114SourceRefs("internal/characters/mona/charge.go", {
      classic: "5e36d6460ad5d6ab9fcb531dcfb8bc66e91f9bbcd469ebd5b684916ec0ae5927",
      stellar: "6b45cbcd3fb1474f8467a7a0289b57c06e1bd269cf9977e3525abb6a04baca8a",
    }, ["internal/characters/mona/charge.go:34-70 (classic)", "internal/characters/mona/charge.go:34-72 (stellar)"])],
    scopeNotes: [directScopeNote, "保留原随机、状态与冷却读取顺序及两来源各自的回调；重击动作、产球、星异、Hexerei 增益与后续效果不由本次追加攻击闭合。"],
  },
  "nahida-trikarma-bloom": {
    id: "nahida-trikarma-bloom", kind: "direct", siteId: "nahida.trikarma.bloom-enemy-damage", key: "nahida-tri-karma",
    label: "纳西妲 · 绽放相关三业追击事件组件",
    intro: "这是一次由绽放、烈绽放或超绽放伤害触发的监听调用；原生循环对仍带标记的敌人逐一排队，并独立记录实际进入的排队分支数。",
    directEmitSite: "nahida.trikarma.bloom-followup", ability: "Tri-Karma Purification", attackTag: "AttackTagElementalArt",
    attackCountFact: "nahida.trikarma.bloom-enemy-damage.attack-count", attackCountMode: "source-loop", sourceCommits,
    sourceRefs: batch114SourceRefs("internal/characters/nahida/skill.go", {
      classic: "62640e91c2ede69576640dca3c5e487e93af94a1d331f95483e5b9bae1938fa7",
      stellar: "62640e91c2ede69576640dca3c5e487e93af94a1d331f95483e5b9bae1938fa7",
    }, ["internal/characters/nahida/nahida.go:49", "internal/characters/nahida/skill.go:157-238"]),
    scopeNotes: [directScopeNote, "允许数量来自原生标记筛选循环的非负整数分支计数，不从已观察队列数反推；共用函数的其他反应监听器调用保留独立路径。", "原首个排队目标的产球回调保持不变；标记归属与期限、产球随机及冷却、其他反应输出和完整 E/Q 不在范围内。"],
  },
  "charlotte-c6": {
    id: "charlotte-c6", kind: "delayed", siteId: "charlotte.c6.enemy-damage", key: "charlotte-c6",
    label: "夏洛蒂 C6 · 延迟攻击事件组件",
    intro: "这是一次夏洛蒂 C6 监听调用及其十四帧原生任务；任务运行后无条件排入一次攻击，治疗部分保留独立范围。",
    producerSite: "charlotte.c6.followup-task", producerEmitSite: "charlotte.c6.followup-attack",
    producerCountFact: "charlotte.c6.enemy-damage.producer-count", allowedProducerCounts: [0, 1],
    producerDelayFrames: 14, producerAttackCount: 1,
    ability: "A Summation of Interest (C6)", attackTag: "AttackTagElementalBurst", sourceCommits,
    sourceRefs: batch114SourceRefs("internal/characters/charlotte/cons.go", {
      classic: "440d4978bf373e407ec17f4f01bfbf5ebce8eb0a944a33177d082f1c07cfe98a",
      stellar: "440d4978bf373e407ec17f4f01bfbf5ebce8eb0a944a33177d082f1c07cfe98a",
    }, ["internal/characters/charlotte/charlotte.go:31-45", "internal/characters/charlotte/cons.go:135-196"]),
    scopeNotes: ["仅核对此次监听调用、零或一个 +14 帧任务及其固定一次攻击；长按标记的先前施加、C6 治疗、OnHeal 后续事件与完整 E/Q 均未闭合。", "每个已执行任务的一次攻击由已审阅无条件排队语句规定，不从观察队列数量反推。"],
  },
  "faruzan-c6-collapse": {
    id: "faruzan-c6-collapse", kind: "delayed", siteId: "faruzan.c6.enemy-damage", key: "faruzan-c6-hook",
    label: "珐露珊 C6 · 风压坍陷事件组件",
    intro: "这是一次珐露珊 C6 监听调用及其三十三帧原生任务；只沿该调用追踪一次风压坍陷，不合并瞄准射击的共用路径。",
    producerSite: "faruzan.c6.collapse-task", producerEmitSite: "faruzan.c6.collapse-attack",
    producerCountFact: "faruzan.c6.enemy-damage.producer-count", allowedProducerCounts: [0, 1],
    producerDelayFrames: 33, producerAttackCount: 1,
    ability: "Pressurized Collapse", attackTag: "AttackTagElementalArt", sourceCommits,
    sourceRefs: [...batch114SourceRefs("internal/characters/faruzan/cons.go", {
      classic: "9bc6e92b476328268deffda19ac068256746a3b710588390cb75697dac24a2fd",
      stellar: "9bc6e92b476328268deffda19ac068256746a3b710588390cb75697dac24a2fd",
    }, ["internal/characters/faruzan/cons.go:58-80", "internal/characters/faruzan/aimed.go:94-101"]),
    ...batch114SourceRefs("internal/characters/faruzan/skill.go", {
      classic: "fc03484ff9d454418192077d58090e8fdbfe2674dc5bebf6eb1b0fd615fd4a00",
      stellar: "fc03484ff9d454418192077d58090e8fdbfe2674dc5bebf6eb1b0fd615fd4a00",
    }, ["internal/characters/faruzan/skill.go:14-20", "internal/characters/faruzan/skill.go:84-128"])],
    scopeNotes: ["仅核对此次 C6 调用的零或一个 +33 帧任务及固定一次攻击；既有爆发增益来源、瞄准射击风压坍陷和完整 E/Q 不在范围内。", "原快照、C4 回能、A1 减抗与产球回调保持原样；其后续状态或资源生命周期未由本组件闭合。"],
  },
  "ororon-a1-hypersense": {
    id: "ororon-a1-hypersense", kind: "direct", siteId: "ororon.a1.enemy-damage", key: "ororon-a1-ns",
    label: "欧洛伦 A1 · 超感攻击事件组件",
    intro: "这是一次欧洛伦 A1 伤害监听调用及其直接排队的超感攻击；逐个分支记录排队次数，保留原固定来源的选敌循环。",
    directEmitSite: "ororon.a1.hypersense-attack", ability: "Hypersense", attackTag: "AttackTagNone",
    attackCountFact: "ororon.a1.enemy-damage.attack-count", allowedAttackCounts: [0, 1, 2, 3], sourceCommits,
    sourceRefs: batch114SourceRefs("internal/characters/ororon/asc.go", {
      classic: "9b3f8641a552247caefe42e786a076b0d612e8769f685550642d6b992d64e2ae",
      stellar: "a905749b14cd91d807d810b7c43fea2063fecc0136fccbc857c2fec7bda40f7b",
    }, ["internal/characters/ororon/asc.go:34-40", "internal/characters/ororon/asc.go:88-146"]),
    scopeNotes: [directScopeNote, "源码仅在区域内敌人数为 1–3 时各排一次；零个或至少四个时排零次，该循环未修正。其他反应监听器、夜魂资源与祝福期限、C6 状态不归属本次事件。"],
  },
  "chiori-c4-kinu": {
    id: "chiori-c4-kinu", kind: "chiori-c4-tree", siteId: "chiori.c4.enemy-damage", key: "chiori-c4",
    label: "千织 C4 · 绢任务树事件组件",
    intro: "这是一次千织 C4 监听调用创建的绢及其已登记任务树；攻击、后续检查和到期任务全部完成后才可认定本次交付结束。",
    producerCountFact: "chiori.c4.enemy-damage.producer-count", allowedProducerCounts: [0, 2],
    treeAttackEmitSite: "chiori.c4.kinu.attack", ability: "Fluttering Hasode (Kinu)", attackTag: "AttackTagElementalArt", sourceCommits,
    sourceRefs: [...batch114SourceRefs("internal/characters/chiori/cons.go", {
      classic: "5184e50555dcfa0338039c9d926fbd4d85f93721ee3a1857f90dc192cd39122f",
      stellar: "5184e50555dcfa0338039c9d926fbd4d85f93721ee3a1857f90dc192cd39122f",
    }, ["internal/characters/chiori/cons.go:113-156"]),
    ...batch114SourceRefs("internal/characters/chiori/kinu.go", {
      classic: "39d063cb2aa2de13d1a60a5a717b1b3c8b170849931308bd478fdd2348a6f663",
      stellar: "39d063cb2aa2de13d1a60a5a717b1b3c8b170849931308bd478fdd2348a6f663",
    }, ["internal/characters/chiori/kinu.go:11-97", "internal/characters/chiori/ticker.go:27-70"])],
    scopeNotes: ["仅跟踪此次 C4 分支的两个根任务、显式父子关联的后续检查和攻击尝试；每个任务的子任务数与攻击数均需原生分支读数。", "攻击尝试可因距离返回零次；已命中不能替代剩余检查与到期任务结算。其他来源的绢、既有 C4 状态、袖、C2/C6 及完整 E/Q 不归属本次组件。"],
  },
  "beidou-burst-proc": {
    id: "beidou-burst-proc", kind: "beidou-chain", siteId: "beidou.burst.enemy-damage", key: "beidou-burst",
    label: "北斗 · 闪雷连锁事件组件",
    intro: "这是一次北斗伤害监听调用发出的闪雷及其原生命中回调连锁；每次弹跳都沿相同父队列、攻击、派发和回调槽位继续追踪。",
    directEmitSite: "beidou.burst.first-bounce", callbackEmitSite: "beidou.burst.chain-bounce",
    attackCountFact: "beidou.burst.attack-count", allowedAttackCounts: [0, 1],
    ability: "Stormbreaker (Bounce)", attackTag: "AttackTagElementalBurst", sourceCommits,
    sourceRefs: batch114SourceRefs("internal/characters/beidou/burst.go", {
      classic: "45bba1b60c87c2795ee4084c39bbd9c859993cada435a84b9ace9d209ba552d7",
      stellar: "45bba1b60c87c2795ee4084c39bbd9c859993cada435a84b9ace9d209ba552d7",
    }, ["internal/characters/beidou/burst.go:130-192", "docs/validation/source-shared-delayed-events-beidou-20260930.json"]),
    scopeNotes: ["只闭合此次闪雷调用和沿原生回调身份到达的弹跳；原生 3/5 段上限、实际选择的下一目标和每段零或一次排队分支均需读数。", "未执行或证据不全的回调保持未结算；落空、命中确认阻断及没有其他目标按各自原生回执处理。爆发初始攻击、既有状态归属、护盾、其他监听器和完整 Q 均在范围之外。"],
  },
} as const satisfies Record<SourceHostEventComponentId, SourceHostEventComponentRule>;

export function getSourceHostEventComponentRule(componentId: SourceHostEventComponentId): SourceHostEventComponentRule {
  return sourceHostEventComponentRules[componentId];
}

export function getSourceHostEventComponentForSite(siteId: string | undefined): SourceHostEventComponentId | undefined {
  return sourceHostEventComponentIds.find(id => sourceHostEventComponentRules[id].siteId === siteId);
}
