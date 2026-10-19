from pathlib import Path
import json,datetime,hashlib
out=Path(__file__).parent
manifest=json.loads((out/'retrieval-manifest.json').read_text())
records={row['file']:row for row in manifest['records'] if row.get('httpStatus')==200}
version='7.1.50'
now=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
license_status='No license declaration obtained from the sampled first-party API responses or frontend; redistribution license is unknown. The offline mirror license is not applied to upstream data.'
unknown=['No primary proof mapping provider7.1.50 to requested7.2V1 or its beta ordinal.','Version registry timestamp1790589600 means2026-09-28T10:00:00Z, after retrieval; meaning and accuracy unknown.','Only two observed character records sampled; full preview inventory, weapon and artifact data are not collected.','Absolute attribute rows may be rounded display values; source base/curve/promotion decomposition is unavailable.','Only numeric params array from the source is preserved as uninterpreted source-param indices; formatted level multiplier strings stay raw.','Energy, attack timing and endure collections are empty in sampled bodies; this does not prove zero cost or no mechanics.','ICD, trigger conditions, state windows, elemental application, hit grouping and runnable definitions are unverified.','Provider URL contains a version, but server immutability is not guaranteed; local saved raw bytes and hashes pin this observation.','No independent expected inventory or numerical/game-mechanic verification.']
sources=[]
for file,row in records.items():
 sid='lunaris-'+file.replace('.','-')
 sources.append({'id':sid,'url':row['url'],'revision':version+':sha256:'+row['sha256'],'retrievedAt':row['retrievedAt'],'gameVersion':version,'contentSha256':row['sha256'],'license':license_status,'verificationMethod':'HTTP200 exact source bytes retained with SHA256; no upstream code executed; content and version identity not independently verified.','evidenceRef':'retrieval-manifest.json#'+file})
cat_sources=[{'id':s['id'],'name':'Lunaris observed source '+s['id'],'url':s['url'],'version':version,'commit':s['revision'],'license':s['license'],'contentSha256':s['contentSha256'],'notes':'Provider revision label7.1.50; provisional unreleased observation, not a confirmed7.2V1 or current release.'} for s in sources]
characters=[];talents=[];constellations=[];fields=[]
def field(entity,path,source,mapping,missing=None):
 fields.append({'id':entity+':'+path,'entityId':entity,'path':path,'processingStatus':'raw' if missing else 'parsed','numericEvidenceStatus':'missing' if missing else 'unchecked','mechanicEvidenceStatus':'missing','sourceIds':[source],'sourceMapping':mapping,'testRefs':[],'rejectionReasons':[missing or 'Raw source values only; no independent numerical or semantic verification.'],'conflicts':[]})
for slug,aid in [('mitya',10000136),('valeriy',10000137)]:
 file=slug+'.chs.json';row=records[file];raw=json.loads((out/file).read_text());source='lunaris-'+file.replace('.','-');info=raw['info']
 prov={'patch':version,'source':row['url'],'sourceVersion':version+':sha256:'+row['sha256'],'verifiedAt':row['retrievedAt'],'verificationStatus':'provisional','notes':'verifiedAt is the required schema timestamp for source observation, not independent game verification. Source calls this a test character; release patch and7.2V1 mapping remain unknown.'}
 cid='character:'+str(aid);tid='talent-set:'+slug
 missing_stats='Source supplies absolute level/ascension attributes; no verified base/curve/promotion decomposition. Empty maps mean unavailable, not zero.'
 characters.append({'id':cid,'avatarId':aid,'slug':slug,'name':info['name'],'element':info['element'].lower(),'weaponType':{'WEAPON_CATALYST':'catalyst','WEAPON_SWORD_ONE_HAND':'sword'}[info['weapon']],'rarity':5 if info['rarity']=='QUALITY_ORANGE' else 4,'releasePatch':'unknown','talentSetIds':[tid],'stats':{'base':{},'curve':{},'specialized':'unknown','promotion':[]},'sourceAttributes':info['attributes'],'provenance':prov,'simulationStatus':'metadata-only','unmappedMechanics':[missing_stats,*unknown]})
 field(cid,'sourceAttributes',source,'$.info.attributes')
 field(cid,'stats',source,'$.info.attributes',missing_stats)
 abilities=[]
 groups=[('skills',key,kind) for key,kind in [('normalattack','normal'),('elementalskill','skill'),('elementalburst','burst')]]+[('passives',key,'passive') for key in raw['passives']]
 for group,key,kind in groups:
  value=raw[group][key];bid=tid+':'+key
  if not isinstance(value,dict):
   field(tid,'unavailable.'+key,source,'$.'+group+'.'+key,'Provider entry is an empty/non-object value; no ability invented.')
   continue
  params=value.get('params',[]);parameters={'sourceParam'+str(i):[v] for i,v in enumerate(params) if isinstance(v,(int,float)) and not isinstance(v,bool)}
  abilities.append({'id':bid,'key':key,'kind':kind,'name':value.get('name') or key,'description':value.get('description',''),'labels':list(value.get('multipliers',{})),'parameters':parameters,'levelCount':0,'sourceParameterMeaning':'Each one-element array preserves one raw provider params slot; level association is not asserted. levelCount0 means unclassified, not zero talent.','sourceMultipliers':value.get('multipliers',{}),'provenance':prov,'simulationStatus':'metadata-only','unmappedMechanics':['Raw params slots are not assigned to talent levels, scaling expressions, hit counts or damage categories.',*unknown]})
  for p in parameters:field(bid,'parameters.'+p,source,'$.'+group+'.'+key+'.params['+p.removeprefix('sourceParam')+']')
  field(bid,'sourceMultipliers',source,'$.'+group+'.'+key+'.multipliers')
  for semantic in ['scalingExpression','criticalPolicy','hitInstances','applicationIcd','actionTiming','energy']:
   field(bid,semantic,source,'$.'+group+'.'+key,semantic+' is not established by source text/params alone.')
 talents.append({'id':tid,'numericId':aid,'slug':slug,'name':info['name'],'releasePatch':'unknown','abilities':abilities,'provenance':prov,'simulationStatus':'metadata-only','unmappedMechanics':unknown})
 constellations.append({'id':'constellation-set:'+slug,'characterId':cid,'name':info['name'],'sourceMapping':'$.constellations','sourceId':source,'entries':raw['constellations'],'provenance':prov})
 field('constellation-set:'+slug,'entries',source,'$.constellations')
 field('constellation-set:'+slug,'executableEffects',source,'$.constellations','Constellation prose/params retained only; no executable mechanics or verification.')
