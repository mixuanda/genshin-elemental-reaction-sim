import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {importPlayerInput} from '../../../packages/player-import/src/index';
import {preparePlayerPanel} from './player-import-handoff';
import {preparePlayerPanelWithManualTalents} from './player-import-manual-talents';
import {getCharacterDocuments} from './character-calculations';
import {applyImportedCalculatorPanel} from './calculator-import';
import {calculateDocument} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument} from '../../../packages/sim-core/src/calculator-model';

function input(){
  const source=JSON.parse(readFileSync(new URL('../e2e/fixtures/player-import/kaeya-enka-panel.json',import.meta.url),'utf8'));
  delete source.avatarInfoList[0].proudSkillExtraLevelMap;
  delete source.avatarInfoList[0].fightPropMap['40']; // An unrelated Pyro bonus remains unknown.
  const raw=JSON.stringify(source),result=importPlayerInput(raw,{fixture:true});if(!result.ok)throw Error(result.message);
  return {raw,snapshot:result.snapshot,build:result.snapshot.builds[0]!};
}
describe('manual effective talents retain unknown source evidence in actual calculation',()=>{
  it('uses explicit E10 once, persists independent talent levels and nullable element bonuses',()=>{
    const {raw,snapshot,build}=input(),before=JSON.stringify(build);
    expect(()=>preparePlayerPanel(raw,build,snapshot.source)).toThrow();
    const checked=preparePlayerPanelWithManualTalents(raw,build,snapshot.source,{auto:1,skill:10,burst:9});
    expect(checked.character.resolvedSkills.every(s=>s.bonusLevel===null&&s.effectiveLevel===null)).toBe(true);
    const original=getCharacterDocuments(checked.character.catalog.characterId!,10).find(d=>d.gameContext?.skillId==='kaeya-skill')!;
    original.gameContext!.manualEffectiveTalents=checked.manualEffectiveTalents;
    const doc=applyImportedCalculatorPanel(original,checked.character,checked.source,'manual-effective'),result=calculateDocument(doc);
    expect(result.status).toBe('calculated');expect(doc.gameContext!.effectiveTalentLevel).toBe(10);
    const reopened=parseCalculatorDocument(serializeCalculatorDocument(doc));
    expect(reopened.gameContext!.manualEffectiveTalents).toEqual({auto:1,skill:10,burst:9});
    expect(reopened.gameContext!.importedPanelDamageBonuses!.pyro).toBeNull();
    expect(calculateDocument(reopened).totals).toEqual(result.totals);expect(JSON.stringify(build)).toBe(before);
  });
  it('still rejects a missing required panel property despite explicit talents',()=>{
    const {raw}=input(),source=JSON.parse(raw);delete source.avatarInfoList[0].fightPropMap['2001'];
    const text=JSON.stringify(source),result=importPlayerInput(text,{fixture:true});if(!result.ok)throw Error(result.message);
    expect(()=>preparePlayerPanelWithManualTalents(text,result.snapshot.builds[0]!,result.snapshot.source,{auto:1,skill:10,burst:9})).toThrow();
  });
});
