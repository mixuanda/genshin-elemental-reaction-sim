"""Audit paired real-engine VV captures; never simulate or modify a saved result."""
import json,sys,math,collections
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
sys.dont_write_bytecode=True
spec=spec_from_file_location('prior',Path(__file__).with_name('audit-four-team-120.py'));prior=module_from_spec(spec);spec.loader.exec_module(prior)
root=Path(sys.argv[1]);control=json.load(open(root/'control.capture.json'));vv=json.load(open(root/'vv.capture.json'))

def resmult(r):return 1-r/2 if r<0 else 1/(4*r+1) if r>=.75 else 1-r

def inspect(r,group,scenario):
 records={c['request']['id']:c for c in r['calculations']};events=[];active='bennett';swirls=[];procs=[];windows=[]
 for log in r['logs']:
  if log['msg'].startswith('swapping '):active=log['msg'].split(' to ')[1]
  if log['event']=='damage' and log['msg'].startswith('swirl-'):swirls.append({'frame':log['frame'],'element':log['msg'][6:],'active':active})
  if log['msg'].startswith('vv 4pc proc:'):
   assert active=='sucrose' and log['char_index']==3
   procs.append({'frame':log['frame'],'key':log['logs']['reaction'],'target':log['logs']['target'],'active':active})
  if str(log['logs'].get('key','')).startswith('vv') and log['event']=='status':events.append(log)
 for proc in procs:
  secondary=any(s['frame']==proc['frame'] and 'vv'+s['element']==proc['key'] and s['active']=='sucrose' for s in swirls)
  primary=any(x['event']=='element' and x['frame']==proc['frame'] and x['char_index']==3 and x['logs'].get('target')==proc['target'] and x['logs'].get('applied_ele')=='anemo' and any(v.startswith(proc['key'][2:]+':') for v in (x['logs'].get('existing') or [])) for x in r['logs'])
  assert primary or secondary,('proc lacks native primary application or secondary Swirl',proc)
 for swirl in swirls:
  if swirl['active']!='sucrose':assert not any(p['frame']==swirl['frame'] and p['key']=='vv'+swirl['element'] for p in procs),('off-field Swirl refreshed VV',swirl)
 life={};refreshes=[];extensions=[];lifecycleChecks=0
 for log in r['logs']:
  key=log['logs'].get('key');frame=log['frame']
  if key in ['vvpyro','vvcryo'] and log['event']=='status':
   if log['msg'] in ['enemy mod added','enemy mod refreshed']:
    assert log['logs']['expiry']==frame+600
    if key in life and life[key]>frame:refreshes.append({'key':key,'frame':frame,'oldExpiry':life[key],'newExpiry':log['logs']['expiry']})
    life[key]=log['logs']['expiry']
   elif log['msg']=='mod extended':
    assert key in life and log['logs']['expiry']==life[key]+log['logs']['amt']
    life[key]=log['logs']['expiry'];extensions.append({'key':key,'frame':frame,'expiry':life[key]})
  if log['event']=='damage':
   expected=.1+(-.4 if life.get('vv'+log['logs']['ele'],-1)>frame else 0)
   qs=[x['request'] for x in r['calculations'] if x['request']['kind']=='damage' and x['request']['frame']==frame and x['request']['actorIndex']==log['char_index'] and x['request']['ability']==log['msg']]
   assert qs
   for q in qs:prior.close(q['input']['effectiveResistance'],expected,'independent VV event lifecycle')
   lifecycleChecks+=1
 errors=[];hits=[];snapshots=collections.defaultdict(list);resStates=collections.Counter()
 for app in r['applications']:
  q=records[app['calculationId']]['request'];i=q['input'];s=q['snapshot'];res=i['effectiveResistance'];close=prior.close
  reads=[rd for rd in q.get('scalarProvenance',{}).get('reads',[]) if rd['kind']=='resistance'];assert len(reads)==1
  rd=reads[0];close(rd['output'],res,'actual resistance read');assert rd['frame']==q['frame']
  applied=[t for t in rd['steps'] if t['outcome']=='applied'];close(res,.1+sum(t['delta'] for t in applied),'resistance contribution')
  for step in applied:
   assert group=='vv' and step['key']=='vv'+q['element'];close(step['delta'],-.4,'VV shred');assert step['expiryBefore']>q['frame']
   assert any(p['key']==step['key'] and p['target']==q['targetKey'] and p['frame']<=q['frame'] for p in procs)
  resStates[(q['element'],round(res,4))]+=1
  if q['damageCategory']=='ordinary':
   close(i['scaling'],prior.TALENTS[q['ability']],'pinned talent')
   close(i['scalingValue'],s['baseAtk']*(1+s['atkPct'])+s['flatAtk'],'ATK')
  else:
   assert q['actorKey']=='sucrose' and q['ability'].startswith('swirl-')
   base=records[q['componentApplications'][0]['id']]['request']['input'];bonus=.6 if group=='vv' else 0
   close(base['reactionBonus'],bonus,'VV swirl-only bonus');close(i['flatDamage'],1446.8535*.6*(1+16*base['elementalMastery']/(2000+base['elementalMastery'])+bonus),'Swirl')
  amp=i['amplifyingMultiplier']*(1+2.78*i['elementalMastery']/(1400+i['elementalMastery'])+i['reactionBonus']) if i['amped'] else 1
  d=(i['characterLevel']+100)/((i['characterLevel']+100)+(i['enemyLevel']+100)*(1-i['defenseAdjustment'])*(1-i['defenseIgnore']))
  hand=(i['scalingValue']*i['scaling']*(1+i['baseDamageBonus'])+i['flatDamage'])*(1+i['damageBonus'])*d*resmult(res)*amp*(1+i['critDamage'] if i['isCrit'] else 1)*i['groupMultiplier']*(1+i['elevation'])
  close(app['rawDamage'],hand,'hand damage');errors.append(abs(hand-app['rawDamage']))
  hits.append({'id':app['id'],'frame':q['frame'],'actor':q['actorKey'],'ability':q['ability'],'snapshotFrame':q['snapshotFrame'],'resistance':res,'damage':app['rawDamage'],'hand':hand,'error':errors[-1]})
  if q['ability']=='Pyronado':snapshots[q['snapshotFrame']].append(q)
 balance=[0 if scenario=='zero' else n for n in prior.MAX];consumes=[]
 for e in r['energyApplications']:
  ix=e['actorIndex'];close(e['energyBefore'],balance[ix],'energy continuity')
  if e['operation']=='consume':
   close(e['energyBefore'],prior.MAX[ix],'funded Q');close(e['energyAfter'],0,'consume');consumes.append(e['frame'])
   assert len([a for a in r['abilityInvocations'] if a['actorIndex']==ix and a['action']=='burst' and a['startedFrame']+prior.DELAY[e['actorKey']]==e['frame']])==1,'Q consumption timing'
  else:close(e['energyAfter'],min(prior.MAX[ix],e['energyBefore']+e['requestedAmount']),'particle credit')
  balance[ix]=e['energyAfter']
 cooldownChecks=0
 for a in r['abilityInvocations']:
  assert a['success']
  preceding=[c for c in r['calculations'] if c['request']['kind']=='character-cooldown' and c['request']['input']['operation']=='duration' and c['request']['actorKey']==a['characterKey'] and c['request']['input']['action']==a['action'] and c['request']['frame']<a['startedFrame']]
  if preceding:
   last=preceding[-1];assert a['startedFrame']>=last['request']['frame']+last['value'],'cooldown illegal';cooldownChecks+=1
 dynamic=[]
 for frame,qs in snapshots.items():
  assert len({q['input']['scalingValue'] for q in qs})==1
  if len({round(q['input']['effectiveResistance'],4) for q in qs})>1:dynamic.append(frame)
 if group=='vv':assert procs and any(s['active']!='sucrose' for s in swirls) and dynamic
 else:assert not procs and all(abs(h['resistance']-.1)<1e-12 for h in hits)
 return {'group':group,'scenario':scenario,'seed':r['seed'],'hits':len(hits),'maxHandError':max(errors),'total':sum(a['rawDamage'] for a in r['applications']),'lastHit':hits[-1]['frame'],'QCount':len(consumes),'cooldownChecks':cooldownChecks,'windowDamage':sum(a['rawDamage'] for a in r['applications'] if a['frame']<7200),'windowHits':sum(a['frame']<7200 for a in r['applications']),'boundaryHits':sum(a['frame']==7200 for a in r['applications']),'lifecycleChecks':lifecycleChecks,'refreshes':refreshes,'hitlagExtensions':extensions,'resistanceStates':[{'element':k[0],'resistance':k[1],'hits':v} for k,v in resStates.items()],'swirls':swirls,'procs':procs,'statusEvents':events,'snapshotsWithDynamicResistance':dynamic,'perHit':hits}

