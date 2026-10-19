import {
  assessRuntimeEvidence,
  type RuntimeWorkspace,
} from "@genshin-dps-lab/game-data";
import type { SupportedDefinition } from "@genshin-dps-lab/game-data/update-schema";
import {
  evaluateCalculatorTrust,
  getCalculatorHitSourceContract,
  getCalculatorHitTrustDependencies,
  type CalculatorDocument,
  type CalculatorTrustContext,
  type CalculatorTrustedReleasedSource,
} from "@genshin-dps-lab/sim-core";

/**
 * Snapshot authors declare calculator:hit:<hitId> (or the exact hitId) with
 * scope hitCalculation, or calculator:skill:<skillId> (or exact skillId) with
 * scope skillCalculation. The definition must explicitly list EVERY field ID
 * returned by getCalculatorHitTrustDependencies, including rule:, source: and
 * equipment: identifiers. Names/prefixes are not wildcard evidence mappings.
 * Each listed field still needs classified, verified numeric/mechanic evidence,
 * immutable source references and tests, and the snapshot must be promoted.
 */
function selectedCalculationIds(document: CalculatorDocument): string[] {
  const ids = new Set(document.selectedHitIds);
  if (document.scope === "one-cast") {
    for (const hit of document.hits) {
      if (ids.has(hit.id) && hit.kind === "ordinary" && hit.occurrence?.enabled) {
        ids.add(hit.occurrence.sourceHitId);
      }
    }
  }
  return [...ids];
}

function workspaceReleaseStatus(workspace: RuntimeWorkspace): CalculatorDocument["dataIdentity"]["releaseStatus"] {
  return workspace.channel === "preview" ? "preview" : workspace.metadata.releaseStatus;
}

function identityMatches(document: CalculatorDocument, workspace: RuntimeWorkspace): boolean {
  return document.dataIdentity.datasetId === workspace.metadata.snapshotId
    && document.dataIdentity.gameVersion === workspace.metadata.gameVersion
    && document.dataIdentity.releaseStatus === workspaceReleaseStatus(workspace);
}

function promotedWorkspace(workspace: RuntimeWorkspace): boolean {
  return workspace.channel === "released" && workspace.metadata.releaseStatus === "released"
    && workspace.selection.activeCatalogSnapshotId === workspace.metadata.snapshotId
    && workspace.selection.activeVerifiedSnapshotId === workspace.metadata.snapshotId
    && workspace.evidence.snapshotId === workspace.metadata.snapshotId
    && workspace.evidence.metadata.snapshotId === workspace.metadata.snapshotId
    && workspace.evidence.metadata.catalogVersion === workspace.metadata.catalogVersion
    && workspace.evidence.metadata.contentSha256 === workspace.metadata.contentSha256
    && workspace.evidence.metadata.gameVersion === workspace.metadata.gameVersion
    && workspace.evidence.metadata.releaseStatus === "released";
}

function definitionForHit(
  template: CalculatorDocument,
  hitId: string,
  requiredIds: readonly string[],
  skillRequiredIds: readonly string[],
  workspace: RuntimeWorkspace,
): SupportedDefinition | undefined {
  const skillId = template.gameContext?.skillId;
  const hitNames = new Set([`calculator:hit:${hitId}`, hitId]);
  const skillNames = new Set(skillId ? [`calculator:skill:${skillId}`, skillId] : []);
  const candidates = [
    ...workspace.evidence.definitions.filter(definition => definition.scope === "hitCalculation" && hitNames.has(definition.id)),
    ...workspace.evidence.definitions.filter(definition => definition.scope === "skillCalculation" && skillNames.has(definition.id)),
  ];
  return candidates.find(definition => {
    const required = definition.scope === "skillCalculation" ? skillRequiredIds : requiredIds;
    // Passing extra dependency IDs to the assessor is insufficient: the source
    // definition itself must declare the execution contract's full dependency set.
    if (!required.every(id => definition.dependencyFieldIds.includes(id))) return false;
    return assessRuntimeEvidence(workspace.evidence, workspace.selection, {
      scope: definition.scope,
      definitionIds: [definition.id],
      dependencyFieldIds: required,
      channel: workspace.channel,
    }).ready;
  });
}

