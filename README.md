# 提瓦特伤害实验室

一个以“逐段可审计、配置可迁移、结果可复现”为目标的原神队伍 DPS 模拟器。当前完成了 Vanilla v0.1 基线冻结，以及 TypeScript 模拟核心、Zod Schema、版本迁移、Golden 回归和 Web UI 迁移。

## 安装和运行

要求 Node.js 24 或兼容版本。

```bash
npm install
npm run dev
```

开发服务器默认位于：

```text
http://127.0.0.1:5173
```

生产构建与预览：

```bash
npm run build
npm run preview
```

## 测试

```bash
npm test
npm run typecheck
npm run test:e2e
npm run check
```

首次运行 Playwright 时若本机没有浏览器：

```bash
npx playwright install chromium
```

## 当前功能

- 无 DOM 依赖的纯 TypeScript 确定性事件模拟核心。
- 输入配置含 `schemaVersion`、`engineVersion`、`dataVersion` 和 `randomSeed`。
- Zod 严格校验、字段路径错误和 v0.1 配置迁移。
- ATK / HP / DEF / EM 缩放、增伤、防御、抗性、暴击和手工增幅反应。
- 行动快照与命中时动态结算。
- 能量消耗、确定性回能和能量不足整行动取消。
- 每段伤害的施放者、缩放面板、伤害归属、状态、敌人状态和完整乘区。
- 每段伤害同时返回核心浮点原始值和四舍五入到个位的显示值。
- 每段伤害预留 Aura、附着量和 ICD 审计字段；兼容模式明确返回“未模拟”。
- 角色/技能伤害构成。
- 逐秒堆叠伤害时间轴。
- 每个折点对应一段伤害的逐击累计伤害曲线。
- 可筛选、分页并展开公式的逐段伤害日志。
- JSON 导入、导出和高级编辑。
- 从 Enka.Network 读取公开 UID 展示柜，经 Schema 校验后展示角色 ID、等级、命座、技能等级、面板、武器与圣遗物。
- “毕业站位”目前只生成显式不可模拟的占位对象，不会编造统一毕业面板。

展示柜请求由 Vite 开发/预览服务器的 `/api/showcase/:uid` 代理发出，以便设置上游要求的自定义 `User-Agent`，并按上游 `ttl` 做内存缓存。纯静态部署时需要把同一路由迁移到服务端函数。

## 数据声明

内置“黑杜林融化”配置的 `verificationStatus` 为 `provisional`。其中角色、装备系数和确定性回能包含用于兼容回归的示例魔法数：

- 它们不是正式、已验证的游戏数据库。
- Golden Fixture 只证明迁移前后结果一致，不证明数值符合游戏实测。
- 页面明确显示 `provisional`，导出配置也保留这一状态。

## 当前精度边界

本版本是 v0.1 兼容引擎，不是 gcsim 精度实现。尚未实现：

- Aura、附着量、衰减和自动反应判断。
- ICD 组和默认 3-hit / 2.5-second 规则。
- 粒子对象、飞行时间、前后台分配、同色倍率与充能效率。
- 以 60 FPS 帧推进的合法行动队列、切人、动作占用、取消帧、冷却和充能次数。
- Hitlag、多目标、AoE、索敌、移动、无敌、护盾和特殊易伤窗口。
- Monte Carlo 暴击/粒子采样和统计分布。
- 经过来源核验的角色、武器、圣遗物与敌人数据库。
- 展示柜角色 ID 到本地化名称、角色技能数据与模拟配置的自动映射。

因此，本轮并未完成“全角色/全武器/全技能数据库”，也没有把展示柜角色直接用于伤害模拟。Enka 只提供玩家公开配置；角色倍率、动作帧与特殊机制仍需独立的版本化游戏数据源和校验流程。

## 目录

```text
apps/web                 Vite + TypeScript 展示层
packages/sim-core        纯 TypeScript 模拟与公式
packages/schemas         Zod Schema、类型和版本迁移
packages/game-data       预设与数据（当前示例均明确标记状态）
packages/mechanics       通用声明式伤害机制插件入口
packages/test-vectors    Golden Fixture
legacy/v0.1-vanilla      冻结的原版网站和基线记录
```

## gcsim 参考边界

项目借鉴 gcsim 的“角色/技能伤害构成、逐帧 Sample、每个事件可展开计算、显式能量问题与版本化配置”思路，但本轮没有复制其实现或角色数据库。gcsim 本身采用 MIT License；详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
