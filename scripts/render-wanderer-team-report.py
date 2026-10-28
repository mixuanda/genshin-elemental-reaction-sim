"""Render the declared hypothetical team from retained real native receipts.
No simulator, formula, credentials or personal fixtures are invoked here.
"""
from pathlib import Path
import argparse,collections,csv,hashlib,html,json,re,shutil,math
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('evidence',type=Path);p.add_argument('--public',type=Path,default=Path('apps/web/public/examples'));a=p.parse_args()
e=a.evidence;public=a.public;public.mkdir(parents=True,exist_ok=True);prefix='wanderer-team-120-classic'
r=json.loads((e/'team-120-observed.result.json').read_text());s=json.loads((e/'team-120-observed.summary.json').read_text());c=json.loads((e/'team-120-observed.curve.json').read_text())['series'];audit=json.loads((e/'nicole-durin-energy-audit.json').read_text())
assert r['seed']=='20261022' and r['observationWindow']['actualEndFrame']==7200
assert audit['mechanismRevision']=='athame-and-action-speed'
names={'wanderer':'流浪者','faruzan':'法露珊','nicole':'妮可','durin':'杜林'}
records={x['request']['id']:x['request'] for x in r['calculations']};apps=r['applications'];included=[x for x in apps if 0<=x['frame']<7200]
assert len({x['id'] for x in apps})==len(apps)
assert math.isclose(math.fsum(x['appliedDamage'] for x in included),s['totalDamage'],rel_tol=2e-14)
roles=s['actors'];assert math.isclose(math.fsum(x['damage'] for x in roles),s['totalDamage'],rel_tol=2e-14)
old_total=29529976.748742152;old_dps=old_total/120
manual={
 'tulaytullahsremembrance-na-dmg':'独立从实际E、切人、普攻命中及60f/18f规则重建叠层；不把读取值本身作预期。原公式节点链接仍缺。',
 'tulaytullahsremembrance-atkspd':'已修构造动作读取上下文；E/重击转普攻及普攻转重击的两版本微探针通过。原来源链接缺口仍保留。',
 'blade-of-the-daylight-hours-buff':'首Q同击已修：只补该原始快照缺少的自身贡献，后续不叠加。原事件负责触发/刷新。',
 'athame-trigger-hit-atk':'首Q在341f补0.35攻击，19358.18→21142.88；同帧双目标/单魔导/R5/非Q负例均验证。未伪造原公式节点。',
}
groups=collections.defaultdict(list)
for gap in r['explanationGaps']:
 m=re.match(r'(?:属性读取|来源标量) [^/]+/\d+/([^/]+)/',gap)
 key=m.group(1) if m else ('天赋倍率来源' if '的攻击倍率' in gap else '执行/范围说明')
 groups[key].append(gap)
gap_report={'noticeCount':len(r['explanationGaps']),'countMeaning':'按原回执读取ID统计，不是独立机制或错误数量。独立补证不伪造原公式节点。','groups':[{'key':key,'count':len(v),'representative':v[0],'additionalManualEvidence':manual.get(key,'仅审计报告明确列出的生成与消费已补证；其余输入仍未独立闭合，不因总和吻合而推定。')} for key,v in sorted(groups.items(),key=lambda kv:-len(kv[1]))]}
(e/'explanation-gap-classification.json').write_text(json.dumps(gap_report,ensure_ascii=False,indent=2))
light={'verification':'provisional','title':'散法妮杜120秒：固定源暂定单次场景','sourceCommit':r['sourceCommit'],'wasmSha256':r['executionArtifact']['wasmSha256'],'seed':r['seed'],'observationWindow':r['observationWindow'],'statisticsWindow':'[0,7200)','totalDamage':s['totalDamage'],'dps':s['dps'],'hits':len(included),'roles':roles,'abilities':audit['abilityTotals'],'curve1s':c['points'],'QDecisions':audit['QDecisions'],'QSkipped':audit['QSkipped'],'QConsumptionCounts':audit['QConsumptionCounts'],'phaseFrames':audit['rotationBoundaryFrames'],'lastAction':{k:audit['lastAcceptedAction'][k] for k in ('characterKey','action','startedFrame')},'boundaryApplications':audit['outsideWindowApplications'],'eventSha256':audit['eventSha256'],'assumptions':json.loads((e/'team-120-observed.builds.json').read_text())['assumptions'],'manualEvidence':{'strictSharedCallbackCount':len(r['calculations']),'directNicoleDurinChecks':len(audit['directNicoleDurinChecks']),'energyWrites':len(r['energyApplications']),'cooldownRecasts':len(audit['cooldownRecasts']),'meaning':'一致性和独立路径补证仍不等于实机或所有机制验证。'},'athameSameHitCorrection':audit['athameKnownSameHitApproximation']['correctedHits'],'explanationGaps':gap_report,'changeFromPreviousPublishedScene':{'previousTotal':old_total,'previousDps':old_dps,'damageDelta':s['totalDamage']-old_total,'dpsDelta':s['dps']-old_dps,'causes':['黑蚀首Q同击自身攻击修复。','图莱/沙上普通攻击攻速使用本次构造动作，不漏加首普攻或错误加给重击；时序、窗口内命中与固定种子随机消费相应改变。'],'notAnErrorBound':True},'limitations':['固定Classic来源/几何/碰撞与部分机制仍暂定，未做实机对照。','一次固定种子，不能称随机期望或稳态循环。','两次已到达的流浪者Q缺能跳过，第六轮未到其Q决策。','静态draft无if分支，与高级自适应轴的初始切人和输入流不同，重跑会产生自己的结果。','配装是假设的逐件合法预算，不是玩家实装或角色最优配装。']}
(public/(prefix+'.result-summary.json')).write_text(json.dumps(light,ensure_ascii=False,indent=2))
shutil.copyfile(e/'team-120-observed.gcsl',public/(prefix+'.gcsl'))
shutil.copyfile(e/'damage-by-ability.csv',public/(prefix+'.damage-by-ability.csv'))
with (public/(prefix+'.hits.csv')).open('w',newline='') as f:
 w=csv.writer(f);w.writerow(['frame','seconds','actor','ability','element','reaction','damage','isCrit','includedIn120Seconds'])
 for app in apps:
  q=records[app['calculationId']];w.writerow([app['frame'],app['frame']/60,q['actorKey'],q['ability'],q['element'],q.get('reaction',''),app['appliedDamage'],app['isCrit'],0<=app['frame']<7200])
