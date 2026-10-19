# QA 与实测报告

更新：2026-09-24。本轮把久岐忍固定来源 E 接入真实周期实体、生命与粒子队列，并提供正常轮转入口及结果账本。独立单击／单技能计算器继续作为主导航功能，不需要队伍或轮转。最终 goal 保持进行中；未提交、推送或部署。

## 实际改动

- 正常轮转页可载入 C0 八环／C2 十环的久岐忍 E 来源情景，编辑合法 E、等待与两角色切换；初始生命比例在队伍页编辑。固定 Lv90/A6/T1、钝剑Lv1、额外EM200与暴击率降至0是明确合成输入，安柏只接治疗。
- 起手消耗当前生命30%，最低保留最大生命的20%；草轮由实际实体逐次安排。新代次替换会取消旧实体下一次周期事件，已经安排的延迟伤害仍执行；末次周期事件先执行再结束。
- 治疗读取执行时久岐忍自己的 HP/EM、前台接收者；A1按治疗前自身HP≤50%提供15%治疗加成。共享AST执行最大生命项、精通项、基础治疗、条件阈值、加成、实际恢复与溢出，并展示公式、变量、数值代入和解释。
- 环击命中确认后先锁12帧ICD，再独立45%判定一枚雷微粒，明确飞行100帧后按实际前台和充能结算。失败也保留ICD；无资格事件不抽样。旧粒子数量随机流不变。
- 主结果与预热视图显示真实实体、HP、治疗轨迹和产球抽样。完整运行JSON恢复相同事件；伤害仍进入共享核心，模拟环击可在独立计算器恢复完整上下文和逐步公式。

来源、接口与范围见[久岐忍来源报告](validation/kuki-runtime-source.md)、[周期实体运行时](validation/periodic-entity-runtime.md)及[固定来源参数](cross-validation/action-library/kuki-source-parameters.md)。低突破E初击A4来源冲突和动态快照TODO没有被固定A6情景掩盖。

## 实际执行检查

| 检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 唯一外部 gcsim CLI 对照 | 首次exit0，约0.0224s；一次汇总迭代及独立调试sample，seed分开 | [精确命令／二进制哈希](cross-validation/action-library/kuki-e-swaps.execution.json)、[比较数据](cross-validation/action-library/kuki-external-comparison.json) |
| `npx vitest run packages/sim-core/src/__tests__/periodic-entity-runtime.test.ts` | 首轮2通过1失败，1.05s；失败是测试手算初击多加25，未改运行时 | [首轮](validation/periodic-entity-runtime-test.log) |
| 仅复验周期实体失败项 `-t 'reads owner HP/A1'` | 1通过2跳过，926ms，exit0 | [复验](validation/periodic-entity-runtime-test-retry.log) |
| `npx vitest run packages/sim-core/src/__tests__/kuki-source-action.test.ts` | 首轮2失败于新来源校验器编码可选undefined；明确按null比较未启用字段后，同2项通过，1.45s／测试681ms | [首轮](validation/kuki-runtime-source-tests.log)、[复验](validation/kuki-runtime-source-tests-rerun.log) |
| `npm run build` | 前两次类型检查失败：Event.kind及两处来源分组字符串被推宽；仅增加类型约束，第三次exit0，全工程TypeScript＋321模块生产构建通过，341ms | [首轮](validation/kuki-runtime-build.log)、[第二次](validation/kuki-runtime-build-retry.log)、[最终](validation/kuki-runtime-build-final.log) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/kuki-runtime.spec.ts` | 唯一新增页面流程首次1/1通过，总2.0s，流程1.7s，exit0，无重试 | [页面实测](validation/kuki-runtime-browser.md)、[日志](validation/kuki-runtime-browser.log) |

新增核心5项都有最终通过证据，不能声称首次全通过。浏览器使用4173生产预览；只为这条新增流程检查普通入口、真实治疗公式、概率失败显示、命中捕获及JSON往返。未运行旧全集、data:status／data:check、性能基准或大型随机模拟。构建、CLI与页面流程耗时不作产品性能结论。既有大chunk与无效动态拆分提示保留。

## 实测数值与适用边界

固定参考 ATK235.642192、HP15237.931506964002、EM200、CR0、双方90级、防御乘区0.5、抗性乘区0.9：初击 `(ATK×0.75712+EM×0.25)×0.5×0.9` 为102.784237383168；每环 `(ATK×0.2524+EM×0.25)×0.5×0.9` 为49.26424016736。外部sample九击总496.89815872204804；本地页面总496.8981587220481，仅总和浮点运算顺序差异。独立手算对外部逐击最大残差0；本地9个命中恢复到计算器的差值全部0。

E在第1帧把HP7618.965753482001消耗至5333.2760274374；第24帧生成，第114至744帧每90帧治疗，第116至746帧环伤。前三次治疗给安柏，后五次给久岐忍；前六次A1乘区1.15，后两次因久岐忍跨越50%生命恢复为1。基础治疗 `HP×0.03+288.8908+EM×0.75` 为896.0287452089201；带A1请求1030.4330569902581。满血安柏的溢出没有计为实际恢复。页面最后久岐忍HP10216.632688826014；独立手算与外部sample治疗原始量最大残差2.27e-13、HP最大残差1.82e-12。

页面同一流程C2实测11击／10次治疗，末tick924帧、末击926帧，总伤595.4266390567681。默认本地C0 seed八次概率抽样四次失败，成功粒子生成帧386/476/566/656；这些是本地实际日志，不要求与外部gcsim不同随机实现产生相同序列。完整记录重放保持实体、生命、抽样与能量日志一致。

通用替换例：第115帧替换旧草轮，旧116帧已投递伤害仍发生，旧204帧周期事件取消；新代次在205/295帧治疗。另一合成例在tick与延迟伤害之间改变EM，确认追加项保留tick取样，普通伤害面板按命中时刻读取。该通用能力不把久岐忍来源契约扩展为任意动态面板已验证。

## 数据与剩余工作

本轮没有改变数据目录与条件技能映射。映射.15仍为120身份／916命中／541完整条件动作／146部分／18具体映射阻塞；194武器／958合法精炼及53二件／44四件规则。条件完整不等于完整可执行角色。

活动目录仍 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，released/provisional，verified为空，preview数0。发行来源观察仍为2026-09-23 14:22香港时间，本轮没有在线刷新或晋升证据等级。

久岐忍Q真实生命周期、C4触发、C6时钟、低突破来源冲突及动态快照TODO仍未完成。周期实体代次、未来任务及概率随机流尚未完整纳入相位检查点，因此不能证明该情景稳态；上一轮静态确定性healthChanges的完整队列证明继续保留。生命之契、真实死亡、动态最大生命、其余完整角色／装备与特殊反应范围、可靠预览来源、广泛外部整队验证见[已知限制](known-limitations.md)。

[上轮QA](history/qa-report-2026-09-24-before-kuki-runtime.md)保留独立久岐忍E/Q和生命相位检查点的实际证据。120秒性能仍只引用2026-09-23T06:42:28.209Z的[历史基准](cross-validation/simulation-execution-benchmark.md)，本轮未重测。

本轮 `git diff --check` 首次exit0、无输出，仅检查已跟踪差异。[日志](validation/kuki-runtime-diff-check.log)／[退出码](validation/kuki-runtime-diff-check.exit)。