catalog={'schemaVersion':'1.0.0','catalogVersion':'lunaris-7.1.50-preview-observed-20260924.partial-two-characters.1','locale':'zh-CN','gamePatch':version,'generatedAt':now,'sources':cat_sources,'counts':{'characters':len(characters),'talentSets':len(talents),'weapons':0,'enkaCharacterMappings':0},'characters':characters,'talentSets':talents,'weapons':[],'enkaCharacterMappings':[],'observationScope':{'observedEntityIds':[10000136,10000137],'fullInventory':'unknown','weapons':'not-collected','artifactSets':'not-collected','rawProviderVersion':version,'requested72V1Mapping':'unconfirmed'}}
bundle={'catalog':catalog,'supplemental':{'artifactSets':[],'constellationSets':constellations,'statCurves':{'characters':{},'weapons':{}}}}
metadata={'gameVersion':version,'label':catalog['catalogVersion'],'releaseStatus':'preview','createdAt':now,'sources':sources,'fields':fields,'definitions':[],'expectedInventory':None}
script=(out/'lunaris-app.js').read_text();i=script.index('async function SS');snippet=script[i:i+650]
evidence={'schemaVersion':1,'scope':'Two-character observed prerelease candidate only; no active pointer changes and no pipeline commands executed.','rawVersion':version,'released71':{'observedAtWindow':'2026-09-24T14:46:07Z/2026-09-24T14:48:17Z','url':'https://store.epicgames.com/p/genshin-impact','method':'Web indexed page text crawled today; direct HTTP403','sourceByteSha256':None,'observedClaim':'Version7.1 is now available. Official account update-details also readable; HoYoLAB linked body unavailable.'},'previewEvidence':{'frontendSourceFile':'lunaris-app.js','frontendSha256':records['lunaris-app.js']['sha256'],'sourceSnippet':snippet,'interpretation':'The first-party frontend passes showUnreleased into SS; true selects version.json version7.1.50, false selects7.1.0. Sampled CHS records also have info.description test-character text. This establishes provider unreleased classification, not an official7.2V1 label.'},'providerTimestamp':{'value':1790589600,'decodedUTC':'2026-09-28T10:00:00Z','meaning':'unknown; later than our observation; must not replace retrievedAt'},'observedEntities':[{'id':10000136,'name':'米提亚','englishName':'Mitya'},{'id':10000137,'name':'瓦列里','englishName':'Valeriy'}],'unknownFields':unknown,'licenseStatus':license_status,'pipelinePlan':'After root review, data:preview can consume candidate.bundle.json and candidate.metadata.json. Explicit fields override genshin-db-specific default source mappings. Empty unsupported categories are documented not-collected, not full-game zeroes. The preview selection would remain isolated from released/verified pointers. This script did not run ingestion, validation tests, builds, or any pointer mutation.'}
for name,data in [('candidate.bundle.json',bundle),('candidate.metadata.json',metadata),('candidate-evidence.json',evidence)]:
 (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
outputs={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in out.iterdir() if p.is_file() and p.name!='checksums.json'}
(out/'checksums.json').write_text(json.dumps(outputs,indent=2)+'\n')
for p in out.iterdir():
 if p.is_file():p.chmod(0o444)
print(json.dumps({'directory':str(out),'files':outputs,'counts':catalog['counts'],'abilities':sum(len(v['abilities']) for v in talents),'fieldAssessments':len(fields)},ensure_ascii=False))
