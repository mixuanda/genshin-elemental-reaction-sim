/** Causal references from original Go modifier receipts to shared scalar calls. */
import { sourceHostScalarProvenanceSchema, type SourceHostScalarKind } from "./source-host-scalar-provenance";
import { sourceHostStatProvenanceSchema, type SourceHostStatReadReceipt } from "./source-host-stat-provenance";
import { sourceHostArtifactRuleStatIndex } from "./source-host-artifact-formula";
import { isSourceHostArtifactConstantRuleId, sourceHostArtifactConstantModifierKeys } from "./source-host-artifact-constant-formula";
import { isSourceHostArtifactDynamicRuleId, sourceHostArtifactDynamicModifierKeys } from "./source-host-artifact-dynamic-formula";
import { isSourceHostArtifactAuxiliaryRuleId, sourceHostArtifactAuxiliaryDescriptor } from "./source-host-artifact-auxiliary-formula";
import { isSourceHostCharacterModifierRuleId, resolveSourceHostCharacterModifierInput, sourceHostCharacterModifierRuleDescriptor } from "./source-host-character-modifier-formula";
import { isSourceHostCharacterModifierDynamicRuleId, sourceHostCharacterModifierDynamicRuleDescriptor } from "./source-host-character-modifier-dynamic-formula";
import { isSourceHostCharacterScalarRuleId, resolveSourceHostCharacterScalarInput, sourceHostCharacterScalarRuleDescriptor } from "./source-host-character-scalar-formula";
import { resolveSourceHostCharacterAdditiveInput, sourceHostCharacterAdditiveRuleDescriptor } from "./source-host-character-additive-formula";
import { resolveSourceHostCharacterFlatInput, sourceHostCharacterFlatRuleDescriptor } from "./source-host-character-flat-formula";
import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import { SourceHostWandererC2ScopeError } from "./source-host-wanderer-c2-scope";
import { SOURCE_HOST_COMMIT, type SourceHostCalculationRecord, type SourceHostCalculationRequest, type SourceHostCharacterScalarRequest, type SourceHostCharacterAdditiveRequest, type SourceHostCharacterFlatRequest } from "./source-host-wire";

type SupportRecords = ReadonlyMap<number, SourceHostCalculationRecord>;
type ResistanceMeta = { sourceHolderIndex: number; createdFrame: number; targetKey: number; element: string };
type StepRef = { ids: number[]; creationIds?: number[] | undefined; readId: string; index: number; key: string; frame: number; actorIndex?: number | undefined; effectSourceActorIndex?: number | undefined; targetKey?: number | undefined; readElement?: string | undefined; stepElement?: string | undefined; artifactResistance?: ResistanceMeta | undefined; kind: "stat" | "scalar"; scalarKind?: SourceHostScalarKind; returned: number[] | number | null; outcome: string };
const modifierKeys: Record<string, string> = {
  "mh-2pc": "mh-2pc", "mh-4pc": "mh-4pc", "gt-2pc": "troupe-2pc", "gt-4pc": "troupe-4pc",
  "hod-2pc": "hod-2pc", "hod-4pc": "hod-4pc", "nd-2pc": "nd-2pc", "nd-4pc-atk": "nd-4pc", "nd-4pc-hydro": "nd-4pc",
  "pf-2pc": "pf-2pc", "pf-4pc-atk": "pf-4pc", "pf-4pc-physical": "pf-4pc",
  "cw-2pc": "crimson-2pc", "cw-4pc-pyro": "crimson-4pc-stacks", "cw-4pc-reaction": "crimson-4pc",
  "vg-2pc": "vg-2pc", "vg-4pc-base": "vg-4pc", "vg-4pc-stack": "vg-4pc-stack",
};

