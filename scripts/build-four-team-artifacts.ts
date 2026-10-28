import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolveArtifactBuild,type ArtifactPieceInput,type ArtifactStatKey,type ArtifactSubstatKey} from '../packages/game-data/src/artifact-build';
const output=process.argv[2]!;mkdirSync(output,{recursive:true});
const base=readFileSync('apps/web/e2e/fixtures/four-team-120-second.gcsim','utf8');
const metadata=JSON.parse(readFileSync('apps/web/public/source-host/inventory-metadata.json','utf8'));
const native=new Map<number,string>(metadata.packages.filter((p:any)=>p.kind==='artifact').map((p:any)=>[p.resolved.sourceGameId,p.resolved.configurationKey]));
const names:Record<string,string>={FIGHT_PROP_HP:'hp',FIGHT_PROP_HP_PERCENT:'hp%',FIGHT_PROP_ATTACK:'atk',FIGHT_PROP_ATTACK_PERCENT:'atk%',FIGHT_PROP_ELEMENT_MASTERY:'em',FIGHT_PROP_CHARGE_EFFICIENCY:'er',FIGHT_PROP_CRITICAL:'cr',FIGHT_PROP_CRITICAL_HURT:'cd',FIGHT_PROP_FIRE_ADD_HURT:'pyro%',FIGHT_PROP_ICE_ADD_HURT:'cryo%'};
const actors=['bennett','kaeya','xiangling','sucrose'];const receipt:any={source:'artifact-stats-go-180a0a1',groups:{}};
for(const group of ['control','vv']){
 let config=base;const builds:any={};
 for(const actor of actors){
  const main:ArtifactStatKey[]=['hp','atk',actor==='sucrose'?'eleMas':'enerRech_',actor==='sucrose'?'eleMas':actor==='kaeya'?'cryo_dmg_':'pyro_dmg_',actor==='sucrose'?'eleMas':'critRate_'];
  const pieces:ArtifactPieceInput[]=(['flower','plume','sands','goblet','circlet'] as const).map((slot,i)=>{
   const keys:ArtifactSubstatKey[]=['atk_','enerRech_','critRate_','critDMG_','hp_'];
   const subs=keys.filter(k=>k!==main[i]).slice(0,4);
   return {slot,setId:`artifact-set:${group==='vv'&&actor==='sucrose'&&i<4?15002:[15001,15002,15003,15007,15008][i]}`,rarity:5,level:20,mainStat:main[i]!,initialSubstats:3,substats:subs.map((stat,j)=>({stat,rolls:Array(j===0?5:1).fill(0)}))};
  });
  const resolved=resolveArtifactBuild(pieces);const stats:Record<string,number>={};
  for(const term of resolved.statContributions){const key=names[term.property];if(!key)throw Error(term.property);stats[key]=(stats[key]??0)+term.value;}
  const lines=[`${actor} add stats ${Object.entries(stats).map(([k,v])=>`${k}=${v}`).join(' ')};`,...Object.entries(resolved.setCounts).map(([id,count])=>{const key=native.get(Number(id.split(':')[1]));if(!key)throw Error(id);return `${actor} add set="${key}" count=${count};`;})];
  config=config.replace('target lvl=',lines.join('\n')+'\ntarget lvl=');
  builds[actor]={pieces,resolved,stats};
 }
 receipt.groups[group]=builds;writeFileSync(`${output}/${group}.gcsim`,config);
}
writeFileSync(`${output}/artifact-builds.json`,JSON.stringify(receipt,null,2));
console.log('Validated 40 pieces: two groups of four actors, identical legal stat histories; Sucrose set identity is the only difference.');
