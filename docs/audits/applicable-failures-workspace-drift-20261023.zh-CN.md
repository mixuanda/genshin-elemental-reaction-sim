# /goal 旧消费者失败：显式工作区漂移回归

基线 `fc733b3`。实际先运行 `packages/game-data/src/classified-hits.test.ts`，得到7通过/4失败；原JSON与日志保存于 `/tmp/GIDPS-applicable-failures-20261023/classified-before.{json,log}`。本块仅修正其中工作区漂移测试的过时夹具，没有修改计算公式、生产隔离、角色数据或Golden。

旧测试先修改另行解析的 `gameDataCatalog`，随后要求未传工作区的UI入口被污染。当前 `getCharacterDocuments` 明确默认 `releasedRuntimeWorkspace`，而 `resolveClassifiedCharacterHits` 的旧目录入口保留原目录；两个解析对象本就不应因测试修改而联动。来源见 `packages/game-data/src/runtime-workspace.ts` 的独立解析、`apps/web/src/character-calculations.ts:getCharacterDocuments` 的显式第三参数，以及已有 `apps/web/src/calculator-workspace.test.ts` 的隔离政策。

修正后的原测试保留旧目录E漂移阻断和普攻独立成立两条断言，并添加：

- 克隆实际UI工作区，仅给凯亚E向量第1级增加0.001；显式传入该工作区时E仍blocked、无totals，N1仍calculated。
- 默认已发布工作区不被旧目录或克隆污染，其E保持 `2000 × 原倍率 × 0.5防御 × 0.9抗性`，精度断言仍为10位。
- 保存重开漂移文档后仍blocked；恢复原向量后显式工作区重新给出与原已发布结果完全相同的totals。

仅重跑该用例：

```bash
./node_modules/.bin/vitest run packages/game-data/src/classified-hits.test.ts \
  --testNamePattern='blocks a drifted skill field' --reporter=json \
  --outputFile=/tmp/GIDPS-applicable-failures-20261023/workspace-drift-after.json
```

实际1通过/0失败/10未选，日志同目录。其余3个该文件旧失败本块未复测，更不等于整套79已减为78。最近全量3196/79/1继续作为历史记录；琴Q、卡齐娜交互与历史投影由独立工作线继续验证。

没有新模拟、生产部署、数据更新、凭据或许可操作。
