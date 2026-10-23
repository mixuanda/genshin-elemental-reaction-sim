import type { CatalogResolvedShowcaseCharacter } from '@genshin-dps-lab/schemas';
import { mountPlayerImportPreview } from './player-import-preview';
import type { ManualEffectiveTalents } from './player-import-manual-talents';
import { resolveCalculatorBuildTrace } from "@genshin-dps-lab/sim-core";
import { renderTraceHtml } from "./calculator-trace-view";
import { gameDataCatalog } from '@genshin-dps-lab/game-data/catalog';
import { getCharacterBuildPreset, characterBuildPresetCoverage, type CharacterBuildPresetTier } from '../../../packages/game-data/src/character-build-presets';
import { resolveEquipmentBuild, type EquipmentBuildInput } from '@genshin-dps-lab/game-data/equipment-build';
import { mountEquipmentControls } from './equipment-controls';
import { downloadSourceHostJson } from './source-host-calculator';
import { compileSourceTeamDraft, equipmentBuildToSourceTeamMember, loadSourceTeamInventory, type SourceHostVariant } from './source-team-builder';
import { renderImportedRosterControls, type ImportedRosterEntry } from './imported-roster-controls';
import './build-workshop.css';

const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export interface BuildHandoffMetadata { constellation: number; baseTalentLevels: { auto: number; skill: number; burst: number }; label?: string; favoniusParticleDelayFrames?: number; noblesseSelfDelayFrames?: 0 | 1 }
interface SavedBuild { version: 'editable-build-v1'; name: string; input: EquipmentBuildInput; metadata: BuildHandoffMetadata }
interface WorkshopOptions {
  openImportedPanel(character: CatalogResolvedShowcaseCharacter, source: string, manualEffectiveTalents?: ManualEffectiveTalents): Promise<void>;
  openCalculator(input: EquipmentBuildInput, metadata: BuildHandoffMetadata): Promise<void>;
  addToTeam(input: EquipmentBuildInput, metadata: BuildHandoffMetadata, source: { hostVariant: SourceHostVariant; characterKey: string }): Promise<void>;
  addRosterToTeam(entries: ImportedRosterEntry[], source: { hostVariant: SourceHostVariant; revision: string }, mode: 'merge' | 'replace'): Promise<void>;
  getLocalTeamActors(): Array<{ id: string; name: string }>;
  applyToLocalTeam(actorId: string, input: EquipmentBuildInput, metadata: BuildHandoffMetadata): Promise<void>;
}
const storageKey = 'gidps:editable-builds:v1';
let selectedCharacter = gameDataCatalog.characters.find(c => c.slug === 'amber')!.id;
let selectedTier: CharacterBuildPresetTier = 'starter';

export function focusBuildImport(root: HTMLElement, target: 'uid' | 'file'): void {
  const input = root.querySelector<HTMLInputElement>(target === 'uid' ? '#build-uid' : '[data-player-file]');
  if (!input) return;
  for (let section = input.closest('details'); section; section = section.parentElement?.closest('details') ?? null) section.open = true;
  input.focus({ preventScroll: true });
  input.scrollIntoView({ block: 'center' });
}