function refsFromStatRead(read: SourceHostStatReadReceipt, refs: StepRef[]): void {
  for (const step of read.steps) {
    if (step.formulaCalculationIds && new Set(step.formulaCalculationIds).size !== step.formulaCalculationIds.length) {
      throw new Error(`来源属性步骤 ${read.id}/${step.key} 重复消费同一公式 ID`);
    }
    if (step.creationFormulaCalculationIds?.length && (new Set(step.creationFormulaCalculationIds).size !== step.creationFormulaCalculationIds.length
      || step.creationFormulaCalculationIds.some(id => !step.formulaCalculationIds?.includes(id)))) {
      throw new Error(`来源属性步骤 ${read.id}/${step.key} 的创建公式 ID 不属于实际消费列表`);
    }
    if (step.formulaCalculationIds?.length) refs.push({ ids: step.formulaCalculationIds, creationIds: step.creationFormulaCalculationIds, readId: read.id, index: step.index, key: step.key, frame: read.frame, actorIndex: read.actorIndex, effectSourceActorIndex: read.effectSourceActorIndex, targetKey: read.targetKey, kind: "stat", returned: step.returned, outcome: step.outcome });
    step.dependencies.forEach(nested => refsFromStatRead(nested, refs));
  }
}

export function sourceHostArtifactSupportRefs(request: SourceHostCalculationRequest): StepRef[] {
  const refs: StepRef[] = [];
  if ((request.kind === "transformative-base" || request.kind === "additive-base") && request.statRead)
    refsFromStatRead(request.statRead, refs);
  if (request.kind === "weapon-additive") refsFromStatRead(request.statRead, refs);
  if (request.kind === "artifact-additive" && request.statRead) refsFromStatRead(request.statRead, refs);
  if (request.kind === "character-energy" && request.statRead) refsFromStatRead(request.statRead, refs);
  if (request.kind === "character-healing" && request.statRead) refsFromStatRead(request.statRead, refs);
  if (request.kind === "character-healing" && request.input.operation === "source")
    request.statReads?.forEach(read => refsFromStatRead(read, refs));
  if (request.kind === "character-drain") request.statReads?.forEach(read => refsFromStatRead(read, refs));
  if (request.kind === "character-shield") request.statReads?.forEach(read => refsFromStatRead(read, refs));
  if (request.kind === "character-modifier" && request.statRead) refsFromStatRead(request.statRead, refs);
  if (request.kind === "character-modifier") request.statReads?.forEach(read => refsFromStatRead(read, refs));
  if (request.kind === "character-scalar" && request.statRead) refsFromStatRead(request.statRead, refs);
  if (request.kind === "character-additive" && request.statRead) refsFromStatRead(request.statRead, refs);
  if (request.kind === "character-additive") request.statReads?.forEach(read => refsFromStatRead(read, refs));
  if (request.kind === "character-flat") request.statReads?.forEach(read => refsFromStatRead(read, refs));
  if (request.kind === "character-multiplier") request.statReads?.forEach(read => refsFromStatRead(read, refs));
  if (request.snapshot && "statProvenance" in request.snapshot && request.snapshot.statProvenance != null) {
    const stat = sourceHostStatProvenanceSchema.parse(request.snapshot.statProvenance);
    if (stat.snapshotRead) refsFromStatRead(stat.snapshotRead, refs);
    stat.attackReads.forEach(read => refsFromStatRead(read, refs));
  }
  if (request.scalarProvenance) {
    const scalar = sourceHostScalarProvenanceSchema.parse(request.scalarProvenance);
    for (const read of scalar.reads) for (const step of read.steps) {
      if (step.formulaCalculationIds && new Set(step.formulaCalculationIds).size !== step.formulaCalculationIds.length)
        throw new Error(`来源标量步骤 ${read.id}/${step.key} 重复消费同一公式 ID`);
      if (step.creationFormulaCalculationIds?.length && (new Set(step.creationFormulaCalculationIds).size !== step.creationFormulaCalculationIds.length ||
        step.creationFormulaCalculationIds.some(id => !step.formulaCalculationIds?.includes(id))))
        throw new Error(`来源标量步骤 ${read.id}/${step.key} 的创建公式 ID 不属于实际消费列表`);
      if (step.formulaCalculationIds?.length) refs.push({ ids: step.formulaCalculationIds, creationIds: step.creationFormulaCalculationIds, readId: read.id, index: step.index, key: step.key, frame: read.frame, actorIndex: read.actorIndex, targetKey: read.targetKey, readElement: read.element, stepElement: step.element, artifactResistance: step.artifactResistance, kind: "scalar", scalarKind: read.kind, returned: step.delta, outcome: step.outcome });
      step.dependencies.forEach(nested => refsFromStatRead(nested, refs));
    }
  }
  return refs;
}

