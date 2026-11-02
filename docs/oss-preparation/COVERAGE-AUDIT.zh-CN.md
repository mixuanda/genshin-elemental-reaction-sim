# 角色与动作覆盖核查（本地，2026-10-21）

这里的数量是固定来源映射，不是官方认证、完整角色数或全队模拟就绪数。活动 verified 指针仍为空。原始可追溯系数、技能/天赋参数、来源路径及限定条件保存在同批 character-hit-matrix.json / source-mappings.json。解析天赋等级10的124个身份没有抛出异常，不等于数值已与游戏独立验证。

| 身份 | 名称 | 映射命中 | 条件完整动作 | 部分动作 | 可组合来源动作 | 相关测试文件（只是候选；括号为上一轮失败数） |
|---|---|---:|---:|---:|---:|---|
| kamisatoayaka | 神里绫华 | 13 | 9 | 0 | 0 | 未建立逐角色测试关联 |
| jean | 琴 | 9 | 7 | 0 | 0 | 未建立逐角色测试关联 |
| aether | 空 | 71 | 32 | 0 | 0 | 未建立逐角色测试关联 |
| lisa | 丽莎 | 9 | 9 | 0 | 0 | 未建立逐角色测试关联 |
| lumine | 荧 | 71 | 32 | 0 | 0 | 未建立逐角色测试关联 |
| barbara | 芭芭拉 | 5 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| kaeya | 凯亚 | 20 | 8 | 0 | 0 | 未建立逐角色测试关联 |
| diluc | 迪卢克 | 19 | 10 | 0 | 0 | 未建立逐角色测试关联 |
| razor | 雷泽 | 9 | 9 | 0 | 0 | 未建立逐角色测试关联 |
| amber | 安柏 | 24 | 7 | 0 | 6 | packages/sim-core/src/__tests__/source-action-amber-skill-burst.test.ts (0) |
| venti | 温迪 | 21 | 2 | 0 | 6 | 未建立逐角色测试关联 |
| xiangling | 香菱 | 13 | 6 | 0 | 0 | 未建立逐角色测试关联 |
| beidou | 北斗 | 8 | 8 | 0 | 0 | 未建立逐角色测试关联 |
| xingqiu | 行秋 | 5 | 3 | 0 | 0 | packages/sim-core/src/__tests__/calculator-keqing-xingqiu.test.ts (0) |
| xiao | 魈 | 12 | 10 | 0 | 0 | 未建立逐角色测试关联 |
| ningguang | 凝光 | 22 | 5 | 0 | 0 | packages/sim-core/src/__tests__/calculator-ningguang-snapshot.test.ts (0) |
| klee | 可莉 | 14 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| zhongli | 钟离 | 14 | 9 | 0 | 1 | 未建立逐角色测试关联 |
| fischl | 菲谢尔 | 4 | 2 | 0 | 5 | 未建立逐角色测试关联 |
| bennett | 班尼特 | 12 | 9 | 0 | 0 | 未建立逐角色测试关联 |
| tartaglia | 达达利亚 | 1 | 1 | 0 | 0 | 未建立逐角色测试关联 |
| noelle | 诺艾尔 | 15 | 11 | 0 | 0 | packages/game-data/src/character-mappings/noelle-action-mappings.test.ts (1); packages/sim-core/src/__tests__/calculator-noelle-context.test.ts (1); packages/sim-core/src/__tests__/noelle-source-action.test.ts (1) |
| qiqi | 七七 | 18 | 7 | 0 | 0 | 未建立逐角色测试关联 |
| chongyun | 重云 | 12 | 9 | 0 | 1 | 未建立逐角色测试关联 |
| ganyu | 甘雨 | 8 | 7 | 0 | 6 | 未建立逐角色测试关联 |
| albedo | 阿贝多 | 7 | 6 | 0 | 0 | 未建立逐角色测试关联 |
| diona | 迪奥娜 | 5 | 5 | 0 | 5 | 未建立逐角色测试关联 |
| mona | 莫娜 | 4 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| keqing | 刻晴 | 16 | 4 | 0 | 1 | packages/sim-core/src/__tests__/calculator-keqing-constellation.test.ts (0); packages/sim-core/src/__tests__/calculator-keqing-xingqiu.test.ts (0) |
| sucrose | 砂糖 | 5 | 5 | 0 | 0 | 未建立逐角色测试关联 |
| xinyan | 辛焱 | 10 | 5 | 0 | 0 | 未建立逐角色测试关联 |
| rosaria | 罗莎莉亚 | 9 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| hutao | 胡桃 | 2 | 2 | 0 | 0 | 未建立逐角色测试关联 |
| kaedeharakazuha | 枫原万叶 | 10 | 7 | 0 | 0 | 未建立逐角色测试关联 |
| yanfei | 烟绯 | 9 | 8 | 0 | 0 | packages/sim-core/src/__tests__/calculator-yanfei-charged.test.ts (0) |
| yoimiya | 宵宫 | 13 | 6 | 0 | 0 | 未建立逐角色测试关联 |
| thoma | 托马 | 9 | 7 | 0 | 0 | 未建立逐角色测试关联 |
| eula | 优菈 | 7 | 5 | 0 | 0 | 未建立逐角色测试关联 |
| raidenshogun | 雷电将军 | 11 | 9 | 0 | 0 | 未建立逐角色测试关联 |
| sayu | 早柚 | 3 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| sangonomiyakokomi | 珊瑚宫心海 | 7 | 1 | 0 | 0 | 未建立逐角色测试关联 |
| gorou | 五郎 | 4 | 4 | 0 | 4 | 未建立逐角色测试关联 |
| kujousara | 九条裟罗 | 5 | 5 | 0 | 5 | 未建立逐角色测试关联 |
| aratakiitto | 荒泷一斗 | 10 | 10 | 0 | 0 | 未建立逐角色测试关联 |
| yaemiko | 八重神子 | 3 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| shikanoinheizou | 鹿野院平藏 | 7 | 5 | 0 | 0 | 未建立逐角色测试关联 |
| yelan | 夜兰 | 6 | 5 | 0 | 4 | 未建立逐角色测试关联 |
| kirara | 绮良良 | 13 | 6 | 0 | 0 | 未建立逐角色测试关联 |
| aloy | 埃洛伊 | 3 | 2 | 0 | 1 | 未建立逐角色测试关联 |
| shenhe | 申鹤 | 17 | 5 | 0 | 0 | 未建立逐角色测试关联 |
| yunjin | 云堇 | 7 | 5 | 0 | 0 | 未建立逐角色测试关联 |
| kukishinobu | 久岐忍 | 41 | 5 | 0 | 0 | 未建立逐角色测试关联 |
| kamisatoayato | 神里绫人 | 11 | 10 | 0 | 0 | 未建立逐角色测试关联 |
| collei | 柯莱 | 16 | 7 | 0 | 4 | packages/game-data/src/character-mappings/collei-charlotte-skill-mappings.test.ts (0) |
| dori | 多莉 | 7 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| tighnari | 提纳里 | 6 | 5 | 0 | 4 | 未建立逐角色测试关联 |
| nilou | 妮露 | 5 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| cyno | 赛诺 | 7 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| candace | 坎蒂丝 | 5 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| nahida | 纳西妲 | 4 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| layla | 莱依拉 | 5 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| wanderer | 流浪者 | 1 | 1 | 0 | 0 | 未建立逐角色测试关联 |
| faruzan | 珐露珊 | 8 | 6 | 0 | 4 | 未建立逐角色测试关联 |
| yaoyao | 瑶瑶 | 8 | 5 | 0 | 0 | 未建立逐角色测试关联 |
| alhaitham | 艾尔海森 | 11 | 9 | 0 | 0 | 未建立逐角色测试关联 |
| dehya | 迪希雅 | 24 | 6 | 0 | 0 | 未建立逐角色测试关联 |
| mika | 米卡 | 2 | 2 | 0 | 0 | 未建立逐角色测试关联 |
| kaveh | 卡维 | 6 | 6 | 0 | 0 | 未建立逐角色测试关联 |
| baizhu | 白术 | 8 | 5 | 0 | 0 | 未建立逐角色测试关联 |
| lynette | 琳妮特 | 5 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| lyney | 林尼 | 3 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| freminet | 菲米尼 | 5 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| wriothesley | 莱欧斯利 | 8 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| neuvillette | 那维莱特 | 5 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| charlotte | 夏洛蒂 | 17 | 5 | 0 | 0 | packages/game-data/src/character-mappings/collei-charlotte-skill-mappings.test.ts (0); packages/sim-core/src/__tests__/calculator-charlotte-c2.test.ts (0) |
| furina | 芙宁娜 | 20 | 13 | 0 | 0 | 未建立逐角色测试关联 |
| chevreuse | 夏沃蕾 | 16 | 5 | 0 | 0 | 未建立逐角色测试关联 |
| navia | 娜维娅 | 6 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| gaming | 嘉明 | 7 | 7 | 0 | 0 | 未建立逐角色测试关联 |
| xianyun | 闲云 | 4 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| chiori | 千织 | 3 | 2 | 0 | 0 | 未建立逐角色测试关联 |
| sigewinne | 希格雯 | 3 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| arlecchino | 阿蕾奇诺 | 5 | 2 | 0 | 0 | 未建立逐角色测试关联 |
| sethos | 赛索斯 | 1 | 1 | 0 | 0 | 未建立逐角色测试关联 |
| clorinde | 克洛琳德 | 6 | 2 | 0 | 0 | 未建立逐角色测试关联 |
| emilie | 艾梅莉埃 | 11 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| kachina | 卡齐娜 | 18 | 10 | 4 | 0 | packages/game-data/src/character-mappings/optimizer-kachina-mappings.test.ts (0) |
| kinich | 基尼奇 | 3 | 1 | 0 | 0 | 未建立逐角色测试关联 |
| mualani | 玛拉妮 | 1 | 1 | 0 | 0 | 未建立逐角色测试关联 |
| xilonen | 希诺宁 | 3 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| chasca | 恰斯卡 | 7 | 2 | 0 | 0 | 未建立逐角色测试关联 |
| ororon | 欧洛伦 | 3 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| mavuika | 玛薇卡 | 1 | 1 | 0 | 0 | 未建立逐角色测试关联 |
| citlali | 茜特菈莉 | 3 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| lanyan | 蓝砚 | 8 | 4 | 0 | 0 | 未建立逐角色测试关联 |
| yumemizukimizuki | 梦见月瑞希 | 3 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| iansan | 伊安珊 | 7 | 7 | 0 | 0 | 未建立逐角色测试关联 |
| varesa | 瓦雷莎 | 2 | 2 | 0 | 0 | 未建立逐角色测试关联 |
| escoffier | 爱可菲 | 24 | 2 | 0 | 0 | 未建立逐角色测试关联 |
| ifa | 伊法 | 6 | 6 | 0 | 0 | packages/game-data/src/artifact-build.test.ts (0); packages/game-data/src/artifact-conditional-build.test.ts (0); packages/game-data/src/artifact-conditional-effects.test.ts (0); packages/game-data/src/artifact-piece-effects.test.ts (1); packages/game-data/src/artifact-reaction-effects.test.ts (0); packages/game-data/src/artifact-remaining-effects.test.ts (0); packages/sim-core/src/artifact-utility-runtime.test.ts (0); packages/sim-core/src/lunar-artifact-calculator.test.ts (0); packages/sim-core/src/__tests__/artifact-buff-runtime.test.ts (0); packages/sim-core/src/__tests__/artifact-damage-runtime.test.ts (0); packages/sim-core/src/__tests__/artifact-event-runtime.test.ts (0); packages/sim-core/src/__tests__/artifact-special-composition.test.ts (0); packages/sim-core/src/__tests__/lunar-artifact-runtime.test.ts (0); packages/sim-core/src/__tests__/moonlight-artifact-composition.test.ts (0); packages/sim-core/src/__tests__/source-host-artifact-constants.test.ts (0); packages/sim-core/src/__tests__/source-host-artifact-dynamic.test.ts (0); packages/sim-core/src/__tests__/source-host-artifact-formula.test.ts (0); packages/sim-core/src/__tests__/stellar-artifact-composition.test.ts (0) |
| skirk | 丝柯克 | 2 | 1 | 0 | 0 | 未建立逐角色测试关联 |
| dahlia | 塔利雅 | 7 | 6 | 0 | 0 | 未建立逐角色测试关联 |
| ineffa | 伊涅芙 | 4 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| manekin | 奇偶·男性 | 16 | 14 | 0 | 0 | 未建立逐角色测试关联 |
| manekina | 奇偶·女性 | 16 | 14 | 0 | 0 | 未建立逐角色测试关联 |
| lauma | 菈乌玛 | 4 | 2 | 0 | 0 | 未建立逐角色测试关联 |
| flins | 菲林斯 | 3 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| aino | 爱诺 | 4 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| nefer | 奈芙尔 | 13 | 9 | 1 | 0 | packages/sim-core/src/nefer-observed-lifecycle.test.ts (0); packages/game-data/src/character-mappings/nefer-ordinary-context.test.ts (0) |
| durin | 杜林 | 4 | 2 | 0 | 0 | packages/mechanics/src/characters/durin.test.ts (0) |
| jahoda | 雅珂达 | 10 | 8 | 0 | 0 | 未建立逐角色测试关联 |
| columbina | 哥伦比娅 | 4 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| zibai | 兹白 | 11 | 9 | 0 | 0 | packages/sim-core/src/traveler-zibai-source-batch.test.ts (0) |
| illuga | 叶洛亚 | 10 | 9 | 0 | 0 | 未建立逐角色测试关联 |
| varka | 法尔伽 | 18 | 2 | 0 | 0 | 未建立逐角色测试关联 |
| lohen | 洛恩 | 24 | 9 | 4 | 0 | 未建立逐角色测试关联 |
| linnea | 莉奈娅 | 14 | 7 | 4 | 0 | packages/sim-core/src/linnea-observed-composition.test.ts (0); packages/sim-core/src/linnea-observed-lifecycle.test.ts (0); packages/game-data/src/character-mappings/optimizer-linnea-mappings.test.ts (0) |
| nicole | 尼可 | 4 | 3 | 0 | 0 | 未建立逐角色测试关联 |
| prune | 布伦妮 | 13 | 6 | 0 | 0 | 未建立逐角色测试关联 |
| sandrone | 桑多涅 | 19 | 7 | 6 | 0 | packages/sim-core/src/sandrone-observed-composition.test.ts (0); packages/sim-core/src/sandrone-observed-lifecycle.test.ts (0) |
| vodyanitsa | 沃雅妮莎 | 7 | 7 | 0 | 0 | 未建立逐角色测试关联 |
| vesna | 薇斯纳 | 10 | 9 | 0 | 0 | 未建立逐角色测试关联 |
| alyosha | 阿罗夏 | 17 | 9 | 5 | 0 | packages/sim-core/src/alyosha-observed-lifecycle.test.ts (0) |
| odette | 奥黛塔 | 17 | 9 | 0 | 0 | 未建立逐角色测试关联 |

本轮新增实际关联：凯亚C0/T1的120秒E-only原生浏览器闭环已通过；12击各自手算/独立回放差0，真实结束7200帧。详见SCOPE-AND-REPRODUCTION的真实角色段。此证据不将本表其他角色或凯亚Q/整队循环改为已测。
