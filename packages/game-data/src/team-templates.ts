/**
 * Editable four-character starting points for the source-host team builder.
 * These are team skeletons, not rankings or optimized rotations. The action
 * lists are conservative teaching inputs; source-host owns timing, energy,
 * cooldowns, and animation behavior.
 */
export type TeamTemplateCharacterId = `character:${number}`;

export type TeamTemplateAction = {
  actor: TeamTemplateCharacterId;
  /** Source GCSL action vocabulary; low_plunge and aim are needed by some kits. */
  kind: "skill" | "burst" | "attack" | "aim" | "jump" | "low_plunge" | "wait";
  repeat?: number;
  frames?: number;
  /** Integer source action parameters, serialized as GCSL key=value fields. */
  params?: Record<string, number>;
};

export type TeamTemplateMember = {
  characterId: TeamTemplateCharacterId;
  /** Exact character configuration key from source-host inventory metadata. */
  configurationKey: string;
  role: string;
};

export type TeamTemplate = {
  id: string;
  name: string;
  reaction: string;
  description: string;
  members: [TeamTemplateMember, TeamTemplateMember, TeamTemplateMember, TeamTemplateMember];
  /** Editable beginner sequence, not a recommended or optimized rotation. */
  beginnerSequence: TeamTemplateAction[];
};

const c = (id: number): TeamTemplateCharacterId => `character:${id}`;
const m = (
  characterId: TeamTemplateCharacterId,
  configurationKey: string,
  role: string
): TeamTemplateMember => ({ characterId, configurationKey, role });
const a = (
  actor: TeamTemplateCharacterId,
  kind: TeamTemplateAction["kind"],
  repeat?: number,
  frames?: number,
  params?: Record<string, number>
): TeamTemplateAction => ({ actor, kind, ...(repeat === undefined ? {} : { repeat }), ...(frames === undefined ? {} : { frames }), ...(params === undefined ? {} : { params }) });

