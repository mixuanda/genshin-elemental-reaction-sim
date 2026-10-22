# 官方页面配装观察字段映射

本页对应无凭据纯解析，不证明真实登录连通。源模型固定于 genshin.py `2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213`，模型全文见 [chronicle/characters.py](https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/models/genshin/chronicle/characters.py)。未复制其实现，仅依据字段声明和同次响应关系实现导入。

| 原响应字段 | 接入既有契约的方式 |
| --- | --- |
| `list[].base.id / level / actived_constellation_num` | 角色固定 ID、源等级和命座；95/100 不裁切，缺项不补零。模型的 base 展平规则不使用 `base.weapon` 覆盖详细武器。 |
| `weapon.id / level / promote_level / affix_level` | 已装备武器身份、等级、突破、精炼；突破 0 是已知值。 |
| `weapon.main_property / sub_property` | 只把来源 final 显示值按明确属性名称/单位保存为武器观测；base/add 保留源观察，不相加，不混入角色总面板。 |
| `relics[].id / rarity / level / pos_name` | 仅角色当前 relics；物品 ID 用已有固定目录解析套装，位置用明确中英文位置名。强化 +0 保留；不按数字 pos 猜位置，也不把 API set.id 当成另一命名空间的游戏套装 ID。 |
| `main_property / sub_property_list` 与 `property_map[str(property_type)]` | 源模型明确使用同次 property_map 补充属性名；只有编号一致且名称受支持才识别词条。显式百分号按既有归一化函数除以 100 一次；无百分号的普通平铺值原样，真实 0 保留。 |
| `skills[].skill_id / level / is_unlock` | 固定目录 skillOrder 唯一匹配后记录显示等级；不把来源数组顺序或 skill_type 数字当战斗天赋次序，不按命座再加减。基础与额外等级仍未知，相关计算继续阻断。 |

现有身份/物品映射继续复用仓库固定 [Genshin Optimizer 导入资料](../game-data/sources/build-import/manifest.json)，固定上游为 [180a0a1](https://github.com/frzyc/genshin-optimizer/tree/180a0a1015cb725c7570cd828eb086749960df98)。没有新建物品目录或数据公式。源命名或 ID 未识别时标 unknown-id；属性字典编号冲突、单位不明确或格式非法时阻断该值，不静默丢掉后称完整。

当前仍需要现场净化 shape/明确来源才能补的项目：

- **角色突破阶段**：固定模型未声明，不能由 95/100 级反推，也不接受文件自加的 ascension 字段冒充官方来源。
- **天赋基础/附加拆分**：只知道显示 level 和 is_unlock；即使 C6、显示 13，也不反推 10+3。没有这项来源就不能把显示等级送作基础等级。
- **未支持语言与格式**：位置名、属性名只精确匹配当前受支持标签；没有 property_map 元数据、只有数字编号、缺单位或含未核实千位/小数分隔符时保持未知。数字 pos 与属性编号映射不靠猜测补齐。
- **全账号覆盖与真实调用**：只比较本次列表与详细角色 ID 严格一致；仍不证明官方列表覆盖全账号，更不证明真实登录成功。

宿主导出带 `observations.format=gidps-official-ui-observation/1`，独立工作台现有 JSON/文件入口自动识别；规范化结果仍为 ImportSnapshot，source.kind 为 official-ui-observation、范围为 file-equipped-subset。普通 GOOD/Enka/文本路径保持原合同。导入失败或任何必需字段仍 partial 时，既有 applyPreview 保留上次完整快照；预览不会自动应用或持久保存。

本轮验证：新增映射、观察器、既有文本与核心交接共 55 个 focused tests 通过；既有五项文件/文本/UID 浏览器流加新增观察文件流共 6 项通过。standalone 与新增测试的类型检查、语法及 diff 检查通过。浏览器用例观察到账号外部请求与本地/会话存储均为零。没有执行真实登录、主动账号 API、主应用构建或全回归。
