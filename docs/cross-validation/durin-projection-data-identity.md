# 杜林浏览器投影的数据身份修复

最终全量单元运行出现两个杜林投影复现键不相等。对黑、白两分支的完整作者配置与浏览器预设递归比较，唯一字段差异均为 `dataVersion`：

- 作者配置：`gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2+durin-gcsim-b4ae769d7c1c.8`
- 浏览器预设：`gi-6.7-zh-CN.genshin-db-5.2.12.enka-2b9d23b.1+durin-gcsim-b4ae769d7c1c.8`

所有其他配置字段均相等。该差异是真实数据来源标识陈旧，不是 `captureHits` 选项或伤害运算变化。修复 `durin-audit.ts`，使两分支通过同一个 `runtimeDatasetMetadata.catalogVersion` 读取活动身份，保留各自固定机制 mappingVersion。没有修改共享模拟器、canonical/hash 函数或数值容差。

原有复现键、伤害事件、能量、粒子与附着精确相等检查全部保留；两个用例还新增完整配置精确相等检查，后续来源字段漂移会先报告具体差异。

仅复验本次两个失败项：

```sh
npx vitest run packages/mechanics/src/characters/durin.test.ts -t 'keeps the compact'
```

结果：2 通过，12 未选用例跳过，1.19 秒；测试执行 75 ms。原失败日志见 `docs/validation/continuation-tests-final.log`，复验日志见 `docs/validation/continuation-durin-projection-retest.log`。未重复运行整套测试。
