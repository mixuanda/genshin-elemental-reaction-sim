# 映射/装备消费者16项失败审计

基线：干净提交5b4c637，完整单元2820通过/94失败，其中本组16项。本轮不改旧测试期待、不改V153身份、不删Golden或校验。以下“迁移”只表示已定位旧契约与当前入口差异，不表示对应角色机制已全面验证，也未将这些失败自动计为通过。

| 基线用例（文件/简称） | 根因与依据 | 本轮处置 |
|---|---|---|
| artifact-piece-effects：生存条款描述 | equipment-effects.ts区分已有独立生存事件重放与尚未执行条款；旧断言对全部条款要求“未计入可执行套装覆盖” | 保留失败，需按实际执行域逐套核对，不能改回虚假的全未实现描述 |
| noelle-action-mappings：完整来源向量 | held/plunge替换表从全局映射中过滤了原有旋转单击、终结单击、路径碰撞；原独立动作仍有完整15级固定来源向量和SHA证据 | **生产修复**：三种单击与完整动作并存，单击保持completeAction=false；原测试不变通过 |
| optimizer-adapter：所有新动作默认可算 | 卡齐娜带碰撞下落新增观测条件；缺外部附魔确认、实际碰撞次数、目标接触时应阻断 | 保留旧失败，不能凭默认值构造碰撞；实际blockers已导出 |
| optimizer-additional-mappings：排除描述−0.30 | 露米普通攻击已有单独映射/来源减抗AST，旧测试在排除说明内搜旧常数 | 保留，尚未独立重核该机制，不删除现有来源AST以迎合文字断言 |
| classified-hits：漂移技能仍计算 | 测试修改catalog单例；getCharacterDocuments默认使用另行解析的releasedRuntimeWorkspace。两个独立解析对象被错误视为同一个 | 不改生产隔离；对显式传入工作区注入同样漂移的探针证明E blocked、N1 calculated，见consumer-audit.json |
| classified-hits：全部普通动作默认可算 | 琴Q完整边界动作需要实际命中及跨快照条件；没有blocked类型占位不代表所有依赖可用 | 保留旧失败，不能把缺失条件默认成立 |
| classified-hits：持续tick不是完整技能 | 旧fischl-skill-birdatk被coordinated-fischl-skill-c0等替换；旧ID查找为undefined | 保留，后续需审计新入口是否完整保留独立单击与状态要求，不能只换期待 |
| classified-hits：新来源固定tick计数 | 旧Prune/后续Odette动作入口与当前观测实体入口不一致 | 保留，当前动作清单/缺失上下文已导出，不把源码最大排程当实际全中 |
| classified-hits：旅行者性别元素 | 旧aether-anemo-burst被traveler-cross-aether-anemo-burst-c0替换；旧冲突映射已移出 | 保留；当前要求剧情增益明确状态，不恢复旧冲突或猜测状态 |
| classified-hits：HP/DEF混合项 | 首个失败在第59行Neuvillette旧HP入口；其后Chiori旧thrustatkscaling与Alhaitham突进也在idle-stance替换表中移除。后续块已恢复后两者，Neuvillette仍待审计 | 保留；不代表新入口已证明等价，需要独立单击回归 |
| classified-hits：草旅行者A4静态条数 | 新held/cross-source动作在实际命中上下文阶段生成A4，要求实时EM与已含份额，旧测试只数初始文档的静态damageBonusFormula | 保留，不能用快照EM或固定计数替代命中时状态 |
| equipment-additional-effects：覆盖计数 | 旧期待4件44/公式42/反应5；实际48/46/6，独立verified仍0，统计明确countsPartialMappings=true | 保留旧失败，实际清单待逐项确认，不单纯改数字 |
| update-pipeline：previewSnapshots=[] | 当前已有隔离预览快照；该断言与“activeVerifiedDataset=null”并不等价 | 保留，未激活预览或提升verified，不删除预览数据 |
| calculator-equipment-hit-effects：固化贡献追溯 | finalSnapshot递归重放有意剥离固化模型防止重复应用，却也丢掉展示审计；后续原断言还发现纯剧变分支因usesOrdinaryBuild=false漏显示装备不适用原因 | **生产修复**：历史贡献仅作为not-applicable审计节点附回；排除说明读取装备声明，不参与运算。原全部断言保留通过 |
| calculator-noelle-context：C2终结单击 | 同上单击映射被替换表移除，独立计算入口不存在 | **生产修复**同Noelle映射；C2/Q历史DEF原测试保留通过 |
| weapon-proc-calculator-weakpoint：自动触发边界文字 | 旧测试要求所有非强制暴击追击都有“自动触发边界”；当前区分未支持自动触发与已有lifecycle说明 | 保留失败，需逐武器验证状态，不统一回写同一句免责声明 |