export function sourceHostArtifactSupportIds(request: SourceHostCalculationRequest): number[] {
  return [...new Set([
    ...sourceHostArtifactSupportRefs(request).flatMap(ref => ref.ids),
    ...(request.kind === "character-scalar" ? Object.values(request.valueSources ?? {}) : []),
    ...(request.kind === "character-additive" ? Object.values(request.valueSources ?? {}) : []),
  ])];
}

/** A state leaf may reuse a scalar computed at an earlier native creation
 * point. It is an input dependency, not another contribution to Amount. */
export function sourceHostCharacterScalarValueSourceLinks(
  request: SourceHostCharacterScalarRequest, records: SupportRecords,
): Map<string, string> {
  const descriptor = sourceHostCharacterScalarRuleDescriptor(request.input.ruleId);
  const expected = descriptor.valueSources ?? {};
  const actual = request.valueSources ?? {};
  const keys = Object.keys(expected);
  if ((keys.length > 0 && request.input.phase !== "read") || Object.keys(actual).length !== keys.length ||
    keys.some(key => !Object.prototype.hasOwnProperty.call(actual, key)))
    throw new Error(`角色标量 #${request.id} 的创建数值来源字段与固定规则不一致`);
  const links = new Map<string, string>();
  for (const key of keys) {
    const id = actual[key]!;
    const row = records.get(id);
    if (!row || row.request.kind !== "character-scalar" || id >= request.id || row.request.id !== id ||
      row.request.input.ruleId !== expected[key] || row.request.input.phase !== "creation" ||
      row.request.actorIndex !== request.input.sourceHolderIndex ||
      row.request.input.sourceHolderIndex !== request.input.sourceHolderIndex || row.request.targetKey !== 0 ||
      row.request.frame > request.frame || (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT) ||
      row.request.componentIds.length || row.request.componentApplications.length ||
      descriptor.statLeaf?.stateKey === key || !Object.prototype.hasOwnProperty.call(request.input.state, key)) {
      throw new Error(`角色标量 #${request.id} 的 ${key} 创建来源身份、阶段或帧无效`);
    }
    const creation = sourceHostCharacterScalarRuleDescriptor(row.request.input.ruleId);
    if (creation.phase !== "creation" || !(creation.sourceCommits as readonly string[]).includes(row.request.sourceCommit ?? SOURCE_HOST_COMMIT))
      throw new Error(`角色标量 #${request.id} 的 ${key} 创建规则与固定源码不符`);
    const computed = resolveSourceHostCharacterScalarInput(row.request.input, row.request.sourceCommit ?? SOURCE_HOST_COMMIT, `characterScalar.${id}`);
    close(row.value, computed.value, `character-scalar source #${id}`);
    close(request.input.state[key]!, row.value, `character-scalar ${request.id}/${key}`);
    links.set(key, `characterScalar.${id}.${row.request.input.ruleId}`);
  }
  return links;
}

/** A hit may consume a value stored by one earlier character callback. The
 * creation record explains a state leaf and never becomes a FlatDmg component. */
