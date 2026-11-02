import { it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { importPlayerInput } from '../../../packages/player-import/src/index';
import { preparePlayerPanel } from './player-import-handoff';
// Offline replay of a single separately fetched official-doc example. Never calls the API.
it.skipIf(!process.env.GIDPS_ENKA_RESPONSE)('public response normalizes and reports individual panel gates',()=>{
 const raw=readFileSync(process.env.GIDPS_ENKA_RESPONSE!,'utf8');
 const result=importPlayerInput(raw);expect(result.ok).toBe(true);if(!result.ok)return;
 const report=result.snapshot.builds.map(build=>{
  try{const p=preparePlayerPanel(raw,build,result.snapshot.source);return {character:p.character.catalog.characterId,status:'panel-ready',skills:p.character.resolvedSkills.map(s=>({id:s.skillId,base:s.baseLevel,bonus:s.bonusLevel,effective:s.effectiveLevel}))};}
  catch(e){return {character:build.identity.value?.id,status:'blocked',reason:String(e)};}
 });
 writeFileSync(process.env.GIDPS_ENKA_REPORT!,JSON.stringify(report,null,2));
 expect(report.length).toBeGreaterThan(0);
});
