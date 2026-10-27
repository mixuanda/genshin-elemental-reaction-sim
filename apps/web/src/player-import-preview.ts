import { importPlayerInput, applyPreview, type ImportSnapshot } from '../../../packages/player-import/src/index';
import { preparePlayerEquipment, preparePlayerPanel } from './player-import-handoff';
import { preparePlayerPanelWithManualTalents, type ManualEffectiveTalents } from './player-import-manual-talents';

export function mountPlayerImportPreview(root: HTMLElement, openCalculator: (input: ReturnType<typeof preparePlayerEquipment>['input'], metadata: ReturnType<typeof preparePlayerEquipment>['metadata']) => Promise<void>, openPanel: (character: ReturnType<typeof preparePlayerPanel>['character'], source: string, manualEffectiveTalents?: ManualEffectiveTalents) => Promise<void>): () => void {
  root.innerHTML = `<details open><summary>玩家配装预览 → 单技能计算</summary><p>本地解析 GOOD / Enka JSON / 配装纯文本。装备推导与 Enka 最终面板是互斥路线；不会重复叠加装备。公开展柜不能还原条件增益、附着或历史快照，所选技能仍需满足计算器条件。装备路线的条件效果关闭。未知机制仍由计算器提示。这里不提供账号登录。</p><label>本地配装文件<input data-player-file type="file" accept=".json,.txt,application/json,text/plain"></label><label>或粘贴配装文本<textarea data-player-input rows="5"></textarea></label><label><input data-player-fixture type="checkbox">这是合成测试数据</label><button data-player-preview>预览导入</button><button data-player-clear>清除本次导入</button><button data-player-restore hidden>返回上次完整预览</button><p data-player-status role="status" aria-live="polite"></p><div data-player-builds></div></details>`;
  const text = root.querySelector<HTMLTextAreaElement>('[data-player-input]')!;
  const status = root.querySelector<HTMLElement>('[data-player-status]')!;
  const list = root.querySelector<HTMLElement>('[data-player-builds]')!;
  const restore = root.querySelector<HTMLButtonElement>('[data-player-restore]')!;
  let accepted: ImportSnapshot | null = null;
  let acceptedRaw = '';
  let busy = false;
  let revision = 0;
  let disposed = false;
  function clearPreview(): void {
    revision++; accepted = null; acceptedRaw = ''; text.value = '';
    root.querySelector<HTMLInputElement>('[data-player-file]')!.value = '';
    list.replaceChildren(); restore.hidden = true;
    status.textContent = '本次导入预览已清除；已经交给计算器的资料仍仅限本次会话，刷新页面可清除整个工作区。';
  }
  root.querySelector<HTMLButtonElement>('[data-player-clear]')!.onclick = clearPreview;
  function render(snapshot: ImportSnapshot, allowed: boolean, raw: string) {
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
        try { const checked = preparePlayerEquipment(build, snapshot.source);await openCalculator(checked.input, checked.metadata);clearPreview(); }
        catch (error) { status.textContent = `计算未载入：${error instanceof Error ? error.message : String(error)}。预览保留，可修正后重试。`; }
        finally { busy = false;button.disabled = !allowed || !prepared; }
      };
      const panelButton = document.createElement('button'), panelNote = document.createElement('p');
      panelButton.textContent = '用最终面板计算单技能';panelButton.dataset.playerPanel = build.key;
      let panelReady = false;
      try { preparePlayerPanel(raw, build, snapshot.source);panelReady = true;panelNote.textContent = '最终面板独立可用；不要求装备路线完整。不自动还原条件增益；未提供的元素加成会阻断对应动作。'; }
      catch(error) { panelNote.textContent = `面板路线不可用：${error instanceof Error ? error.message : String(error)}`; }
      panelButton.disabled = !panelReady;
      panelButton.onclick = async () => {
        if (busy || !panelReady) return;
        busy = true;panelButton.disabled = true;
        try { const checked = preparePlayerPanel(raw, build, snapshot.source);await openPanel(checked.character, checked.source);clearPreview(); }
        catch(error) { status.textContent = `面板未载入：${error instanceof Error ? error.message : String(error)}。原预览保留。`; }
        finally { busy = false;panelButton.disabled = !panelReady; }
      };
      box.append(title, detail, button, panelNote, panelButton);
      if (!panelReady && (snapshot.source.kind === 'enka-json' || snapshot.source.kind === 'enka-uid')) {
        const manual = document.createElement('details'), summary = document.createElement('summary'), note = document.createElement('p');
        summary.textContent = '补充有效天赋等级后计算';
        note.textContent = '按游戏内显示填写，包含已有加级；这些数值记为手填，原始导入不变。';
        manual.append(summary, note);
        const fields = {} as Record<keyof ManualEffectiveTalents, HTMLInputElement>;
        for (const [key, labelText] of [['auto','普攻有效等级'],['skill','E有效等级'],['burst','Q有效等级']] as const) {
          const label = document.createElement('label'), field = document.createElement('input');
          label.textContent = labelText;field.type = 'number';field.min = '1';field.max = '15';field.step = '1';field.required = true;
          field.placeholder = '请明确填写';field.setAttribute(`data-player-talent-${key}`, build.key);label.append(field);manual.append(label);fields[key] = field;
        }
        const proceed = document.createElement('button');proceed.textContent = '用面板和手填天赋计算';proceed.dataset.playerManualPanel = build.key;proceed.disabled = true;
        const ready = () => Object.values(fields).every(field => field.value !== '' && field.checkValidity() && Number.isInteger(field.valueAsNumber));
        Object.values(fields).forEach(field => field.addEventListener('input', () => { proceed.disabled = busy || !ready(); }));
        proceed.onclick = async () => {
          if (busy || !ready()) return;
          busy = true;proceed.disabled = true;
          try {
            const checked = preparePlayerPanelWithManualTalents(raw, build, snapshot.source, { auto: fields.auto.valueAsNumber, skill: fields.skill.valueAsNumber, burst: fields.burst.valueAsNumber });
            await openPanel(checked.character, checked.source, checked.manualEffectiveTalents);clearPreview();
          } catch (error) { status.textContent = `面板未载入：${error instanceof Error ? error.message : String(error)}。原预览保留。`; }
          finally { busy = false;proceed.disabled = !ready(); }
        };
        manual.append(proceed);box.append(manual);
      }
      list.append(box);
    }
  }
  function preview() {
    if (disposed) return;
    revision++;
    const result = importPlayerInput(text.value, { fixture: root.querySelector<HTMLInputElement>('[data-player-fixture]')!.checked });
    const applied = applyPreview(accepted, result);
    if (applied.applied) { accepted = applied.current;acceptedRaw = text.value; }
    status.textContent = applied.message;
    if (result.ok) render(result.snapshot, applied.applied, text.value);
    // A rejected parse never clears the last visible successful preview.
    restore.hidden = !accepted || applied.applied;
    text.value = '';
  }
  root.querySelector<HTMLButtonElement>('[data-player-preview]')!.onclick = preview;
  restore.onclick = () => { if (accepted) { render(accepted, true, acceptedRaw);restore.hidden = true;status.textContent = '已恢复上次完整预览；不是本次失败导入的结果。'; } };
  root.querySelector<HTMLInputElement>('[data-player-file]')!.onchange = async event => {
    const input = event.target as HTMLInputElement, file = input.files?.[0];input.value = '';if (!file) return;
    const request = ++revision;
    try { const content = await file.text();if (disposed || request !== revision) return;text.value = content;preview(); }
    catch { if (request === revision) status.textContent = '文件读取失败；原预览保留。'; }
  };
  return () => { disposed = true; clearPreview(); };
}
