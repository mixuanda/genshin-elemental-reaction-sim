import type { SimConfig, StaminaCost } from "@genshin-dps-lab/schemas";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderStaminaControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  const rows = [
    ...(config.timeline?.abilities ?? []).map((ability, index) => ({ kind: "ability", index, label: `${ability.actorId} · ${ability.name}`, cost: ability.staminaCost })),
    ...(config.timeline?.commands.flatMap((command, index) => command.type === "dash" || command.type === "jump" || command.type === "walk" ? [{ kind: "command", index, label: `${command.actorId} · 指令 ${index + 1} ${command.type}`, cost: command.staminaCost }] : []) ?? []),
  ];
  root.innerHTML = `<h3>共享耐力与行动消耗</h3><label><input id="team-stamina-enabled" type="checkbox"${config.staminaModel ? " checked" : ""}${config.timeline ? "" : " disabled"}>启用固定来源耐力模型</label><p>全队共享240上限的耐力池，切人不补满。按固定来源，每次实际扣除后超过90帧才开始以25/秒恢复；当前只支持合法帧时间线。未启用时保留原情景行为。</p><label>初始共享耐力<input id="team-stamina-initial" type="number" min="0" max="240" step="any" required value="${config.staminaModel?.initialStamina ?? 240}"></label><details open><summary>逐行动明确消耗与扣除时刻</summary><p>启用时须明确填写每个能力及闪避／跳跃／行走指令；不消耗也应填0，不从名称猜数值。延迟是相对实际行动起手的帧数，输入时检查资格，在指定帧实际扣除。固定来源声明只读；自定义值不等于已核验的角色动作。</p><div class="table-wrap"><table><thead><tr><th>行动</th><th>耐力消耗</th><th>延迟扣除帧</th><th>零费用仍调用扣除</th></tr></thead><tbody>${rows.map(row => {
    const locked = row.cost?.source.kind === "source";
    return `<tr data-stamina-kind="${row.kind}" data-stamina-index="${row.index}"><td>${esc(row.label)}<small>${locked ? "固定来源声明" : "用户明确输入"}</small></td><td><input data-stamina-amount type="number" min="0" max="240" step="any" required value="${row.cost?.amount ?? ""}"${locked ? " readonly" : ""}></td><td><input data-stamina-consume-frame type="number" min="0" step="1" required value="${row.cost?.consumeFrame ?? ""}"${locked ? " readonly" : ""}></td><td><input data-stamina-zero-use type="checkbox"${row.cost?.consumeWhenZero ? " checked" : ""}${locked ? " disabled" : ""}></td></tr>`;
  }).join("")}</tbody></table></div><p>明确的零费用扣除回调也会重新开始恢复延迟；普通“无消耗”不重置。此区别用于已知来源条件，不能按重击等名字自动推定。体力减免、冲刺连用限制和角色特殊资源尚不由该开关自动生成。</p></details><p>严格模式会报告耐力不足的行动失败；等待模式延后到实际恢复足够。此状态不会被能量满起步选项替换。更改随「保存队伍配置」保存；关闭模型会一并移除行动费用声明，再次启用时需重新填写。</p>`;
  return { apply(next) {
    if (!root.querySelector<HTMLInputElement>("#team-stamina-enabled")!.checked) {
      delete next.staminaModel;
      for (const action of next.rotation) delete action.staminaCost;
      for (const ability of next.timeline?.abilities ?? []) delete ability.staminaCost;
      for (const command of next.timeline?.commands ?? []) {
        if (command.type === "dash" || command.type === "jump" || command.type === "walk") delete command.staminaCost;
      }
      return;
    }
    const initial = root.querySelector<HTMLInputElement>("#team-stamina-initial")!;
    if (!initial.checkValidity()) throw new Error("初始耐力须为0至240之间的明确数值。");
    if (!next.timeline) throw new Error("耐力执行需要合法帧时间线。");
    for (const row of root.querySelectorAll<HTMLElement>("[data-stamina-kind]")) {
      const amount = row.querySelector<HTMLInputElement>("[data-stamina-amount]")!, delay = row.querySelector<HTMLInputElement>("[data-stamina-consume-frame]")!;
      if (!amount.checkValidity() || !delay.checkValidity()) throw new Error("请逐行动明确填写消耗和非负整数扣除帧；未知不会当成零。");
      const index = Number(row.dataset.staminaIndex);
      const original = rows.find(entry => entry.kind === row.dataset.staminaKind && entry.index === index)!.cost;
      const cost: StaminaCost = original?.source.kind === "source" ? structuredClone(original) : {
        amount: amount.valueAsNumber, consumeFrame: delay.valueAsNumber,
        consumeWhenZero: row.querySelector<HTMLInputElement>("[data-stamina-zero-use]")!.checked,
        source: { kind: "custom", note: "用户在队伍页明确提供的行动耐力与扣除时刻；未自动核验角色动作来源。" },
      };
      if (row.dataset.staminaKind === "ability") next.timeline.abilities[index]!.staminaCost = cost;
      else {
        const command = next.timeline.commands[index]!;
        if (command.type === "dash" || command.type === "jump" || command.type === "walk") command.staminaCost = cost;
      }
    }
    next.staminaModel = { mode: "shared-stamina-v1", profileId: "gcsim-b4ae769-stamina-v1", initialStamina: initial.valueAsNumber };
  } };
}