out=[]
for ca,va in zip(control['runs'],vv['runs']):
 assert ca['scenario']==va['scenario'] and ca['result']['seed']==va['result']['seed'];c=ca['result'];v=va['result']
 a=inspect(c,'control',ca['scenario']);b=inspect(v,'vv',va['scenario'])
 assert c['abilityInvocations']==v['abilityInvocations'],'rotation changed'
 energy_keys=['frame','actorIndex','actorKey','source','operation','energyBefore','energyAfter','requestedAmount','energyMax']
 assert [[e.get(k) for k in energy_keys] for e in c['energyApplications']]==[[e.get(k) for k in energy_keys] for e in v['energyApplications']],'paired energy changed'
 assert len(c['applications'])==len(v['applications'])
 diffs=[];cq={x['request']['id']:x['request'] for x in c['calculations']};vq={x['request']['id']:x['request'] for x in v['calculations']}
 for ac,av in zip(c['applications'],v['applications']):
  x=cq[ac['calculationId']];y=vq[av['calculationId']]
  for key in ['frame','actorIndex','actorKey','ability','element','snapshotFrame','attackId']:assert x[key]==y[key],key
  for key in ['scalingValue','scaling','isCrit','critRoll','elementalMastery','amped','amplifyingMultiplier']:assert x['input'][key]==y['input'][key],key
  prior.close(y['input']['damageBonus']-x['input']['damageBonus'],.15 if x['actorKey']=='sucrose' and x['element']=='anemo' else 0,'VV 2pc Anemo-only bonus')
  factor=resmult(y['input']['effectiveResistance'])/resmult(x['input']['effectiveResistance'])*(1+y['input']['damageBonus'])/(1+x['input']['damageBonus'])
  if x['damageCategory']=='transformative':factor*=y['input']['flatDamage']/x['input']['flatDamage']
  prior.close(av['rawDamage'],ac['rawDamage']*factor,'isolated VV per-hit difference')
  diffs.append({'frame':x['frame'],'actor':x['actorKey'],'ability':x['ability'],'control':ac['rawDamage'],'vv':av['rawDamage'],'factor':factor})
 out.append({'control':a,'vv':b,'perHitDifferences':diffs})
json.dump(out,open(root/'audit.json','w'),indent=2)
print(json.dumps([{g:{k:p[g][k] for k in ['hits','maxHandError','total','QCount','lastHit','snapshotsWithDynamicResistance']} for g in ['control','vv']} for p in out],indent=2))