with (public/(prefix+'.curve-1s.csv')).open('w',newline='') as f:
 w=csv.writer(f);w.writerow(['startSeconds','endSeconds','damage','cumulative'])
 for pt in c['points']: w.writerow([pt['startSeconds'],pt['endSeconds'],pt['damage'],pt['cumulative']])
fmt=lambda x:f'{x:,.2f}'
historical_notice=''
correction_path=public/(prefix+'.known-defects.json')
if correction_path.exists():
 correction=json.loads(correction_path.read_text())
 if correction['historicalWasmSha256']==r['executionArtifact']['wasmSha256']:
  historical_notice='<p role="note"><strong>历史结果：</strong>此记录含已确认的流浪者C2非Q增伤错误，原数值保留。<a href="wanderer-team-recharge.html">查看修正结果与合法充能配装对照</a>。</p>'
role_rows=''.join(f"<tr><td>{names[x['key']]}</td><td>{fmt(x['damage'])}</td><td>{x['share']*100:.2f}%</td><td>{x['hits']}</td></tr>" for x in roles)
ability_rows=''.join(f"<tr><td>{names[x['actor']]}</td><td>{html.escape(x['ability'])}</td><td>{x['hits']}</td><td>{fmt(x['damage'])}</td></tr>" for x in audit['abilityTotals'])
qrows=''.join(f"<tr><td>{names[k]}</td><td>{audit['QConsumptionCounts'][k]}</td><td>{sum(x['actor']==k for x in audit['QSkipped'])}</td></tr>" for k in names)
maxd=max(pt['damage'] for pt in c['points']);cw=1000;ch=170;bars=''.join(f"<rect x='{i*cw/120+30:.3f}' y='{ch+25-pt['damage']/maxd*ch:.3f}' width='{cw/120-1:.3f}' height='{pt['damage']/maxd*ch:.3f}' fill='#28799b'><title>{i}–{i+1}秒：{fmt(pt['damage'])}</title></rect>" for i,pt in enumerate(c['points']))
svg=f"<svg viewBox='0 0 1060 235' role='img' aria-label='120秒实际伤害：1秒汇总'><text x='30' y='18'>1秒汇总 · 逐击原始帧见CSV</text>{bars}<text x='30' y='220'>0秒</text><text x='520' y='220'>60秒</text><text x='990' y='220'>120秒</text></svg>"
page=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>散法妮杜120秒计算场景</title><style>body{{max-width:1100px;margin:32px auto;padding:0 20px;font:16px/1.65 system-ui;color:#162c3c;background:#f7fafc}}h1{{line-height:1.25}}table{{border-collapse:collapse;width:100%;margin:16px 0;background:white}}th,td{{border:1px solid #c5d2dc;padding:7px 12px;text-align:left}}small{{color:#455e70;overflow-wrap:anywhere}}svg{{width:100%;height:auto;background:white}}details{{margin:20px 0}}a{{color:#075c94}}.metric{{padding:16px;background:#e1eff9;border-radius:10px}}.scroll{{overflow:auto}}</style><main>
<h1>散／法／妮／杜：120秒实际运行</h1>{historical_notice}<p class="metric"><strong>总伤 {fmt(s['totalDamage'])} · 本次DPS {fmt(s['dps'])}</strong><br>固定Classic来源的暂定单次结果，[0,7200)内{len(included)}次实际结算。</p>
<p>流浪者100级C6图莱R5；珐露珊C6西风R5；妮可、杜林C2专武R1。其他角色和全部武器按90级、基础天赋10/10/10；配装为可编辑的逐件合法预算假设。</p>
<p>流浪者Q实际3次、2次缺能跳过；队友各6次Q，最后一轮在120秒截断。此结果不能当作随机期望、稳定满Q循环或玩家实装。</p>
<p><a href="{prefix}.draft.json" download>可编辑队伍草稿</a> · <a href="{prefix}.equipment.json" download>逐件配装</a> · <a href="{prefix}.gcsl" download>本次高级自适应动作轴</a> · <a href="{prefix}.result-summary.json" download>结果与范围JSON</a></p>
<h2>角色贡献</h2><div class="scroll"><table><thead><tr><th>角色</th><th>伤害</th><th>占比</th><th>命中</th></tr></thead><tbody>{role_rows}</tbody></table></div><p>按实际伤害所有者记账，不把队友增益的边际价值再次算成伤害；妮可投影保留实际触发者和技能名。</p>
<h2>伤害曲线</h2>{svg}<p><a href="{prefix}.curve-1s.csv" download>逐秒曲线CSV</a> · <a href="{prefix}.hits.csv" download>逐击CSV：整数帧、角色、招式、伤害</a></p>
<h2>主要技能与协同伤害</h2><div class="scroll"><table><thead><tr><th>记账角色</th><th>实际技能</th><th>命中</th><th>伤害</th></tr></thead><tbody>{ability_rows}</tbody></table></div><p><a href="{prefix}.damage-by-ability.csv" download>完整技能贡献CSV</a></p>
<h2>循环与能量</h2><table><thead><tr><th>角色</th><th>实际Q</th><th>缺能跳过</th></tr></thead><tbody>{qrows}</tbody></table><p>只在开场满能，此后逐次检查粒子、回能、扣能和冷却；没有无限能量。六轮起点帧：{ '、'.join(map(str,audit['rotationBoundaryFrames'])) }。本次没有7200帧外结算计入。</p>
<h2>本次修正</h2><p>旧DPS {fmt(old_dps)} → {fmt(s['dps'])}（+{fmt(s['dps']-old_dps)}）。黑蚀首Q在341帧由19,358.18修正为21,142.88；此前5击不变。图莱／沙上的普攻攻速改为读取当前准备执行的动作，修复重击转普攻漏加、普攻转重击误加。由此后续帧、命中数量与随机消费发生变化，不能只把首击差乘次数解释总变化。</p>
<details><summary>复算方法、假设和验证边界</summary><p>草稿可导入队伍DPS模拟的高级文件入口；它是无if分支的静态示例，与本次数值轴的初始切人／输入流不同。复算本次须用所附完整GCSL，Classic、种子20261022、开局满能一次、自动等待、duration截止和相位记录。</p><p>目标为100级各元素10%抗性、静止半径2、位置(0,2.4)，无初始附着／敌人攻击／掉球。实用动作档：切人8帧，其余5帧。流浪者4沙上、珐露珊5宗室、妮可／杜林5角斗为通用预算，不是角色最优推荐。C4随机染色保留实际抽样。</p><p>{len(r['calculations']):,}次共享响应与原生回执一致；另有独立固定表／逐击算术、实际触发生成链、图莱60/18帧叠层、{len(r['energyApplications'])}次能量写回及{len(audit['cooldownRecasts'])}次合法再施放检查。固定几何、原生时间规则和未覆盖机制仍需实机验证，不因此宣称全部角色／机制验证完成。</p><p>原记录保留{len(r['explanationGaps'])}条解释说明，按每次读取ID计数，不是同数量的机制错误。外部独立补证不伪造原结果缺失的公式节点。详见JSON中的分组与范围。</p></details>
<p><small>Classic {r['sourceCommit']}；WASM {r['executionArtifact']['wasmSha256']}；种子20261022。只含假设场景，无个人UID／账号／完整trace。</small></p></main></html>'''
(public/(prefix+'.html')).write_text(page)
manifest={'scope':'declared hypothetical four-person scene only; no personal/account data/full trace','files':[]}
for ext in ['.gcsl','.draft.json','.equipment.json','.result-summary.json','.damage-by-ability.csv','.curve-1s.csv','.hits.csv','.html']:
 path=public/(prefix+ext);manifest['files'].append({'path':str(path),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(e/'public-files.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(json.dumps({'files':8,'hits':len(included),'dps':s['dps']},ensure_ascii=False))
