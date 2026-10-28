# 导入整合准备（补丁尚未收到）

独立工作树 `/workspace/GIDPS-cloud/player-import-integration`，分支 `cloud/player-import-integration-20261021`，基于 `269c47a88de28dfcedbc2ebea57a625284e9b74c`。原计算分支不改动。

收到的仅是完整类型契约与补丁摘要。26 个新文件的完整原始补丁尚未收到；没有应用、重写或测试不存在的导入模块。

## 收件步骤

完整 raw patch 应为 203115 bytes，SHA-256 `5b083dd098fe66b713bce928d6fef8ae857343a24443b7e0c57e822b798d2be5`；gzip 为 50260 bytes，SHA-256 `512b4ac7554544866c9c9e067df1c72287f0c46b0d7bf4927978f7dcd74b3674`。先逐段校验、顺序拼接再解码解压，保留原始各段。禁止将缺段或摘要写成实现。

在本工作树执行 `node scripts/check-player-import-handoff.mjs /path/full.patch`。脚本仅校验长度、哈希、26 个新增普通文件路径及 `git apply --check`，不应用、不下载。通过后再审查并应用；不能声称此脚本已验证尚未收到的补丁。

## 已确认现有入口与最小改动清单

- **新增** `apps/web/src/player-import-preview.ts`：在现有配装页挂载本地 JSON/纯文本预览；直接调用新模块 `importPlayerInput`、`applyPreview`、`createCoreHandoff`，不再解析一套 GOOD/Enka。显示来源、范围、合成标记、未知字段、角色选择与逐路线阻断理由。只有用户明确选择合法配装才调用现有 openCalculator。
- **新增** `apps/web/src/player-import-handoff.ts`：薄交接层，检查 `equipment.status`、非空 equipmentInput、基础天赋与命座，转换为现有 `BuildHandoffMetadata`；再次调用既有装备校验，不能仅凭 ready 文本信任输入。记录来源 label，不传最终面板统计到装备路线。不复制新模块类型。
- **修改** `apps/web/src/build-workshop.ts`：挂载预览、传入既有 `options.openCalculator`；保留 editable-build-v1 本地文件、UID API 代理和现有导入入口行为。第一块不接队伍导入，避免新增范围。
- **新增测试** `apps/web/src/player-import-handoff.test.ts`、`apps/web/e2e/player-import-calculator.spec.ts`。根据收到的真实导出及 fixture 编写，不提前占用导入模块的测试路径。
- **预计不改** `app.ts`、`calculator-ui.ts`、`calculator-import.ts`、game-data/schemas/sim-core、根依赖与许可证。若现有接口不足，再报告具体原因，不预先改引擎。

已确认链路：`app.ts` 的 `/builds` 调用 `renderBuildWorkshop`；`openCalculator(input, metadata)` → `ensureCalculator()` → `CalculatorController.loadEquipmentBuild(input, metadata)` → 现有 `resolveEquipmentBuild`、角色/技能精确映射与真实公式 → `/calculator`。

`loadEquipmentBuild` 接受 `EquipmentBuildInput` 和 `{constellation:number,baseTalentLevels:{auto:number,skill:number,burst:number},label?:string}`，在装入前校验装备与天赋绑定。有效天赋由已有精确命座条款得出，不把 13 当基础再加 3。没有对应可执行动作会明确失败；预览必须保留可供重试，不宣称整体 complete 就代表机制已实现。

## 首条闭环与路线边界

优先使用补丁内明确标记 synthetic 的合法 GOOD fixture；不假定其角色已支持，收件后核对，必要时从已核诺艾尔/凯亚等角色中构造明确合成的合法配装。本地文件 → 模块规范化 → 预览来源/缺项 → 用户选配装 → equipment handoff → 现有单技能动作 → 数值及公式步骤。

Enka JSON 和纯文本通过同一入口验证。纯文本只有有效天赋而缺基础等级时不能猜；允许预览，但阻断装备路线。面板路线需要完整 CatalogResolvedShowcaseCharacter 的身份与 resolvedSkills，CoreImportHandoff.panel 不是可直接 cast 的对象。首条装备闭环不擅自接通面板路线；最终面板不与装备推导叠加。

UID 使用已有同源 `/api/showcase` 能力，须收件后核对 fetchEnkaUid 的请求/响应形状，不能凭接口名更改代理。登录适配器只有无凭据 fixture，不接真实会话。

## 必要验收入口（尚未执行）

1. 单元：合法 handoff 保留精确装备、基础天赋、命座和来源；null/unknown/缺字段阻断，合法 0 通过；有效等级不得塞入基础路线；不同角色身份拒绝。
2. 浏览器：本地 GOOD → 预览 → 选配装 → 真实单技能数值，与相同 input 的既有 resolveEquipmentBuild/计算器对照；公式解释可展开。Enka/纯文本分别按实际字段支持通过或明确阻断，不用默认值补齐。
3. 不完整预览或解析失败不调用计算器、不替换此前完整数据；原文件不写回；切换元素重新检查必要字段。
4. 合成数据与真实账号端到端分开报告。不开网络登录、不采集秘密、不假报账号成功。
5. 只跑上述新测试、导入模块既有相关测试及类型/构建；本阶段不全量回归、不重复120秒性能测试。

启动前须使用本工作树的构建与独立端口，不能复用 4173 上原分支预览而误测旧代码。补丁未收到，不启动预览、不安装依赖、不生成空壳测试来计数。
