#!/usr/bin/env python3
"""Render explicit fixed-seed native comparisons; never simulate or average samples."""
import argparse
import csv
import hashlib
import html
import json
import math
from pathlib import Path


def render(comparison, output):
    if comparison.get("schemaVersion") != "wanderer-recharge-comparison/1":
        raise ValueError("Unsupported explicit comparison contract")
    runs = comparison["runs"]
    if not runs or any(run["statisticsWindow"] != "[0,7200)" for run in runs):
        raise ValueError("Every run must retain the same 120-second half-open window")
    identities = [(row["variant"], row["seed"]) for row in runs]
    if len(set(identities)) != len(identities):
        raise ValueError("Duplicate variant/seed; do not count a repeated sample twice")
    for run in runs:
        if run["sourceCommit"] != comparison["sourceCommit"] or run["wasmSha256"] != comparison["wasmSha256"]:
            raise ValueError("Comparison rows must use the identical corrected source artifact")
        if not math.isclose(math.fsum(row["damage"] for row in run["actors"]), run["totalDamage"], rel_tol=2e-14):
            raise ValueError("Actor contributions do not conserve damage")
        if len(run["curve1s"]) != 120 or not math.isclose(math.fsum(row["damage"] for row in run["curve1s"]), run["totalDamage"], rel_tol=2e-14):
            raise ValueError("Real 1-second bins do not conserve damage")
        if not math.isclose(run["dps"] * 120, run["totalDamage"], rel_tol=2e-14):
            raise ValueError("DPS must use the complete 120-second denominator")
    output.mkdir(parents=True, exist_ok=True)
    prefix = "wanderer-team-recharge"
    (output / f"{prefix}.comparison.json").write_text(json.dumps(comparison, ensure_ascii=False, indent=2) + "\n")
    names = {"wanderer": "流浪者", "faruzan": "珐露珊", "nicole": "妮可", "durin": "杜林"}
    fmt = lambda number: f"{number:,.2f}"
    esc = html.escape
    sections, rows = [], []
    for run in runs:
        variant, seed = run["variant"], run["seed"]
        stem = f"{prefix}.{variant}.{seed}"
        with (output / f"{stem}.curve-1s.csv").open("w", newline="") as stream:
            writer = csv.writer(stream, lineterminator="\n")
            writer.writerow(["startSeconds", "endSeconds", "damage", "cumulative"])
            for point in run["curve1s"]:
                writer.writerow([point[key] for key in ("startSeconds", "endSeconds", "damage", "cumulative")])
        with (output / f"{stem}.q-decisions.csv").open("w", newline="") as stream:
            writer = csv.writer(stream, lineterminator="\n")
            writer.writerow(["actor", "frame", "seconds", "energy", "maxEnergy", "cooldownFrames", "ready"])
            for decision in run["qDecisions"]:
                writer.writerow([decision[key] for key in ("actor", "frame", "seconds", "energy", "maxEnergy", "cooldownFrames", "ready")])
        wanderer = run["qByActor"]["wanderer"]
        rows.append(f'<tr><td>{esc(run["label"])}<small class="mobile-seed">种子 {esc(seed)}</small></td><td>{esc(seed)}</td><td>{run["wandererEnergyRecharge"] * 100:.2f}%</td><td>{fmt(run["dps"])}</td><td>{wanderer["cast"]} / {wanderer["decisions"]}</td><td>{wanderer["skipped"]}</td><td>{run["hits"]}</td></tr>')
        actor_rows = "".join(f'<tr><td>{names[row["key"]]}</td><td>{fmt(row["damage"])}</td><td>{row["share"] * 100:.2f}%</td><td>{row["hits"]}</td></tr>' for row in run["actors"])
        q_rows = "".join(f'<tr><td>{names[actor]}</td><td>{facts["cast"]}</td><td>{facts["decisions"]}</td><td>{facts["skipped"]}</td></tr>' for actor, facts in run["qByActor"].items())
        peak = max(point["damage"] for point in run["curve1s"])
        bars = "".join(f'<rect x="{24 + i * 8:.2f}" y="{180 - point["damage"] / peak * 150:.3f}" width="7" height="{point["damage"] / peak * 150:.3f}"><title>{i}–{i + 1}秒：{fmt(point["damage"])}</title></rect>' for i, point in enumerate(run["curve1s"]))
        sections.append(f'''<details><summary>{esc(run["label"])} · 种子 {esc(seed)}：角色、循环与曲线</summary>
<div class="scroll"><table><thead><tr><th>角色</th><th>伤害</th><th>占比</th><th>命中</th></tr></thead><tbody>{actor_rows}</tbody></table></div>
<div class="scroll"><table><thead><tr><th>角色</th><th>实际 Q</th><th>到达 Q 检查</th><th>跳过</th></tr></thead><tbody>{q_rows}</tbody></table></div>
<p>本次流浪者 C4 随机雷增益实际保留的回能：{fmt(run['c4ElectroActualGain'])} 点；已扣除达到能量上限而溢出的部分。</p>
<svg viewBox="0 0 1000 215" role="img" aria-label="{esc(run['label'])}，单次伤害的1秒汇总"><text x="24" y="18">伤害（点）· 1秒汇总 · 空档保留零</text>{bars}<text x="24" y="205">0秒</text><text x="490" y="205">60秒</text><text x="930" y="205">120秒</text></svg>
<p><a href="{stem}.hits.csv" download>逐击整数帧 CSV</a> · <a href="{stem}.curve-1s.csv" download>逐秒汇总 CSV</a> · <a href="{stem}.q-decisions.csv" download>每次 Q 能量检查</a></p>
<p>各轮起点帧：{esc('、'.join(str(frame) for frame in run['phaseFrames']))}。120秒结束后的伤害不计入；尚未到达的 Q 检查不记成缺能跳过。</p></details>''')
    candidates = []
    for candidate in comparison["candidates"]:
        changes = "；".join(f'{esc(row["label"])} {row["delta"]:+.2f} {esc(row["unit"])}' for row in candidate["displayDeltas"])
        candidates.append(f'<li><strong>{esc(candidate["label"])}</strong>：{changes}。五件仍共 {candidate["totalRolls"]} 次词条，主词条、套装和逐件档位预算不变。<a href="{esc(candidate["equipmentAsset"])}" download>逐件配装</a> · <a href="{esc(candidate["configAsset"])}" download>实际自适应动作轴</a></li>')
    explanation = "".join(f"<p>{esc(text)}</p>" for text in comparison["conclusions"])
    limits = "".join(f"<li>{esc(text)}</li>" for text in comparison["limitations"])
    page = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>散法妮杜：合法充能配装对照</title>
