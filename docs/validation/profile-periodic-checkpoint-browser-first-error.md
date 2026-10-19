# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: profile-periodic-checkpoint.spec.ts >> Execution profiles use the actual energy baseline and retain imported 1.0.0 structural semantics
- Location: apps/web/e2e/profile-periodic-checkpoint.spec.ts:24:1

# Error details

```
Error: expect(received).toMatchObject(expected)

- Expected  - 1
+ Received  + 1

  Object {
    "critMode": "noCrit",
    "energyMode": "configured",
-   "randomSeed": "kuki-profile-energy-reference",
+   "randomSeed": "kuki-eq-c0-source-reference-v1",
  }
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]: GENSHIN DAMAGE LABORATORY
      - heading "提瓦特伤害实验室" [level=1] [ref=e6]
      - paragraph [ref=e7]: 独立技能计算 · 逐步公式解释 · 可审计的团队模拟
    - generic [ref=e8]:
      - generic [ref=e9]:
        - text: 预设
        - combobox "预设" [ref=e10]:
          - option "黑杜林融化 · C6R5 / C6R1 结构示例" [selected]
          - option "空白四人队模板"
          - option "合法帧时间线 · 双角色结构示例"
          - option "Aura / ICD 自动反应 · M3 结构示例"
          - option "粒子 / 回能 · M4 结构示例"
          - option "杜林黑 E · 部分机制审计向量"
          - option "杜林白 E · 部分机制审计向量"
      - button "运行模拟" [ref=e11] [cursor=pointer]
      - status
      - button "导出 JSON" [ref=e12] [cursor=pointer]
      - button "导出完整模拟记录" [active] [ref=e13] [cursor=pointer]
      - generic [ref=e14] [cursor=pointer]: 导入 JSON
  - navigation "主导航" [ref=e15]:
    - link "技能计算器" [ref=e16] [cursor=pointer]:
      - /url: /calculator
    - link "演算示例" [ref=e17] [cursor=pointer]:
      - /url: /examples
    - link "队伍配置" [ref=e18] [cursor=pointer]:
      - /url: /team
    - link "行动编辑" [ref=e19] [cursor=pointer]:
      - /url: /rotation
    - link "模拟结果" [ref=e20] [cursor=pointer]:
      - /url: /results
    - link "结果比较" [ref=e21] [cursor=pointer]:
      - /url: /compare
    - link "数据浏览" [ref=e22] [cursor=pointer]:
      - /url: /data
    - link "更新状态" [ref=e23] [cursor=pointer]:
      - /url: /updates
  - generic [ref=e24]:
    - generic [ref=e25]:
      - strong [ref=e26]: 久岐忍 C0 · E治疗后真实起手HP决定Q的7／12击
      - generic [ref=e27]: provisional
      - text: ·
      - generic [ref=e28]: legal-frame-v1
      - text: ·
      - generic [ref=e29]: schema 1.53.0
      - text: ·
      - generic [ref=e30]: engine 1.53.0-callback-bus
      - text: · 久岐忍Lv90/90、突破6、C0、天赋1/1/1、钝剑Lv1/20 R1、无圣遗物；明确合成输入+200EM和-5%暴击率至0。安柏Lv1/20、C0/T1、猎弓Lv1/20 R1，只作切换与接治疗。无卡肉/动态属性/附着/外部伤害；两人共享静止位置，单目标始终处于4米草轮范围内。 E/Q在同帧既有任务完成后执行；Q以真实起手HP锁定7或12击，一次起手快照，+4帧消耗60能量。初始能量与初始HP是明确可编辑输入。 此契约限固定面板的E、Q、合法等待和两角色切换；不认证普通/重击、C4追击、C6状态或整角色完整实现。旧E-only来源身份仍按原规则执行，不自动升级。 A6同时解锁A1和A4。低突破E初击来源冲突仍未解决，本契约不通过固定A6条件将其宣称为已解决。 E草轮源快照仍有TODO；固定ATK/EM使构造FlatDmg和延迟+2帧快照数值一致，不扩张为动态快照验证。治疗在tick时读取真实角色HP，A1取久岐忍自己的HP而非受治疗角色HP。 源粒子只由草轮伤害确认触发：先锁12帧ICD，再独立45%判定，一枚雷微粒、明确飞行100帧；初击无此回调。随机流可重放，不承诺与gcsim同seed逐抽样一致。 换人使用明确1帧延迟，成功换人后60帧全队换人冷却；来源校验检查真实编译后的输入时点。允许等待与合法切换，不静默无视取消窗或冷却。 治疗、自损和敌人受伤分开记录。初始HP比例是明确可编辑输入，不属于固定天赋数值；不模拟敌方攻击、结晶拾取、其他反应或HP上限变化。 Q以主目标的固定位置(0,2)为圆心，C0半径4，C2包含C1半径6；来源假定目标足够接近，未覆盖远距离中心选择或移动目标。 Q起手HP≤50%时12击，否则7击；来源count注释写11而可执行代码明确12。命中间隔是Go整数除法120/7=17帧，不采用显示总倍率的独立舍入值。 默认E@1、切安柏@51、切回久岐忍@300、Q@564；该帧既有草轮先治疗，使久岐忍HP从低于50%升到高于50%，随后Q选择7击。改为Q@563则读取治疗前实际HP，选择12击。
    - main [ref=e31]:
      - generic [ref=e32]:
        - generic [ref=e33]:
          - text: 基准条件
          - combobox "基准条件" [ref=e34]:
            - option "保留当前自定义情景" [selected]
            - option "旧基准 · 110级 / 零能量 / 120秒"
            - option "KQMS 启发 / 自定义"
        - generic [ref=e35]:
          - text: 时长预设
          - combobox "时长预设" [ref=e36]:
            - option "自定义" [selected]
            - option "15"
            - option "18"
            - option "20"
            - option "60"
            - option "90"
            - option "120"
        - generic [ref=e37]:
          - text: 模拟时长（秒）
          - spinbutton "模拟时长（秒）" [ref=e38]: "16"
        - generic [ref=e39]:
          - text: 循环长度（秒）
          - spinbutton "循环长度（秒）" [ref=e40]: "16"
        - generic [ref=e41]:
          - text: 敌人等级
          - spinbutton "敌人等级" [ref=e42]: "90"
        - generic [ref=e43]:
          - text: 基础抗性（%）
          - spinbutton "基础抗性（%） 全元素共享的兼容抗性（当前作用于：静止范围内目标）。" [ref=e44]: "10"
          - generic [ref=e45]: 全元素共享的兼容抗性（当前作用于：静止范围内目标）。
        - generic [ref=e46]:
          - text: 初始能量模式
          - combobox "初始能量模式" [ref=e47]:
            - option "按角色配置" [selected]
            - option "强制全员 0"
            - option "强制全员满能量"
        - generic [ref=e48]:
          - text: 暴击模式
          - combobox "暴击模式" [ref=e49]:
            - option "期望值"
            - option "全部暴击"
            - option "全部不暴击" [selected]
            - option "按种子逐击随机暴击"
        - generic [ref=e50]:
          - text: 种子
          - textbox "种子" [ref=e51]: kuki-eq-c0-source-reference-v1
        - generic [ref=e52]:
          - text: 种子迭代次数
          - spinbutton "种子迭代次数" [ref=e53]: "1"
        - generic [ref=e54]:
          - checkbox "记录周期稳态检查点" [ref=e55]
          - text: 记录周期稳态检查点
        - generic [ref=e56]:
          - checkbox "随结果保存所有逐击公式轨迹" [ref=e57]
          - text: 随结果保存所有逐击公式轨迹
      - generic [ref=e58]:
        - generic [ref=e59]:
          - generic [ref=e60]: 队伍 DPS
          - generic [ref=e61]: "31"
          - generic [ref=e62]: 31 / 秒
        - generic [ref=e63]:
          - generic [ref=e64]: 16秒总伤
          - generic [ref=e65]: "497"
          - generic [ref=e66]: "497"
        - generic [ref=e67]:
          - generic [ref=e68]: 已实现分支状态
          - generic [ref=e69]: 未截断
          - generic [ref=e70]: 未跨过已知未实现机制；不代表完整游戏机制
        - generic [ref=e71]:
          - generic [ref=e72]: 模型内有效 / 全部伤害段
          - generic [ref=e73]: 9 / 9
          - generic [ref=e74]: 0 次反应触发 · aura-v3 自动判定
        - generic [ref=e75]:
          - generic [ref=e76]: 目标判定
          - generic [ref=e77]: 9 / 9
          - generic [ref=e78]: 全部命中
        - generic [ref=e79]:
          - generic [ref=e80]: 时间线指令
          - generic [ref=e81]: "5"
          - generic [ref=e82]: 592f · 9.87s
        - generic [ref=e83]:
          - generic [ref=e84]: 跳过行动
          - generic [ref=e85]: "1"
          - generic [ref=e86]: 存在断能量/断轴
      - navigation "结果视图" [ref=e87]:
        - button "总览" [ref=e88] [cursor=pointer]
        - button "时间轴" [ref=e89] [cursor=pointer]
        - button "逐段伤害" [ref=e90] [cursor=pointer]
        - button "账号展示柜" [ref=e91] [cursor=pointer]
        - button "高级配置" [ref=e92] [cursor=pointer]
      - generic [ref=e93]:
        - generic [ref=e94]:
          - article [ref=e95]:
            - generic [ref=e96]:
              - heading "角色伤害构成" [level=2] [ref=e97]
              - generic [ref=e98]: 1 名角色产生伤害
            - generic [ref=e99]:
              - generic [ref=e100]:
                - strong [ref=e103]: 久岐忍 C0/Lv90/A6/T1
                - generic [ref=e106]:
                  - text: "497"
                  - generic [ref=e107]: 100.0% · 31 DPS · 9 段
              - generic [ref=e108]:
                - strong [ref=e111]: 安柏 C0/Lv1/T1（仅切换接治疗）
                - generic [ref=e113]:
                  - text: "0"
                  - generic [ref=e114]: 0.0% · 0 DPS · 0 段
          - article [ref=e115]:
            - generic [ref=e116]:
              - heading "技能伤害构成" [level=2] [ref=e117]
              - generic [ref=e118]: 按最终伤害排序
            - table [ref=e120]:
              - rowgroup [ref=e121]:
                - row [ref=e122]:
                  - columnheader "角色" [ref=e123]
                  - columnheader "技能" [ref=e124]
                  - columnheader "次数" [ref=e125]
                  - columnheader "伤害" [ref=e126]
                  - columnheader "DPS" [ref=e127]
                  - columnheader "占比" [ref=e128]
              - rowgroup [ref=e129]:
                - row [ref=e130]:
                  - cell "久岐忍 C0/Lv90/A6/T1" [ref=e131]
                  - cell "越祓雷草之轮 · 真实耗血/周期草轮" [ref=e133]
                  - cell "9" [ref=e134]
                  - cell "497" [ref=e135]
                  - cell "31" [ref=e136]
                  - cell "100.0%" [ref=e137]
        - article [ref=e138]:
          - generic [ref=e139]:
            - heading "能量与执行状态" [level=2] [ref=e140]
            - generic [ref=e141]: 用于识别 0 能量启动导致的断轴
          - generic [ref=e142]:
            - generic [ref=e143]:
              - generic [ref=e144]:
                - strong [ref=e145]: 久岐忍 C0/Lv90/A6/T1
                - generic [ref=e146]: 跳过 1
              - generic [ref=e149]: 充能效率 100% · 初始 0 · 固定 0 · 粒子 16.2 · 消耗 0 · 溢出 0 · 最终 16.2/60
            - generic [ref=e150]:
              - generic [ref=e151]:
                - strong [ref=e152]: 安柏 C0/Lv1/T1（仅切换接治疗）
                - generic [ref=e153]: 正常
              - generic [ref=e156]: 充能效率 100% · 初始 0 · 固定 0 · 粒子 5.4 · 消耗 0 · 溢出 0 · 最终 5.4/40
        - generic [ref=e158]:
          - article [ref=e159]:
            - heading "测量窗口" [level=2] [ref=e160]
            - paragraph [ref=e161]: 按已完成的模拟结果取半开区间 [开始帧, 结束帧)。保留区间内空闲时间；终点帧伤害不计入。改变窗口不会重置能量、冷却或实体。
            - generic [ref=e162]:
              - generic [ref=e163]:
                - text: 窗口类型
                - combobox "窗口类型" [ref=e164]:
                  - option "完整观察窗口" [selected]
                  - option "首个配置周期"
                  - option "开场 15 秒"
                  - option "开场 18 秒"
                  - option "开场 20 秒"
                  - option "自定义整帧窗口"
              - generic [ref=e165]:
                - text: 开始帧
                - spinbutton "开始帧" [ref=e166]: "0"
              - generic [ref=e167]:
                - text: 结束帧（不含）
                - spinbutton "结束帧（不含）" [ref=e168]: "960"
              - generic [ref=e169]:
                - text: 主目标
                - combobox "主目标" [ref=e170]:
                  - option "静止范围内目标" [selected]
            - status [ref=e171]:
              - table [ref=e173]:
                - rowgroup [ref=e174]:
                  - row [ref=e175]:
                    - columnheader "区间" [ref=e176]
                    - columnheader "时长" [ref=e177]
                    - columnheader "全部目标伤害" [ref=e178]
                    - columnheader "窗口 DPS" [ref=e179]
                    - columnheader "主目标伤害" [ref=e180]
                    - columnheader "主目标 DPS" [ref=e181]
                - rowgroup [ref=e182]:
                  - row [ref=e183]:
                    - cell "[0, 960)f" [ref=e184]
                    - cell "16 秒" [ref=e185]
                    - cell "496.898" [ref=e186]
                    - cell "31.056" [ref=e187]
                    - cell "496.898" [ref=e188]
                    - cell "31.056" [ref=e189]
            - paragraph [ref=e190]: 首个配置周期采用 cycleLength，并不把失败、延迟或尚未完成的指令称为完整可执行轮转。
          - article [ref=e191]:
            - heading "稳态检查与预热" [level=2] [ref=e192]
            - status [ref=e193]:
              - paragraph [ref=e194]: 未建立稳态
              - paragraph [ref=e195]: 本次未请求完整相位检查点。；检查点未覆盖的状态：引擎标记不完整。
            - paragraph [ref=e196]: 可以在一次连续运行中先执行预热，再测量当前时长的观察窗口。预热行动和所有状态会延续进入窗口，不会只补满能量。总模拟上限 600 秒。
            - generic [ref=e197]:
              - generic [ref=e198]:
                - text: 预热周期数
                - spinbutton "预热周期数" [ref=e199]: "20"
              - generic [ref=e200]:
                - text: 预热起始能量
                - combobox "预热起始能量" [ref=e201]:
                  - option "零能量" [selected]
                  - option "满能量"
                  - option "按角色配置"
            - button "连续预热并检查稳态" [ref=e202] [cursor=pointer]
            - status
          - article [ref=e203]:
            - heading "随机预热与起步敏感性" [level=2] [ref=e204]
            - paragraph [ref=e205]: 对每组种子分别从零能量与满能量连续运行，在 W 和 2W 预热后取相同时长窗口。保留所有实际状态，不把随机状态要求为逐周期相同；比较伤害、能量和行动拒绝的配对差值。
            - generic [ref=e206]:
              - generic [ref=e207]:
                - text: 独立种子组数
                - spinbutton "独立种子组数" [ref=e208]: "8"
              - generic [ref=e209]:
                - text: W 预热周期数
                - spinbutton "W 预热周期数" [ref=e210]: "5"
            - paragraph [ref=e211]: 默认8组，共16次连续运行；每次 2W 加当前 16 秒观察窗口不得超过600秒。沿用本次运行的种子基础、暴击与回能政策；结果为有限样本诊断，不自动认证随机稳态。
            - button "运行随机预热诊断" [ref=e212] [cursor=pointer]
            - status
          - article [ref=e213]:
            - heading "充能需求求解" [level=2] [ref=e214]
            - paragraph [ref=e215]: 固定本次配装、动作、configured 起步方式与种子；逐个检查有限充能网格，返回每个失败原因。不会用更高充能必然更好的假设跳过候选。
            - generic [ref=e216]:
              - generic [ref=e217]:
                - text: 角色
                - combobox "角色" [ref=e218]:
                  - option "久岐忍 C0/Lv90/A6/T1" [selected]
                  - option "安柏 C0/Lv1/T1（仅切换接治疗）"
              - generic [ref=e219]:
                - text: 最低充能（%）
                - spinbutton "最低充能（%）" [ref=e220]: "100"
              - generic [ref=e221]:
                - text: 最高充能（%）
                - spinbutton "最高充能（%）" [ref=e222]: "300"
              - generic [ref=e223]:
                - text: 步长（百分点）
                - spinbutton "步长（百分点）" [ref=e224]: "10"
              - generic [ref=e225]:
                - text: 安全裕量（百分点）
                - spinbutton "安全裕量（百分点）" [ref=e226]: "0"
            - button "计算充能需求" [ref=e228] [cursor=pointer]
            - status
          - button "导出本次分析" [ref=e230] [cursor=pointer]
        - article [ref=e232]:
          - generic [ref=e233]:
            - generic [ref=e234]: LUNAR-CHARGED · STATE-RESOLVED RUN
            - heading "月感电自动事件" [level=2] [ref=e235]
            - paragraph [ref=e236]: 使用当前队伍、动作和面板，在独立线程运行明确范围内的月感电转换。仅已实际结算的特殊事件进入合计；状态日志中的伤害意图本身不计伤害。
          - generic [ref=e237]:
            - text: 自动反应分支
            - combobox "自动反应分支" [ref=e238]:
              - option "月感电" [selected]
              - option "月结晶"
              - option "星超导 · 来源参考（非正式服核验）"
              - option "月绽放 · 草露与已声明能力"
              - option "星扩散 · 指南参考（来源冲突未解决）"
              - option "月感电＋月结晶 · 同次共享状态"
              - option "混合 v2 · 月反应＋绽放／超绽放／草露"
          - generic [ref=e239]:
            - strong [ref=e240]: 固定来源参考配置 · 暂定
            - paragraph [ref=e241]: 当前执行范围为单个静止范围内目标、60 FPS、无目标卡肉、水／雷／物理命中及 aura-v3。角色身份用于确定所选月感电分支的转换资格；不会补造其天赋、面板或未建模的被动。
          - group [ref=e242]:
            - generic "本次配置和队伍身份" [ref=e243]
            - paragraph [ref=e244]: 当前配置：久岐忍 C0 · E治疗后真实起手HP决定Q的7／12击；观察时长 16 秒；反应模式 aura-v3。运行时读取下方身份选择，并重新复制当前配置和运行选项。
            - generic [ref=e245]:
              - generic [ref=e246]:
                - text: 久岐忍 C0/Lv90/A6/T1 · kuki / electro
                - combobox "久岐忍 C0/Lv90/A6/T1 · kuki / electro 尚无唯一目录身份依据；请选择真实目录身份，或明确保留未匹配配置身份。" [ref=e247]:
                  - option "必须明确选择身份" [selected]
                  - option "保留配置身份 kuki（未匹配的显式身份条件）"
                  - option "空 · travelerelectro · travelerelectro"
                  - option "丽莎 · lisa"
                  - option "荧 · travelerelectro · travelerelectro"
                  - option "雷泽 · razor"
                  - option "北斗 · beidou"
                  - option "菲谢尔 · fischl"
                  - option "刻晴 · keqing"
                  - option "雷电将军 · raidenshogun"
                  - option "九条裟罗 · kujousara"
                  - option "八重神子 · yaemiko"
                  - option "久岐忍 · kukishinobu"
                  - option "多莉 · dori"
                  - option "赛诺 · cyno"
                  - option "赛索斯 · sethos"
                  - option "克洛琳德 · clorinde"
                  - option "欧洛伦 · ororon"
                  - option "伊安珊 · iansan"
                  - option "瓦雷莎 · varesa"
                  - option "伊涅芙 · ineffa"
                  - option "菲林斯 · flins"
                  - option "阿罗夏 · alyosha"
                - generic [ref=e248]: 尚无唯一目录身份依据；请选择真实目录身份，或明确保留未匹配配置身份。
              - generic [ref=e249]:
                - text: 安柏 C0/Lv1/T1（仅切换接治疗） · amber / pyro
                - combobox "安柏 C0/Lv1/T1（仅切换接治疗） · amber / pyro 尚无唯一目录身份依据；请选择真实目录身份，或明确保留未匹配配置身份。" [ref=e250]:
                  - option "必须明确选择身份" [selected]
                  - option "空 · travelerpyro · travelerpyro"
                  - option "荧 · travelerpyro · travelerpyro"
                  - option "迪卢克 · diluc"
                  - option "安柏 · amber"
                  - option "香菱 · xiangling"
                  - option "可莉 · klee"
                  - option "班尼特 · bennett"
                  - option "辛焱 · xinyan"
                  - option "胡桃 · hutao"
                  - option "烟绯 · yanfei"
                  - option "宵宫 · yoimiya"
                  - option "托马 · thoma"
                  - option "迪希雅 · dehya"
                  - option "林尼 · lyney"
                  - option "夏沃蕾 · chevreuse"
                  - option "嘉明 · gaming"
                  - option "阿蕾奇诺 · arlecchino"
                  - option "玛薇卡 · mavuika"
                  - option "杜林 · durin"
                  - option "尼可 · nicole"
                - generic [ref=e251]: 尚无唯一目录身份依据；请选择真实目录身份，或明确保留未匹配配置身份。
            - paragraph [ref=e252]: 精确目录 ID 或名称与元素的一致性只说明映射依据，不证明整套角色机制已实现。手动选择一律作为本次运行的身份条件；实际数值仍来自配置。尚未匹配的角色必须明确选择。
          - generic [ref=e253]:
            - checkbox "本次运行副本明确改用 aura-v3；保留其余输入和 ICD 定义" [ref=e254]
            - generic [ref=e255]: 本次运行副本明确改用 aura-v3；保留其余输入和 ICD 定义
          - generic [ref=e256]:
            - checkbox "本次独立运行采用 legal-frame-v1 整数帧调度；不改全局普通模式选择" [checked] [ref=e257]
            - text: 本次独立运行采用 legal-frame-v1 整数帧调度；不改全局普通模式选择
          - generic [ref=e258]:
            - button "读取当前配置" [ref=e259] [cursor=pointer]
            - button "运行月感电参考配置" [ref=e260] [cursor=pointer]
            - button "导出完整结果" [disabled] [ref=e261] [cursor=pointer]
          - status [ref=e262]: 尚未运行。请核对身份映射；不满足执行范围时会显示实际阻塞原因。
        - article [ref=e263]:
          - generic [ref=e264]:
            - heading "合法帧行动队列" [level=2] [ref=e265]
            - generic [ref=e266]: 60 FPS · 严格模式 · 0 次调整 · 1 次拒绝 · 0 次状态变更
          - table [ref=e268]:
            - rowgroup [ref=e269]:
              - row [ref=e270]:
                - columnheader "#" [ref=e271]
                - columnheader "指令" [ref=e272]
                - columnheader "角色 / 行动" [ref=e273]
                - columnheader "请求帧" [ref=e274]
                - columnheader "开始帧" [ref=e275]
                - columnheader "取消帧" [ref=e276]
                - columnheader "动画结束" [ref=e277]
                - columnheader "等待" [ref=e278]
                - columnheader "状态" [ref=e279]
            - rowgroup [ref=e280]:
              - row [ref=e281]:
                - cell "0" [ref=e282]
                - cell "元素战技" [ref=e283]
                - cell "久岐忍 C0/Lv90/A6/T1 / 越祓雷草之轮 · 真实耗血/周期草轮" [ref=e284]
                - cell "3f / 0.050s" [ref=e285]
                - cell "3f / 0.050s" [ref=e286]
                - cell "53f / 0.883s" [ref=e287]
                - cell "55f / 0.917s" [ref=e288]
                - cell "—" [ref=e289]
                - cell "已执行" [ref=e290]
              - row [ref=e292]:
                - cell "1" [ref=e293]
                - cell "切人" [ref=e294]
                - cell "安柏 C0/Lv1/T1（仅切换接治疗） / 切人" [ref=e295]
                - cell "63f / 1.050s" [ref=e296]
                - cell "63f / 1.050s" [ref=e297]
                - cell "64f / 1.067s" [ref=e298]
                - cell "64f / 1.067s" [ref=e299]
                - cell "—" [ref=e300]
                - cell "已执行" [ref=e301]
              - row [ref=e303]:
                - cell "2" [ref=e304]
                - cell "切人" [ref=e305]
                - cell "久岐忍 C0/Lv90/A6/T1 / 切人" [ref=e306]
                - cell "318f / 5.300s" [ref=e307]
                - cell "318f / 5.300s" [ref=e308]
                - cell "319f / 5.317s" [ref=e309]
                - cell "319f / 5.317s" [ref=e310]
                - cell "—" [ref=e311]
                - cell "已执行" [ref=e312]
              - row [ref=e314]:
                - cell "3" [ref=e315]
                - cell "元素爆发" [ref=e316]
                - cell "久岐忍 C0/Lv90/A6/T1 / 御咏鸣神刈山祭 · 真实起手HP分支" [ref=e317]
                - cell "584f / 9.733s" [ref=e318]
                - cell "584f / 9.733s" [ref=e319]
                - cell "—" [ref=e320]
                - cell "—" [ref=e321]
                - cell "—" [ref=e322]
                - cell "拒绝 · INSUFFICIENT_ENERGY" [ref=e323]
              - row [ref=e325]:
                - cell "4" [ref=e326]
                - cell "切人" [ref=e327]
                - cell "安柏 C0/Lv1/T1（仅切换接治疗） / 切人" [ref=e328]
                - cell "591f / 9.850s" [ref=e329]
                - cell "591f / 9.850s" [ref=e330]
                - cell "592f / 9.867s" [ref=e331]
                - cell "592f / 9.867s" [ref=e332]
                - cell "—" [ref=e333]
                - cell "已执行" [ref=e334]
          - generic [ref=e336]: "#3 \"御咏鸣神刈山祭 · 真实起手HP分支\" 能量不足 11.4/60，未施放且不占用冷却或改变行动状态。"
```