function evidenceRefsForField(id: string, definition: SupportedDefinition, workspace: RuntimeWorkspace): string[] {
  const field = workspace.evidence.fields.find(entry => entry.id === id);
  if (!field) return [];
  const sources = field.sourceIds.flatMap(sourceId => {
    const source = workspace.evidence.sources.find(entry => entry.id === sourceId);
    if (!source?.contentSha256) return [];
    return [
      `${source.url} (revision ${source.revision}; sha256 ${source.contentSha256})`,
      ...(source.evidenceRef ? [source.evidenceRef] : []),
    ];
  });
  return [...new Set([...sources, ...field.testRefs, ...definition.testRefs, definition.implementationRef])];
}

/**
 * The template must have been rebuilt independently from this workspace's source
 * data. Never pass an imported/edited document as its own source template. This
 * function does not infer trusted rules from document evidenceStatus/sourceRefs.
 */
export function createWorkspaceCalculatorTrust(
  document: CalculatorDocument,
  sourceTemplate: CalculatorDocument | undefined,
  workspace: RuntimeWorkspace,
): CalculatorTrustContext {
  if (!sourceTemplate || !promotedWorkspace(workspace)
    || !identityMatches(document, workspace) || !identityMatches(sourceTemplate, workspace)) return {};

  const requested = selectedCalculationIds(document);
  const templateHits = new Set(sourceTemplate.hits.map(hit => hit.id));
  const requirements = new Map(requested.filter(id => templateHits.has(id)).map(id => [
    id, getCalculatorHitTrustDependencies(sourceTemplate, id),
  ]));
  const skillRequiredIds = [...new Set([...requirements.values()].flat())];
  const hitContracts: CalculatorTrustedReleasedSource["hitContracts"][number][] = [];
  const verifiedDependencies = new Map<string, Set<string>>();
  for (const [hitId, dependencyIds] of requirements) {
    const definition = definitionForHit(sourceTemplate, hitId, dependencyIds, skillRequiredIds, workspace);
    if (!definition) continue;
    hitContracts.push({hitId, dependencyIds, sourceContract:getCalculatorHitSourceContract(sourceTemplate,hitId)});
    for (const id of dependencyIds) {
      const refs = verifiedDependencies.get(id) ?? new Set<string>();
      evidenceRefsForField(id, definition, workspace).forEach(ref => refs.add(ref));
      verifiedDependencies.set(id, refs);
    }
  }
  if (!hitContracts.length) return {};
  return {trustedReleasedSources:[{
    datasetId:workspace.metadata.snapshotId,
    gameVersion:workspace.metadata.gameVersion,
    snapshotId:workspace.metadata.snapshotId,
    // This identifier records the checked authoritative selection, rather than
    // accepting a promotion claim embedded in the snapshot or imported document.
    promotionId:`runtime-selection.activeVerifiedSnapshotId:${workspace.selection.activeVerifiedSnapshotId}`,
    releaseStatus:"released",
    verifiedDependencies:[...verifiedDependencies].map(([id,refs])=>({id,evidenceRefs:[...refs]})),
    hitContracts,
  }]};
}

/** Source-generation boundary ONLY. Imports retain their recorded identity and
 * are compared against a separately regenerated template with the function above. */
export function stampCalculatorWorkspaceEvidence(document: CalculatorDocument, workspace: RuntimeWorkspace): CalculatorDocument {
  const stamped = structuredClone(document);
  stamped.dataIdentity = {
    datasetId:workspace.metadata.snapshotId,
    gameVersion:workspace.metadata.gameVersion,
    releaseStatus:workspaceReleaseStatus(workspace),
    evidenceStatus:"provisional",
  };
  // Here the argument is already a source-generated document. No trust context
  // returned here is persisted in calculator JSON or reused by the import path.
  const trust = createWorkspaceCalculatorTrust(stamped, stamped, workspace);
  const fields = new Map((trust.trustedReleasedSources ?? []).flatMap(source => source.verifiedDependencies).map(field => [field.id, field]));
  stamped.dependencies = stamped.dependencies.map(dependency => dependency.status === "missing" ? dependency : {
    ...dependency,
    status:fields.has(dependency.id) ? "verified" as const : "provisional" as const,
  });
  if (evaluateCalculatorTrust(stamped, trust).verified) stamped.dataIdentity.evidenceStatus = "verified";
  return stamped;
}
