import { importPlayerInput, applyPreview, type ImportSnapshot } from '../../../packages/player-import/src/index';
import { preparePlayerEquipment } from './player-import-handoff';

export function mountPlayerImportPreview(root: HTMLElement, openCalculator: (input: ReturnType<typeof preparePlayerEquipment>['input'], metadata: ReturnType<typeof preparePlayerEquipment>['metadata']) => Promise<void>): void {
  root.innerHTML = `<details open><summary>玩家配装预览 → 单技能计算</summary><p>本地解析 GOOD / Enka JSON / 配装纯文本。仅采用装备推导，不叠加导出最终面板；装备条件效果关闭。未知机制仍由计算器提示。这里不提供账号登录。</p><label>本地配装文件<input data-player-file type="file" accept=".json,.txt,application/json,text/plain"></label><label>或粘贴配装文本<textarea data-player-input rows="5"></textarea></label><label><input data-player-fixture type="checkbox">这是合成测试数据</label><button data-player-preview>预览导入</button><button data-player-restore hidden>返回上次完整预览</button><p data-player-status role="status" aria-live="polite"></p><div data-player-builds></div></details>`;
  const text = root.querySelector<HTMLTextAreaElement>('[data-player-input]')!;
  const status = root.querySelector<HTMLElement>('[data-player-status]')!;
  const list = root.querySelector<HTMLElement>('[data-player-builds]')!;
  const restore = root.querySelector<HTMLButtonElement>('[data-player-restore]')!;
  let accepted: ImportSnapshot | null = null;
  let busy = false;
  let revision = 0;
  function render(snapshot: ImportSnapshot, allowed: boolean) {
    list.replaceChildren();
    const source = document.createElement('p');
    source.dataset.playerSource = '';
    source.textContent = `来源 ${snapshot.source.kind} · ${snapshot.source.scope} · ${snapshot.source.importedAt} · ${snapshot.source.fixture ? '合成测试数据' : '用户提供；未验证账号'}。快照时间未知；不包含背包或历史配装。`;
    list.append(source);
    for (const build of snapshot.builds) {
      const box = document.createElement('section'), title = document.createElement('h3'), detail = document.createElement('p'), button = document.createElement('button');
      title.textContent = build.identity.value?.name ?? '未知角色';
      button.textContent = '用此配装计算单技能';button.dataset.playerCalculate = build.key;
      let prepared: ReturnType<typeof preparePlayerEquipment> | null = null;
      try { prepared = preparePlayerEquipment(build, snapshot.source); detail.textContent = '装备路线可用；基础天赋与命座分开计算，最终面板不叠加。'; }
      catch (error) { detail.textContent = `暂不可计算：${error instanceof Error ? error.message : String(error)}`; }
      if (!allowed) detail.textContent += ' 本次预览不完整，未替换上次数据。';
      button.disabled = !allowed || !prepared;
      button.onclick = async () => {
        if (busy || !allowed || !prepared) return;
        busy = true;button.disabled = true;
        try { const checked = preparePlayerEquipment(build, snapshot.source);await openCalculator(checked.input, checked.metadata); }
        catch (error) { status.textContent = `计算未载入：${error instanceof Error ? error.message : String(error)}。预览保留，可修正后重试。`; }
        finally { busy = false;button.disabled = !allowed || !prepared; }
      };
      box.append(title, detail, button);list.append(box);
    }
  }
  function preview() {
    revision++;
    const result = importPlayerInput(text.value, { fixture: root.querySelector<HTMLInputElement>('[data-player-fixture]')!.checked });
    const applied = applyPreview(accepted, result);
    if (applied.applied) accepted = applied.current;
    status.textContent = applied.message;
    if (result.ok) render(result.snapshot, applied.applied);
    // A rejected parse never clears the last visible successful preview.
    restore.hidden = !accepted || applied.applied;
  }
  root.querySelector<HTMLButtonElement>('[data-player-preview]')!.onclick = preview;
  restore.onclick = () => { if (accepted) { render(accepted, true);restore.hidden = true;status.textContent = '已恢复上次完整预览；不是本次失败导入的结果。'; } };
  root.querySelector<HTMLInputElement>('[data-player-file]')!.onchange = async event => {
    const input = event.target as HTMLInputElement, file = input.files?.[0];input.value = '';if (!file) return;
    const request = ++revision;
    try { const content = await file.text();if (request !== revision) return;text.value = content;preview(); }
    catch { if (request === revision) status.textContent = '文件读取失败；原预览保留。'; }
  };
}