<style>body{{max-width:1100px;margin:28px auto;padding:0 16px;font:16px/1.65 system-ui;color:#173043;background:#f7fafc}}h1{{line-height:1.3}}table{{border-collapse:collapse;width:100%;background:#fff;margin:14px 0}}th,td{{border:1px solid #c8d5de;padding:7px 10px;text-align:left;white-space:nowrap}}.scroll{{overflow:auto}}details{{margin:20px 0}}summary{{cursor:pointer;font-weight:600}}svg{{width:100%;height:auto;background:#fff}}rect{{fill:#28799b}}a{{color:#075c94}}code{{overflow-wrap:anywhere}}li{{margin:7px 0}}.mobile-seed,.narrow-label{{display:none}}@media(max-width:640px){{.comparison-table{{font-size:14px}}.comparison-table th,.comparison-table td{{padding:7px 6px}}.comparison-table th:nth-child(2),.comparison-table td:nth-child(2),.comparison-table th:nth-child(3),.comparison-table td:nth-child(3),.comparison-table th:nth-child(6),.comparison-table td:nth-child(6),.comparison-table th:nth-child(7),.comparison-table td:nth-child(7){{display:none}}.comparison-table td:first-child{{white-space:normal}}.mobile-seed{{display:block;font-size:12px}}.wide-label{{display:none}}.narrow-label{{display:inline}}}}</style>
<main><h1>散／法／妮／杜：合法充能配装对照</h1>
<p>流浪者 100级 C6 图莱 R5；珐露珊 C6 西风 R5；妮可、杜林 C2 专武 R1。仅在原圣遗物预算内换词条，开场满能一次，此后没有补能。</p>
{explanation}<div class="scroll"><table class="comparison-table"><thead><tr><th>配装</th><th>固定种子</th><th>流浪者充能</th><th><span class="wide-label">本次120秒DPS</span><span class="narrow-label">120秒DPS</span></th><th><span class="wide-label">实际Q / 检查</span><span class="narrow-label">Q / 检查</span></th><th>跳过Q</th><th>命中</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
<h2>换充能的代价</h2><ul>{''.join(candidates)}</ul><p>队友等级90、全部武器90、基础天赋10/10/10，目标100级、10%抗性，实用动作延迟与原配装相同。配装是假设的合法装备，不代表玩家背包或全局最优。</p>
{''.join(sections)}<details><summary>修正与复算范围</summary><ul>{limits}</ul><p>Classic <code>{esc(comparison['sourceCommit'])}</code><br>WASM <code>{esc(comparison['wasmSha256'])}</code></p><p><a href="{prefix}.comparison.json" download>完整对照摘要 JSON</a> · <a href="wanderer-team-120-classic.html">原固定种子历史场景</a></p></details></main></html>'''
    (output / f"{prefix}.html").write_text(page)
    paths = sorted(output.glob(f"{prefix}.*"))
    return [{"name": path.name, "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in paths]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("comparison", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(render(json.loads(args.comparison.read_text()), args.output), ensure_ascii=False))
