# 固定来源初始目标几何输入（2026-09-29）

本批为来源队伍草稿与单角色单动作草稿接入共享的初始目标几何模型，包含半径 `radius` 与中心坐标 `x`、`y`。表单、来源 GCSL formatter 和几何图示共用同一解析；radius 必须大于零，各字段须为有限数值。只有旧 JSON 完全缺少 geometry 对象时，才沿用并在界面标明应用默认值 `radius=2, pos=(0,2.4)`；已提供但字段不完整的对象会被拒绝，不会静默补全。没有添加固定来源未规定的坐标上限。

几何按来源执行器坐标表示，不声明为米。原生玩家起始中心为 `(0,0)`、半径 `0.3`；示意圆仅表示目标起始位置与半径，不表示攻击 hitbox、命中保证或角色之后的位置／朝向。此次只开放初始几何输入，不包含护盾、phase、移动轨迹、多目标伤害、命中距离公式或完整施放证明。

GCSL 数值词法不接受指数记法，因此 formatter 会将 JavaScript 最短数值文本中的科学记数法展开为等值十进制，不作四舍五入。

验收结果见[汇总测量](validation/source-target-geometry-measurements-20260929.json)：几何 formatter 单测 2/2 通过，测试用例 3ms、命令墙钟 0.878 秒；Web build 通过（6.358 秒，Vite 1.31 秒）；单个浏览器案例通过（墙钟 5.667 秒、case 3.8 秒、runner 5.0 秒，`pageErrors=[]`）。classic 固定来源近目标 `radius=2, pos=(0,2.4)` 得到 12 calculations、1 application，小计 `1161.8921525418264`，回放差 0；远目标 `radius=2, pos=(50,2.4)` 得到 2 calculations、0 applications，原生明确 miss，小计 0、pending 0。两次使用同一 build 与 action seed。队伍输入 `radius=3, pos=(-2,6)` 的 JSON 与输出 GCSL 往返通过；截图所示几何和标签已复核。

本批没有 native build；native WASM 与数据指针未改变。样本只证明输入传递及所选固定执行器场景结果，不提升游戏验证、coverage、`verified` 或 `completeCast`。其他命中机会、空间生命周期和完整技能语义仍是独立缺口。