export function sourceHostCharacterAdditiveValueSourceLinks(
  request: SourceHostCharacterAdditiveRequest, records: SupportRecords,
): Map<string, string> {
  const descriptor = sourceHostCharacterAdditiveRuleDescriptor(request.input.ruleId);
  const expected = descriptor.valueSources ?? {};
  const actual = request.valueSources ?? {};
  const keys = Object.keys(expected);
  if ((keys.length > 0 && request.input.phase !== "hit") || Object.keys(actual).length !== keys.length ||
    keys.some(key => !Object.prototype.hasOwnProperty.call(actual, key))) {
    throw new Error(`角色附加伤害 #${request.id} 的创建数值来源字段与固定规则不一致`);
  }
  const links = new Map<string, string>();
  for (const key of keys) {
    const id = actual[key]!;
    const row = records.get(id);
    if (!row || row.request.kind !== "character-additive" || id >= request.id || row.request.id !== id ||
      row.request.input.ruleId !== expected[key] || row.request.input.phase !== "creation" ||
      row.request.actorIndex !== request.input.sourceHolderIndex ||
      row.request.input.sourceHolderIndex !== request.input.sourceHolderIndex || row.request.targetKey !== 0 ||
      row.request.frame > request.frame || (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT) ||
      row.request.componentIds.length || row.request.componentApplications.length || row.request.snapshot !== null ||
      row.request.snapshotStats !== null || row.request.componentScope !== undefined ||
      descriptor.statLeaf?.stateKey === key || descriptor.snapshotLeaf?.stateKey === key ||
      descriptor.statLeaves?.some(leaf => leaf.stateKey === key) ||
      !Object.prototype.hasOwnProperty.call(request.input.state, key)) {
      throw new Error(`角色附加伤害 #${request.id} 的 ${key} 创建来源身份、阶段或帧无效`);
    }
    const creation = sourceHostCharacterAdditiveRuleDescriptor(row.request.input.ruleId);
    if (creation.phase !== "creation" || !(creation.sourceCommits as readonly string[]).includes(row.request.sourceCommit ?? SOURCE_HOST_COMMIT))
      throw new Error(`角色附加伤害 #${request.id} 的 ${key} 创建规则与固定源码不符`);
    const computed = resolveSourceHostCharacterAdditiveInput(row.request.input, row.request.sourceCommit ?? SOURCE_HOST_COMMIT, `characterAdditive.${id}`);
    close(row.value, computed.value, `character-additive source #${id}`);
    close(request.input.state[key]!, row.value, `character-additive ${request.id}/${key}`);
    links.set(key, `characterAdditive.${id}.${row.request.input.ruleId}`);
  }
  return links;
}

/** Only an earlier source-owned FlatDmg producer may supply a saved numeric
 * leaf. It is a dependency of the current term, not another active component. */
export function sourceHostCharacterFlatValueSourceLinks(
  request: SourceHostCharacterFlatRequest, records: SupportRecords,
): Map<string, string> {
  const descriptor = sourceHostCharacterFlatRuleDescriptor(request.input.ruleId);
  const expected = descriptor.valueSources ?? {};
  const actual = request.valueSources ?? {};
  const keys = Object.keys(expected);
  if (Object.keys(actual).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(actual, key)))
    throw new Error(`角色 FlatDmg #${request.id} 的保存数值来源与固定规则不一致`);
  const links = new Map<string, string>();
  for (const key of keys) {
    const id = actual[key]!;
    const row = records.get(id);
    const allowedRules = expected[key]!;
    const allowed = typeof allowedRules === "string" ? row?.request.kind === "character-flat" && row.request.input.ruleId === allowedRules
      : row?.request.kind === "character-flat" && allowedRules.includes(row.request.input.ruleId);
    if (!row || row.request.kind !== "character-flat" || id >= request.id || row.request.id !== id ||
      !allowed || row.request.input.sourceHolderIndex !== request.input.sourceHolderIndex ||
      row.request.frame > request.frame ||
      (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT) ||
      row.request.componentApplications.length ||
      descriptor.statLeaf?.stateKey === key || descriptor.statLeaves?.some(leaf => leaf.stateKey === key) ||
      descriptor.snapshotLeaf?.stateKey === key || descriptor.snapshotLeaves?.some(leaf => leaf.stateKey === key) ||
      !Object.prototype.hasOwnProperty.call(request.input.state, key)) {
      throw new Error(`角色 FlatDmg #${request.id} 的 ${key} 保存来源身份、时序或先前状态无效`);
    }
    const creation = sourceHostCharacterFlatRuleDescriptor(row.request.input.ruleId);
    if (!(creation.sourceCommits as readonly string[]).includes(row.request.sourceCommit ?? SOURCE_HOST_COMMIT))
      throw new Error(`角色 FlatDmg #${request.id} 的 ${key} 保存来源不属于该源码版本`);
    const computed = resolveSourceHostCharacterFlatInput(row.request.input, row.request.sourceCommit ?? SOURCE_HOST_COMMIT, `characterFlat.${id}`);
    close(row.value, computed.value, `character-flat source #${id}`);
    close(request.input.state[key]!, row.value, `character-flat ${request.id}/${key}`);
    links.set(key, `characterFlat.${id}.${row.request.input.ruleId}`);
  }
  return links;
}

