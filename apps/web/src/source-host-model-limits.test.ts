import {expect,it} from 'vitest';
import {SOURCE_HOST_COMMIT,SOURCE_HOST_STELLAR_COMMIT,type SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';
import {renderSourceResultModelLimits,renderSourceHitModelLimits} from './source-host-model-limits';
import {renderSourceHostResultOverview} from './source-host-result-overview';
const q={kind:'damage',actorKey:'kaeya',ability:'Glacial Waltz'};
function fixture(overrides:Record<string,unknown>={}):SourceHostResult{return {sourceCommit:SOURCE_HOST_COMMIT,result:{duration:120},observationWindow:{actualEndFrame:7200,configuredEndFrame:7200,endReason:'duration'},calculations:[{request:{...q,id:1}},{request:{...q,id:2}}],applications:[{id:1,calculationId:1,frame:7199,appliedDamage:10},{id:2,calculationId:2,frame:7199,appliedDamage:20},{id:3,calculationId:1,frame:7200,appliedDamage:99}],abilityInvocations:[{characterKey:'kaeya',action:'burst',success:true}],logs:[],...overrides} as unknown as SourceHostResult;}
it.each([SOURCE_HOST_COMMIT,SOURCE_HOST_STELLAR_COMMIT])('shows the independently inspected pinned model %s and preserves same-frame multi-target records',sourceCommit=>{
 const result=fixture({sourceCommit});const before=JSON.stringify(result);const html=renderSourceResultModelLimits(result);
 expect(html).toContain('实际结算 2 条 Q');expect(html).toContain('1 次成功释放');expect(html).toContain('几何近似');expect(html).toContain('起手后53帧');expect(html).toContain(`/blob/${sourceCommit}/`);expect(html).not.toContain('13次');expect(JSON.stringify(result)).toBe(before);
 const overview=renderSourceHostResultOverview(result);expect(overview).toContain('data-source-model-limit');expect(overview).toContain('data-value=30>30');
});
it('does not report total Q validation for an isolated hit or invent casts for older records',()=>{
 expect(renderSourceHitModelLimits(SOURCE_HOST_COMMIT,q)).toContain('单击重放一致不能验证');
 expect(renderSourceResultModelLimits(fixture({abilityInvocations:undefined}))).toContain('释放次数未记录');
});
it('also warns about zero recorded hits after a real burst invocation',()=>{
 expect(renderSourceResultModelLimits(fixture({calculations:[],applications:[]}))).toContain('实际结算 0 条 Q');
});
it('does not label E or another actor by an ability name alone',()=>{
 expect(renderSourceHitModelLimits(SOURCE_HOST_COMMIT,{...q,ability:'Frostgnaw'})).toBe('');
 expect(renderSourceHitModelLimits(SOURCE_HOST_COMMIT,{...q,actorKey:'noelle'})).toBe('');
 expect(renderSourceResultModelLimits(fixture({calculations:[],abilityInvocations:[]}))).toBe('');
});
it('unknown source never inherits pinned timing',()=>{
 const html=renderSourceHitModelLimits('unknown',q);expect(html).toContain('来源版本未核对');expect(html).not.toContain('起手后53帧');
});
it.each([
 [SOURCE_HOST_COMMIT,'8e159a65991824908ecfa1226ae18a18c87b1956f9458dc7257bd97b249322f6'],
 [SOURCE_HOST_STELLAR_COMMIT,'a16817836d46ca096f24cf31e70e614002d4d443eae06c64ba5fe0ee8bc62744'],
])('keeps known old Venti results readable with an actionable correction notice: %s',(sourceCommit,wasmSha256)=>{
 const result=fixture({sourceCommit,executionArtifact:{wasmSha256,wasmBytes:1},abilityInvocations:[],
  calculations:[{request:{kind:'damage',actorKey:'venti',ability:'Skyward Sonnett (Hold)',input:{hitWeakPoint:true}}}]});
 const before=JSON.stringify(result);
 expect(renderSourceResultModelLimits(result)).toContain('重新运行队伍可得到修正值');
 expect(JSON.stringify(result)).toBe(before);
 result.executionArtifact!.wasmSha256='unknown-or-new';
 expect(renderSourceResultModelLimits(result)).toBe('');
});
it('does not label old Venti Q or an unverified source as the known E bug',()=>{
 const result=fixture({executionArtifact:{wasmSha256:'8e159a65991824908ecfa1226ae18a18c87b1956f9458dc7257bd97b249322f6',wasmBytes:1},abilityInvocations:[],
  calculations:[{request:{kind:'damage',actorKey:'venti',ability:"Wind's Grand Ode",input:{hitWeakPoint:false}}}]});
 expect(renderSourceResultModelLimits(result)).toBe('');
 result.sourceCommit='unknown';expect(renderSourceResultModelLimits(result)).toBe('');
});