export function renderBuildWorkshop(root: HTMLElement, options: WorkshopOptions): void {
  let saved: SavedBuild[] = [];
  try { const raw = localStorage.getItem(storageKey); if (raw) saved = JSON.parse(raw); } catch { /* Saved builds are optional; an unreadable local draft does not prevent editing. */ }
  root.innerHTML = `<article class="card build-workshop"><div class="eyebrow">BUILD LIBRARY</div><h2>角色配装预设</h2><p>先选角色和投入档位，再按你的武器、圣遗物与天赋调整。可以直接计算一个技能，也可以加入队伍。</p><div class="workspace-fields"><label>查找角色<input id="build-search" type="search" placeholder="角色名字"></label><label>角色<select id="build-character"></select></label><label>配装档位<select id="build-tier"><option value="starter">基础投入档</option><option value="developed">进阶投入档</option></select></label></div><p id="build-count"></p><p id="build-preset-note"></p><details><summary>预设的选择依据与范围</summary><div id="build-assumptions"></div></details><div class="workspace-fields"><label>配装名称<input id="build-name"></label><label>命座<input id="build-constellation" type="number" min="0" max="6" step="1"></label><label>普攻基础天赋<input id="build-talent-auto" type="number" min="1" max="10" step="1"></label><label>E 基础天赋<input id="build-talent-skill" type="number" min="1" max="10" step="1"></label><label>Q 基础天赋<input id="build-talent-burst" type="number" min="1" max="10" step="1"></label></div><p class="calculator-hint">这里填写未加命座的基础天赋。预设是可编辑的假设构筑，不是最优配装排名；具体冷却、动画与能量由实际技能执行决定。</p><fieldset id="build-equipment"></fieldset><div id="build-panel-summary" role="status"></div><div class="editor-actions"><button id="build-open-calculator" class="primary">计算此角色的技能</button><label>来源规则<select id="build-source-host"><option value="classic">普通／月曜 · b4</option><option value="stellar">星辉 · a7</option></select></label><label>来源角色形态<select id="build-source-form" disabled><option value="">正在读取来源配置…</option></select></label><button id="build-add-team">加入来源队伍</button><label>本地队伍角色<select id="build-local-team-actor"><option value="">请选择队伍中的角色</option></select></label><button id="build-apply-local-team">应用装备到本地队伍</button><label id="build-favonius-delay-field" hidden>西风微粒到达延迟（帧，若装备西风必填）<input id="build-favonius-delay" type="number" min="0" step="1" placeholder="按来源或实测填写"></label><label id="build-noblesse-delay-field" hidden>宗室自身增益取样分支（若装备宗室四件套必选）<select id="build-noblesse-delay"><option value="">请选择</option><option value="0">自身立即生效 · 0 帧</option><option value="1">自身延迟 · 1 帧</option></select></label><button id="build-save">保存为我的预设</button><button id="build-export">导出配装</button></div><p class="calculator-hint">本地队伍仅应用装备与基础面板；角色天赋、命座和动作仍由该队伍已有的来源能力管理。已实现的装备时序会自动接入，未能精确映射的条款会逐项显示。</p><p id="build-source-status" role="status" aria-live="polite"></p><p id="build-status" role="status" aria-live="polite"></p><details open><summary>我的预设与真实游戏配装</summary><div class="workspace-fields"><label>我的本地预设<select id="build-saved"></select></label><button id="build-load">载入所选预设</button><button id="build-delete">删除所选预设</button><label class="file-button">导入 GOOD / 配装 JSON<input id="build-import" type="file" accept="application/json,.json"></label></div><p>支持 Genshin Optimizer 的 GOOD 装备导出和本页配装文件。文件在浏览器本地读取；武器和圣遗物仍可继续编辑。GOOD 没有保存的阵容、增益状态不会自动补入。</p><div class="workspace-fields"><label>游戏 UID<input id="build-uid" inputmode="numeric" placeholder="9–10 位公开展示柜 UID"></label><button id="build-fetch">读取公开展示柜</button></div><div id="build-import-list"></div><p id="build-import-status" role="status"></p></details></article>`;
  const playerImportHost = document.createElement('section');
  playerImportHost.dataset.playerImport = '';
  root.prepend(playerImportHost);
  mountPlayerImportPreview(playerImportHost, options.openCalculator, options.openImportedPanel);
  const importEntry = document.createElement('section');
  importEntry.className = 'card';
  importEntry.dataset.buildImportEntry = '';
  importEntry.style.marginBottom = '16px';
  importEntry.innerHTML = '<h2>导入我的角色 / 配装</h2><p>UID 只读取 Enka 公开展示柜；本地文件支持 GOOD / 配装 JSON / 配装文本。</p><div class="editor-actions"><button type="button" data-build-import-target="uid">用 UID 读取公开展柜</button><button type="button" data-build-import-target="file">导入本地配装文件</button></div>';
  root.prepend(importEntry);
  importEntry.querySelectorAll<HTMLButtonElement>('[data-build-import-target]').forEach(button => {
    button.onclick = () => focusBuildImport(root, button.dataset.buildImportTarget as 'uid' | 'file');
  });
  const query = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const status = (message: string) => { query('#build-status').textContent = message; };
  const field = (selector: string) => query<HTMLInputElement>(selector);
  const select = query<HTMLSelectElement>('#build-character');
  const tier = query<HTMLSelectElement>('#build-tier'); tier.value = selectedTier;
  const sourceHost = query<HTMLSelectElement>('#build-source-host');
  const sourceForm = query<HTMLSelectElement>('#build-source-form');
  const localActor = query<HTMLSelectElement>('#build-local-team-actor');
  localActor.innerHTML = '<option value="">请选择队伍中的角色</option>' + options.getLocalTeamActors().map(actor => `<option value="${esc(actor.id)}">${esc(actor.name)} · ${esc(actor.id)}</option>`).join('');
  const addTeamButton = query<HTMLButtonElement>('#build-add-team');
  let sourceInventoryEpoch = 0;
  let selectedSourceCharacterKey = '';
  async function refreshSourceForms(): Promise<void> {
    const epoch = ++sourceInventoryEpoch;
    const hostVariant = sourceHost.value as SourceHostVariant;
    const character = gameDataCatalog.characters.find(entry => entry.id === selectedCharacter);
    selectedSourceCharacterKey = '';
    addTeamButton.disabled = true;
    sourceForm.disabled = true;
    sourceForm.innerHTML = '<option value="">正在读取来源配置…</option>';
    query('#build-source-status').textContent = '正在读取所选来源规则中的角色形态…';
    if (!character) {
      sourceForm.innerHTML = '<option value="">角色目录身份不可用</option>';
      query('#build-source-status').textContent = '无法确定当前角色的来源身份。';
      return;
    }
    try {
      const inventory = await loadSourceTeamInventory(hostVariant);
      if (epoch !== sourceInventoryEpoch || selectedCharacter !== character.id || sourceHost.value !== hostVariant) return;
      const forms = inventory.characters.filter(item => item.sourceGameId === character.avatarId);
      if (!forms.length) {
        sourceForm.innerHTML = '<option value="">此来源规则没有匹配的角色形态</option>';
        query('#build-source-status').textContent = `此来源规则暂不提供${character.name}。可以切换另一个来源，或继续使用独立技能计算器。`;
        return;
      }
      sourceForm.innerHTML = forms.map(item => `<option value="${esc(item.key)}">${esc(item.name)} · ${esc(item.key)}</option>`).join('');
      if (forms.length === 1) {
        selectedSourceCharacterKey = forms[0]!.key;
        sourceForm.value = selectedSourceCharacterKey;
        addTeamButton.disabled = false;
        query('#build-source-status').textContent = `已按精确来源身份选择 ${forms[0]!.name}（${forms[0]!.key}）。`;
      } else {
        sourceForm.insertAdjacentHTML('afterbegin', '<option value="" selected>请选择明确的来源角色形态</option>');
        sourceForm.value = '';
        query('#build-source-status').textContent = `${character.name} 在该来源规则中有 ${forms.length} 个精确匹配形态，请明确选择。`;
      }
      sourceForm.disabled = false;
    } catch (error) {
      if (epoch !== sourceInventoryEpoch) return;
      sourceForm.innerHTML = '<option value="">来源角色形态不可用</option>';
      query('#build-source-status').textContent = `无法载入所选来源规则的角色形态：${error instanceof Error ? error.message : String(error)}`;
    }
  }
  sourceHost.onchange = () => { void refreshSourceForms(); };
  sourceForm.onchange = () => { selectedSourceCharacterKey = sourceForm.value; addTeamButton.disabled = !selectedSourceCharacterKey; };
  function showCharacters(): void {
    const search = field('#build-search').value.trim().toLowerCase();
    const characters = gameDataCatalog.characters.filter(c => c.name.toLowerCase().includes(search) || c.slug.includes(search) || c.id === selectedCharacter);
    select.innerHTML = characters.map(c => `<option value="${esc(c.id)}"${c.id === selectedCharacter ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
    query('#build-count').textContent = `已发布目录 ${gameDataCatalog.characters.length} 个角色身份：${characterBuildPresetCoverage.roleSpecific.length} 个有角色专属来源模板，${characterBuildPresetCoverage.partial.length} 个仅有部分输入，${characterBuildPresetCoverage.generic.length} 个为通用占位。只有标为“角色专属来源模板”的档位才按角色建议维护。`;
  }
  const editor = mountEquipmentControls(query('#build-equipment'), { getCharacterId: () => selectedCharacter, applyLabel: '更新配装面板预览', onResolve: renderPanel });
  const favoniusWeaponIds = new Set(["weapon:11401", "weapon:12401", "weapon:13407", "weapon:14401", "weapon:15401"]);
  function refreshHandoffFieldVisibility(): void {
    const input = editor.getInput();
    const hasNoblesseFourPiece = (input.artifacts ?? []).filter(piece => piece.setId === "artifact-set:15007").length >= 4;
    query<HTMLElement>("#build-favonius-delay-field").hidden = !favoniusWeaponIds.has(input.weaponId);
    query<HTMLElement>("#build-noblesse-delay-field").hidden = !hasNoblesseFourPiece;
  }
  query("#build-equipment").addEventListener("change", refreshHandoffFieldVisibility);
  function renderPanel(resolution: ReturnType<typeof resolveEquipmentBuild>): void {
    const {stats:b,trace} = resolveCalculatorBuildTrace(resolution.build);
    query('#build-panel-summary').innerHTML = `<h3>当前基础配装面板</h3><dl class="build-stat-grid">${Object.entries({ '生命': b.hp, '攻击': b.atk, '防御':b.def, '精通':b.em, '暴击率 %':b.critRate*100, '暴击伤害 %':b.critDamage*100, '充能效率 %':(b.energyRecharge ?? 1)*100 }).map(([name,value])=>`<div><dt>${name}</dt><dd>${value.toFixed(2)}</dd></div>`).join('')}</dl><p>角色与装备基础值由同一配装核心查表推导。命中效果与角色天赋在技能计算中按条件执行。</p><details><summary>查看每步面板公式与数值代入</summary>${renderTraceHtml(trace)}</details>${resolution.effectBlockers.length ? `<p>${esc(resolution.effectBlockers.join('；'))}</p>` : ''}`;
  }
  function setMeta(meta: Partial<BuildHandoffMetadata> & { name?: string }): void {
    field('#build-name').value = meta.name ?? meta.label ?? '';
    field('#build-favonius-delay').value = meta.favoniusParticleDelayFrames === undefined ? '' : String(meta.favoniusParticleDelayFrames);
    query<HTMLSelectElement>('#build-noblesse-delay').value = meta.noblesseSelfDelayFrames === undefined ? '' : String(meta.noblesseSelfDelayFrames);
    field('#build-constellation').value = meta.constellation === undefined ? '' : String(meta.constellation);
    for (const key of ['auto','skill','burst'] as const) field(`#build-talent-${key}`).value = meta.baseTalentLevels?.[key] === undefined ? '' : String(meta.baseTalentLevels[key]);
  }
  function readMeta(): BuildHandoffMetadata {
    const integer = (selector: string, min: number, max: number) => { const input=field(selector), value=Number(input.value); if (!input.value.trim() || !Number.isInteger(value) || value<min || value>max) throw new Error(`${input.parentElement?.textContent}需要填写 ${min}–${max} 的整数。`); return value; };
    const delayText = field('#build-favonius-delay').value.trim();
    const favoniusParticleDelayFrames = delayText === '' ? undefined : Number(delayText);
    if (favoniusParticleDelayFrames !== undefined && (!Number.isInteger(favoniusParticleDelayFrames) || favoniusParticleDelayFrames < 0)) throw new Error('西风微粒到达延迟须为非负整数帧。');
    const noblesseText = query<HTMLSelectElement>('#build-noblesse-delay').value;
    const noblesseSelfDelayFrames = noblesseText === '' ? undefined : Number(noblesseText) as 0 | 1;
    return { ...(favoniusParticleDelayFrames === undefined ? {} : {favoniusParticleDelayFrames}), ...(noblesseSelfDelayFrames === undefined ? {} : {noblesseSelfDelayFrames}), label: field('#build-name').value.trim(), constellation: integer('#build-constellation',0,6), baseTalentLevels:{ auto:integer('#build-talent-auto',1,10), skill:integer('#build-talent-skill',1,10), burst:integer('#build-talent-burst',1,10) } };
  }
  function loadPreset(): void {
    const preset = getCharacterBuildPreset(selectedCharacter, selectedTier)!;
    const options = tier.options;
    options[0]!.textContent = preset.coverage === 'role-specific' ? '小毕业 · 角色来源模板' : '基础投入 · 通用占位';
    options[1]!.textContent = preset.coverage === 'role-specific' ? '大毕业 · 角色来源模板' : '进阶投入 · 通用占位';
    showCharacters(); editor.setInput(preset.build);
    refreshHandoffFieldVisibility();
    setMeta({name:`${preset.characterName} · ${preset.label}`,constellation:preset.constellation,baseTalentLevels:{auto:preset.talentLevels.normal,skill:preset.talentLevels.skill,burst:preset.talentLevels.burst}});
    query('#build-preset-note').textContent=`${preset.label}${preset.roleLabel ? ` · ${preset.roleLabel}` : ''}：${preset.mainStatRationale}`;
    query('#build-assumptions').innerHTML=`<p>${esc(preset.sourceNote)}</p><ul>${preset.assumptions.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`;
    try { renderPanel(resolveEquipmentBuild(editor.getInput())); status(preset.blocked.join('；') || '已载入参考配装，所有武器与圣遗物均可修改。'); } catch(error) { status(String(error)); }
    void refreshSourceForms();
  }
  function loadSaved(entry: SavedBuild): void {
    if (entry.version !== 'editable-build-v1' || !gameDataCatalog.characters.some(c=>c.id===entry.input.characterId)) throw new Error('配装文件版本或角色身份无法识别。');
    const resolution=resolveEquipmentBuild(entry.input);
    selectedCharacter=entry.input.characterId; field('#build-search').value=''; showCharacters(); editor.setInput(entry.input); refreshHandoffFieldVisibility(); setMeta({...entry.metadata,name:entry.name}); renderPanel(resolution); void refreshSourceForms();
    query('#build-preset-note').textContent='当前为你的可编辑配装。'; query('#build-assumptions').textContent='本配装保留导入或保存时的输入。'; status('已载入配装。');
  }
  function snapshot(): SavedBuild { const input=editor.getInput(); resolveEquipmentBuild(input); return {version:'editable-build-v1',name:field('#build-name').value.trim() || '我的配装', input,metadata:readMeta()}; }
  function showSaved(): void { query<HTMLSelectElement>('#build-saved').innerHTML=saved.length ? saved.map((e,i)=>`<option value="${i}">${esc(e.name)}</option>`).join('') : '<option value="">尚无本地预设</option>'; }
  const action=(selector:string, fn:()=>void|Promise<void>)=>{ query<HTMLButtonElement>(selector).onclick=()=>{ void Promise.resolve().then(fn).catch(error=>status(error instanceof Error ? error.message : String(error))); }; };
  field('#build-search').oninput=showCharacters;
  select.onchange=()=>{selectedCharacter=select.value; loadPreset();}; tier.onchange=()=>{selectedTier=tier.value as CharacterBuildPresetTier; loadPreset();};
  action('#build-open-calculator',async()=>{const e=snapshot(); await options.openCalculator(e.input,e.metadata);});
  action('#build-add-team',async()=>{const e=snapshot(); if(!selectedSourceCharacterKey) throw new Error('请先选择一个明确且可用的来源角色形态。'); await options.addToTeam(e.input,e.metadata,{hostVariant:sourceHost.value as SourceHostVariant,characterKey:selectedSourceCharacterKey});});
  action('#build-apply-local-team',async()=>{const e=snapshot(); if(!localActor.value) throw new Error('请明确选择本地队伍中的角色。'); await options.applyToLocalTeam(localActor.value,e.input,e.metadata);});
  action('#build-save',()=>{const entry=snapshot(), index=saved.findIndex(e=>e.name===entry.name && e.input.characterId===entry.input.characterId); if(index<0)saved.push(entry); else saved[index]=entry; localStorage.setItem(storageKey,JSON.stringify(saved)); showSaved(); status('已保存到此浏览器，可随时载入或导出。');});
  action('#build-export',()=>downloadSourceHostJson(snapshot(),'editable-build.json'));
  action('#build-load',()=>{const value=query<HTMLSelectElement>('#build-saved').value;if(value==='')return;loadSaved(saved[Number(value)]!);});
  action('#build-delete',()=>{const value=query<HTMLSelectElement>('#build-saved').value;if(value==='')return;saved.splice(Number(value),1);localStorage.setItem(storageKey,JSON.stringify(saved));showSaved();status('已删除所选本地预设。');});
  // External formats are normalized by the same import module before reaching this editor.
  async function showImported(raw: unknown, format:'good'|'enka', uid = '', fetchedAt?: string):Promise<void> {
    const { parseGoodBuilds, parseEnkaBuilds } = await import('../../../packages/game-data/src/build-import');
    const batch = format==='good' ? parseGoodBuilds(raw) : parseEnkaBuilds(raw, {uid, ...(fetchedAt ? {fetchedAt} : {})});
    const list=query('#build-import-list');
    list.replaceChildren();
    query('#build-import-status').textContent=batch.diagnostics.map(d => d.message).join('；');
    batch.builds.forEach(entry=>{
      const article=document.createElement('article');article.className='card';
      const title=document.createElement('h4');title.textContent=entry.name;
      const note=document.createElement('p');note.textContent=entry.diagnostics.map(d => d.message).join('；');
      const button=document.createElement('button');button.textContent='编辑这套真实配装';button.disabled=!entry.equipmentInput;
      button.onclick=()=>{try {const input=entry.equipmentInput!;selectedCharacter=input.characterId;field('#build-search').value='';showCharacters();editor.setInput(input);refreshHandoffFieldVisibility();field('#build-name').value=entry.name;field('#build-constellation').value=entry.constellation===null?'':String(entry.constellation);for(const key of ['auto','skill','burst'] as const)field(`#build-talent-${key}`).value=entry.baseTalentLevels[key]===null?'':String(entry.baseTalentLevels[key]);query('#build-preset-note').textContent=`已导入 ${entry.sourceKey}，保留实际词条。`;renderPanel(resolveEquipmentBuild(input));void refreshSourceForms();status('已载入真实配装；缺失的命座或基础天赋需补齐后再计算或加入队伍。');}catch(error){status(String(error));}};
      article.append(title,note,button);list.append(article);
    });
    const rosterHost = document.createElement('div');
    rosterHost.className = 'build-import-roster';
    list.append(rosterHost);
    renderImportedRosterControls({
      root: rosterHost,
      builds: batch.builds,
      loadInventory: loadSourceTeamInventory,
      convert: (input, metadata, inventory) => equipmentBuildToSourceTeamMember(input, {
        constellation: metadata.constellation,
        talents: { auto: metadata.baseTalentLevels.auto, skill: metadata.baseTalentLevels.skill, burst: metadata.baseTalentLevels.burst },
        characterKey: metadata.characterKey,
      }, inventory),
      validate: (members, inventory) => {
        compileSourceTeamDraft({ schemaVersion: 1, source: { hostVariant: inventory.hostVariant, revision: inventory.revision }, name: '导入队伍预检', members, actions: [], durationSeconds: 30, target: { level: 90, resistance: 0.1 } }, inventory);
      },
      addRoster: options.addRosterToTeam,
    });
  }
  field('#build-import').onchange=event=>{const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;void file.text().then(async text=>{const raw=JSON.parse(text);if(raw.version==='editable-build-v1')loadSaved(raw);else await showImported(raw,'good');}).catch(error=>status(`导入失败：${error}`));input.value='';};
  action('#build-fetch',async()=>{const uid=field('#build-uid').value.trim();if(!/^[1-9]\d{8,9}$/.test(uid))throw new Error('请填写 9–10 位 UID。');query('#build-import-status').textContent='正在读取公开展示柜…';const response=await fetch(`/api/showcase/${encodeURIComponent(uid)}`);if(!response.ok)throw new Error(`展示柜请求失败（${response.status}）`);const envelope = await response.json() as {data?:unknown;fetchedAt?:string;error?:string};if(envelope.data===undefined)throw new Error(envelope.error ?? '展示柜没有返回角色数据。');await showImported(envelope.data,'enka',uid,envelope.fetchedAt);});
  showCharacters(); showSaved(); loadPreset();
}