/** Include formula calls made by a support call's one captured nested getter. */
export function sourceHostArtifactSupportClosureIds(
  roots: readonly SourceHostCalculationRequest[], records: ReadonlyMap<number, SourceHostCalculationRecord>,
): number[] {
  const ids = new Set<number>();
  const visit = (request: SourceHostCalculationRequest): void => {
    if (request.kind === "character-scalar") sourceHostCharacterScalarValueSourceLinks(request, records);
    if (request.kind === "character-additive") sourceHostCharacterAdditiveValueSourceLinks(request, records);
    for (const id of sourceHostArtifactSupportIds(request)) {
      if (id >= request.id) throw new Error(`来源修饰器支持记录 #${id} 未先于消费者 #${request.id} 完成`);
      const row = records.get(id);
      const creationDependency = request.kind === "character-additive" && Object.values(request.valueSources ?? {}).includes(id);
      if (!row || (creationDependency ? row.request.kind !== "character-additive" || row.request.input.phase !== "creation"
        : row.request.kind !== "artifact-scalar" && row.request.kind !== "character-modifier" && row.request.kind !== "character-scalar")) {
        throw new Error(`来源修饰器缺少嵌套支持记录 #${id}`);
      }
      if (!ids.has(id)) { ids.add(id); visit(row.request); }
    }
  };
  roots.forEach(visit);
  return [...ids].sort((a, b) => a - b);
}

function close(actual: number, expected: number, label: string): void {
  if (Math.abs(actual - expected) > 1e-12 * Math.max(1, Math.abs(actual), Math.abs(expected))) throw new Error(`来源修饰器共享公式 ${label} 不一致：${actual} / ${expected}`);
}

/** Verify each shared formula output was the value consumed by its one native
 * Amount call. Unlinked historical modifiers remain explicit opaque receipts. */
