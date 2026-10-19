// runtime-selection: {"schemaVersion":"1.0.0","activeCatalogSnapshotId":"snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34","previousCatalogSnapshotIds":["snapshot-7a04312fe7e39be842a84b1cacdfbd5838454a92304e4f367eb852b73f30e6c0","snapshot-ac47e52c318acda87c24caadbcfd0002c6dee012e154ffc95be8bbe4ceaa2c37"],"activeVerifiedSnapshotId":null,"previousVerifiedSnapshotIds":[],"previewWorkspaceSnapshotId":"snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217","archivedSnapshotIds":["snapshot-42fbd144ef58e11ff80f6ab8954eb642a3b200d9ee5cac2667c03cb8184b6a50","snapshot-5664d4cabbe84b86c6e473f72fc8269fcbd1bb62498567f463aaae144e4afbbc","snapshot-7a04312fe7e39be842a84b1cacdfbd5838454a92304e4f367eb852b73f30e6c0","snapshot-ac47e52c318acda87c24caadbcfd0002c6dee012e154ffc95be8bbe4ceaa2c37","snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc"]}
// Generated atomically from validated immutable snapshots. Do not edit.
export const runtimeSelection = {"schemaVersion":"1.0.0","activeCatalogSnapshotId":"snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34","previousCatalogSnapshotIds":["snapshot-7a04312fe7e39be842a84b1cacdfbd5838454a92304e4f367eb852b73f30e6c0","snapshot-ac47e52c318acda87c24caadbcfd0002c6dee012e154ffc95be8bbe4ceaa2c37"],"activeVerifiedSnapshotId":null,"previousVerifiedSnapshotIds":[],"previewWorkspaceSnapshotId":"snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217","archivedSnapshotIds":["snapshot-42fbd144ef58e11ff80f6ab8954eb642a3b200d9ee5cac2667c03cb8184b6a50","snapshot-5664d4cabbe84b86c6e473f72fc8269fcbd1bb62498567f463aaae144e4afbbc","snapshot-7a04312fe7e39be842a84b1cacdfbd5838454a92304e4f367eb852b73f30e6c0","snapshot-ac47e52c318acda87c24caadbcfd0002c6dee012e154ffc95be8bbe4ceaa2c37","snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc"]};
export { default as activeCatalogData } from "./datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/catalog.json";
export { default as activeCatalogIndexData } from "./datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/catalog-index.json";
export { default as activeSupplementalData } from "./datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/supplemental.json";
export { default as legacyRuntimeDatasetMetadata } from "./datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/metadata.json";
import evidence from "./datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/evidence-v1.json";
export const runtimeEvidenceData = evidence;
export const runtimeDatasetMetadata = evidence.metadata;
export const previewRuntimeDatasetMetadata = [{"snapshotId":"snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc","catalogVersion":"lunaris-7.1.50-preview-observed-20260924.partial-two-characters.1","gameVersion":"7.1.50","releaseStatus":"preview","contentSha256":"b5281065d42479f0215ccc29310a2d58593d81abc1590d556eb8fe580fb86c7d","numericEvidenceStatus":"missing","mechanicEvidenceStatus":"missing","sourceIds":["lunaris-version-json","lunaris-charlist-json","lunaris-mitya-en-json","lunaris-valeriy-en-json","lunaris-mitya-chs-json","lunaris-valeriy-chs-json","lunaris-lunaris-app-js"]},{"snapshotId":"snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217","catalogVersion":"lunaris-7.1.50.2-preview-observed-20260928.partial-two-characters.1","gameVersion":"7.1.50.2","releaseStatus":"preview","contentSha256":"f744f0aef052fae3a5bd6aa007457154cac01205f4c4c515a6f29ed5850dcb08","numericEvidenceStatus":"missing","mechanicEvidenceStatus":"missing","sourceIds":["lunaris-version-json","lunaris-charlist-json","lunaris-mitya-en-json","lunaris-valeriy-en-json","lunaris-mitya-chs-json","lunaris-valeriy-chs-json","lunaris-lunaris-app-js"]}];
export async function loadPreviewRuntimeDataset(snapshotId?: string) {
  const selectedId = snapshotId ?? runtimeSelection.previewWorkspaceSnapshotId;
  if (selectedId === null) return null;
  switch (selectedId) {
    case "snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc": {
      const [catalog, index, supplemental, evidence] = await Promise.all([
        import("./datasets/snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc/catalog.json"), import("./datasets/snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc/catalog-index.json"),
        import("./datasets/snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc/supplemental.json"), import("./datasets/snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc/evidence-v1.json")
      ]);
      return { catalog: catalog.default, index: index.default, supplemental: supplemental.default,
        evidence: evidence.default, metadata: evidence.default.metadata,
        selection: { ...runtimeSelection, previewWorkspaceSnapshotId: selectedId } };
    }
    case "snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217": {
      const [catalog, index, supplemental, evidence] = await Promise.all([
        import("./datasets/snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217/catalog.json"), import("./datasets/snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217/catalog-index.json"),
        import("./datasets/snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217/supplemental.json"), import("./datasets/snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217/evidence-v1.json")
      ]);
      return { catalog: catalog.default, index: index.default, supplemental: supplemental.default,
        evidence: evidence.default, metadata: evidence.default.metadata,
        selection: { ...runtimeSelection, previewWorkspaceSnapshotId: selectedId } };
    }
    default: throw new Error(`Unknown persisted preview snapshot: ${selectedId}`);
  }
}
