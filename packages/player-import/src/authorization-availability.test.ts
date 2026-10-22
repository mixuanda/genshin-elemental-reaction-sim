import { describe, expect, it } from "vitest";
import { getEquipmentAuthorizationAvailability } from "./authorization-availability";
import { createOwnedEquipmentController, type EquipmentProvider } from "./authorized-host";

describe("official account import availability boundary", () => {
  it.each(["miyoushe", "hoyolab"] as const)("keeps %s unavailable through the existing no-host controller", async provider => {
    const availability = getEquipmentAuthorizationAvailability(provider)!;
    expect(availability).toMatchObject({ realLogin: false, authorizedEquipmentRead: false, requestedPurpose: "read-owned-current-equipment" });
    const controller = createOwnedEquipmentController();
    const result = await controller.prepareRead({ provider, purpose: availability.requestedPurpose, consent: "user-initiated" });
    expect(result).toMatchObject({ ok: false, code: "host-unavailable" });
    expect(controller.getState()).toMatchObject({ realLogin: false, roles: [], preview: null, selectedRole: null });
    expect(await controller.disconnect()).toMatchObject({ ok: true });
    expect(controller.getState()).toMatchObject({ status: "disconnected", realLogin: false, provider: null, preview: null });
  });

  it("rejects an unrecognized provider rather than using it as a login or redirect target", () => {
    expect(getEquipmentAuthorizationAvailability("https://example.invalid/login" as EquipmentProvider)).toBeNull();
  });

  it("keeps provider links separate from an authorization grant and isolates caller edits", () => {
    const first = getEquipmentAuthorizationAvailability("miyoushe")!;
    expect(first.officialCommunityUrl).toBe("https://www.miyoushe.com/ys/");
    expect(getEquipmentAuthorizationAvailability("hoyolab")!.officialCommunityUrl).toBe("https://www.hoyolab.com/");
    expect(first.officialSources.every(source => new URL(source.url).protocol === "https:")).toBe(true);
    first.officialCommunityUrl = "https://example.invalid/";
    expect(getEquipmentAuthorizationAvailability("miyoushe")!.officialCommunityUrl).toBe("https://www.miyoushe.com/ys/");
    expect(Object.keys(first)).not.toContain("authorizationUrl");
    expect(Object.keys(first)).not.toContain("clientId");
  });
});
