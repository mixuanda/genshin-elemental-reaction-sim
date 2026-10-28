# 路径级许可与来源草案（未决定原创代码许可证）

根目录缺少LICENSE，package.json没有license字段；private:true仅阻止npm发布，不授予代码许可。此文不替换任何原有版权/许可文件，也不宣称已完成法律合规审查。

| 路径/产物 | 本地可核实身份 | 发布前需要完成 |
|---|---|---|
| packages/source-host/go、patches、apps/web/public/source-host | 固定b4ae769 Classic来源；MIT与Go/依赖许可随产物保留 | 对应固定源码归档、全部补丁、构建脚本、工具链身份与最终WASM哈希清单一并核对 |
| packages/source-host/stellar-overlay、apps/web/public/source-host-stellar | a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd；AGPL-3.0-or-later，另有早期MIT贡献说明 | 单独审查修改/组合边界及网络提供方式；准备与实际WASM逐字对应的源码、补丁、构建材料和公开获取路径；仅放上游链接不能证明本地修改源码已对应提供 |
| public/source-host*/licenses、third_party/licenses | 原始许可/版权文本及依赖声明 | 保留、校验，禁止被整仓新LICENSE覆盖或删除 |
| game-data与genshin-db来源 | 社区数据仓库许可与原游戏文本/资源权属是不同层次 | 按来源清单核实数据、文字、图像各自授权；不能把代码MIT自动延伸到游戏资产 |
| Enka标识快照 | NO-LICENSE-DETECTED，provisional | 分发范围和授权尚待核清；不假定公开API等于任意内容重分发许可 |
| Lunaris隔离preview | provider授权未知 | 隔离身份与许可缺口保留，不能在申请中称正式开放授权数据 |
| 原创TS/UI等 | 没有新许可证决定 | 先核作者/贡献权属及与AGPL来源的实际组合，再由维护者决定 |

候选仅供选择：对紧密集成且有权授权的原创部分，可评估AGPL-3.0-or-later；真正独立、有权授权的组件才讨论MIT或Apache-2.0。两者的授权/专利条款等影响需单独审阅，不能借组件划分规避来源义务。尚未替用户选择、提交申请、发表法律承诺或发布源码包。

建议发布材料按Classic/Stellar两套manifest列出：上游revision、归档SHA256、补丁列表及SHA256、构建脚本与工具链、链接依赖、对应二进制SHA256、原许可、完整源码获取地址。当前只核实本地材料存在性；没有完成一次干净环境重建及最终公开分发核验。

## 2026-10-21分发入口复核与待实施方案

本地source-host-panel.ts目前仅链接两份manifest；Stellar的sourceArchiveUrl仅指未修改上游，没有GIDPS对应commit及修改后完整源码入口。本地两个public/source-host目录均缺go-build-info.txt；Stellar build.mjs将其写入staged/dist并列入files，但public复制名单漏掉该项。不能把manifest列出等同于公开文件可获取。

Stellar Worker下载WASM并把TypeScript resolver作为同步回调传给Go；因此不能凭目录隔离或“独立宿主”标签断言法律上的独立组件。需覆盖所有共享patch目录、桥接Go、插桩、构建脚本、锁文件及必要TS公式/接口；只提供上游tarball不足以描述当前修改。

下一步最小实现方案（本轮未实施）：

1. 生成版本化source-distribution.json，记录GIDPS源码commit与dirty状态、上游revision/归档哈希、实际WASM哈希、全部patch/bridge/instrumentation/build-input路径与哈希，以及TS接口/公式来源身份。旧二进制不能直接标成本轮HEAD已干净重建的产物。
2. 在用户批准分发范围及源码授权边界后，提供与产物对应的完整修改源码包和固定版本获取入口；来源面板清楚区分上游原始源码与GIDPS修改源码。未提供时明确显示缺口，不能用空链接冒充完成。
3. 修复public复制清单并核对manifest中每个可获取文件的bytes/SHA256；缺失的go-build-info不能根据本机当前Go版本虚构。
4. 在无私有缓存的干净环境重建，保存工具链/依赖解析及二进制差异报告；未完成前只称材料盘点/构建方案，不称可复现发布包。

根许可证选择和实际源码公开发布仍待维护者决定；本轮没有删除功能、改变原许可或进行部署。

2026-10-21后续事实修复：Classic与Stellar构建脚本的public复制名单均已补上真实staged产物go-build-info.txt，两个脚本通过node --check；未重建Go/WASM，未给现有二进制伪造build-info。现有public缺文件、完整修改源码获取入口和干净重建的缺口仍然存在。根许可证没有选择或变更。