export const teamTemplates: TeamTemplate[] = [
  {
    id: "vaporize-hydro-pyro",
    name: "水火蒸发入门",
    reaction: "vaporize",
    description: "用行秋和夜兰提供水元素后台伤害，胡桃负责前台攻击；钟离提供护盾。动作仅用于熟悉队伍输入。",
    members: [m(c(10000046), "hutao", "站场输出"), m(c(10000025), "xingqiu", "后台挂水与减伤"), m(c(10000060), "yelan", "后台挂水与增伤"), m(c(10000030), "zhongli", "护盾与抗打断")],
    beginnerSequence: [a(c(10000030), "skill", undefined, undefined, { hold: 1 }), a(c(10000025), "skill"), a(c(10000025), "burst"), a(c(10000060), "skill"), a(c(10000060), "burst"), a(c(10000046), "skill"), a(c(10000046), "attack", 3)]
  },
  {
    id: "melt-cryo-pyro",
    name: "冰火融化入门",
    reaction: "melt",
    description: "香菱与班尼特提供火元素技能，凯亚和罗莎莉亚提供冰元素伤害；先观察元素附着，再调整施放顺序。",
    members: [m(c(10000023), "xiangling", "后台火元素伤害"), m(c(10000032), "bennett", "治疗与火元素支援"), m(c(10000015), "kaeya", "后台冰元素伤害"), m(c(10000045), "rosaria", "后台冰元素伤害与暴击支援")],
    beginnerSequence: [a(c(10000032), "skill"), a(c(10000032), "burst"), a(c(10000023), "skill"), a(c(10000023), "burst"), a(c(10000015), "skill"), a(c(10000015), "burst"), a(c(10000045), "skill"), a(c(10000045), "burst")]
  },
  {
    id: "overload-chevreuse",
    name: "夏沃蕾超载入门",
    reaction: "overload",
    description: "队伍只使用火、雷角色以配合夏沃蕾的队伍条件；从技能与爆发开始，具体施放次序可以编辑。",
    members: [m(c(10000090), "chevreuse", "治疗与火雷队伍支援"), m(c(10000023), "xiangling", "后台火元素伤害"), m(c(10000031), "fischl", "后台雷元素伤害"), m(c(10000032), "bennett", "治疗与攻击支援")],
    beginnerSequence: [a(c(10000032), "skill"), a(c(10000032), "burst"), a(c(10000023), "skill"), a(c(10000023), "burst"), a(c(10000031), "skill"), a(c(10000090), "skill"), a(c(10000090), "burst")]
  },
  {
    id: "electro-charged-ayato",
    name: "水雷感电入门",
    reaction: "electro-charged",
    description: "绫人负责前台水元素攻击，菲谢尔与北斗提供后台雷元素伤害，万叶提供聚怪与元素支援。",
    members: [m(c(10000066), "kamisatoayato", "站场水元素输出"), m(c(10000031), "fischl", "后台雷元素伤害"), m(c(10000024), "beidou", "后台雷元素伤害与抗打断"), m(c(10000047), "kaedeharakazuha", "聚怪与元素支援")],
    beginnerSequence: [a(c(10000031), "skill"), a(c(10000024), "skill"), a(c(10000024), "burst"), a(c(10000047), "skill"), a(c(10000047), "burst"), a(c(10000066), "skill"), a(c(10000066), "attack", 3)]
  },
  {
    id: "aggravate-keqing",
    name: "刻晴激化入门",
    reaction: "aggravate",
    description: "纳西妲提供草元素，菲谢尔补充后台雷伤，刻晴承担站场雷伤；万叶提供聚怪和元素支援。",
    members: [m(c(10000042), "keqing", "站场雷元素输出"), m(c(10000031), "fischl", "后台雷元素伤害"), m(c(10000073), "nahida", "草元素附着与精通支援"), m(c(10000047), "kaedeharakazuha", "聚怪与元素支援")],
    beginnerSequence: [a(c(10000073), "skill"), a(c(10000073), "burst"), a(c(10000031), "skill"), a(c(10000042), "skill"), a(c(10000042), "burst"), a(c(10000047), "skill"), a(c(10000042), "attack", 3)]
  },
  {
    id: "hyperbloom-kuki",
    name: "久岐忍超绽放入门",
    reaction: "hyperbloom",
    description: "草、水共同产生草原核，由久岐忍的雷元素技能触发；先用简单技能输入观察草原核与追踪攻击。",
    members: [m(c(10000073), "nahida", "草元素附着"), m(c(10000025), "xingqiu", "后台挂水"), m(c(10000065), "kukishinobu", "治疗与雷元素触发"), m(c(10000060), "yelan", "后台挂水与增伤")],
    beginnerSequence: [a(c(10000073), "skill"), a(c(10000025), "skill"), a(c(10000025), "burst"), a(c(10000060), "skill"), a(c(10000060), "burst"), a(c(10000065), "skill"), a(c(10000073), "attack", 3)]
  },
  {
    id: "burgeon-thoma",
    name: "托马烈绽放入门",
    reaction: "burgeon",
    description: "纳西妲与行秋提供草、水元素以产生草原核，托马的火元素后台伤害触发烈绽放；白术负责治疗与草元素支援。",
    members: [m(c(10000073), "nahida", "草元素附着"), m(c(10000025), "xingqiu", "后台挂水"), m(c(10000050), "thoma", "护盾与火元素触发"), m(c(10000082), "baizhu", "治疗与草元素支援")],
    beginnerSequence: [a(c(10000073), "skill"), a(c(10000025), "skill"), a(c(10000025), "burst"), a(c(10000082), "skill"), a(c(10000050), "skill"), a(c(10000050), "burst"), a(c(10000073), "attack", 3)]
  },
  {
    id: "bloom-nilou",
    name: "妮露绽放入门",
    reaction: "bloom",
    description: "全队限定水、草角色以满足妮露天赋条件；用技能建立水草附着并观察丰穰之核。",
    members: [m(c(10000070), "nilou", "水草队伍核心"), m(c(10000073), "nahida", "草元素附着"), m(c(10000054), "sangonomiyakokomi", "治疗与挂水"), m(c(10000067), "collei", "后台草元素附着")],
    beginnerSequence: [a(c(10000070), "skill"), a(c(10000070), "skill"), a(c(10000070), "skill"), a(c(10000070), "skill"), a(c(10000067), "skill"), a(c(10000067), "burst"), a(c(10000073), "skill"), a(c(10000054), "skill"), a(c(10000054), "attack", 3)]
  },
  {
    id: "freeze-ayaka",
    name: "神里绫华冻结入门",
    reaction: "freeze",
    description: "心海提供水元素与治疗，绫华提供冰元素输出，万叶聚怪，迪奥娜提供护盾与冰元素支援。",
    members: [m(c(10000002), "kamisatoayaka", "站场冰元素输出"), m(c(10000054), "sangonomiyakokomi", "挂水与治疗"), m(c(10000047), "kaedeharakazuha", "聚怪与元素支援"), m(c(10000039), "diona", "护盾与治疗")],
    beginnerSequence: [a(c(10000039), "skill"), a(c(10000054), "skill"), a(c(10000047), "skill"), a(c(10000047), "burst"), a(c(10000002), "skill"), a(c(10000002), "burst"), a(c(10000002), "attack", 2)]
  },
  {
    id: "physical-eula",
    name: "优菈物理入门",
    reaction: "physical",
    description: "菲谢尔提供雷元素以协助触发超导，米卡提供治疗与物理支援；优菈进行物理攻击。",
    members: [m(c(10000051), "eula", "站场物理输出"), m(c(10000031), "fischl", "后台雷元素伤害"), m(c(10000080), "mika", "治疗与物理支援"), m(c(10000045), "rosaria", "冰元素支援")],
    beginnerSequence: [a(c(10000031), "skill"), a(c(10000045), "skill"), a(c(10000051), "skill"), a(c(10000051), "burst"), a(c(10000051), "attack", 3)]
  },
  {
    id: "geo-itto",
    name: "荒泷一斗岩队入门",
    reaction: "geo",
    description: "五郎为岩队提供支援，阿贝多与钟离补充岩元素技能；以一斗的基础攻击作为入门输入。",
    members: [m(c(10000057), "aratakiitto", "站场岩元素输出"), m(c(10000055), "gorou", "岩队支援"), m(c(10000038), "albedo", "后台岩元素伤害"), m(c(10000030), "zhongli", "护盾与减抗")],
    beginnerSequence: [a(c(10000030), "skill", undefined, undefined, { hold: 1 }), a(c(10000038), "skill"), a(c(10000055), "skill"), a(c(10000057), "skill"), a(c(10000057), "burst"), a(c(10000057), "attack", 3)]
  },
  {
    id: "lunar-crystallize-ningguang",
    name: "月结晶机制入门",
    reaction: "lunar-crystallize",
    description: "固定来源中的哥伦比娅与凝光示例可在水元素技能后通过凝光攻击触发月结晶；五郎和钟离补充岩队支援与护盾。这是机制入门骨架，不是配队推荐或最优循环。",
    members: [m(c(10000125), "columbina", "水元素施加"), m(c(10000027), "ningguang", "岩元素触发与站场攻击"), m(c(10000055), "gorou", "岩队支援"), m(c(10000030), "zhongli", "护盾与减抗")],
    beginnerSequence: [a(c(10000125), "skill"), a(c(10000027), "attack", 3), a(c(10000055), "skill"), a(c(10000030), "skill", undefined, undefined, { hold: 1 }), a(c(10000027), "attack", 3)]
  },
  {
    id: "mono-pyro-lyney",
    name: "林尼纯火入门",
    reaction: "mono-pyro",
    description: "队伍以火元素角色为主，班尼特提供治疗和攻击支援，万叶负责聚怪与元素支援；先用通用技能输入熟悉角色轮换。",
    members: [m(c(10000084), "lyney", "站场火元素输出"), m(c(10000023), "xiangling", "后台火元素伤害"), m(c(10000032), "bennett", "治疗与攻击支援"), m(c(10000047), "kaedeharakazuha", "聚怪与元素支援")],
    beginnerSequence: [a(c(10000032), "skill"), a(c(10000032), "burst"), a(c(10000023), "skill"), a(c(10000023), "burst"), a(c(10000047), "skill"), a(c(10000084), "skill"), a(c(10000084), "aim")]
  },
  {
    id: "anemo-xiao",
    name: "魈风队入门",
    reaction: "anemo",
    description: "珐露珊提供风元素支援，闲云提供治疗与下落攻击支援。动作草稿在爆发后穿插跳跃与低空下落攻击；高度和有效命中由实际来源状态决定。",
    members: [m(c(10000026), "xiao", "站场风元素输出"), m(c(10000076), "faruzan", "风元素支援"), m(c(10000093), "xianyun", "治疗与下落攻击支援"), m(c(10000032), "bennett", "治疗与攻击支援")],
    beginnerSequence: [a(c(10000076), "skill"), a(c(10000076), "burst"), a(c(10000093), "skill"), a(c(10000032), "skill"), a(c(10000032), "burst"), a(c(10000026), "skill"), a(c(10000026), "burst"), a(c(10000026), "jump"), a(c(10000026), "low_plunge"), a(c(10000026), "jump"), a(c(10000026), "low_plunge"), a(c(10000026), "jump"), a(c(10000026), "low_plunge")]
  },
  {
    id: "lunar-charged-ineffa",
    name: "月感电入门",
    reaction: "lunar-charged",
    description: "采用固定来源中可用的伊涅芙、菲林斯与哥伦比娅，加入欧洛伦提供雷元素支援；月曜机制由 source-host 实际运行。",
    members: [m(c(10000116), "ineffa", "月感电队伍核心"), m(c(10000120), "flins", "雷元素输出"), m(c(10000125), "columbina", "水元素支援"), m(c(10000105), "ororon", "后台雷元素伤害")],
    beginnerSequence: [a(c(10000116), "skill"), a(c(10000125), "skill"), a(c(10000105), "skill"), a(c(10000120), "skill"), a(c(10000120), "burst"), a(c(10000116), "burst")]
  },
  {
    id: "lunar-bloom-lauma",
    name: "月绽放入门",
    reaction: "lunar-bloom",
    description: "以菈乌玛和纳西妲提供草元素、哥伦比娅和妮露提供水元素作为月绽放起步骨架；具体月曜机制由来源运行。",
    members: [m(c(10000119), "lauma", "月绽放队伍核心"), m(c(10000073), "nahida", "草元素附着"), m(c(10000125), "columbina", "水元素支援"), m(c(10000070), "nilou", "水元素支援")],
    beginnerSequence: [a(c(10000119), "skill"), a(c(10000125), "skill"), a(c(10000070), "skill"), a(c(10000073), "skill"), a(c(10000119), "burst")]
  },
  {
    id: "electro-charged-charged-shot",
    name: "达达利亚感电入门",
    reaction: "electro-charged",
    description: "以达达利亚作为水元素前台角色，菲谢尔与北斗提供后台雷伤，班尼特提供治疗；此模板便于与另一感电骨架比较。",
    members: [m(c(10000033), "tartaglia", "前台水元素输出"), m(c(10000031), "fischl", "后台雷元素伤害"), m(c(10000024), "beidou", "后台雷元素伤害"), m(c(10000032), "bennett", "治疗与攻击支援")],
    beginnerSequence: [a(c(10000032), "skill"), a(c(10000032), "burst"), a(c(10000031), "skill"), a(c(10000024), "skill"), a(c(10000024), "burst"), a(c(10000033), "skill"), a(c(10000033), "attack", 3)]
  },
  {
    id: "lunar-charged-ororon",
    name: "月感电角色轮换示例",
    reaction: "lunar-charged",
    description: "保留伊涅芙与哥伦比娅，改用菲林斯和爱诺作为可用来源角色；动作草稿只展示角色轮换，不声明推荐循环。",
    members: [m(c(10000116), "ineffa", "月感电队伍核心"), m(c(10000120), "flins", "雷元素输出"), m(c(10000125), "columbina", "水元素支援"), m(c(10000121), "aino", "水元素支援")],
    beginnerSequence: [a(c(10000121), "skill"), a(c(10000116), "skill"), a(c(10000125), "skill"), a(c(10000120), "skill"), a(c(10000120), "burst"), a(c(10000116), "burst")]
  }
];