## 修复证据与负例

原三文件定向复现2通过/3失败；修复后包含完整持有动作回归的四文件8通过。新增测试确认三种独立单击只有一击、标为selected-components、没有伪造held/plunge事件；无观测上下文的完整持有/下落仍blocked且无totals。

装备审计逐记录比较表达式结果与已保存amount，节点身份唯一、全部not-applicable，原伤害及JSON往返一致，篡改保存表达式仍拒绝。额外验证已经捕获finalSnapshot的命中不读取当前ATK/EM。首次负例误将未捕获快照的其他命中也要求不变，失败日志保留；已限定在实际存在finalSnapshot的命中，没有改变生产快照政策。

全部初始失败/修复后日志、源码差异及实际消费者探针保存在consumer-fixes-20261021。完整回归以最终差集为准，不将上述8项叠加到完整测试数。

## 最小兼容建议

V153政策仍建议采用CURRENT-CONTRACT-DECISIONS中的A：新执行语义用明确新身份，历史版本冻结；投影仅接受可证明无损的域。证据是canonical-v1平坦属性标记影响真实统计，不是纯审计附加字段。B（V153内扩展）只有在逐字段证明身份可区分及投影安全后可选。本轮没有替维护者作此决定；EC步骤也没有统一改+1/+2或放宽成大于。

## 浏览器进一步发现的输入记忆缺陷

恢复单击入口后运行原noelle-actions浏览器用例，才走到后续Q起手断言：预期976转换实际0。原始trace证明切换形态先加载observed-plunge（没有noelleBurst），随后终结单击仅拿到默认already-in-final-panel，历史DEF800丢失。修复在UI按角色另存显式Noelle上下文，优先保留本动作草稿，其次当前角色草稿，再取已保存Noelle上下文；切换工作区清空此缓存，不猜当前DEF。所有原数值断言保持不变。另一原用例因新增外层来源示例折叠面板无法点击内部summary，测试只增加外层真实点击，没有强制跳过可见性检查。

## 真实凯亚能量循环

新增kaeya-energy-cycle.spec.ts从来源模拟页面执行四次120秒：种子12021/12022 × 零能/满能，C0、等级90、E/Q天赋1、无锋剑90，显式额外100%充能与45%暴击率作为受控输入，不宣称已核圣遗物配装。每周期六次E（等待400帧），再Q并等待600帧，共两周期；最后延伸观察至7200帧。

固定b4源码burst.go、skill.go、kaeya.go、zz_kaeya.dm.go已重新取回并与仓库reviewed-skill-source-manifest逐文件SHA256一致。源码E产生2或3枚冰微粒，Q上限/消耗60，Q冷却900帧且延迟48帧起算，T1倍率0.776；本测试未加入额外充能脚本、虚拟粒子或重复满能重置。

四条轨迹均有12次E、26次Q命中，Q扣能帧2602和5813，每次energyBefore=60、energyAfter=0；连续14条能量应用前后衔接且全部独立重放差0。逐击伤害用实际面板、固定倍率、同等级防御0.5、抗性0.1及一次原生暴击手算；全部命中回放差0。种子12021总伤11216.515142115364，12022总伤10340.410721952961。零能/满能最终输出相同是因为六次E先补满，不代表开局政策一般无影响。来源Q递归寿命13击是本固定实现和目标接触条件的结果，不宣称游戏所有情境固定13击。

范围仅单角色E供能两次Q，不含反应队、敌人掉球、全部命座或稳态无限循环；仍provisional，Windows真机未测。

最终诺艾尔原浏览器两项均通过（23.9秒）：独立条件计算完整断言通过；Q→N1–N4轮轴与保留的外部固定来源夹具逐帧、逐击、总伤、能量reserve/debit和DEF转换完全对照，命中回放原断言通过。仅测试导航新增展开“来源示例”和“更多设置”两次点击，无数值期待修改。凯亚浏览器另1项通过（43.3秒，内含四条原生轨迹）。这三项不是全部浏览器套件。

最终完整单元回归：2824通过/91失败，总2915项；相对2820/94新增1项、修复3项、无删除测试、新失败0项。构建/类型检查与数据检查通过。仍不满足发布门禁。

首轮data:check因派生classified-hit-coverage过期失败。只运行generate-classified-coverage.mjs更新四个计数：总命中1271→1274、partialActions24→27、Noelle命中15→18、Noelle部分动作0→3；完整动作713及角色124未变。数据检查重跑通过，未修改真实源数据或Golden。全量回归后除该派生索引和文档外无核心修改；最终构建再次检查类型及打包。
