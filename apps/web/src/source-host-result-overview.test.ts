import { describe, expect, it } from 'vitest';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import { renderSourceHostResultOverview } from './source-host-result-overview';

const fixture = (overrides: Record<string, unknown> = {}): SourceHostResult => ({
  result: { duration: 120 }, observationWindow: { actualEndFrame: 60, configuredEndFrame: 120, policy: 'duration-or-native', endReason: 'targets-dead' },
  applications: [
    { id: 1, calculationId: 10, appliedDamage: 100 },
    { id: 2, calculationId: 11, appliedDamage: 25 },
    { id: 3, calculationId: 12, appliedDamage: 50 },
    { id: 4, calculationId: 999, appliedDamage: 25 },
  ],
  calculations: [
    { request: { id: 10, actorKey: 'amber' }, value: 100 },
    { request: { id: 11, actorKey: 'amber' }, value: 25 },
    { request: { id: 12, actorKey: 'kaeya' }, value: 50 },
  ],
  logs: [
    { event: 'character', char_index: 0, logs: { char_base: { key: 'amber' } } },
    { event: 'character', char_index: 1, logs: { char_base: { key: 'noelle' } } },
    { event: 'action', msg: 'source-host action queued', logs: {} },
    { event: 'action', frame: 14, char_index: 0, msg: 'source-host action rejected', logs: { action: 'burst', reason: 'insufficient_energy' } },
    { event: 'action', frame: 15, char_index: 0, msg: 'source-host action rejected', logs: { action: 'burst', reason: 'insufficient_energy' } },
  ],
  ...overrides,
} as unknown as SourceHostResult);

describe('source host result overview', () => {
  it('summarizes actual application damage, role attribution, duration, DPS, and recorded retry reasons', () => {
    const html = renderSourceHostResultOverview(fixture(), key => ({ amber: '安柏', kaeya: '凯亚', noelle: '诺艾尔' }[key]));
    expect(html).toContain('data-source-host-overview-duration>1 秒');
    expect(html).toContain('data-source-host-overview-total data-value=200>200');
    expect(html).toContain('data-source-host-overview-dps>200</strong>');
    expect(html).toContain('安柏');
    expect(html).toContain('凯亚');
    expect(html).toContain('诺艾尔');
    expect(html).toContain('data-actor-key="noelle"');
    expect(html).toContain('角色归属未知（未关联到来源伤害记录）');
    expect(html).toContain('能量不足 · 2 次未就绪重试');
    expect(html).toContain('本次模拟提前结束');
  });

  it('does not invent a duration or failure cause when source evidence is absent', () => {
    const html = renderSourceHostResultOverview(fixture({ logs: [], observationWindow: undefined, result: {}, applications: [] }));
    expect(html).toContain('未知（来源未记录时长）');
    expect(html).toContain('未知（没有有效时长）');
    expect(html).toContain('此结果没有可读的动作拒绝日志，等待原因未知。');
    expect(html).toContain('本次没有已结算伤害记录。');
  });
});

it('excludes the exact fixed-window endpoint consistently with curve and Monte Carlo totals',()=>{
 const html=renderSourceHostResultOverview(fixture({observationWindow:{endReason:'duration',actualEndFrame:7200,configuredEndFrame:7200},applications:[{id:1,calculationId:10,frame:7199,appliedDamage:100},{id:2,calculationId:10,frame:7200,appliedDamage:500}]}));
 expect(html).toContain('data-source-host-overview-total data-value=100>100');
 expect(html).toContain('data-source-host-overview-duration>120 秒');
});
