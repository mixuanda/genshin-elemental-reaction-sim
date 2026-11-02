import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {calculateDocument} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
import {canCreateAlhaithamActualPanelDraft,createAlhaithamActualPanelDraft} from './alhaitham-final-panel-draft';
import {collectCalculatorRequirements} from './calculator-requirements';
const fixture=()=>parseCalculatorDocument(readFileSync(new URL('../e2e/fixtures/player-import/alhaitham-c2-unsupported-equipment.json',import.meta.url),'utf8'));
describe('blocked Alhaitham equipment to actual panel input',()=>{
 it('preserves original gear and opens only a blocked unconfirmed draft, including when C2 delta is zero',()=>{
  const original=fixture(),before=JSON.stringify(original);expect(calculateDocument(original).status).toBe('blocked');
  expect(canCreateAlhaithamActualPanelDraft(original)).toBe(true);const draft=createAlhaithamActualPanelDraft(original);
  expect(JSON.stringify(original)).toBe(before);expect(draft.build.mode).toBe('manual-final');expect(draft.build).not.toHaveProperty('equipment');
  expect(draft.gameContext!.alhaithamDamage!.c2OtherSnapshotStatsFinal).toBe(false);expect(calculateDocument(draft).status).toBe('blocked');expect(draft.hits.every(h=>h.kind!=='ordinary'||!h.finalSnapshot)).toBe(true);
  expect(collectCalculatorRequirements(draft).fields.some(field=>field.fieldPath==='gameContext.alhaithamDamage.c2OtherSnapshotStatsFinal')).toBe(true);
  delete draft.gameContext!.alhaithamDamage!.c2OtherSnapshotStatsFinal;
  const reopened=parseCalculatorDocument(serializeCalculatorDocument(draft));
  expect(reopened.gameContext!.alhaithamDamage!.c2RequiresActualPanelConfirmation).toBe(true);
  expect(calculateDocument(reopened).status).toBe('blocked');
  expect(collectCalculatorRequirements(reopened).fields.some(field=>field.fieldPath==='gameContext.alhaithamDamage.c2OtherSnapshotStatsFinal')).toBe(true);
  if(draft.build.mode!=='manual-final')throw Error();Object.assign(draft.build.stats,{atk:2000,em:300,critRate:.5,critDamage:1});expect(calculateDocument(draft).status).toBe('blocked');
  draft.gameContext!.alhaithamDamage!.c2OtherSnapshotStatsFinal=true;const result=calculateDocument(draft);expect(result.status).toBe('calculated');expect(result.totals!.expected).toBeCloseTo(9552.816,8);
 });
 it('refuses nonmatching or already captured historical offense',()=>{
  const d=fixture();d.gameContext!.constellation=0;expect(canCreateAlhaithamActualPanelDraft(d)).toBe(false);expect(()=>createAlhaithamActualPanelDraft(d)).toThrow('历史结果不能改写');
  const frozen=fixture(),h=frozen.hits[0]!;if(h.kind!=='ordinary')throw Error();h.effectiveCritRate=.5;expect(canCreateAlhaithamActualPanelDraft(frozen)).toBe(false);
 });
});
