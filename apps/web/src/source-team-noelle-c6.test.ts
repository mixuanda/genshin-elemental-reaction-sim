import {describe,expect,it} from 'vitest';
import {SOURCE_HOST_COMMIT,SOURCE_HOST_STELLAR_COMMIT} from '../../../packages/sim-core/src/source-host-wire';
import {compileSourceTeamDraft,type SourceTeamDraft,type SourceTeamInventory} from './source-team-builder';
function fixture(stellar=false){
 const inventory:SourceTeamInventory={repository:'https://github.com/genshinsim/gcsim',hostVariant:stellar?'stellar':'classic',revision:stellar?SOURCE_HOST_STELLAR_COMMIT:SOURCE_HOST_COMMIT,
  characters:[{kind:'character',key:'noelle',sourceGameId:10000034,name:'诺艾尔',packagePath:'internal/characters/noelle',maximumLevel:90,weaponClass:'claymore',actionCapabilities:{schemaVersion:1,normalChain:{length:4},actions:[{kind:'burst',status:'implemented',method:'Burst',parameters:[{key:'extend',source:{path:'synthetic-test-capability-not-mechanism-evidence',line:1}}]}]}}],
  weapons:[{kind:'weapon',key:'debateclub',name:'以理服人',packagePath:'internal/weapons/claymore/debateclub',maximumLevel:90,weaponClass:'claymore'}],artifacts:[]};
 const draft:SourceTeamDraft={schemaVersion:1,name:'Explicit no-kill UI compiler fixture',source:{hostVariant:inventory.hostVariant,revision:inventory.revision},members:[{id:'noelle',characterKey:'noelle',level:90,levelCap:90,constellation:6,talents:{auto:1,skill:1,burst:1},weapon:{key:'debateclub',level:1,levelCap:20,refinement:1},artifactSets:[],artifactStats:{}}],actions:[{actorId:'noelle',kind:'burst'}],durationSeconds:120,target:{level:90,resistance:.1}};
 return {inventory,draft};
}
describe('Noelle C6 new ordinary-axis compilation',()=>{
 for(const stellar of [false,true])it(`does not invent kill extension when compiling ${stellar?'Stellar':'Classic'} Q and does not rewrite saved input`,()=>{
  const {inventory,draft}=fixture(stellar),before=structuredClone(draft);expect(compileSourceTeamDraft(draft,inventory)).toContain('noelle burst[extend=0];');expect(draft).toEqual(before);
 });
 it('retains explicit user extension and non-C6 source defaults without mutating either draft',()=>{
  const {inventory,draft}=fixture();draft.actions[0]!.params={extend:4};const before=structuredClone(draft);expect(compileSourceTeamDraft(draft,inventory)).toContain('noelle burst[extend=4];');expect(draft).toEqual(before);
  delete draft.actions[0]!.params;draft.members[0]!.constellation=5;expect(compileSourceTeamDraft(draft,inventory)).toContain('noelle burst;');
 });
});
