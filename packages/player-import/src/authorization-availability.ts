import { equipmentProviderInfo, type EquipmentProvider } from "./authorized-host";

export interface EquipmentAuthorizationAvailability {
  provider: EquipmentProvider;
  name: string;
  region: "cn" | "overseas";
  officialCommunityUrl: string;
  checkedAt: "2026-10-22";
  status: "normal-client-route-found-live-host-unverified";
  realLogin: false;
  authorizedEquipmentRead: false;
  /** A requested product scope, not a provider-issued scope or permission. */
  requestedPurpose: "read-owned-current-equipment";
  requestedData: readonly string[];
  excludedData: readonly string[];
  missingRequirements: readonly string[];
  officialSources: readonly { title: string; url: string; observation: string }[];
  normalClientRoute: {
    authentication: string;
    scopeFact: string;
    cloudStatus: string;
    sources: readonly { title: string; url: string }[];
  };
}

/** Evidence status only. A normal-client route is source-backed, but no actual
 * cloud login or complete-equipment read has been verified. This is not OAuth. */
export function getEquipmentAuthorizationAvailability(provider: EquipmentProvider): EquipmentAuthorizationAvailability | null {
  const info = equipmentProviderInfo(provider);
  if (!info) return null;
  return {
    provider: info.provider, region: info.region, officialCommunityUrl: info.communityUrl,
    name: provider === "miyoushe" ? "米游社（国服）" : "HoYoLAB（海外）",
    checkedAt: "2026-10-22", status: "normal-client-route-found-live-host-unverified", realLogin: false, authorizedEquipmentRead: false,
    requestedPurpose: "read-owned-current-equipment",
    requestedData: ["用户明确选定的已绑定原神 UID 与区服", "该角色的全部已拥有角色列表", "这些角色当前装备、等级、命座与天赋来源字段"],
    excludedData: ["未装备背包物品", "历史配装", "账号或游戏内写入", "后台同步与持久访问"],
    missingRequirements: [
      "当前云宿主中用户可见、可操作的官方登录 / 扫码与风险验证窗口",
      "本次真实操作前明确云宿主接收方、普通账号会话权限和最长 10 分钟保留，并由用户知情决定",
      "真实核对官方页面返回的绑定 UID / 服务器、角色列表与详情覆盖；缺少任一角色就不能标为完整",
      "核对角色突破、天赋基础与附加等级、圣遗物位置及词条编号/单位；未确认字段保持缺项",
    ],
    normalClientRoute: {
      authentication: provider === "miyoushe" ? "已找到成熟客户端采用的官方页面登录和国服扫码路线；扫码确认后是普通账号登录状态。" : "已找到成熟客户端采用的 HoYoLAB 官方网页登录路线；不能把国服扫码方式套到海外。",
      scopeFact: "普通账号登录状态的权限超出装备只读。本工具拟仅在本次临时云宿主观察所选账号配装，完成、取消或最多 10 分钟后释放；不等同官方全局登出。",
      cloudStatus: "默认零网络的宿主原型已可执行；当前云端还缺少用户可操作的登录、扫码和验证窗口。真实账号连通及完整配装尚未验证。",
      sources: [
        { title: "Starward：两区官方页面登录实现", url: "https://github.com/Scighost/Starward/blob/df8ae07b5ad4c9c6cb70d288488ce8073ce01478/src/Starward/Features/GameRecord/LoginPage.xaml.cs" },
        { title: "genshin.py：角色列表与当前配装详情", url: "https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/client/components/chronicle/genshin.py" },
        ...(provider === "miyoushe" ? [{ title: "genshin.py：仅国服扫码登录", url: "https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/client/components/auth/client.py" }] : []),
      ],
    },
    officialSources: provider === "miyoushe" ? [
      { title: "米游社原神社区", url: info.communityUrl, observation: "官方社区入口；本次公开抓取超时，未取得第三方授权文档。" },
      { title: "米哈游通行证", url: "https://user.mihoyo.com/", observation: "官方账号入口为脚本页面；不据此认定存在第三方装备读取权限。" },
    ] : [
      { title: "HoYoLAB 官方社区", url: info.communityUrl, observation: "官方社区入口；公开页面不构成第三方只读授权合同。" },
      { title: "HoYoLAB Battle Chronicle", url: "https://act.hoyolab.com/app/community-game-records-sea/index.html", observation: "官方战绩产品的脚本页面；未登录、未读取账号数据，未取得第三方授权文档。" },
      { title: "HoYoverse Account", url: "https://account.hoyoverse.com/", observation: "官方账号入口为脚本页面；打开该页不把账号授权给本工具。" },
    ],
  };
}
