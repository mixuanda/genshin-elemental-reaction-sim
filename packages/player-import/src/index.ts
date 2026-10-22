export type { Field, FieldState, Identity, Talent, Stat, Artifact, PlayerBuild, ImportSnapshot, ImportResult, Slot } from "./model";
export { importPlayerJson, parseTalentNotation } from "./normalize";
export { fetchEnkaUid, createAuthorizedFixtureAdapter, applyPreview } from "./adapters";
export type { PublicTransport, AuthorizedEquipmentRequest, AuthorizedEquipmentAdapter } from "./adapters";
export { importPlayerText } from "./hutao-text";
export type { TextImportOptions } from "./hutao-text";
export { importPlayerInput } from "./import";
export { createCoreHandoff } from "./core-handoff";
export type { CoreImportHandoff, NullableCorePanel, DamageElement } from "./core-handoff";

export { createOwnedEquipmentController, equipmentProviderInfo } from "./authorized-host";
export type { EquipmentProvider, BoundEquipmentRole, EquipmentProblemCode, EquipmentProblem, HostProblemCode, FixtureEquipmentHost, OwnedEquipmentState } from "./authorized-host";
export { getEquipmentAuthorizationAvailability } from "./authorization-availability";
export type { EquipmentAuthorizationAvailability } from "./authorization-availability";
export { createOfficialEquipmentObserver, matchOfficialEquipmentResponse } from "./official-browser-observer.mjs";
export type { ObserverProvider, ObservedRole, ObservationResult } from "./official-browser-observer.mjs";
export { importOfficialEquipmentObservation } from "./official-equipment-import";
