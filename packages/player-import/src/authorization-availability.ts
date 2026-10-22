import { equipmentProviderInfo, type EquipmentProvider } from "./authorized-host";

export interface EquipmentAuthorizationAvailability {
  provider: EquipmentProvider;
  name: string;
  region: "cn" | "overseas";
  officialCommunityUrl: string;
  checkedAt: "2026-10-22";
  status: "official-third-party-route-not-verified";
  realLogin: false;
  authorizedEquipmentRead: false;
  /** A requested product scope, not a provider-issued scope or permission. */
  requestedPurpose: "read-owned-current-equipment";
  requestedData: readonly string[];
  excludedData: readonly string[];
  missingRequirements: readonly string[];
  officialSources: readonly { title: string; url: string; observation: string }[];
}

/** Evidence status only. Official product/login pages do not establish a
 * delegated third-party read grant. No authorization endpoint, client id,
 * login parameter, credential exchange or live host is invented here. */
export function getEquipmentAuthorizationAvailability(provider: EquipmentProvider): EquipmentAuthorizationAvailability | null {
  const info = equipmentProviderInfo(provider);
  if (!info) return null;
  return {
    provider: info.provider, region: info.region, officialCommunityUrl: info.communityUrl,
    name: provider === "miyoushe" ? "米游社（国服）" : "HoYoLAB（海外）",
    checkedAt: "2026-10-22", status: "official-third-party-route-not-verified", realLogin: false, authorizedEquipmentRead: false,
    requestedPurpose: "read-owned-current-equipment",
    requestedData: ["用户明确选定的已绑定原神 UID 与区服", "该角色的全部已拥有角色列表", "这些角色当前装备、等级、命座与天赋来源字段"],
    excludedData: ["未装备背包物品", "历史配装", "账号或游戏内写入", "后台同步与持久访问"],
    missingRequirements: [
      "官方明确允许第三方接入的文档或接入批准",
      "用户在官方界面授予本次只读访问的方式，以及准确权限范围",
      "绑定角色枚举、完整已拥有角色列表与当前装备的官方数据合同",
      "授权到期、取消和撤回的可验证行为",
    ],
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