# Test source

```ts
  1   | import { Buffer } from "node:buffer";
  2   | import { readFile } from "node:fs/promises";
  3   | import { expect, test, type Page } from "@playwright/test";
  4   | import type { SimConfig } from "@genshin-dps-lab/schemas";
  5   | import type { SimulationStartupResult } from "../../../packages/sim-core/src/simulation-analysis";
  6   | import type { ExecutionProfile } from "../../../packages/sim-core/src/execution-profiles";
  7   | import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";
  8   | import type { SimulationRecord } from "../src/simulation-record";
  9   | 
  10  | async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  11  |   const pending = page.waitForEvent("download");
  12  |   await page.locator(selector).click();
  13  |   return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
  14  | }
  15  | 
  16  | async function waitForSimulation(page: Page): Promise<void> {
  17  |   await expect(page.locator("#cancelRunButton")).toBeHidden();
  18  |   await expect(page.locator("#simulationProgress")).toHaveText("");
  19  |   await expect(page.locator("#exportRunButton")).toBeEnabled();
  20  | }
  21  | 
  22  | test.use({ trace: { mode: "retain-on-failure", snapshots: false } });
  23  | 
  24  | test("Execution profiles use the actual energy baseline and retain imported 1.0.0 structural semantics", async ({ page }) => {
  25  |   const seed = "kuki-profile-energy-reference";
  26  |   await page.goto("/rotation");
  27  |   await page.locator("#rotation-source-kuki-skill-burst > summary").click();
  28  |   await page.locator("#rotation-load-source-kuki-skill-burst").click();
  29  |   await page.locator('.product-nav a[href="/team"]').click();
  30  |   await page.locator('[data-actor="0"][data-key="initialEnergy"]').fill("0");
  31  |   await page.locator("#team-apply").click();
  32  |   await expect(page.locator("#team-status")).toContainText("已通过输入验证并保存");
  33  |   await page.locator('.product-nav a[href="/results"]').click();
  34  |   await page.locator("#randomSeedInput").fill(seed);
  35  |   await page.locator("#critModeInput").selectOption("noCrit");
  36  |   await page.locator("#energyModeInput").selectOption("configured");
  37  |   await page.locator("#iterationInput").fill("1");
  38  |   await page.locator('.product-nav a[href="/rotation"]').click();
  39  |   await page.locator("#rotation-swap-actor").selectOption("amber");
  40  |   await page.locator("#rotation-add-swap").click();
  41  |   await page.locator('[data-request="4"]').fill("565");
  42  |   await page.locator('[data-request="4"]').press("Tab");
  43  |   await page.locator("#execution-profile").selectOption("practical-assumed-input");
  44  |   await page.locator("#execution-preview").click();
  45  |   await expect(page.locator("[data-execution-baseline]")).toContainText(seed);
  46  |   await expect(page.locator("[data-execution-baseline]")).toContainText("configured");
  47  |   await expect(page.locator("[data-execution-baseline]")).toContainText("noCrit");
  48  |   await expect(page.locator("[data-execution-command]")).toHaveCount(5);
  49  |   expect(await page.locator("[data-execution-command] td:nth-child(4)").allTextContents()).toEqual(["3", "63", "318", "584", "591"]);
  50  |   await expect(page.locator('[data-execution-command="3"] td').nth(2)).toHaveText("未施放：INSUFFICIENT_ENERGY");
  51  |   await expect(page.locator('[data-execution-command="4"] td').nth(4)).toHaveText("6");
  52  |   await page.locator("#rotation-compile").click();
  53  |   await expect(page.locator('[data-rotation-command="3"]')).toContainText("未施放：能量");
  54  |   await expect(page.locator('[data-rotation-command="3"] td').nth(2)).toHaveText("584");
  55  |   await expect(page.locator('[data-rotation-command="4"] td').nth(2)).toHaveText("591");
  56  |   await page.locator("#rotation-save").click();
  57  |   await expect(page).toHaveURL(/\/results$/);
  58  |   await waitForSimulation(page);
  59  |   const record = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  60  |   expect(record.executionProfile).toMatchObject({ id: "practical-assumed-input", version: "1.1.0", baselineMode: "runtime-energy-v1" });
  61  |   expect(record.sourceConfig.timeline!.commands.map(command => command.type === "wait" ? null : command.atFrame)).toEqual([1, 51, 300, 564, 565]);
  62  |   expect(record.result.config.timeline!.commands.map(command => command.type === "wait" ? null : command.atFrame)).toEqual([3, 63, 318, 584, 591]);
  63  |   expect(record.result.config.timeline!.abilities).toEqual(record.sourceConfig.timeline!.abilities);
  64  |   const baseline = record.executionBaseline!;
  65  |   expect(baseline.policy).toBe("fixed-reference-v1");
  66  |   expect(baseline.options).toEqual(record.options);
> 67  |   expect(baseline.options).toMatchObject({ randomSeed: seed, critMode: "noCrit", energyMode: "configured" });
      |                            ^ Error: expect(received).toMatchObject(expected)
  68  |   expect(record.batchSummary.seed).toBe(seed);
  69  |   expect(baseline.changes.map(change => [change.originalStartTick, change.requestedTick, change.addedDelayFrames])).toEqual([[1, 3, 2], [51, 63, 10], [300, 318, 6], [564, 584, 2], [565, 591, 6]]);
  70  |   expect(baseline.changes[3]).toMatchObject({ baselineStatus: "rejected", baselineFailureCode: "INSUFFICIENT_ENERGY", reason: "ability-input" });
  71  |   expect(baseline.changes[4]).toMatchObject({ baselineStatus: "executed", reason: "swap-input" });
  72  |   expect(record.result.timelineExecution!.commandResults[3]).toMatchObject({ status: "rejected", startFrame: 584, failureCode: "INSUFFICIENT_ENERGY" });
  73  |   expect(record.result.timelineExecution!.commandResults[4]).toMatchObject({ status: "executed", startFrame: 591, endFrame: 592 });
  74  | 
  75  |   // A two-command compatibility input: E has naturally ended by swap@100.
  76  |   // Historical 1.0.0 still adds its adjacent-ability cancellation delay (10 total, not 6).
  77  |   const legacyProfile: ExecutionProfile = {
  78  |     id: "practical-assumed-input", version: "1.0.0", label: "旧版实用输入兼容样例", referenceFps: 60,
  79  |     inputDelayFrames: 2, swapDelayFrames: 6, cancellationDelayFrames: 4, evidence: "explicit-assumption",
  80  |     assumptions: ["旧版结构基线：相邻能力后的切人额外计4帧，不重解释为实际动画判断。"],
  81  |   };
  82  |   const legacyRecord = structuredClone(record);
  83  |   legacyRecord.executionProfile = legacyProfile;
  84  |   delete legacyRecord.executionBaseline;
  85  |   legacyRecord.sourceConfig.timeline!.commands = [legacyRecord.sourceConfig.timeline!.commands[0]!, { type: "swap", characterId: "amber", atFrame: 100 }];
  86  |   await page.locator("#randomSeedInput").fill("discard-this-seed");
  87  |   await page.locator("#importInput").setInputFiles({ name: "legacy-1.0.0-profile-compatibility-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(legacyRecord)) });
  88  |   await expect(page.locator("#randomSeedInput")).toHaveValue(seed);
  89  |   await waitForSimulation(page);
  90  |   await page.locator('.product-nav a[href="/rotation"]').click();
  91  |   await expect(page.locator("#execution-profile")).toHaveValue("stored-profile");
  92  |   await expect(page.locator('#execution-profile option:checked')).toContainText("1.0.0");
  93  |   await page.locator("#execution-preview").click();
  94  |   await expect(page.locator("[data-execution-baseline]")).toContainText("旧版结构基线");
  95  |   await expect(page.locator('[data-execution-command="1"] td').nth(3)).toHaveText("112");
  96  |   await expect(page.locator('[data-execution-command="1"] td').nth(4)).toHaveText("10");
  97  |   await page.locator("#rotation-save").click();
  98  |   await expect(page).toHaveURL(/\/results$/);
  99  |   await waitForSimulation(page);
  100 |   const restoredLegacy = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  101 |   expect(restoredLegacy.executionProfile).toEqual(legacyProfile);
  102 |   expect(restoredLegacy.executionProfile).not.toHaveProperty("baselineMode");
  103 |   expect(restoredLegacy).not.toHaveProperty("executionBaseline");
  104 |   expect(restoredLegacy.sourceConfig.timeline!.commands).toEqual(legacyRecord.sourceConfig.timeline!.commands);
  105 |   expect(restoredLegacy.result.timelineExecution!.commandResults.map(command => command.startFrame)).toEqual([3, 112]);
  106 |   expect(restoredLegacy.options).toEqual(record.options);
  107 |   console.info("Execution profile browser measurements", JSON.stringify({ version: record.executionProfile!.version,
  108 |     referenceSeed: baseline.options.randomSeed, requests: baseline.changes.map(change => change.requestedTick),
  109 |     failedQFrame: record.result.skippedActions[0]!.frame, postFailureSwapDelay: baseline.changes[4]!.addedDelayFrames,
  110 |     legacyVersion: restoredLegacy.executionProfile!.version, legacyRequests: restoredLegacy.result.timelineExecution!.commandResults.map(command => command.startFrame) }));
  111 | });
  112 | 
  113 | function periodicCheckpointFixture(): SimConfig {
  114 |   const refs = ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/kuki/skill.go"];
  115 |   const config = makeConfig({
  116 |     dataVersion: "synthetic-periodic-checkpoint-ui-v1", randomSeed: "deterministic-periodic-checkpoint-ui-v1",
  117 |     meta: { name: "合成机制验证：周期实体代次与锁定条件检查点", version: "synthetic-periodic-checkpoint-ui-v1", verificationStatus: "provisional", note: "明确合成帧数与面板，仅验证确定性实体和状态检查点，不代表真实角色。" },
  118 |     duration: 2, cycleLength: 2, rotation: [],
  119 |     enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "合成静止目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
  120 |     playerDamageModel: { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: 0.5, shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue",
  121 |       characters: [{ actorId: "a", initialHpRatio: 1, resistances: { pyro: 0, hydro: 0, electro: 0, cryo: 0, dendro: 0, anemo: 0, geo: 0, physical: 0 } }] },
  122 |     timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
  123 |       abilities: [{ id: "ring", actorId: "a", name: "合成确定性周期实体", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
  124 |         actionPhase: "after-frame-tasks-v1",
  125 |         conditionalHitGroups: [{ id: "condition", kind: "owner-hp-at-action-v1", comparison: "lte", thresholdRatio: 1, hitIds: ["branch"], sourceRefs: refs }],
  126 |         hits: [{ id: "branch", frame: 20, scaling: 0.1, element: "physical", snapshot: "action" },
  127 |           { id: "tick-hit", frame: 0, scaling: 1, element: "physical", snapshot: "hit", flatSources: [{ stat: "em", multiplier: 1 }] }],
  128 |         periodicEntities: [{ kind: "periodic-active-heal-v1", id: "ring", label: "明确合成数据", spawnFrame: 0, durationFrames: 400,
  129 |           firstTickDelayFrames: 60, intervalFrames: 180, hitDelayFrames: 230, hitIds: ["tick-hit"],
  130 |           healing: { ownerHpCoefficient: 0, flat: 1, ownerEmCoefficient: 0, healingBonus: 0, incomingHealingBonus: 0 }, sourceRefs: refs }],
  131 |       }], commands: [{ type: "skill", actorId: "a", abilityId: "ring", atFrame: 0 }] },
  132 |   });
  133 |   config.characters[0]!.stats.em = 200;
  134 |   return config;
  135 | }
  136 | 
  137 | test("Deterministic periodic entities and accepted action conditions survive real startup Worker checkpoints and export", async ({ page }) => {
  138 |   const config = periodicCheckpointFixture();
  139 |   await page.goto("/results");
  140 |   await page.locator("#importInput").setInputFiles({ name: "periodic-condition-checkpoint.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  141 |   await expect(page.locator("#notice")).toContainText(config.meta.name);
  142 |   await waitForSimulation(page);
  143 |   await page.locator("#analysis-warmup-cycles").fill("9");
  144 |   await page.locator("#analysis-warmup-energy").selectOption("configured");
  145 |   await page.locator("#analysis-steady-run").click();
  146 |   await expect(page.locator("#analysis-steady-run")).toBeEnabled();
  147 |   await expect(page.locator("#analysis-startup-output")).toContainText("已从完整模拟检查点建立稳态");
  148 |   const report = await downloadJson<{ startup: SimulationStartupResult }>(page, "#analysis-export");
  149 |   const startup = report.startup, result = startup.result!;
  150 |   expect(startup.status).toBe("steady-state-established");
  151 |   expect(startup.startup).toMatchObject({ warmupTicks: 1080, measurementStartTick: 1080, measurementEndTick: 1200, simulationTicks: 1730 });
  152 |   expect(startup.steadyState).toMatchObject({ status: "established-from-simulation", periodCycles: 1 });
  153 |   expect(result.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
  154 |   expect(result.config.timeline!.abilities).toEqual(config.timeline!.abilities);
  155 |   const included = result.damageEvents.filter(event => startup.measurement!.includedDamageEventIds.includes(event.id));
  156 |   // One 0.1×ATK branch and one delayed (ATK + EM) hit, with equal levels and zero resistance.
  157 |   expect(included.map(event => [event.frame, event.finalDamage])).toEqual([[1100, 1000 * 0.1 * 0.5], [1130, (1000 + 200) * 0.5]]);
  158 |   expect(startup.measurement!.totalDamage).toBe(650);
  159 |   expect(startup.steadyState!.steadyStateDps).toBe(325);
  160 |   const checkpoint = result.executionAudit!.phaseCheckpoints.find(point => point.tick === 1080)!;
  161 |   const state = checkpoint.state as unknown as {
  162 |     entities: { periodicEntities: Array<{ relativeGeneration: number; live: boolean; spawnAgeTicks: number }> };
  163 |     pendingEvents: { inFlight: Array<{ type: string; remainingTicks: number; payload: {
  164 |       instance?: number; tickIndex?: number; willExecute?: boolean; periodicFlatSnapshots?: { a: { em: number } };
  165 |       periodicEntityContext?: { instance: number; tickIndex: number; snapshotAgeTicks: number };
  166 |     } }>; futureInputCycle: Array<{ priority: number }> };
  167 |     activeCharacterAndActionPhase: { lockedConditions: Array<{ selected: boolean; inputPriority: number; ownerCurrentHp: number }> };
```