export function verifySourceHostArtifactSupport(request: SourceHostCalculationRequest, records: SupportRecords): Map<string, string> {
  const links = new Map<string, string>();
  const ambiguousLinks = new Set<string>();
  const link = (key: string, reference: string): void => {
    if (ambiguousLinks.has(key)) return;
    if (links.has(key)) { links.delete(key); ambiguousLinks.add(key); }
    else links.set(key, reference);
  };
  const seen = new Set<number>();
  for (const ref of sourceHostArtifactSupportRefs(request)) {
    if (ref.outcome !== "applied" || ref.returned === null) throw new Error(`来源共享公式挂在未应用的 modifier ${ref.readId}/${ref.index}`);
    if (ref.kind === "scalar") {
      const leafSourceIds = new Set(ref.ids.flatMap(id => {
        const row = records.get(id);
        return row && row.request.kind === "character-scalar" ? Object.values(row.request.valueSources ?? {}) : [];
      }));
      if (ref.ids.some(id => leafSourceIds.has(id))) throw new Error(`来源标量 ${ref.readId}/${ref.index} 将创建状态叶误计为第二次 Amount 贡献`);
    }
    const sums = new Map<number, number>();
    let scalarSum = 0;
    for (const id of ref.ids) {
      if (seen.has(id) && !ref.artifactResistance && !ref.creationIds?.includes(id)) throw new Error(`来源共享公式 #${id} 在同一请求中被多次归属`);
      seen.add(id);
      if (id >= request.id) throw new Error(`来源共享公式 #${id} 未在使用之前完成`);
      const record = records.get(id);
      if (!record || (record.request.kind !== "artifact-scalar" && record.request.kind !== "character-modifier" && record.request.kind !== "character-scalar") || record.request.componentIds.length) throw new Error(`来源 modifier 缺少共享数值公式 #${id}`);
      if (ref.creationIds?.includes(id) && record.request.kind !== "character-modifier" && record.request.kind !== "character-scalar") throw new Error(`创建公式 #${id} 类型不是角色 modifier`);
      if (record.request.kind === "character-scalar") {
        const input = record.request.input;
        if (!isSourceHostCharacterScalarRuleId(input.ruleId)) throw new Error(`角色标量规则 ${input.ruleId} 未在固定来源登记`);
        const descriptor = sourceHostCharacterScalarRuleDescriptor(input.ruleId);
        const creation = input.phase === "creation";
        const markedCreation = ref.creationIds?.includes(id) ?? false;
        if (ref.kind !== "scalar" || ref.artifactResistance || input.modifierKey !== descriptor.modifierKey || ref.key !== descriptor.modifierKey ||
          ref.scalarKind !== descriptor.kind || input.phase !== descriptor.phase || creation !== markedCreation ||
          (creation ? record.request.frame > ref.frame || record.request.actorIndex !== input.sourceHolderIndex || record.request.targetKey !== 0
            : record.request.frame !== ref.frame || record.request.actorIndex !== (ref.actorIndex ?? input.sourceHolderIndex) ||
              record.request.targetKey !== (ref.targetKey ?? 0)) ||
          !(descriptor.sourceCommits as readonly string[]).includes(record.request.sourceCommit ?? SOURCE_HOST_COMMIT) ||
          (record.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT)) {
          throw new Error(`角色标量公式 #${id} 与原 Amount、实际 getter 消费者或创建阶段不匹配`);
        }
        const computed = resolveSourceHostCharacterScalarInput(input, record.request.sourceCommit ?? SOURCE_HOST_COMMIT, `characterScalar.${id}`);
        close(record.value, computed.value, `character-scalar #${id}`);
        scalarSum += record.value;
        link(`${ref.readId}/${ref.index}/scalar`, `characterScalar.${id}.${input.ruleId}`);
        continue;
      }
      if (record.request.kind === "character-modifier") {
        const input = record.request.input;
        if (!isSourceHostCharacterModifierRuleId(input.ruleId)) throw new Error(`角色 modifier 规则 ${input.ruleId} 未在固定来源登记`);
        const descriptor = sourceHostCharacterModifierRuleDescriptor(input.ruleId);
        const creation = "phase" in input && input.phase === "creation";
        const markedCreation = ref.creationIds?.includes(id) ?? false;
        const consumerSlots = isSourceHostCharacterModifierDynamicRuleId(input.ruleId)
          ? sourceHostCharacterModifierDynamicRuleDescriptor(input.ruleId).consumerSlots : undefined;
        const consumedStatIndex = consumerSlots === undefined
          ? ref.key === descriptor.modifierKey ? descriptor.statIndex : undefined
          : Object.prototype.hasOwnProperty.call(consumerSlots, ref.key) ? consumerSlots[ref.key] : undefined;
        if (ref.kind !== "stat" || ref.artifactResistance || input.modifierKey !== descriptor.modifierKey ||
          consumedStatIndex === undefined || (consumerSlots !== undefined && !creation) ||
          creation !== markedCreation ||
          (creation ? record.request.frame > ref.frame || record.request.actorIndex !== input.sourceHolderIndex || record.request.targetKey !== 0
            : record.request.frame !== ref.frame || record.request.actorIndex !== ref.actorIndex ||
              (ref.targetKey !== undefined && record.request.targetKey !== ref.targetKey)) ||
          (ref.effectSourceActorIndex !== undefined && input.sourceHolderIndex !== ref.effectSourceActorIndex) ||
          !(descriptor.sourceCommits as readonly string[]).includes(record.request.sourceCommit ?? SOURCE_HOST_COMMIT)) {
          throw new Error(`角色 modifier 公式 #${id} 与原 Amount 槽位、来源持有者或受益者读取不匹配`);
        }
        if ((record.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT)) throw new Error(`角色 modifier 公式 #${id} 的固定源码与读取不一致`);
        const computed = resolveSourceHostCharacterModifierInput(input, record.request.sourceCommit ?? SOURCE_HOST_COMMIT, `characterModifier.${id}`);
        close(record.value, computed.value, `character-modifier #${id}`);
        // C2 is a creation-time stored vector, scoped by Wanderer.Snapshot to
        // this attack's Burst tag. A matching scalar/slot alone cannot verify
        // a non-Q hit, another actor, or an inconsistent numeric/name tag pair.
        if (input.ruleId === "char-dyn-wanderer-c2"
          && (request.kind !== "damage" || request.actorKey !== descriptor.character || request.actorIndex !== input.sourceHolderIndex
            || ref.actorIndex !== input.sourceHolderIndex || request.attackTag !== 6
            || !sourceHostAttackTagMatches(request.attackTagName, "AttackTagElementalBurst"))) {
          throw new SourceHostWandererC2ScopeError(id, request.id);
        }
        sums.set(consumedStatIndex, (sums.get(consumedStatIndex) ?? 0) + record.value);
        link(`${ref.readId}/${ref.index}/${consumedStatIndex}`, `characterModifier.${id}.${input.ruleId}`);
        continue;
      }
      const ruleId = record.request.input.ruleId;
      const auxiliary = isSourceHostArtifactAuxiliaryRuleId(ruleId) ? sourceHostArtifactAuxiliaryDescriptor(ruleId) : undefined;
      const expectedKeys: readonly string[] = isSourceHostArtifactConstantRuleId(ruleId) ? sourceHostArtifactConstantModifierKeys(ruleId)
        : isSourceHostArtifactDynamicRuleId(ruleId) ? sourceHostArtifactDynamicModifierKeys(ruleId)
        : auxiliary ? auxiliary.modifierKeys : [modifierKeys[ruleId]!];
      if (!expectedKeys.includes(ref.key) && !(record.request.input.ruleId === "vg-4pc-stack" && /^vg-4pc-[1-5]-stack$/.test(ref.key))) throw new Error(`装备规则 ${record.request.input.ruleId} 与原 modifier ${ref.key} 不匹配`);
      if (auxiliary?.kind === "resistance") {
        const meta = ref.artifactResistance;
        if (ref.kind !== "scalar" || ref.scalarKind !== "resistance" || !meta ||
          record.request.frame !== meta.createdFrame || meta.createdFrame > ref.frame ||
          record.request.actorIndex !== meta.sourceHolderIndex || record.request.targetKey !== meta.targetKey || ref.targetKey !== meta.targetKey ||
          record.request.element !== meta.element || meta.element !== auxiliary.element || ref.readElement !== meta.element || ref.stepElement !== meta.element) {
          throw new Error(`减抗公式 #${id} 的创建帧、来源装备者、目标或元素与本次原生读取不匹配`);
        }
      } else if (record.request.frame !== ref.frame ||
        (ref.actorIndex !== undefined && auxiliary?.kind !== "shield-bonus" && record.request.actorIndex !== ref.actorIndex) || ref.artifactResistance) {
        throw new Error(`装备公式 #${id} 与原 getter 的帧或角色不匹配`);
      }
      if ((record.request.sourceCommit ?? request.sourceCommit) !== request.sourceCommit) throw new Error(`来源装备公式 #${id} 的固定源码与命中不一致`);
      const slot = sourceHostArtifactRuleStatIndex(record.request.input.ruleId);
      if (ref.kind === "scalar") {
        if (slot !== undefined || (auxiliary ? ref.scalarKind !== auxiliary.kind : ref.scalarKind !== "reaction-bonus")) throw new Error(`装备公式 #${id} 错接到不匹配的来源标量`);
        scalarSum += record.value;
        link(`${ref.readId}/${ref.index}/scalar`, `artifactScalar.${id}.${record.request.input.ruleId}`);
      } else {
        if (slot === undefined) throw new Error(`反应装备公式 #${id} 错接到属性向量`);
        sums.set(slot, (sums.get(slot) ?? 0) + record.value);
        link(`${ref.readId}/${ref.index}/${slot}`, `artifactScalar.${id}.${record.request.input.ruleId}`);
      }
    }
    if (ref.kind === "scalar") close(scalarSum, ref.returned as number, `${ref.readId}/${ref.index}/scalar`);
    else {
      const returned = ref.returned as number[];
      for (const slot of sums.keys()) if (slot >= returned.length) throw new Error(`来源 modifier 返回向量缺少共享公式槽位 ${slot}`);
      returned.forEach((value, slot) => close(sums.get(slot) ?? 0, value, `${ref.readId}/${ref.index}/stat[${slot}]`));
    }
  }
  return links;
}
