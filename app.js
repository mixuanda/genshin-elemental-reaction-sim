(() => {
  'use strict';

  const ELEMENT_LABELS = {
    pyro: '火', cryo: '冰', hydro: '水', electro: '雷', anemo: '风', geo: '岩', dendro: '草', physical: '物理'
  };
  const ELEMENT_COLORS = {
    pyro: '#ff8b72', cryo: '#8ed8ff', hydro: '#6fa8ff', electro: '#bd91ff', anemo: '#72e0c1', geo: '#e9bd68', dendro: '#9edc72', physical: '#b9c0cb'
  };
  const REACTION_LABELS = {
    none: '无', melt: '融化', reverseMelt: '反向融化', vaporize: '蒸发', reverseVaporize: '反向蒸发'
  };
  const AMP_BASE = { none: 1, melt: 2, reverseMelt: 1.5, vaporize: 2, reverseVaporize: 1.5 };
  const BUFF_STATS = ['atkFlat', 'atkPct', 'hpFlat', 'hpPct', 'defFlat', 'defPct', 'dmgBonus', 'critRate', 'critDmg', 'em', 'defIgnore', 'reactionBonus'];

  const durinMeltPreset = {
    meta: {
      name: '黑杜林融化 · C6R5 / C6R1 结构示例',
      version: '0.1.0-demo',
      note: '用于验证事件引擎、120秒零能量木桩与逐段展示。系数和回能为可编辑校准值，不是完整官方数据库。'
    },
    duration: 120,
    cycleLength: 21.5,
    enemy: { level: 110, resistance: 0.10, defReduction: 0 },
    characters: [
      {
        id: 'durin', name: '杜林', element: 'pyro', color: '#ff8b72', level: 90, energyMax: 70, initialEnergy: 0,
        stats: { baseAtk: 1035, atkPct: 1.05, flatAtk: 850, baseHp: 13000, hpPct: 0, flatHp: 0, baseDef: 780, defPct: 0, flatDef: 0, em: 190, critRate: 0.82, critDmg: 2.55, dmgBonus: 1.88, defIgnore: 0.70, reactionBonus: 0.70 }
      },
      {
        id: 'nicole', name: '尼可', element: 'pyro', color: '#ffbd80', level: 90, energyMax: 60, initialEnergy: 0,
        stats: { baseAtk: 1180, atkPct: 1.28, flatAtk: 920, baseHp: 12500, hpPct: 0, flatHp: 0, baseDef: 730, defPct: 0, flatDef: 0, em: 80, critRate: 0.70, critDmg: 1.85, dmgBonus: 1.05, defIgnore: 0, reactionBonus: 0 }
      },
      {
        id: 'lohen', name: '洛恩', element: 'cryo', color: '#8ed8ff', level: 90, energyMax: 60, initialEnergy: 0,
        stats: { baseAtk: 1010, atkPct: 1.12, flatAtk: 780, baseHp: 12800, hpPct: 0, flatHp: 0, baseDef: 760, defPct: 0, flatDef: 0, em: 120, critRate: 0.74, critDmg: 2.25, dmgBonus: 1.42, defIgnore: 0, reactionBonus: 0 }
      },
      {
        id: 'citlali', name: '茜特菈莉', element: 'cryo', color: '#b5cfff', level: 90, energyMax: 60, initialEnergy: 0,
        stats: { baseAtk: 670, atkPct: 0.35, flatAtk: 390, baseHp: 11500, hpPct: 0, flatHp: 0, baseDef: 720, defPct: 0, flatDef: 0, em: 980, critRate: 0.55, critDmg: 1.45, dmgBonus: 0.85, defIgnore: 0, reactionBonus: 0 }
      }
    ],
    rotation: [
      {
        id: 'passives', actorId: 'nicole', name: '队伍常驻被动', at: 0, once: true,
        buffs: [
          { key: 'nicole-c6-def-ignore', target: 'team', stat: 'defIgnore', value: 0.40, duration: 999, offset: 0 },
          { key: 'double-cryo', target: 'team', stat: 'critRate', value: 0.15, duration: 999, offset: 0 }
        ]
      },
      {
        id: 'nicole-e', actorId: 'nicole', name: '尼可 E', at: 0.15,
        hits: [{ offset: 0.15, label: 'E', scaling: 2.20, scalingStat: 'atk', element: 'pyro', reaction: 'none', snapshot: 'hit' }],
        buffs: [
          { key: 'nicole-e-atk', target: 'team', stat: 'atkFlat', value: 950, duration: 20, offset: 0.13 },
          { key: 'nicole-c2-atk', target: 'team', stat: 'atkFlat', value: 300, duration: 20, offset: 0.13 }
        ],
        debuffs: [{ key: 'nicole-c2-pyro-res', element: 'pyro', resShred: 0.25, duration: 20, offset: 0.13 }],
        energyGains: [
          { target: 'nicole', amount: 15, offset: 0.55 },
          { target: 'durin', amount: 12, offset: 0.55 },
          { target: 'citlali', amount: 4, offset: 0.55 },
          { target: 'lohen', amount: 4, offset: 0.55 }
        ]
      },
      {
        id: 'citlali-e', actorId: 'citlali', name: '茜特菈莉 E', at: 1.05,
        hits: [
          { offset: 0.35, label: 'E', scaling: 1.50, scalingStat: 'em', element: 'cryo', reaction: 'none', snapshot: 'action' },
          ...Array.from({ length: 8 }, (_, i) => ({ offset: 2.2 + i * 2.25, label: `后台冰 ${i + 1}`, scaling: 0.42, scalingStat: 'em', element: 'cryo', reaction: i % 4 === 0 ? 'reverseMelt' : 'none', snapshot: 'action' }))
        ],
        buffs: [
          { key: 'scroll-set', target: 'team', stat: 'dmgBonus', value: 0.40, duration: 20, offset: 0.25 },
          { key: 'ttds-durin', target: 'durin', stat: 'atkPct', value: 0.48, duration: 10, offset: 0.30 }
        ],
        debuffs: [{ key: 'citlali-pyro-res', element: 'pyro', resShred: 0.40, duration: 20, offset: 0.25 }],
        energyGains: [
          { target: 'citlali', amount: 18, offset: 0.8 },
          { target: 'durin', amount: 12, offset: 0.8 },
          { target: 'nicole', amount: 5, offset: 0.8 },
          { target: 'lohen', amount: 5, offset: 0.8 }
        ]
      },
      {
        id: 'durin-e', actorId: 'durin', name: '杜林 黑 E', at: 2.35,
        hits: [
          { offset: 0.53, label: '黑 E·1', scaling: 1.15, scalingStat: 'atk', element: 'pyro', reaction: 'melt', snapshot: 'hit' },
          { offset: 0.61, label: '黑 E·2', scaling: 1.15, scalingStat: 'atk', element: 'pyro', reaction: 'none', snapshot: 'hit' },
          { offset: 0.69, label: '黑 E·3', scaling: 1.15, scalingStat: 'atk', element: 'pyro', reaction: 'melt', snapshot: 'hit' }
        ],
        energyGains: [
          { target: 'durin', amount: 46, offset: 0.75 },
          { target: 'nicole', amount: 7, offset: 0.75 },
          { target: 'lohen', amount: 4, offset: 0.75 },
          { target: 'citlali', amount: 4, offset: 0.75 }
        ]
      },
      {
        id: 'nicole-q', actorId: 'nicole', name: '尼可 Q', at: 3.15, energyCost: 60,
        hits: [
          { offset: 1.80, label: 'Q 初始', scaling: 4.80, scalingStat: 'atk', element: 'pyro', reaction: 'melt', snapshot: 'hit' },
          { offset: 4.8, label: '投影 1', scaling: 3.40, scalingStat: 'atk', element: 'pyro', reaction: 'melt', snapshot: 'hit', creditId: 'durin', flatSources: [{ ownerId: 'nicole', stat: 'atk', multiplier: 0.70 }] },
          { offset: 7.8, label: '投影 2', scaling: 3.40, scalingStat: 'atk', element: 'pyro', reaction: 'melt', snapshot: 'hit', creditId: 'durin', flatSources: [{ ownerId: 'nicole', stat: 'atk', multiplier: 0.70 }] },
          { offset: 10.8, label: '投影 3', scaling: 3.40, scalingStat: 'atk', element: 'pyro', reaction: 'melt', snapshot: 'hit', creditId: 'durin', flatSources: [{ ownerId: 'nicole', stat: 'atk', multiplier: 0.70 }] },
          { offset: 13.8, label: '投影 4', scaling: 3.40, scalingStat: 'atk', element: 'pyro', reaction: 'melt', snapshot: 'hit', creditId: 'durin', flatSources: [{ ownerId: 'nicole', stat: 'atk', multiplier: 0.70 }] }
        ]
      },
      {
        id: 'durin-q', actorId: 'durin', name: '杜林 黑 Q', at: 3.55, energyCost: 70,
        hits: [
          { offset: 1.62, label: 'Q 初始·1', scaling: 1.85, scalingStat: 'atk', element: 'pyro', reaction: 'melt', snapshot: 'hit' },
          { offset: 2.02, label: 'Q 初始·2', scaling: 1.85, scalingStat: 'atk', element: 'pyro', reaction: 'none', snapshot: 'hit' },
          { offset: 2.57, label: 'Q 初始·3', scaling: 2.75, scalingStat: 'atk', element: 'pyro', reaction: 'melt', snapshot: 'hit' },
          ...Array.from({ length: 16 }, (_, i) => ({
            offset: 3.15 + i * 1.226,
            label: `黑龙持续 ${i + 1}`,
            scaling: 0.74,
            scalingStat: 'atk',
            element: 'pyro',
            reaction: i === 1 || i === 5 || i === 10 || i === 14 ? 'none' : 'melt',
            snapshot: 'hit',
            flatSources: [
              ...(i < 10 ? [{ ownerId: 'durin', stat: 'atk', multiplier: 1.50 }] : []),
              ...(i < 8 ? [{ ownerId: 'nicole', stat: 'atk', multiplier: 0.70 }] : [])
            ]
          }))
        ]
      },
      {
        id: 'lohen-field', actorId: 'lohen', name: '洛恩站场输出', at: 6.15,
        hits: Array.from({ length: 14 }, (_, i) => ({
          offset: 0.30 + i * 0.83,
          label: i % 3 === 2 ? `特殊战技 ${Math.floor(i / 3) + 1}` : `N1C ${i + 1}`,
          scaling: i % 3 === 2 ? 2.35 : 1.05,
          scalingStat: 'atk',
          element: 'cryo',
          reaction: i === 3 || i === 8 || i === 12 ? 'reverseMelt' : 'none',
          snapshot: 'hit',
          flatSources: i < 8 ? [{ ownerId: 'citlali', stat: 'em', multiplier: 0.32 }] : []
        })),
        energyGains: [
          { target: 'lohen', amount: 28, offset: 7.5 },
          { target: 'durin', amount: 8, offset: 7.5 },
          { target: 'nicole', amount: 22, offset: 7.5 },
          { target: 'citlali', amount: 14, offset: 7.5 }
        ]
      }
    ]
  };

  const blankPreset = {
    meta: { name: '空白四人队模板', version: '0.1.0', note: '用于从零编写角色与循环。' },
    duration: 120,
    cycleLength: 20,
    enemy: { level: 110, resistance: 0.10, defReduction: 0 },
    characters: [
      { id: 'a', name: '角色 A', element: 'pyro', color: '#ff8b72', level: 90, energyMax: 60, initialEnergy: 0, stats: { baseAtk: 900, atkPct: 1, flatAtk: 700, baseHp: 12000, hpPct: 0, flatHp: 0, baseDef: 700, defPct: 0, flatDef: 0, em: 100, critRate: 0.75, critDmg: 1.8, dmgBonus: 1.0, defIgnore: 0, reactionBonus: 0 } },
      { id: 'b', name: '角色 B', element: 'cryo', color: '#8ed8ff', level: 90, energyMax: 60, initialEnergy: 0, stats: { baseAtk: 850, atkPct: .8, flatAtk: 600, baseHp: 12000, hpPct: 0, flatHp: 0, baseDef: 700, defPct: 0, flatDef: 0, em: 100, critRate: 0.65, critDmg: 1.5, dmgBonus: .8, defIgnore: 0, reactionBonus: 0 } }
    ],
    rotation: [
      { id: 'a-hit', actorId: 'a', name: '角色 A 技能', at: 1, hits: [{ offset: .5, label: '命中 1', scaling: 3, scalingStat: 'atk', element: 'pyro', reaction: 'melt', snapshot: 'hit' }] }
    ]
  };

  const PRESETS = [durinMeltPreset, blankPreset];

  const $ = (id) => document.getElementById(id);
  const deepClone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const round = (v, digits = 2) => Number(v.toFixed(digits));
  const safeNum = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const fmt = (v, digits = 1) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(v || 0);
  const compact = (v) => {
    const n = v || 0;
    if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
    if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(2)}万`;
    return fmt(n, 0);
  };

  class MinHeap {
    constructor() { this.data = []; }
    compare(a, b) { return a.time - b.time || a.priority - b.priority || a.seq - b.seq; }
    push(item) {
      const a = this.data; a.push(item); let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (this.compare(a[p], item) <= 0) break; a[i] = a[p]; i = p; }
      a[i] = item;
    }
    pop() {
      const a = this.data;
      if (!a.length) return null;
      const root = a[0];
      const last = a.pop();
      if (a.length && last) {
        let i = 0;
        while (true) {
          const l = i * 2 + 1;
          const r = l + 1;
          if (l >= a.length) break;
          let child = l;
          if (r < a.length && this.compare(a[r], a[l]) < 0) child = r;
          if (this.compare(a[child], last) >= 0) break;
          a[i] = a[child];
          i = child;
        }
        a[i] = last;
      }
      return root;
    }
    get size() { return this.data.length; }
  }

  function normalizeConfig(raw) {
    const c = deepClone(raw);
    c.duration = clamp(safeNum(c.duration, 120), 1, 600);
    c.cycleLength = clamp(safeNum(c.cycleLength, 20), .1, 120);
    c.enemy = c.enemy || { level: 110, resistance: .1, defReduction: 0 };
    c.enemy.level = clamp(safeNum(c.enemy.level, 110), 1, 200);
    c.enemy.resistance = safeNum(c.enemy.resistance, .1);
    c.enemy.defReduction = safeNum(c.enemy.defReduction, 0);
    c.characters = Array.isArray(c.characters) ? c.characters : [];
    c.rotation = Array.isArray(c.rotation) ? c.rotation : [];
    c.characters.forEach((ch, i) => {
      ch.id = ch.id || `char-${i}`; ch.name = ch.name || ch.id; ch.element = ch.element || 'physical'; ch.color = ch.color || ELEMENT_COLORS[ch.element] || '#9aa4b2';
      ch.level = clamp(safeNum(ch.level, 90), 1, 100); ch.energyMax = Math.max(0, safeNum(ch.energyMax, 60)); ch.initialEnergy = clamp(safeNum(ch.initialEnergy, 0), 0, ch.energyMax);
      ch.stats = Object.assign({ baseAtk: 0, atkPct: 0, flatAtk: 0, baseHp: 0, hpPct: 0, flatHp: 0, baseDef: 0, defPct: 0, flatDef: 0, em: 0, critRate: .05, critDmg: .5, dmgBonus: 0, defIgnore: 0, reactionBonus: 0 }, ch.stats || {});
    });
    return c;
  }

  function reactionFactor(reaction, em, reactionBonus, explicitBase) {
    const base = explicitBase ?? AMP_BASE[reaction || 'none'] ?? 1;
    if (base === 1) return { base: 1, emBonus: 0, reactionBonus: 0, total: 1 };
    const emBonus = (2.78 * Math.max(0, em)) / (1400 + Math.max(0, em));
    const total = base * (1 + emBonus + Math.max(0, reactionBonus || 0));
    return { base, emBonus, reactionBonus: Math.max(0, reactionBonus || 0), total };
  }

  function resistanceFactor(res) {
    if (res < 0) return 1 - res / 2;
    if (res < .75) return 1 - res;
    return 1 / (4 * res + 1);
  }

  function totalStat(stats, stat) {
    if (stat === 'atk') return stats.baseAtk * (1 + stats.atkPct) + stats.flatAtk;
    if (stat === 'hp') return stats.baseHp * (1 + stats.hpPct) + stats.flatHp;
    if (stat === 'def') return stats.baseDef * (1 + stats.defPct) + stats.flatDef;
    if (stat === 'em') return stats.em;
    return totalStat(stats, 'atk');
  }

  function simulate(rawConfig, options = {}) {
    const config = normalizeConfig(rawConfig);
    const chars = new Map(config.characters.map(ch => [ch.id, ch]));
    const energies = new Map();
    const energyStats = new Map();
    config.characters.forEach(ch => {
      const initial = options.energyMode === 'zero' ? 0 : options.energyMode === 'full' ? ch.energyMax : ch.initialEnergy;
      energies.set(ch.id, initial);
      energyStats.set(ch.id, { initial, gained: 0, spent: 0, skipped: 0, final: initial });
    });

    const heap = new MinHeap();
    let seq = 0;
    const push = (time, priority, type, payload) => { if (time <= config.duration + 1e-9) heap.push({ time, priority, type, payload, seq: seq++ }); };
    const cycles = Math.ceil(config.duration / config.cycleLength);
    for (let cycle = 0; cycle < cycles; cycle++) {
      const base = cycle * config.cycleLength;
      for (const action of config.rotation) {
        if (action.once && cycle > 0) continue;
        if (Array.isArray(action.cycles) && !action.cycles.includes(cycle)) continue;
        if (Number.isFinite(action.everyNCycles) && cycle % action.everyNCycles !== (action.cycleRemainder || 0)) continue;
        const time = base + safeNum(action.at, 0);
        if (time <= config.duration) push(time, 0, 'action', { action, cycle });
      }
    }

    const activeBuffs = [];
    const activeDebuffs = [];
    const hitEvents = [];
    const skippedActions = [];
    const actionLog = [];
    let activeId = config.characters[0]?.id || null;

    function cleanup(time) {
      for (let i = activeBuffs.length - 1; i >= 0; i--) if (activeBuffs[i].end <= time + 1e-9) activeBuffs.splice(i, 1);
      for (let i = activeDebuffs.length - 1; i >= 0; i--) if (activeDebuffs[i].end <= time + 1e-9) activeDebuffs.splice(i, 1);
    }

    function computeStats(charId, time) {
      cleanup(time);
      const ch = chars.get(charId);
      if (!ch) return null;
      const stats = deepClone(ch.stats);
      for (const buff of activeBuffs) {
        if (buff.targetId !== charId) continue;
        if (BUFF_STATS.includes(buff.stat)) stats[buff.stat] = safeNum(stats[buff.stat], 0) + safeNum(buff.value, 0);
      }
      stats.critRate = clamp(stats.critRate, 0, 1);
      stats.defIgnore = clamp(stats.defIgnore, 0, 1);
      return stats;
    }

    function addBuff(time, actorId, buff) {
      const targets = buff.target === 'team' ? config.characters.map(ch => ch.id) : buff.target === 'self' ? [actorId] : Array.isArray(buff.target) ? buff.target : [buff.target || actorId];
      for (const targetId of targets) {
        const key = `${buff.key || buff.stat || 'buff'}:${targetId}`;
        for (let i = activeBuffs.length - 1; i >= 0; i--) if (activeBuffs[i].key === key) activeBuffs.splice(i, 1);
        activeBuffs.push({ key, targetId, stat: buff.stat, value: safeNum(buff.value, 0), start: time, end: time + Math.max(0, safeNum(buff.duration, 0)), label: buff.label || buff.key || buff.stat });
      }
    }

    function addDebuff(time, debuff) {
      const key = debuff.key || `${debuff.element || 'all'}-debuff`;
      for (let i = activeDebuffs.length - 1; i >= 0; i--) if (activeDebuffs[i].key === key) activeDebuffs.splice(i, 1);
      activeDebuffs.push({ key, element: debuff.element || 'all', resShred: safeNum(debuff.resShred, 0), defReduction: safeNum(debuff.defReduction, 0), start: time, end: time + Math.max(0, safeNum(debuff.duration, 0)), label: debuff.label || key });
    }

    function getDebuffState(time, element) {
      cleanup(time);
      let resShred = 0, defReduction = config.enemy.defReduction || 0;
      const labels = [];
      for (const d of activeDebuffs) {
        if (d.element === 'all' || d.element === element) resShred += d.resShred || 0;
        defReduction += d.defReduction || 0;
        labels.push(d.label);
      }
      return { resShred, defReduction: clamp(defReduction, -1, .9), labels };
    }

    while (heap.size) {
      const event = heap.pop();
      const time = event.time;
      if (time > config.duration + 1e-9) break;
      cleanup(time);

      if (event.type === 'action') {
        const { action, cycle } = event.payload;
        const actor = chars.get(action.actorId);
        if (!actor) continue;
        activeId = actor.id;
        const cost = Math.max(0, safeNum(action.energyCost, 0));
        const currentEnergy = energies.get(actor.id) || 0;
        if (cost > currentEnergy + 1e-9) {
          skippedActions.push({ time, actorId: actor.id, action: action.name, reason: `能量不足 ${round(currentEnergy, 1)}/${cost}`, cycle });
          energyStats.get(actor.id).skipped++;
          continue;
        }
        energies.set(actor.id, currentEnergy - cost);
        energyStats.get(actor.id).spent += cost;
        actionLog.push({ time, actorId: actor.id, action: action.name, cycle, energyBefore: currentEnergy, energyAfter: currentEnergy - cost });

        const snapshotIds = new Set([actor.id]);
        (action.hits || []).forEach(hit => { snapshotIds.add(hit.scalingOwnerId || actor.id); (hit.flatSources || []).forEach(s => snapshotIds.add(s.ownerId || actor.id)); });
        const snapshots = {};
        snapshotIds.forEach(id => { snapshots[id] = computeStats(id, time); });

        for (const gain of action.energyGains || []) push(time + safeNum(gain.offset, 0), 2, 'energy', { actorId: actor.id, gain });
        for (const buff of action.buffs || []) push(time + safeNum(buff.offset, 0), 1, 'buff', { actorId: actor.id, buff });
        for (const debuff of action.debuffs || []) push(time + safeNum(debuff.offset, 0), 1, 'debuff', { actorId: actor.id, debuff });
        for (const hit of action.hits || []) push(time + safeNum(hit.offset, 0), 3, 'hit', { actorId: actor.id, action, hit, snapshots, cycle });
      }

      if (event.type === 'energy') {
        const { gain } = event.payload;
        const targets = gain.target === 'team' ? config.characters.map(ch => ch.id) : Array.isArray(gain.target) ? gain.target : [gain.target || event.payload.actorId];
        for (const targetId of targets) {
          const ch = chars.get(targetId); if (!ch) continue;
          const before = energies.get(targetId) || 0;
          const after = clamp(before + safeNum(gain.amount, 0), 0, ch.energyMax);
          energies.set(targetId, after);
          energyStats.get(targetId).gained += after - before;
        }
      }

      if (event.type === 'buff') addBuff(time, event.payload.actorId, event.payload.buff);
      if (event.type === 'debuff') addDebuff(time, event.payload.debuff);

      if (event.type === 'hit') {
        const { actorId, action, hit, snapshots, cycle } = event.payload;
        const scalingOwnerId = hit.scalingOwnerId || actorId;
        const creditId = hit.creditId || actorId;
        const owner = chars.get(scalingOwnerId);
        const credit = chars.get(creditId);
        if (!owner || !credit) continue;
        const stats = hit.snapshot === 'action' ? deepClone(snapshots[scalingOwnerId] || computeStats(scalingOwnerId, time)) : computeStats(scalingOwnerId, time);
        if (!stats) continue;
        const scalingStat = hit.scalingStat || 'atk';
        const scalingValue = totalStat(stats, scalingStat);
        let flat = safeNum(hit.flat, 0);
        const flatDetails = [];
        for (const source of hit.flatSources || []) {
          const sourceId = source.ownerId || scalingOwnerId;
          const sourceStats = hit.snapshot === 'action' ? deepClone(snapshots[sourceId] || computeStats(sourceId, time)) : computeStats(sourceId, time);
          if (!sourceStats) continue;
          const sourceValue = totalStat(sourceStats, source.stat || 'atk');
          const amount = sourceValue * safeNum(source.multiplier, 0);
          flat += amount;
          flatDetails.push({ ownerId: sourceId, stat: source.stat || 'atk', multiplier: safeNum(source.multiplier, 0), sourceValue, amount });
        }
        const baseDamage = safeNum(hit.scaling, 0) * scalingValue + flat;
        const dmgBonus = safeNum(stats.dmgBonus, 0) + safeNum(hit.dmgBonus, 0);
        const bonusFactor = 1 + dmgBonus;
        const preDefense = baseDamage * bonusFactor;
        const debuff = getDebuffState(time, hit.element || owner.element);
        const defIgnore = clamp(safeNum(stats.defIgnore, 0) + safeNum(hit.defIgnore, 0), 0, 1);
        const defReduction = clamp(debuff.defReduction + safeNum(hit.defReduction, 0), -1, .9);
        const defenseFactor = (owner.level + 100) / ((owner.level + 100) + (config.enemy.level + 100) * (1 + defReduction) * (1 - defIgnore));
        const effectiveRes = config.enemy.resistance - debuff.resShred - safeNum(hit.resShred, 0);
        const resFactor = resistanceFactor(effectiveRes);
        const preCrit = preDefense * defenseFactor * resFactor;
        const cr = clamp(safeNum(stats.critRate, 0) + safeNum(hit.critRate, 0), 0, 1);
        const cd = Math.max(0, safeNum(stats.critDmg, 0) + safeNum(hit.critDmg, 0));
        const critFactor = options.critMode === 'allCrit' ? 1 + cd : options.critMode === 'noCrit' ? 1 : 1 + cr * cd;
        const preReaction = preCrit * critFactor;
        const reaction = hit.reaction || 'none';
        const amp = reactionFactor(reaction, stats.em, safeNum(stats.reactionBonus, 0) + safeNum(hit.reactionBonus, 0), hit.ampBase);
        const finalDamage = preReaction * amp.total * safeNum(hit.groupMultiplier, 1);
        hitEvents.push({
          id: hitEvents.length, time, second: Math.floor(time), cycle, actorId, creditId, scalingOwnerId, actorName: credit.name, actionName: action.name, hitLabel: hit.label || '命中', element: hit.element || owner.element, reaction,
          scaling: safeNum(hit.scaling, 0), scalingStat, scalingValue, flat, flatDetails, baseDamage, dmgBonus, bonusFactor, defIgnore, defReduction, defenseFactor, effectiveRes, resFactor,
          critRate: cr, critDmg: cd, critFactor, em: stats.em, reactionBase: amp.base, emBonus: amp.emBonus, reactionBonus: amp.reactionBonus, reactionFactor: amp.total,
          groupMultiplier: safeNum(hit.groupMultiplier, 1), finalDamage, snapshot: hit.snapshot || 'hit', activeId, buffs: activeBuffs.filter(b => b.targetId === scalingOwnerId).map(b => b.label), debuffs: debuff.labels
        });
      }
    }

    config.characters.forEach(ch => { energyStats.get(ch.id).final = energies.get(ch.id) || 0; });
    const totalDamage = hitEvents.reduce((s, h) => s + h.finalDamage, 0);
    const byCharacter = {};
    const bySkill = {};
    const perSecond = Array.from({ length: Math.ceil(config.duration) }, () => ({}));
    for (const h of hitEvents) {
      byCharacter[h.creditId] = (byCharacter[h.creditId] || 0) + h.finalDamage;
      const key = `${h.creditId}::${h.actionName}`;
      if (!bySkill[key]) bySkill[key] = { creditId: h.creditId, actionName: h.actionName, damage: 0, hits: 0 };
      bySkill[key].damage += h.finalDamage; bySkill[key].hits++;
      if (perSecond[h.second]) perSecond[h.second][h.creditId] = (perSecond[h.second][h.creditId] || 0) + h.finalDamage;
    }
    return {
      config, hitEvents, skippedActions, actionLog, energyStats: Object.fromEntries(energyStats), totalDamage, dps: totalDamage / config.duration,
      reactedHits: hitEvents.filter(h => h.reaction !== 'none').length, byCharacter, bySkill: Object.values(bySkill).sort((a, b) => b.damage - a.damage), perSecond
    };
  }

  let currentConfig = normalizeConfig(PRESETS[0]);
  let lastResult = null;
  let currentPage = 1;
  let selectedHitId = null;
  let timelineSecondFilter = null;

  function populatePresetSelect() {
    $('presetSelect').innerHTML = PRESETS.map((p, i) => `<option value="${i}">${escapeHtml(p.meta.name)}</option>`).join('');
  }

  function syncControlsFromConfig() {
    $('durationInput').value = currentConfig.duration;
    $('cycleInput').value = currentConfig.cycleLength;
    $('enemyLevelInput').value = currentConfig.enemy.level;
    $('resInput').value = round(currentConfig.enemy.resistance * 100, 2);
    $('jsonEditor').value = JSON.stringify(currentConfig, null, 2);
  }

  function syncConfigFromControls() {
    currentConfig.duration = clamp(safeNum($('durationInput').value, 120), 1, 600);
    currentConfig.cycleLength = clamp(safeNum($('cycleInput').value, 20), .1, 120);
    currentConfig.enemy.level = clamp(safeNum($('enemyLevelInput').value, 110), 1, 200);
    currentConfig.enemy.resistance = safeNum($('resInput').value, 10) / 100;
  }

  function runSimulation() {
    syncConfigFromControls();
    lastResult = simulate(currentConfig, { energyMode: $('energyModeInput').value, critMode: $('critModeInput').value });
    currentPage = 1; selectedHitId = null; timelineSecondFilter = null;
    $('jsonEditor').value = JSON.stringify(currentConfig, null, 2);
    renderAll();
  }

  function renderAll() {
    if (!lastResult) return;
    renderMetrics(); renderCharacterBreakdown(); renderSkillTable(); renderEnergy(); renderHitFilters(); renderHitTable(); renderTimeline(); renderHitDetail();
    $('notice').innerHTML = `<strong>${escapeHtml(lastResult.config.meta?.name || '自定义预设')}</strong> · ${escapeHtml(lastResult.config.meta?.note || '')}`;
  }

  function renderMetrics() {
    const r = lastResult;
    const fullCycles = Math.floor(r.config.duration / r.config.cycleLength);
    const metrics = [
      ['队伍 DPS', compact(r.dps), `${fmt(r.dps, 0)} / 秒`],
      [`${r.config.duration}秒总伤`, compact(r.totalDamage), `${fmt(r.totalDamage, 0)}`],
      ['有效命中', fmt(r.hitEvents.length, 0), `${r.reactedHits} 段增幅反应`],
      ['执行循环', fmt(fullCycles, 0), `循环轴 ${r.config.cycleLength}s`],
      ['跳过行动', fmt(r.skippedActions.length, 0), r.skippedActions.length ? '存在断能量/断轴' : '无能量阻塞']
    ];
    $('metricGrid').innerHTML = metrics.map(([label, value, sub]) => `<div class="metric"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`).join('');
  }

  function renderCharacterBreakdown() {
    const r = lastResult;
    const rows = r.config.characters.map(ch => ({ ch, damage: r.byCharacter[ch.id] || 0 })).sort((a, b) => b.damage - a.damage);
    $('characterSummary').textContent = `${rows.filter(x => x.damage > 0).length} 名角色产生伤害`;
    $('characterBreakdown').innerHTML = rows.map(({ ch, damage }) => {
      const pct = r.totalDamage ? damage / r.totalDamage * 100 : 0;
      return `<div class="breakdown-row"><div class="breakdown-name"><span class="dot" style="background:${ch.color}"></span><strong>${escapeHtml(ch.name)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${ch.color}"></div></div><div class="breakdown-value">${compact(damage)}<small>${pct.toFixed(1)}% · ${compact(damage / r.config.duration)} DPS</small></div></div>`;
    }).join('');
  }

  function renderSkillTable() {
    const r = lastResult;
    const chars = new Map(r.config.characters.map(ch => [ch.id, ch]));
    $('skillTableBody').innerHTML = r.bySkill.map(s => {
      const ch = chars.get(s.creditId); const pct = r.totalDamage ? s.damage / r.totalDamage * 100 : 0;
      return `<tr><td><span class="dot" style="display:inline-block;background:${ch?.color || '#999'}"></span> ${escapeHtml(ch?.name || s.creditId)}</td><td>${escapeHtml(s.actionName)}</td><td>${s.hits}</td><td>${compact(s.damage)}</td><td>${compact(s.damage / r.config.duration)}</td><td>${pct.toFixed(1)}%</td></tr>`;
    }).join('') || `<tr><td colspan="6">没有伤害事件。</td></tr>`;
  }

  function renderEnergy() {
    const r = lastResult;
    $('energyStatus').innerHTML = r.config.characters.map(ch => {
      const e = r.energyStats[ch.id]; const pct = ch.energyMax ? e.final / ch.energyMax * 100 : 0;
      const status = e.skipped ? `<span class="badge warn">跳过 ${e.skipped}</span>` : `<span class="badge good">正常</span>`;
      return `<div class="energy-item"><div class="energy-head"><strong>${escapeHtml(ch.name)}</strong>${status}</div><div class="energy-track"><div class="energy-fill" style="width:${pct}%;background:${ch.color}"></div></div><small>初始 ${round(e.initial,1)} · 获得 ${round(e.gained,1)} · 消耗 ${round(e.spent,1)} · 最终 ${round(e.final,1)}/${ch.energyMax}</small></div>`;
    }).join('');
  }

  function renderHitFilters() {
    const r = lastResult;
    const prevChar = $('hitCharacterFilter').value || 'all';
    $('hitCharacterFilter').innerHTML = `<option value="all">全部角色</option>` + r.config.characters.map(ch => `<option value="${escapeAttr(ch.id)}">${escapeHtml(ch.name)}</option>`).join('');
    if ([...$('hitCharacterFilter').options].some(o => o.value === prevChar)) $('hitCharacterFilter').value = prevChar;
    const prevReaction = $('hitReactionFilter').value || 'all';
    const reactions = [...new Set(r.hitEvents.map(h => h.reaction))];
    $('hitReactionFilter').innerHTML = `<option value="all">全部反应</option>` + reactions.map(x => `<option value="${x}">${REACTION_LABELS[x] || x}</option>`).join('');
    if ([...$('hitReactionFilter').options].some(o => o.value === prevReaction)) $('hitReactionFilter').value = prevReaction;
  }

  function filteredHits() {
    if (!lastResult) return [];
    const char = $('hitCharacterFilter').value || 'all';
    const reaction = $('hitReactionFilter').value || 'all';
    const search = ($('hitSearch').value || '').trim().toLowerCase();
    return lastResult.hitEvents.filter(h => {
      if (char !== 'all' && h.creditId !== char) return false;
      if (reaction !== 'all' && h.reaction !== reaction) return false;
      if (timelineSecondFilter !== null && h.second !== timelineSecondFilter) return false;
      if (search && !`${h.actionName} ${h.hitLabel}`.toLowerCase().includes(search)) return false;
      return true;
    });
  }

  function renderHitTable() {
    const hits = filteredHits();
    const pageSize = safeNum($('pageSizeInput').value, 50);
    const totalPages = Math.max(1, Math.ceil(hits.length / pageSize));
    currentPage = clamp(currentPage, 1, totalPages);
    const pageHits = hits.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    $('hitTableBody').innerHTML = pageHits.map(h => `<tr data-hit-id="${h.id}" class="${selectedHitId === h.id ? 'selected' : ''}"><td>${h.time.toFixed(3)}s</td><td>${escapeHtml(h.actorName)}</td><td>${escapeHtml(h.actionName)} <span class="muted">/ ${escapeHtml(h.hitLabel)}</span></td><td><span style="color:${ELEMENT_COLORS[h.element] || '#ccc'}">${ELEMENT_LABELS[h.element] || h.element}</span></td><td>${h.reaction === 'none' ? '—' : `<span class="badge">${REACTION_LABELS[h.reaction] || h.reaction}</span>`}</td><td>${h.scaling.toFixed(3)} × ${h.scalingStat.toUpperCase()}</td><td>${fmt(h.baseDamage,0)}</td><td>×${h.critFactor.toFixed(3)}</td><td><strong>${fmt(h.finalDamage,0)}</strong></td></tr>`).join('') || `<tr><td colspan="9">没有符合筛选条件的伤害事件。</td></tr>`;
    $('pageInfo').textContent = `${currentPage} / ${totalPages} · 共 ${hits.length} 段${timelineSecondFilter !== null ? ` · 已锁定第 ${timelineSecondFilter}s` : ''}`;
    $('prevPage').disabled = currentPage <= 1; $('nextPage').disabled = currentPage >= totalPages;
    [...$('hitTableBody').querySelectorAll('tr[data-hit-id]')].forEach(row => row.addEventListener('click', () => { selectedHitId = Number(row.dataset.hitId); renderHitTable(); renderHitDetail(); }));
  }

  function renderHitDetail() {
    if (!lastResult || selectedHitId === null) { $('hitDetail').className = 'formula-detail empty'; $('hitDetail').textContent = '尚未选择伤害事件。'; return; }
    const h = lastResult.hitEvents.find(x => x.id === selectedHitId);
    if (!h) return;
    const factors = [
      ['倍率基准', `${h.scaling.toFixed(3)} × ${h.scalingStat.toUpperCase()} (${fmt(h.scalingValue,0)})`],
      ['附加基础伤害', fmt(h.flat,0)],
      ['基础伤害', fmt(h.baseDamage,0)],
      ['增伤区', `×${h.bonusFactor.toFixed(3)} (${(h.dmgBonus*100).toFixed(1)}%)`],
      ['防御区', `×${h.defenseFactor.toFixed(4)} · 无视 ${(h.defIgnore*100).toFixed(0)}%`],
      ['抗性区', `×${h.resFactor.toFixed(4)} · 有效抗性 ${(h.effectiveRes*100).toFixed(1)}%`],
      ['暴击期望', `×${h.critFactor.toFixed(4)} · ${(h.critRate*100).toFixed(1)}/${(h.critDmg*100).toFixed(1)}`],
      ['反应区', `×${h.reactionFactor.toFixed(4)} · ${REACTION_LABELS[h.reaction] || h.reaction}`],
      ['元素精通', `${fmt(h.em,0)} · 加成 ${(h.emBonus*100).toFixed(1)}%`],
      ['反应增伤', `${(h.reactionBonus*100).toFixed(1)}%`],
      ['结算方式', h.snapshot === 'action' ? '行动开始快照' : '命中时动态'],
      ['最终伤害', fmt(h.finalDamage,0)]
    ];
    $('hitDetail').className = 'formula-detail';
    $('hitDetail').innerHTML = factors.map(([k,v]) => `<div class="factor"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  }

  function renderTimeline() {
    if (!lastResult) return;
    const canvas = $('timelineCanvas'); const ctx = canvas.getContext('2d'); const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(320, canvas.clientWidth); const cssHeight = 360; canvas.width = cssWidth * dpr; canvas.height = cssHeight * dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cssWidth,cssHeight);
    const pad = { l: 60, r: 18, t: 18, b: 42 }; const w = cssWidth-pad.l-pad.r, h = cssHeight-pad.t-pad.b;
    const chars = lastResult.config.characters; const data = lastResult.perSecond; const totals = data.map(x => Object.values(x).reduce((s,v)=>s+v,0)); const max = Math.max(1, ...totals);
    ctx.strokeStyle = '#293243'; ctx.fillStyle = '#8f9bad'; ctx.font = '12px system-ui'; ctx.lineWidth = 1;
    for (let i=0;i<=4;i++) { const y = pad.t + h - h*i/4; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(cssWidth-pad.r,y); ctx.stroke(); const val=max*i/4; ctx.fillText(compact(val), 6, y+4); }
    const barW = Math.max(1, w / data.length);
    data.forEach((bucket, sec) => { let yBottom=pad.t+h; chars.forEach(ch => { const value=bucket[ch.id]||0; if(!value)return; const bh=value/max*h; ctx.fillStyle=ch.color; ctx.fillRect(pad.l+sec*barW, yBottom-bh, Math.max(1,barW-.35), bh); yBottom-=bh; }); });
    ctx.fillStyle='#8f9bad'; const step = data.length > 180 ? 30 : data.length > 90 ? 20 : 10; for(let s=0;s<=data.length;s+=step){ const x=pad.l+s*barW; ctx.fillText(`${s}s`, x-8, cssHeight-16); }
    if (timelineSecondFilter !== null) { const x=pad.l+timelineSecondFilter*barW; ctx.strokeStyle='#ffffff'; ctx.lineWidth=2; ctx.strokeRect(x,pad.t,Math.max(2,barW),h); }
    canvas.onclick = (e) => { const rect=canvas.getBoundingClientRect(); const x=e.clientX-rect.left; if(x<pad.l||x>cssWidth-pad.r)return; const sec=clamp(Math.floor((x-pad.l)/barW),0,data.length-1); timelineSecondFilter = timelineSecondFilter===sec ? null : sec; currentPage=1; renderTimeline(); activateTab('hits'); renderHitTable(); };
    $('timelineLegend').innerHTML = chars.map(ch => `<span class="legend-item"><span class="dot" style="background:${ch.color}"></span>${escapeHtml(ch.name)}</span>`).join('');
  }

  function activateTab(tab) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    $(`${tab}Panel`).classList.add('active');
    if (tab === 'timeline') requestAnimationFrame(renderTimeline);
  }

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function escapeAttr(value) { return escapeHtml(value); }

  function downloadJson() {
    syncConfigFromControls();
    const blob = new Blob([JSON.stringify(currentConfig, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(currentConfig.meta?.name || 'genshin-sim').replace(/[^\w\u4e00-\u9fa5-]+/g,'-')}.json`; a.click(); URL.revokeObjectURL(a.href);
  }

  function applyEditorJson() {
    try {
      currentConfig = normalizeConfig(JSON.parse($('jsonEditor').value)); $('jsonError').hidden = true; syncControlsFromConfig(); runSimulation();
    } catch (err) { $('jsonError').hidden = false; $('jsonError').textContent = err.stack || err.message || String(err); }
  }

  function initEvents() {
    $('presetSelect').addEventListener('change', e => { currentConfig = normalizeConfig(PRESETS[Number(e.target.value)]); syncControlsFromConfig(); runSimulation(); });
    $('runButton').addEventListener('click', runSimulation);
    $('exportButton').addEventListener('click', downloadJson);
    $('importInput').addEventListener('change', async e => { const file=e.target.files?.[0]; if(!file)return; try{ currentConfig=normalizeConfig(JSON.parse(await file.text())); syncControlsFromConfig(); runSimulation(); }catch(err){ alert(`导入失败：${err.message}`); } finally { e.target.value=''; } });
    document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => activateTab(b.dataset.tab)));
    ['hitCharacterFilter','hitReactionFilter','pageSizeInput'].forEach(id => $(id).addEventListener('change', () => { currentPage=1; renderHitTable(); }));
    $('hitSearch').addEventListener('input', () => { currentPage=1; renderHitTable(); });
    $('prevPage').addEventListener('click', () => { currentPage--; renderHitTable(); });
    $('nextPage').addEventListener('click', () => { currentPage++; renderHitTable(); });
    $('applyJsonButton').addEventListener('click', applyEditorJson);
    $('formatJsonButton').addEventListener('click', () => { try { $('jsonEditor').value=JSON.stringify(JSON.parse($('jsonEditor').value),null,2); $('jsonError').hidden=true; } catch(err){ $('jsonError').hidden=false; $('jsonError').textContent=err.message; } });
    window.addEventListener('resize', () => { if ($('timelinePanel').classList.contains('active')) renderTimeline(); });
  }

  populatePresetSelect();
  initEvents();
  syncControlsFromConfig();
  runSimulation();

  window.GenshinDpsLab = { simulate, presets: PRESETS, getConfig: () => deepClone(currentConfig) };
})();
