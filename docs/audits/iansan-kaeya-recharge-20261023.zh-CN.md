这是一份合法离散词条的双西风充能测试构建，用于与原 starter 双人120秒轴作不同装备输入的能量对照。它不是玩家实装、毕业配装或最优解，也没有证明每20秒必定能够开 Q。伊安珊仍为 C6、凯亚仍为 C0，两人90级、基础天赋10/10/10；武器分别改为90级精5西风长枪、西风剑。仅此候选，不额外搜索或运行模拟。

| 角色 | 固定来源静态总 ER | 原始 CR | 按100%上限后的 CR | 逐件词条总数 |
| --- | ---: | ---: | ---: | ---: |
| 伊安珊 | 253.7068198% | 100.28% | 100% | 5×9=45 |
| 凯亚 | 280.5331802% | 100.28% | 100% | 5×9=45 |

两人均为五星+20、初始四副词条，每件共九次初始/升级档位，每类至少一次、至多六次，主副互斥、四副不重复。五件依次采用冰风迷途的勇士、平息鸣雷的尊者、渡过烈火的贤人、被怜爱的少女、角斗士的终幕礼，每套仅一件，不触发任何二件效果。伊安珊使用充能沙、攻击杯、暴击头；凯亚使用充能沙、冰伤杯、暴击头。

| 部位 | 伊安珊的副词条次数 | 凯亚的副词条次数 |
| --- | --- | --- |
| 花 | CR5、ER2、ATK%1、DEF1 | CR5、ER2、ATK%1、DEF1 |
| 羽 | CR4、ER3、ATK%1、DEF1 | CR4、ER2、ATK%2、DEF1 |
| 沙 | CR4、ATK%3、HP1、DEF1 | CR4、ATK%3、HP1、DEF1 |
| 杯 | CR4、ER3、固定ATK1、DEF1 | CR4、ER1、ATK%3、DEF1 |
| 头 | ER3、ATK%4、固定ATK1、DEF1 | ER2、ATK%5、固定ATK1、DEF1 |

花的五次 CR 使用零起算档2（每次3.5%），其他 CR 使用档3（3.89%）；伊安珊 ER 使用档3（6.48%），凯亚 ER 使用档2（5.83%）；其他副词条使用档3。固定表中 ER沙为51.8%、CR头为31.1%。因此两人的 CR 为 `5%+31.1%+5×3.5%+12×3.89%=100.28%`。没有借用冰附着、凯亚命座或未知增益。此分配没有暴伤副词条，采用很高的确定档位质量，目的是检验能量路径，不能据此称为通常可获得库存或收益最优。

角色突破和武器副属性没有塞进 `add stats`：伊安珊的纯圣遗物 ER 为1.2308，总 ER 为 `1+1.2308+0.066667×4.594=2.537068198`；凯亚纯圣遗物 ER 为0.9261，总 ER 为 `1+0.9261+0.2667+0.133333×4.594=2.805331802`。这些是固定 genshin-db/Optimizer 表的静态值；原生源各自读取角色、武器曲线，实际 native 面板及西风产球仍须在随后对照中独立核对。精5西风也仍要求实际前台命中、暴击及原生冷却就绪，不能把100% CR写成每轮固定回能。

[装备输入](iansan-kaeya-recharge-20261023.equipment.json) 的每件完整身份、主词条、四副和每次档位均保留。校验脚本实际调用现有 `resolveArtifactBuild`、`resolveEquipmentBuild`，然后调用 `equipmentBuildToSourceTeamMember` 与 `compileSourceTeamDraft`；只把编译器的装备声明替换到基线，角色声明行完全相同。导出的 `add stats` 严格等于五件圣遗物贡献，角色突破、武器属性和西风效果由原生声明负责，避免重复。`effectsDisabled` 等字段只限定 TypeScript 静态面板校验范围，未关闭 GCSL 中真实西风被动或角色命座。

[基线原始请求](iansan-kaeya-recharge-20261023.baseline.request.json) SHA256 为 `db8382760f42c0570ecea28e9f4eae9f34f2d13aa3192638982da8cc8683346c`。除装备声明外，动作、120秒时长、target、seed20261023、首次一次满能、phaseObservation及其他请求字段全部保持；没有回能注入、忽略能量、任意面板补差或移动距离假设。[生成请求](iansan-kaeya-recharge-20261023.request.json) 和 [GCSL](iansan-kaeya-recharge-20261023.gcsl) 与已交付 `/tmp/GIDPS-iansan-legal-recharge-evidence-20261023/` 的同名文件字节相同。

实际校验成功，主副ER冲突、第十次词条、不存在档位、武器类型不符四个负例均被现有 API 拒绝。[校验回执](iansan-kaeya-recharge-20261023.validation.json) 保留源文件/API哈希、真实解析后的每件数值和导出成员；[独立 Decimal 复核](iansan-kaeya-recharge-20261023.independent.json) 不导入 TS 公式，直接读取固定表、catalog、曲线累加，核对全部圣遗物属性、ER、CR和静态攻击一致。

复现使用仓库已有 Vite，无需安装依赖：

```sh
node docs/audits/iansan-kaeya-recharge-20261023.validate.mjs --output-dir /tmp/GIDPS-iansan-recharge-reproduced
```

稀疏工作树可通过 `--repo-root` 指向已有完整 checkout 以读取相同 API 和源表。本次实际验证使用 `/workspace/GIDPS-cloud/player-import-integration`。脚本不加载原生运行器，不执行 GCSL；后续唯一120秒对照由根线程统一安排，不能将本回执当作能量闭环通过。

候选冻结身份：equipment `f158fd30624f692c1c893329592724c2ef3de745e396220de24ec5a77c817a99`；request `e9a3524c097cf110faad849a444680d27a032d633299a27f07bd0faa0cbb1413`；GCSL `046ecf61765f3494b64a00c814d1b37b4e2b42b277eb22c14d2fa35ca5715916`；validation `d4e866b5c336e0f9329e3a06d45a55d8139d3709ac35eda1afb6204143cb9f08`。未改公共源码、旧结果或原始基线；未运行 native、全套测试、push 或部署。
