from pathlib import Path
import re,json,hashlib
import argparse
parser=argparse.ArgumentParser(description='Validate reviewed scalar damage mappings against a pinned local gcsim checkout; never execute upstream code.')
parser.add_argument('--source-root', type=Path, required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[3];source=args.source_root;
manifest=json.loads((root/'packages/game-data/src/character-mappings/reviewed-skill-source-manifest.json').read_text())
for relative, expected in manifest['files'].items():
 actual=hashlib.sha256((source/relative).read_bytes()).hexdigest()
 if actual != expected: raise ValueError(f'Pinned source hash mismatch: {relative}')
selection=root/'packages/game-data/manifests/runtime/current.ts'
catalog_relative=re.search(r'"(\./datasets/[^\"]+/catalog.json)"',selection.read_text()).group(1)
catalog=json.loads((selection.parent/catalog_relative).read_text());talents={t['id']:t for t in catalog['talentSets']}
alias={'ayaka':'kamisatoayaka','itto':'aratakiitto','kazuha':'kaedeharakazuha','ayato':'kamisatoayato','raiden':'raidenshogun','kokomi':'sangonomiyakokomi','kuki':'kukishinobu'}
# Explicit source-reviewed declarations. Each tuple is source character, table,
# ability, meaningful hit label, complete selected action, source file, scale.
rows=[]
def add(c,t,label,complete=True,kind='skill',scale='atk',suffix=None,count=1,extra=None,assumptions=None,fixed=None,formula=None,group=None):
 rows.append(dict(char=c,table=t,label=label,complete=complete,kind=kind,scale=scale,suffix=suffix or t,count=count,extra=extra or [],assumptions=assumptions or [],fixed=fixed or [],formula=formula,group=group))
for c,t,label,complete in [
 ('kaeya','skill','霜袭·命中',True),('bennett','skill','热情过载·点按',True),('ayaka','skill','神里流·冰华',True),('chongyun','skill','重华叠霜·施放斩击',False),('dahlia','skill','浸礼·首次命中',True),('faruzan','skill','风域·施放命中',False),('itto','skill','阿丑·投掷命中',True),('jean','skill','风压剑·释放命中',True),('kaveh','skill','画则巧施·草伤命中',True),('kazuha','skill','千早振·点按',True),('kazuha','skillHold','千早振·长按',True),('keqing','skill','星斗归位·雷楔初击',False),('keqing','skillPress','星斗归位·再次施放斩击',True),('kirara','skillPress','呜喵町飞足·点按踢击',True),('layla','skill','垂裳端凝之夜·施放命中',False),('lisa','skillPress','苍雷·点按',True),('ningguang','skill','璇玑屏·施放命中',True),('qiqi','skillInitialDmg','寒病鬼差·初始命中',False),('razor','skillPress','利爪与苍雷·点按',True),('razor','skillHold','利爪与苍雷·长按',True),('sethos','skill','古仪·鸣砂掣雷·命中',True),('sucrose','skill','风灵作成·陆叁零捌·命中',True),('tartaglia','skill','魔王武装·切换近战初击',False),('thoma','skill','烈烧佑命之侍护·命中',True),('tighnari','skill','识果种雷·初击',True),('wanderer','skill','羽画·风姿华歌·施放初击',False),('xiao','skill','风轮两立·首次无被动层数',True),('xinyan','skill','热情拂扫·施放初击',False),('yanfei','skill','丹书立约·命中',True),('aloy','skillMain','冰尘雪野·冰尘弹',False),('aloy','skillBomblets','冰尘雪野·单枚冷冻炸弹',False),('albedo','skill','创生法·拟造阳华·初击',False),('ayato','skill','镜花·水影破裂',False),('baizhu','skillDamage','游丝徵灵·单次命中',False),('charlotte','skillPress','取景·点按初击',False),('charlotte','skillHold','取景·长按初击',False),('charlotte','skillPressMark','速照剪影·单次标记伤害',False),('charlotte','skillHoldMark','聚焦印象·单次标记伤害',False),('collei','skill','拂花偈叶·单次飞叶轮命中',False),('dori','skill','镇灵之灯·断除烦恼炮·初击',False),('dori','skillAfter','售后服务弹·单枚',False),('escoffier','skillInital','低温烹饪·初击',False),('escoffier','skillDot','冷冻芭菲·单次',False),('fischl','birdSum','夜巡影翼·召唤命中',False),('fischl','birdAtk','奥兹·单次攻击',False),('ganyu','lotus','山泽麟迹·单次冰莲伤害',False),('mika','skillPress','星霜的流旋·点按',True),('mika','skillHold','星霜的流旋·长按首击',False),('raiden','skill','神变·恶曜开眼·初击',False),('raiden','skillTick','雷罚恶曜之眼·单次协同攻击',False)]:add(c,t,label,complete)
add('noelle','shieldDmg','护心铠·施放命中',True,scale='def')
add('neuvillette','skill','泪水啊，我必偿还·初击',False,scale='hp',assumptions=['只含生命值倍率初击；不含另行触发的灵息之棘。'])
add('neuvillette','thorn','灵息之棘·一次',False,assumptions=['显式假设始基力触发已就绪；不含生命值倍率初击。'])
add('alhaitham','rushAtk','共相·理式摹写·突进命中',False,extra=[('rushEm','em')],assumptions=['只含突进的 ATK+EM 两项；不含后续琢光镜投射与其伤害加成。'])
add('chiori','thrustAtkScaling','羽袖一触·上挑命中',False,extra=[('thrustDefScaling','def')],assumptions=['只含上挑的 ATK+DEF 两项；不含袖的攻击及额外召唤物。'])
for c,t,label,complete,count in [
 ('aloy','burst','曙光预言·爆发命中',True,1),('ayato','burst','囿于薄景·单枚水花剑',False,1),('bennett','burst','美妙旅程·施放命中',True,1),('chongyun','burst','云开星落·三柄灵刃',True,3),('dahlia','burst','耀仪圣祷·施放命中',False,1),('faruzan','burst','抟风秘道·初击',False,1),('fischl','burst','至夜幻现·一次雷击',False,1),('gaming','burst','璨焰金猊舞·初次猊兽命中',False,1),('jean','burst','蒲公英之风·施放初击',False,1),('kaeya','burst','凛冽轮舞·单次冰棱',False,1),('kaveh','burst','繁绘隅穹·施放命中',False,1),('kirara','burst','秘法·惊喜特派·初击',False,1),('qiqi','burstDmg','仙法·救苦度厄·施放命中',True,1),('razor','burstDmg','雷牙·施放初击',False,1),('shenhe','burst','神女遣灵真诀·施放初击',False,1),('thoma','burst','真红炽火之大铠·施放初击',False,1),('yanfei','burst','凭此结契·施放命中',False,1),('yaoyao','burstDMG','玉颗珊珊月中落·施放初击',False,1),('escoffier','burst','花刀技法·命中',True,1)]:add(c,t,label,complete,kind='burst',count=count)
add('chiori','burstAtkScaling','二刀之形·比翼·命中',True,kind='burst',extra=[('burstDefScaling','def')])

# Second independent review batch. A skill's missing state machine does not block
# a scalar instance whose exact source preconditions are supplied explicitly.
add('barbara','skill','演唱，开始·两枚水滴',True,count=2)
for c,t,label in [('klee','jumpy','蹦蹦炸弹·一次弹跳'),('klee','mine','蹦蹦炸弹·单枚诡雷'),('hutao','bb','血梅香·一次伤害'),('dehya','skill','熔铁流狱·净焰昂藏初击'),('dehya','skillReposition','熔铁流狱·剑域炽焰'),('arlecchino','skillSpike','万相化灰·血火初击'),('arlecchino','skillFinal','万相化灰·横扫'),('arlecchino','skillSigil','血偿勒令·一次伤害'),('emilie','skillDMG','撷萃调香·初击'),('emilie','skillArke','灵息之棘·一次'),('ineffa','skillInitial','清扫模式·初击'),('ineffa','skillDoT','比尔琪塔·一次伤害'),('lauma','skillPress','狩猎颂祷·点按伤害'),('lauma','skillHold1','永眠颂祷·长按草伤组成'),('varka','skillInitial','狂风处决·初击')]:add(c,t,label,False)
add('venti','skillPress','高天之歌·点按',True)
add('cyno','skill','秘仪·律渊渡魂·非爆发状态',True,assumptions=['未处于启途誓使状态；不触发末途真眼与渡荒之雷。'])
add('cyno','skillB','冥祭·单次雷伤',False,assumptions=['处于启途誓使状态，但本次未触发末途真眼裁定；不含渡荒之雷。'])
add('flins','skillDmg','北地枪暴·命中',True,assumptions=['当前输入为北地枪暴分支；不含独立爆发与月感电事件。'])
add('nicole','skill','启示·无始之光·施放伤害',True)
add('kokomi','skillDmg','海月之誓·非爆发状态单次伤害',False,assumptions=['不处于仪来羽衣状态，故无爆发生命值平铺加值。最终暴击率须已包含庙算无遗的减100%暴击率。'])
for c,t,label,complete in [('yelan','skill','萦络纵命索·命中',True),('nilou','skill','七域舞步·初击',False),('furina','skillOusiaBubble','孤心沙龙·荒性初击',False),('columbina','skill','技能·生命值初击',False),('columbina','skillDoT','技能·单次生命值持续伤害',False)]:add(c,t,label,complete,scale='hp')
for t,label in [('skillPress','短促拦截射击·点按'),('skillHold','短促拦截射击·普通长按'),('skillOvercharged','短促拦截射击·超量装药弹'),('arkhe','流涌之刃·一次')]:add('chevreuse',t,label,False,assumptions=['该条只含选定炮弹或始基力命中；始基力就绪和超量装药弹持有状态须符合所选分支。'])
add('dehya','skillDotAtk','熔铁流狱·协同伤害',False,extra=[('skillDotHP','hp')])
add('lauma','frostgroveSanctuaryAtk','霜林圣域·一次草伤',False,extra=[('frostgroveSanctuaryEM','em')])
for c,t,label,complete in [('diluc','burstInitial','黎明·初始斩击',False),('venti','burstDot','风神之诗·单次风伤',False),('xingqiu','burst','裁雨留虹·单柄雨帘剑',False),('klee','burst','轰轰火花·一次伤害',False),('yoimiya','burst','琉金云间草·初击',False),('yoimiya','burstExplode','琉金火光·一次爆炸',False),('rosaria','burstDot','终命的圣礼·一次冰枪持续伤害',False),('chevreuse','burst','圆阵掷弹爆轰术·初始榴弹',False),('chevreuse','burstSecondary','二重毁伤弹·单枚',False),('arlecchino','burst','厄月将升·伤害',True),('emilie','burstDMG','香氛演绎·一次香露',False),('ineffa','burst','至高指令·爆发伤害',True),('flins','burstInit','古律·孤灯秘传·普通初击',False),('nicole','burstInitial','启示·登天之梯·初始伤害',False)]:add(c,t,label,complete,kind='burst')
for c,t,label,complete in [('yelan','burst','渊图玲珑骰·初击',False),('kuki','burst','御咏鸣神刈山祭·单次伤害',False),('nilou','burst','浮莲舞步·初击',False),('nilou','burstAeon','永世流沔·延迟伤害',False),('furina','burstDMG','万众狂欢·初始伤害',True),('columbina','burst','爆发·生命值伤害',True)]:add(c,t,label,complete,kind='burst',scale='hp')
add('dehya','burstPunchAtk','炽鬃拳·一次',False,kind='burst',extra=[('burstPunchHP','hp')])
add('dehya','burstKickAtk','焚落踢·一次',False,kind='burst',extra=[('burstKickHP','hp')])
add('clorinde','burstDamage','残光将终·五次伤害',True,kind='burst',count=5,formula='clorinde-a1',assumptions=['破夜的明焰按显式突破等级判断是否启用；其0至3层反应层数是显式条件输入，不能由独立技能计算自动证明。'])
add('zhongli','skillHold','地心·长按伤害（炊金馔玉条件项）',False,fixed=[('hp',0.019,'asc.go','a4Skill')],assumptions=['炊金馔玉条件项仅在显式突破等级至少4时应用，生命值额外伤害按1.9%加入；本条不含岩脊共鸣。'])
add('zhongli','burst','天星（炊金馔玉条件项）',True,kind='burst',fixed=[('hp',0.33,'asc.go','a4Burst')],assumptions=['炊金馔玉条件项仅在显式突破等级至少4时应用，生命值额外伤害按33%加入。'])
add('kuki','skill','越祓雷草之轮·初击（安心之所条件项）',False,fixed=[('em',0.25,'asc.go','a4Damage')],assumptions=['安心之所条件项仅在显式突破等级至少4时应用，额外伤害加入25%元素精通。'])
add('kuki','skilldot','越祓草轮·一次伤害（安心之所条件项）',False,fixed=[('em',0.25,'asc.go','a4Damage')],assumptions=['安心之所条件项仅在显式突破等级至少4时应用，额外伤害加入25%元素精通。'])
add('lanyan','burst','月落华舞·三次伤害（苍翎镇邪条件项）',True,kind='burst',count=3,fixed=[('em',7.74,'burst.go','FlatDmg')],assumptions=['苍翎镇邪条件项仅在显式突破等级至少4时应用，每段额外伤害加入774%元素精通。'])
add('freminet','skillThrust','浮冰增压·初始上挑',False)
add('freminet','skillBreath','灵息之刺·一次',False,assumptions=['始基力已就绪；不把该伤害当作每次压力引爆固定附加命中。'])
add('freminet','burst','猎影潜袭·初始伤害',True,kind='burst')
add('chasca','skillResonance','灵缰追影·进入夜魂时初击',True,assumptions=['此前未处于夜魂加持状态；本次输入进入状态而非退出状态。后续瞄准射击是另外的输入动作。'])
add('chasca','burstGalesplitting','索魂命袭·裂风索魂弹',False,kind='burst')
add('varesa','rush','疾驰突进·非炽热激情',True,assumptions=['在决定倍率时未处于炽热激情/夜魂加持；只含突进本身，不含下一次重击或下落攻击。'])
add('varesa','kick','闪烈降临·普通飞踢',True,kind='burst',assumptions=['施放时既非极限驱动、亦非炽热激情状态；不采用大火山崩落替代招式。'])
add('wriothesley','burst','黑金狼噬·五段主伤害',True,kind='burst',count=5,group='ousia-ready',assumptions=['C0；施放时荒性流涌之刃冷却已就绪，因此本动作同时包含另列的始基力伤害。'])
add('wriothesley','burstOusia','黑金狼噬·流涌之刃',True,kind='burst',group='ousia-ready',assumptions=['C0；施放时荒性流涌之刃冷却已就绪，因此本动作同时包含五段主伤害。'])

def attack_info_blocks(code):
 # Delimit actual Go composite literals, including nested AdditionalTags arrays.
 masked=re.sub(r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*.*?\*/',lambda m:' '*len(m.group()),code,flags=re.S)
 blocks=[]
 for found in re.finditer(r'info\.AttackInfo\s*\{',masked):
  start=found.end();depth=1;end=start
  while depth and end<len(masked):
   if masked[end]=='{':depth+=1
   elif masked[end]=='}':depth-=1
   end+=1
  if depth:raise ValueError('Unclosed AttackInfo literal')
  blocks.append(code[start:end-1])
 return blocks

def table_values(c,name):
 p=next((source/f'internal/characters/{c}').glob('zz_*.dm.go'));s=re.sub(r'//[^\n]*','',p.read_text());m=re.search(r'\b'+re.escape(name)+r'\s*=\s*\[\]float64\s*\{([^{}]+)\}',s)
 if not m:raise ValueError(f'No literal scalar table {c}/{name}')
 tokens=[t.strip() for t in m.group(1).split(',') if t.strip()]
 if any(not re.fullmatch(r'-?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?',v,re.I) for v in tokens):raise ValueError('Nonliteral table')
 values=list(map(float,tokens));assert len(values)==15,(c,name,len(values));return values

def match_param(ability,values,c=None,table=None):
 matches=[key for key,v in ability['parameters'].items() if v==values]
 if len(matches)!=1:
  reviewed={('klee','jumpy'):'param1',('diluc','burstInitial'):'param1'}.get((c,table))
  if reviewed not in matches:raise ValueError(f'Nonunique coefficient vector: {matches}')
  raw=next((source/f'internal/characters/{c}').glob('zz_*.dm.go')).read_text()
  assert re.search(r'//[^\n]*\{0\}\s*\n\s*'+re.escape(table)+r'\s*=',raw)
  return reviewed
 return matches[0]

mapped=[];rejected=[];evidence={}
for row in rows:
 try:
  c=row['char'];slug=alias.get(c,c);talent=talents[f'talent-set:{slug}'];abilityKey='combat2' if row['kind']=='skill' else 'combat3';ability=next(a for a in talent['abilities'] if a['key']==abilityKey);values=table_values(c,row['table']);param=match_param(ability,values,c,row['table'])
  sourcepath=f'internal/characters/{c}/{row["kind"]}.go';code=(source/sourcepath).read_text();blocks=attack_info_blocks(code)
  matching=[b for b in blocks if re.search(r'\b(?:Mult|FlatDmg):[^\n]*\b'+re.escape(row['table'])+r'\[c\.TalentLvl(?:Skill|Burst)\(\)\]',b)]
  if not matching:raise ValueError('No explicit reviewed AttackInfo coefficient')
  elements={re.search(r'\bElement:\s*attributes\.(\w+)',b).group(1).lower() for b in matching}
  assert len(elements)==1 and 'noelement' not in elements
  if row['scale']=='def':assert all('UseDef:' in b and re.search(r'UseDef:\s*true',b) for b in matching)
  if row['scale']=='hp':assert any(re.search(r'(?:FlatDmg:[^\n]*c\.MaxHP\(\)|UseHP:\s*true)',b) for b in matching)
  more=[]
  for termtable,stat in row['extra']:
   termvalues=table_values(c,termtable);termparam=match_param(ability,termvalues);assert termtable+'[c.TalentLvl' in code
   more.append({'scalingStat':stat,'parameterKey':termparam,'sourceCoefficientValues':termvalues,'coefficientTolerance':0})
  suffix='' if row['table']=='skill' else '-'+row['table'].lower();skillid=c+'-'+row['kind']+suffix
  hitid=skillid+'-hit'
  if row['group']:skillid=c+'-'+row['kind']+'-'+row['group']
  if c=='kaeya' and row['kind']=='skill':skillid='kaeya-skill'
  paths=[sourcepath,str(next((source/f'internal/characters/{c}').glob('zz_*.dm.go')).relative_to(source)),'pkg/enemy/damage.go']
  for filename in ['asc.go','cons.go',c+'.go']:
   path=f'internal/characters/{c}/{filename}'
   if (source/path).exists():paths.append(path)
  fixed=[]
  for stat,coefficient,filename,field in row['fixed']:
   fixedpath=f'internal/characters/{c}/{filename}'
   assert str(coefficient) in (source/fixedpath).read_text()
   fixed.append({'scalingStat':stat,'coefficient':coefficient,'sourceField':fixedpath+':'+field,'minimumAscension':4})
   if fixedpath not in paths:paths.append(fixedpath)
  tags={re.search(r'AttackTag:\s*attacks\.(\w+)',b).group(1) for b in matching}
  tagmap={'AttackTagElementalArt':'skill','AttackTagElementalArtHold':'skill','AttackTagElementalBurst':'burst','AttackTagNormal':'normal'}
  assert len(tags)==1 and next(iter(tags)) in tagmap,tags
  for path in paths:
   actual=hashlib.sha256((source/path).read_bytes()).hexdigest()
   if manifest['files'].get(path)!=actual:raise ValueError(f'Unreviewed source path or changed hash: {path}')
   evidence[path]=actual
  assumptions=['C0；只使用列出的伤害表达式。最终面板及当前命中适用的增伤/减抗由用户明确提供。','选定命中确实发生并命中单个目标；反应资格仅作为逐段条件输入，不声称自动附着覆盖。']+row['assumptions']
  if c=='xiao':assumptions+=['首次施放，坏劫·国土碾尘未积累层数；元素爆发等另行增伤未启用。']
  if c=='jean':assumptions+=['C0 风压剑，不启用 C1 长按增伤。']
  if c=='bennett' and row['kind']=='burst':assumptions+=['最终 ATK 必须是爆发命中快照实际采用的 ATK，不在计算器重复叠加领域增攻。']
  if c=='chiori':assumptions+=['不启用锦上添花的岩造物条件增伤；若已经启用，需将对应伤害加成明确计入该命中。']
  mapped.append({'id':hitid,'characterSlug':slug,'talentSetId':talent['id'],'abilityKey':abilityKey,'parameterKey':param,'skillId':skillid,'skillLabel':('黑金狼噬·五段主伤害与流涌之刃' if row['group']=='ousia-ready' else row['label']),'hitLabel':row['label'],'element':next(iter(elements)),'scalingStat':row['scale'],'attackTag':tagmap[next(iter(tags))],'sourceCoefficientValues':values,'coefficientTolerance':0,'sourcePaths':paths,'assumptions':assumptions,'exclusions':['不含队友伤害、反应生成实体、额外触发、命座伤害与未列出的持续 tick。','非伤害部分（护盾、治疗、能量、状态转换）不计入此伤害总额。']+([] if row['complete'] else ['这只是技能的所选伤害组成，不是整个技能/召唤物生命周期总伤。']),'completeAction':row['complete'],'instanceCount':row['count'],**({'additionalTerms':more} if more else {}),**({'fixedTerms':fixed} if fixed else {}),**({'additiveFormulaId':row['formula']} if row['formula'] else {})})
 except Exception as e:rejected.append({'character':row['char'],'table':row['table'],'reason':str(e)})
if rejected: raise ValueError(json.dumps({'blockedExtractions':rejected}, ensure_ascii=False))
out=root/'packages/game-data/src/character-mappings/skill-mappings-reviewed.ts';out.write_text('import type { SourceHitMapping } from "./types";\n\n/** Explicit reviewed declarations from fixed gcsim; vectors are exact provenance guards.\n * This file is generated from a reviewed allowlist, never by reading damage-like labels. */\nexport const reviewedSkillMappings: SourceHitMapping[] = '+json.dumps(mapped,ensure_ascii=False,indent=2)+';\n\nexport const reviewedSkillSourceEvidence = '+json.dumps({'commit':'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541','files':evidence,'blockedExtractions':rejected},ensure_ascii=False,indent=2)+' as const;\n')
print(json.dumps({'mapped':len(mapped),'characters':len(set(m['characterSlug'] for m in mapped)),'completeActions':sum(m['completeAction'] for m in mapped),'rejected':rejected},ensure_ascii=False,indent=2))
