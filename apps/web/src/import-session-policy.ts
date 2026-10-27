/** Memory-only capability, deliberately outside strict engine/JSON schemas.
 * Once an import enters the shared calculator/team/document workspace, cloning,
 * editing or schema parsing must not make its descendants persistable again.
 * Reload starts a fresh workspace. This module never reads or deletes storage.
 */
export function createImportSessionPolicy() {
  let importedWorkspace = false;
  return {
    markImportedWorkspace(): void { importedWorkspace = true; },
    isSessionOnly(): boolean { return importedWorkspace; },
    assertWorkspacePersistenceAllowed(): void {
      if (importedWorkspace) throw new Error('本次工作区包含玩家导入资料，仅供本次计算，不能保存或导出。请刷新页面后使用公共预设建立新的工作区；已有本地资料未删除。');
    },
  };
}
export const importSessionPolicy = createImportSessionPolicy();
export function assertBuildPersistenceAllowed(sessionOnly: boolean): void {
  if (sessionOnly) throw new Error('玩家导入配装仅供本次计算，不能保存或导出。可选择公共预设建立新的非导入配装。');
}
