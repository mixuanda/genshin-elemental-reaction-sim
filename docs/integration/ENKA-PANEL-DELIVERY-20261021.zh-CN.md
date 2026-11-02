# Enka 最终面板接线（本地未发布）

2026-10-22补充：本文保留当时接线与证据。当前批次已将旧解析器改为直接读取权威 `propMap.val`，原先将val复制到ival的内存适配已移除；缺失或非法val不再回退。本文下方的桥接描述是历史实现，不是当前契约。当前进展见 `FUNCTIONAL-GAPS-20261022.zh-CN.md`。

在 4cf37ea 的独立 integration 分支上继续。`/builds` 玩家导入预览新增“用最终面板计算单技能”，沿用 `CalculatorController.loadImportedCharacter` → `applyImportedCalculatorPanel`，装备路线保持独立；不累加已经包含的武器/圣遗物。

## 文件与契约

- `apps/web/src/player-import-handoff.ts`：新增 `preparePlayerPanel(raw, build, source)`，返回已有 `CatalogResolvedShowcaseCharacter` 和来源字符串。原 JSON 只在内存解析，原文件不变。身份唯一、属性完整、三类天赋基础/额外/有效值及旧目录映射一致才可进入；未知技能不替换为默认技能。具体动作仍由既有计算器验证，入口就绪不等于全机制已验证。
- `player-import-preview.ts`：面板、装备分别校验；装备缺失不会阻断完整面板。读取失败保留预览，完整预览可恢复；无持久化或账号会话。
- `build-workshop.ts` / `app.ts`：增加 `openImportedPanel` 回调，接现有控制器。
- `packages/player-import/src/normalize.ts`：唯一模块契约修正：Enka 缺省 `talentIdList` 按官方协议表示 C0，`null`、字符串、重复列表仍非法；GOOD/文本缺项规则不变。对应原断言更新有明确协议依据，其余未知天赋负向断言保留。
- 新增/扩展 handoff 单测、public-smoke 离线测试、浏览器测试及合成凯亚 fixture。

Enka 官方字段文档：https://github.com/EnkaNetwork/API-docs/blob/master/docs/gi/api.md 。`propMap.val` 是值、`ival` 应忽略；新桥接只对内存副本将权威 val 传到旧解析器读取槽，不重写旧解析器/历史文件。不用非法 val 回退到 ival。公开展柜并非战斗状态快照：条件增益、附着、快照、减抗仍需显式条件，原计算器假设/限制保留。

## 本轮证据

证据目录 `/workspace/GIDPS-cloud/enka-panel-evidence`。

- `unit-final.log`：88/88（导入模块、接线、离线公开响应）。未重跑全仓。
- `browser.log`：3/3（既有 GOOD 对照、失败保留、新 Enka 面板）；最终字段适配后另做面板针对复验，见 `browser-final.log`。
- `build-final.log`：类型与生产构建日志。
- `browser/enka-panel.json`、`enka-panel.png`：**合成**凯亚 C3 / 90级，E 基础10 + 明确额外3 = 13；ATK1700，冰伤0.616，暴击0.4/1，目标90级/10%抗性。1700 × 4.063 × 1.616 × 0.5 × 0.9 × (1 + 0.4 × 1) = 7031.980368，与实际期望伤害一致。无装备输入，未重复加入装备。不是账号实装或毕业配装。
- 官方示例来源：https://github.com/EnkaNetwork/API-docs/blob/master/api.md ，明确给出 UID 618285856。17:47:24 UTC 仅一次 GET，定制 User-Agent，HTTP200、TTL37、4角色，无重试/枚举。`public-smoke.json` 记录状态；后续仅离线复用响应，不消耗 TTL 请求。
- `public-parser-final.json`：3 个角色面板入口就绪；甘雨因额外天赋表缺失仍阻断（不猜 0）。仅接口与解析烟测，未宣称该公开账号全角色浏览器计算通过。响应原文只保存在云本地、不纳入提交或交付包。

## 未覆盖与后续

未做真实 Windows 浏览器；本轮 Chromium 云端。未做真实账号绑定、米游社/HoYoLAB 登录或全账号当前装备读取。UID 展柜不等于全账号/实时战斗状态。新预览使用本地 JSON/文本，既有 UID 获取入口保留，尚未统一两个入口。

下一步账号接入需具体授权：选择国服/海外提供方及只读范围；确认登录会话由何处处理、保存期限、撤销与断开方式；用户主动登录后再做最小真实读取验证。当前没有收集 cookie/token、创建凭据或配置持续访问。没有 push、部署、合并主线或更改许可证。
