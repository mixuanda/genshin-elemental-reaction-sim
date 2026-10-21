# 玩家配装 → 现有单技能计算：本地整合结果

独立分支 cloud/player-import-integration-20261021，计算基线 269c47a。完整原始补丁从 Library `libfile_c27d81463b688191a9a2a5624e143592` 下载：203115 bytes，SHA-256 `5b083dd098fe66b713bce928d6fef8ae857343a24443b7e0c57e822b798d2be5`，26 个新增普通文件清单与 git apply --check 均通过。原样接收提交 ebbfb8f；未使用不完整的手工 chunk 文件。

## 实际接线

新增 apps/web/src/player-import-preview.ts 与 player-import-handoff.ts，build-workshop.ts 挂载到现有 /builds 配装页面。GOOD / Enka JSON / 配装纯文本都调用独立模块 importPlayerInput、applyPreview、createCoreHandoff，不重写解析器。

预览显示来源、范围、导入时间、合成数据标志；不完整/失败预览不替换上次完整快照，提供返回上次完整预览。装备路线通过既有 resolveEquipmentBuild 再校验；用户点选后调用现有 openCalculator → loadEquipmentBuild → 现有单技能计算器。基础天赋与命座独立，不用有效等级反推基础，不叠加最终面板统计。装备条件效果明确关闭；用户需要在现有计算器中按真实条件另行启用支持项。

calculator-ui.ts 的最小修正：把来源 label 保存入 assumptions，供导出保留；把装备已载入后的特定旧“C0；只使用列出的伤害表达式”模板前缀改为实际配装命座。未修改伤害公式。

首条闭环合成 fixture：凯亚 C3、Lv90、基础天赋10、冷刃Lv90 R5、五件5星+0测试圣遗物，三条初始显示副词条。不是玩家账号、不是毕业配装，不证明抽卡/强化历史。E有效等级13；未执行120秒队伍模拟。

与原 parseGoodBuilds → editable-build-v1 → 既有配装编辑器 → 同E动作路线比较（输入一致，不复用新交接层生成对照）：

- 非暴击 1914.0958601595487
- 暴击 3387.9496724824016
- 期望 2186.7588154392765

两条路线 totals 和逐击三个伤害分支完全一致，C3只加一次，来源写入导出文档。该比较证明接线一致，不是独立游戏机制实测。

## 验证与限制

- 导入模块既有测试及新交接测试：83/83。
- 云端 Chromium 浏览器：GOOD完整配装到真实计算数值对照；缺字段/解析失败保留；Enka和纯文本预览与阻断。
- 类型检查与构建通过。未跑全量回归，未重复120秒/批量性能测试。第一次浏览器脚本误把折叠的审计详情当可见，修正为展开详情，保留失败日志和trace；未改数值断言。
- 真实账号/UID联网端到端未在本轮测试；既有UID入口保留。无真实登录、cookie/token收集或会话存储。
- 面板路线仍不接通：CoreImportHandoff.panel 不能强制转换成 CatalogResolvedShowcaseCharacter；缺身份/技能映射或未知条件增益不能猜。
- Enka/纯文本预览已测，但未宣称所有导入角色都能计算。缺基础天赋、非法装备或当前引擎缺动作会明确阻断，预览保留。Windows真实运行未测。
- 新预览仅内存，未新增导入资料持久化；既有计算文档/配装保存入口继续使用。没有覆盖旧文件或旧结果。

## 本地运行与相关测试

```sh
npm ci
npm run build
npm run preview --workspace @genshin-dps-lab/web -- --host 127.0.0.1 --port 4181 --strictPort
# 浏览器打开 http://127.0.0.1:4181/builds
npx vitest run packages/player-import/src apps/web/src/player-import-handoff.test.ts
PLAYWRIGHT_BROWSERS_PATH=/workspace/GIDPS-cloud/browsers npm run test:e2e -- --config playwright.player-import.config.ts --workers=1
```

本轮复用既有依赖，无新安装。独立Playwright配置使用4181且拒绝复用旧服务器，避免误测原分支4173的构建。测试自动启动/关闭预览；手动启动与测试勿同时占用4181。

原始证据：/workspace/GIDPS-cloud/import-integration-evidence，包含 unit.json、构建/浏览器日志、comparison.json、截图及首次失败trace。云连接曾短暂中断，17:40:17 UTC命令成功、原构建会话退出0后继续，未重复启动未知构建。
