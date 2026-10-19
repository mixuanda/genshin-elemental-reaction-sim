# 来源队伍模板预览与显式载入指南（2026-09-28）

本文记录来源队伍构筑页为既有 18 个入门模板新增的预览和显式载入流程。模板给出 reaction 意图、说明文字、四名成员的 role 与来源配置键，以及起步动作；这些是可编辑起点，不等同实际反应覆盖、最优轮转或完整角色构筑。当前 124 × 2 个角色配装预设仍是 reference-assumption，外部角色推荐来源缺口保留；本变更不调整全量覆盖统计分母。

## 先看模板，再载入

在来源 `/source-simulation` 页面选择模板后，模板卡先展示 reaction 中文标签、描述、成员定位和每步起始动作，并依据当前固定来源名册标注动作方法状态。此时仍是预览：不会创建成员页签或覆盖当前队伍。用户需点击“载入此模板”后，才应用所选 starter/developed 参考构筑并生成队伍草稿。成员与装备基础映射缺失时，卡片保留可见并逐项说明缺口，但禁用载入。

载入条件只检查模板成员能否映射到当前来源角色、配置键和本地角色预设；起步动作若为 `unsupported` 或 `unresolved`，仍按原样载入，使用户可以在编辑器中查看并修复。草稿下方“当前队伍动作检查”独立逐步显示现有成员／动作的 `implemented`、`unsupported`、`unresolved` 或等待状态及登记参数键。未实现或未解析的动作需先替换，才可生成 GCSL；动作方法已实现也不保证姿态、能量、冷却、动画、命中或反应成立，仍以实际运行记录为准。

当前动作检查按实际 action 内容显示队伍级等待；帧数缺省时注明“等待帧数未填写”，不从模板缺失信息推断角色或帧数。模板的动作重复次数、动作参数和显式等待数据都保留其原始含义；模板指南不补造默认角色、等待帧或 action 参数。

## 原始来源标记与草稿编辑

载入模板时记录原始 `templateId`。后续修改成员、装备、动作或参数，不会宣称当前草稿仍等同原模板；界面把“原始模板”来源卡与“当前队伍动作检查”分开呈现。原始模板卡提供“重新载入此模板”按钮，明确执行后会重新生成模板起点。草稿 JSON 保存／导入／导出继续保留 `templateId`，因此从编辑后的 JSON 恢复时，原始来源标记和实际修改内容分开保留。

新行为位于 `apps/web/src/source-team-builder.ts` 与其样式 `apps/web/src/source-team-builder.css`，模板数据继续取自 `packages/game-data/src/team-templates.ts`；新增页面覆盖 `apps/web/e2e/source-team-template-guide.spec.ts`。既有 `apps/web/e2e/source-team-builder.spec.ts` 只同步为点击显式载入按钮后再继续原流程，本轮不重跑全部 18 个模板。

## 测试范围与边界

新增 UI 用例使用真实 classic inventory metadata，但在测试响应中将胡桃 `attack` capability 从真实 `implemented` 暂时覆写为 `unsupported`，制造一个受控差异，以验证预览缺口、显式载入、当前动作检查、替换为 charge，以及导出后重新导入保持完整 draft 相等。该测试只证明受控 metadata 分支的 UI 行为，不能据此称固定来源真实缺少胡桃普攻；来源实际状态仍为已实现。

此次页面测试没有执行 WASM／GCSim，不证明模板队伍实战轮转、伤害或 reaction 正确，也不证明来源包未覆盖机制已补齐。Playwright 流程从真实 classic inventory metadata 开始，但只针对一套模板并使用受控 metadata 覆写；既有 `source-team-builder.spec.ts` 只同步为点击显式载入按钮，未重跑 18 模板旧矩阵。

## 验收记录

- 生产构建通过：receipt 墙钟 3.647 秒，Vite 转换 675 modules、构建 848ms。
- 新页面流程通过：Playwright 单用例 806ms，全部运行时间约 1.5 秒，命令墙钟 1.768 秒。测试检查四名成员、七步模板预览；以测试专用覆写把实际已实现的胡桃普攻标成 unsupported，验证卡片预览／载入后当前动作检查，再改为重击 ×3；JSON 导出、编辑、导回后完整 draft 相等，原始 `templateId` 保留。receipt：[检查记录](validation/source-team-template-guide-checks-20260928.json)、[完整页面结果](validation/source-team-template-guide-20260928.result.json)。
- 本批只覆盖一条模板预览和一份导入导出草稿；没有执行 WASM、没有重跑 18 模板旧页面矩阵，也不代表实战轮转或来源实际胡桃普攻缺口。124 × 2 reference-assumption 口径及外部推荐来源缺口不变。
