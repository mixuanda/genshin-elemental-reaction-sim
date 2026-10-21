"""Independent arithmetic/ledger audit of captured native four-team runs.
Usage: python scripts/audit-four-team-120.py <capture.json> <report.json>
No engine execution, data migration, or result rewriting.
"""
import json, math, sys, collections

TALENTS = {'Passion Overload (Press)':1.376, 'Fantastic Voyage':2.328,
 'Frostgnaw':1.912,'Glacial Waltz':.776,'Guoba':1.1128,'Pyronado':1.12,
 'Pyronado Hit 1':.72,'Pyronado Hit 2':.88,'Pyronado Hit 3':1.096,
 'Astable Anemohypostasis Creation-6308':2.112,
 'Forbidden Creation-Isomer 75/Type II':1.48,
 'Forbidden Creation-Isomer 75/Type II (Absorb)':.44}
ACTORS=['bennett','kaeya','xiangling','sucrose']
MAX=[60,60,80,80]
DELAY={'bennett':36,'kaeya':51,'xiangling':24,'sucrose':21}

def close(a,b,label):
 assert math.isfinite(a) and math.isfinite(b) and abs(a-b)<1e-8, (label,a,b)

def audit(r,scenario):
 assert r['sourceCommit']=='b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541'
 assert r['observationWindow']['actualEndFrame']==7200
 assert r['observationWindow']['endReason']=='duration'
 records={x['request']['id']:x for x in r['calculations']}
 direct=[x['request'] for x in r['calculations'] if x['request']['kind']=='damage']
 bennett=next(q['snapshot']['baseAtk'] for q in direct if q['actorKey']=='bennett')
 sucrose=next(q['snapshot']['em'] for q in direct if q['actorKey']=='sucrose' and q['damageCategory']=='ordinary')
 errors=[]; hits=[]; buffs=collections.Counter(); expired=collections.Counter(); amps=collections.Counter(); snaps=collections.defaultdict(list)
 for app in r['applications']:
  q=records[app['calculationId']]['request'];i=q['input'];s=q['snapshot'];a=q['actorKey']
  assert a==ACTORS[q['actorIndex']] and app['frame']==q['frame']
  assert q['damageCategory'] in ['ordinary','transformative']
  logged=[x for x in r['logs'] if x['event']=='damage' and x['frame']==q['frame'] and x['char_index']==q['actorIndex'] and x['msg']==q['ability'] and x['logs']['target']==q['targetKey'] and abs(x['logs']['damage']-app['rawDamage'])<1e-8]
  assert logged,('missing original damage/ownership log',q['id'])
  close(i['effectiveResistance'],.1,'no resistance shred equipped')
  if q['damageCategory']=='ordinary':
   close(i['scaling'],TALENTS[q['ability']],'fixed b4 T1 talent')
   close(i['scalingValue'],s['baseAtk']*(1+s['atkPct'])+s['flatAtk'],'ATK snapshot')
   assert i['defenseIgnore']==0 and i['defenseAdjustment']==0
   assert q['talentTableRead']['indices'][-1]==0
   assert q['talentTableRead']['actorIndex']==q['actorIndex']
   for step in s['statProvenance']['snapshotRead']['steps']:
    read_frame=s['statProvenance']['snapshotRead']['frame']
    if step['outcome']=='expired':
     assert step['expiryBefore']!=-1 and step['expiryBefore']<=read_frame
     expired[step['key']]+=1
    if step['outcome']!='applied':continue
    assert step['expiryBefore']==-1 or step['expiryBefore']>read_frame,('expired modifier applied at Stats read',step['key'])
    key=step['key'];v=step['returned'];buffs[key]+=1
    if key=='bennett-field':close(v[5],.56*bennett,'Bennett T1 base ATK buff')
    elif key=='sucrose-a1':close(v[8],50,'Sucrose A1')
    elif key=='sucrose-a4':close(v[8],.2*sucrose,'Sucrose A4 non-extra EM')
    elif key=='skyrider':close(v[6],.12,'Skyrider R1')
    elif key=='pyro-res':close(v[6],.25,'double Pyro resonance')
    else:raise AssertionError(('unreviewed applied stat modifier',key))
   if q['ability']=='Pyronado':snaps[q['snapshotFrame']].append(q)
  else:
   assert a=='sucrose' and q['ability'] in ['swirl-pyro','swirl-cryo']
   assert not i['amped'] and not i['isCrit'] and i['defenseIgnore']==1
   assert len(q['componentApplications'])==1
   component=records[q['componentApplications'][0]['id']]['request']
   assert component['kind']=='transformative-base' and component['actorKey']==a
   ci=component['input'];close(ci['baseMultiplier'],.6,'Swirl coefficient')
   close(ci['levelBaseDamage'],1446.8535,'pinned level 90 reaction base')
   close(i['flatDamage'],1446.8535*.6*(1+16*ci['elementalMastery']/(2000+ci['elementalMastery'])),'Swirl hand formula')
  amp=1
  if i['amped']:
   assert i['amplifyingReaction']=='melt'
   expected=1.5 if q['element']=='cryo' else 2
   close(i['amplifyingMultiplier'],expected,'Melt direction')
   amp=expected*(1+2.78*i['elementalMastery']/(1400+i['elementalMastery'])+i['reactionBonus'])
   amps[a]+=1
   aura='pyro:' if q['element']=='cryo' else 'cryo:'
   elemental=[x for x in r['logs'] if x['event']=='element' and x['frame']==q['frame'] and x['char_index']==q['actorIndex'] and x['logs'].get('abil')==q['ability'] and x['logs'].get('target')==q['targetKey']]
   assert any(any(v.startswith(aura) for v in (x['logs'].get('existing') or [])) for x in elemental),('Melt lacks opposite original aura',q['id'])
  defense=(i['characterLevel']+100)/((i['characterLevel']+100)+(i['enemyLevel']+100)*(1-i['defenseAdjustment'])*(1-i['defenseIgnore']))
  hand=(i['scalingValue']*i['scaling']*(1+i['baseDamageBonus'])+i['flatDamage'])*(1+i['damageBonus'])*defense*.9*amp*(1+i['critDamage'] if i['isCrit'] else 1)*i['groupMultiplier']*(1+i['elevation'])
  close(app['rawDamage'],hand,'per hit hand formula');close(app['appliedDamage'],hand,'actual target application')
  errors.append(abs(app['rawDamage']-hand));hits.append({'id':app['id'],'actor':a,'ability':q['ability'],'frame':q['frame'],'snapshotFrame':q['snapshotFrame'],'reaction':i['amplifyingReaction'],'isCrit':i['isCrit'],'damage':app['rawDamage'],'hand':hand,'error':errors[-1]})
 frozenAfterExpiry=0
 for frame,qs in snaps.items():
  assert len(qs)==9,('C0 pyronado count',frame,len(qs))
  first=qs[0]
  for q in qs:
   assert q['snapshot']['baseAtk']==first['snapshot']['baseAtk'] and q['snapshot']['flatAtk']==first['snapshot']['flatAtk']
   assert q['snapshot']['em']==first['snapshot']['em']
   for step in q['snapshot']['statProvenance']['snapshotRead']['steps']:
    if step['key']=='bennett-field' and step['outcome']=='applied' and q['frame']>step['expiryAfter']:frozenAfterExpiry+=1
 assert frozenAfterExpiry>0,'need a real snapshot persisting beyond field-mod expiry'
 balance=[0 if scenario=='zero' else n for n in MAX]
 consumes=[]
 if 'startupState' in r:
  assert [a['energy'] for a in r['startupState']['actors']]==balance
 for e in r['energyApplications']:
  ix=e['actorIndex'];assert e['actorKey']==ACTORS[ix];close(e['energyBefore'],balance[ix],'continuous energy ledger')
  assert 0<=e['energyAfter']<=MAX[ix]
  if e['operation']=='consume':
   close(e['energyBefore'],MAX[ix],'Q funded');close(e['energyAfter'],0,'Q consumed')
   matching=[a for a in r['abilityInvocations'] if a['characterKey']==ACTORS[ix] and a['action']=='burst' and a['startedFrame']+DELAY[ACTORS[ix]]==e['frame']]
   assert len(matching)==1,'Q consumption matched exact native delay'
   consumes.append({'actor':ACTORS[ix],'frame':e['frame']})
  else:close(e['energyAfter'],min(MAX[ix],e['energyBefore']+e['requestedAmount']),'particle credit/clamp')
  balance[ix]=e['energyAfter']
 inv=r['abilityInvocations'];assert all(x['success'] for x in inv)
 cdcount=0
 for x in inv:
  preceding=[c for c in r['calculations'] if c['request']['kind']=='character-cooldown' and c['request']['input']['operation']=='duration' and c['request']['actorKey']==x['characterKey'] and c['request']['input']['action']==x['action'] and c['request']['frame']<x['startedFrame']]
  if preceding:
   last=preceding[-1];assert x['startedFrame']>=last['request']['frame']+last['value'],('CD not ready',x,last)
   cdcount+=1
 assert set(x['characterKey'] for x in inv)==set(ACTORS)
 bins=[sum(1 for a in inv if start<=a['startedFrame']<start+1800) for start in range(0,7200,1800)]
 assert all(bins) and r['applications'][-1]['frame']>6900
 return {'seed':r['seed'],'scenario':scenario,'hits':len(hits),'maxHandError':max(errors),'total':sum(a['rawDamage'] for a in r['applications']),'dps120':sum(a['rawDamage'] for a in r['applications'])/120,'lastHitFrame':r['applications'][-1]['frame'],'actionsPer30Seconds':bins,'Q':consumes,'finalEnergy':balance,'cooldownRecastsChecked':cdcount,'meltOwners':dict(amps),'buffApplications':dict(buffs),'expiredBuffReads':dict(expired),'pyronadoSnapshots':len(snaps),'snapshottedHitsAfterBuffExpiry':frozenAfterExpiry,'perHit':hits}

if __name__=='__main__':
 data=json.load(open(sys.argv[1]));runs=data.get('runs')
 reports=[audit(x['result'],x['scenario']) for x in runs] if runs else [audit(data,'native-default-full')]
 json.dump(reports,open(sys.argv[2],'w'),indent=2)
 print(json.dumps([{k:v for k,v in r.items() if k!='perHit'} for r in reports],indent=2))
