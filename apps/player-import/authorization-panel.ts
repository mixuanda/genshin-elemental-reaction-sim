import { getEquipmentAuthorizationAvailability } from "../../packages/player-import/src/authorization-availability";
import { createOwnedEquipmentController, type EquipmentProvider } from "../../packages/player-import/src/authorized-host";

/** The existing host controller is reused without a host. This panel cannot
 * initiate real login or read an official browser session. */
export function mountEquipmentAuthorizationPanel(root: HTMLElement): void {
  const controller = createOwnedEquipmentController();
  const node = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  root.innerHTML = `<h2>米游社 / HoYoLAB 账号导入</h2>
    <p class="availability-badge" data-authorization-availability>真实登录暂不可用</p>
    <p>尚未核实到官方面向第三方、可读取已拥有角色当前配装的只读授权方式。</p>
    <label>账号所在服务<select data-equipment-provider><option value="miyoushe">米游社（国服）</option><option value="hoyolab">HoYoLAB（海外）</option></select></label>
    <div class="controls"><a data-official-community target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">在官方社区查看账号</a>
      <button type="button" data-check-equipment-access>检查接入状态</button>
      <button type="button" data-clear-equipment-access>清除本页账号导入状态</button></div>
    <p>打开官方页面不会把账号授权给本工具。当前可使用下方的公开 UID 展示柜或配装文件导入。</p>
    <p data-authorization-status role="status" aria-live="polite">没有建立真实账号连接，也没有读取账号数据。</p>
    <details><summary>读取范围、断开含义与当前缺口</summary>
      <h3>拟申请的本次只读范围</h3><ul data-authorization-scope></ul>
      <h3>不在该范围内</h3><ul data-authorization-exclusions></ul>
      <p>当前没有真实授权可撤回。“清除”只清空本页账号导入状态。未来若宿主未确认释放，必须显示“断开未确认”，不能声称官方授权已经撤销。</p>
      <h3>接通前缺少</h3><ol data-authorization-gaps></ol>
      <p>接通后最少需要：在官方界面登录并明确同意一次只读访问 → 选择官方返回的绑定 UID / 区服 → 预览当前配装并主动应用。当前缺少上述官方接入前提，无需在此输入账号密码或 Cookie。</p>
      <p>本页导入数据仅放在内存，不创建持久访问；关闭页面即失去本页状态。</p>
      <h3>官方公开入口核对 · <time datetime="2026-10-22">2026-10-22</time></h3><ul data-authorization-sources></ul>
    </details>`;
  const provider = () => node<HTMLSelectElement>("[data-equipment-provider]").value as EquipmentProvider;
  const fill = (selector: string, values: readonly string[]): void => {
    const list = node(selector); list.replaceChildren();
    for (const value of values) { const item = document.createElement("li"); item.textContent = value; list.append(item); }
  };
  const draw = (): void => {
    const info = getEquipmentAuthorizationAvailability(provider());
    if (!info) return;
    const link = node<HTMLAnchorElement>("[data-official-community]"); link.href = info.officialCommunityUrl; link.textContent = `在 ${info.name} 官方社区查看`;
    fill("[data-authorization-scope]", info.requestedData);
    fill("[data-authorization-exclusions]", info.excludedData);
    fill("[data-authorization-gaps]", info.missingRequirements);
    const sources = node("[data-authorization-sources]"); sources.replaceChildren();
    for (const source of info.officialSources) {
      const item = document.createElement("li"), anchor = document.createElement("a");
      anchor.textContent = source.title; anchor.href = source.url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; anchor.referrerPolicy = "no-referrer";
      item.append(anchor, document.createTextNode(`：${source.observation}`)); sources.append(item);
    }
  };
  node("[data-equipment-provider]").addEventListener("change", () => {
    controller.cancel(); draw();
    node("[data-authorization-status]").textContent = "服务选择已更新；真实账号读取仍不可用。";
  });
  node("[data-check-equipment-access]").addEventListener("click", async () => {
    const result = await controller.prepareRead({ provider: provider(), purpose: "read-owned-current-equipment", consent: "user-initiated" });
    node("[data-authorization-status]").textContent = result.ok
      ? "仅合成宿主契约可执行；没有真实登录。"
      : result.message;
  });
  node("[data-clear-equipment-access]").addEventListener("click", async () => {
    const result = await controller.disconnect();
    node("[data-authorization-status]").textContent = result.ok
      ? "本页账号导入状态已清除；未建立真实账号授权，没有执行官方账号登出或撤权。"
      : result.message;
  });
  draw();
}
