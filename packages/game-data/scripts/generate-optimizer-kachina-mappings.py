#!/usr/bin/env python3
"""Generate only explicitly reviewed Kachina rows from immutable literal JSON.

The allowlist below is the semantic review; no localized labels are classified.
Downloaded TypeScript is hash checked, never imported or executed.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--source-root", type=Path, required=True)
args = parser.parse_args()
package = Path(__file__).resolve().parents[1]
folder = package / "src/character-mappings"
manifest = json.loads((folder / "optimizer-kachina-source-manifest.json").read_text())
for source in manifest["sourceFiles"]:
    payload = (args.source_root / source["path"]).read_bytes()
    if hashlib.sha256(payload).hexdigest() != source["sha256"]:
        raise ValueError(f"Pinned source changed: {source['path']}")
stats_path = "libs/gi/stats/Data/Characters/Kachina/skillParam.json"
sheet_path = "libs/gi/sheets/src/Characters/Kachina/index.tsx"
params = json.loads((args.source_root / stats_path).read_text())
selection = (package / "manifests/runtime/current.ts").read_text()
catalog_relative = re.search(r'from "([^"]+/catalog.json)"', selection).group(1)
catalog = json.loads((package / "manifests/runtime" / catalog_relative).read_text())
talent = next(row for row in catalog["talentSets"] if row["id"] == "talent-set:kachina")
abilities = {row["key"]: row for row in talent["abilities"]}
source_paths = [row["path"] for row in manifest["sourceFiles"] if row["path"] != "LICENSE"]

# (stable action, instance, source array, index, talent ability, tag, stat, element, complete)
reviewed = [
    ("normal-1", "1", "auto", 0, "combat1", "normal", "atk", "physical", True),
    ("normal-2", "1", "auto", 1, "combat1", "normal", "atk", "physical", True),
    ("normal-2", "2", "auto", 2, "combat1", "normal", "atk", "physical", True),
    ("normal-3", "1", "auto", 3, "combat1", "normal", "atk", "physical", True),
    ("normal-4", "1", "auto", 4, "combat1", "normal", "atk", "physical", True),
    ("charged", "1", "auto", 5, "combat1", "charged", "atk", "physical", True),
    ("plunge-collision", "1", "auto", 7, "combat1", "plunge", "atk", "physical", False),
    ("plunge-low-no-collision", "1", "auto", 8, "combat1", "plunge", "atk", "physical", True),
    ("plunge-high-no-collision", "1", "auto", 9, "combat1", "plunge", "atk", "physical", True),
    ("plunge-low-with-collision", "1", "auto", 7, "combat1", "plunge", "atk", "physical", True),
    ("plunge-low-with-collision", "2", "auto", 8, "combat1", "plunge", "atk", "physical", True),
    ("plunge-high-with-collision", "1", "auto", 7, "combat1", "plunge", "atk", "physical", True),
    ("plunge-high-with-collision", "2", "auto", 9, "combat1", "plunge", "atk", "physical", True),
    ("skill-riding-single-pulse", "1", "skill", 0, "combat2", "skill", "def", "geo", False),
    ("skill-independent-single-pulse", "1", "skill", 1, "combat2", "skill", "def", "geo", False),
    ("skill-observed-lifecycle", "1", "skill", 0, "combat2", "skill", "def", "geo", False),
    ("skill-observed-lifecycle", "2", "skill", 1, "combat2", "skill", "def", "geo", False),
    ("burst-initial", "1", "burst", 0, "combat3", "burst", "def", "geo", True),
]
labels = {"charged": "基础重击", "plunge-collision": "下落途中单次碰撞", "plunge-low-no-collision": "低空下落着地（零碰撞）", "plunge-high-no-collision": "高空下落着地（零碰撞）", "plunge-low-with-collision": "低空下落（一次碰撞及着地）", "plunge-high-with-collision": "高空下落（一次碰撞及着地）", "skill-riding-single-pulse": "搭乘冲天转转·单次震荡", "skill-independent-single-pulse": "独立冲天转转·单次震荡", "skill-observed-lifecycle": "冲天转转·实际完整寿命", "burst-initial": "认真点！·C0直接伤害"}
mappings = []
for action, instance, source_key, index, ability_key, tag, stat, element, complete in reviewed:
    values = params[source_key][index]
    parameter_key = f"param{index + 1}"
    if len(values) != 15 or values != abilities[ability_key]["parameters"][parameter_key]:
        raise ValueError(f"Exact 15-level match failed: {source_key}[{index}] -> {parameter_key}")
    label = labels.get(action, f"基础普攻第 {action.rsplit('-', 1)[-1]} 下")
    assumptions = ["C0 基础动作审阅；未开启本映射未建模的命座触发。", "命中时面板由用户提供；不把来源程序的占位公式当作属性或伤害。"]
    if element == "physical":
        assumptions.append("未搭乘冲天转转，未受外部附魔；按无附魔长柄武器的物理基础招式计算。A1 岩伤与 A4 战技基础增量不适用于该物理招式。")
    else:
        assumptions.append("A1 的夜魂迸发后 12 秒岩伤加成状态明确未启用；若该状态已触发，须把实际 20% 岩伤加成作为额外命中增伤输入，不能按此关闭条件冒充实战。")
    if action.endswith("with-collision"):
        assumptions.append("此分支确认同一敌人受到一次下落途中碰撞和对应高度着地各一次；碰撞数或接触结果不同须选其他分支。")
    elif action.startswith("plunge-"):
        assumptions.append("这里只计算标明的一次碰撞或着地实例；低/高空着地动作明确途中碰撞次数为 0，不推断高度、碰撞与下落耗时。")
    if tag == "skill":
        assumptions.append("A4 解锁后额外 20% DEF 基础伤害由共同核心按突破自动加入一次。" + ("实际完整寿命须由显式接触、搭乘切换、夜魂余额和结束观察记录构造；未给定时此模板不代表完整E。" if action == "skill-observed-lifecycle" else "仅所选形态的一次震荡；不推断夜魂值、自动震荡间隔、总次数或整轮持续时间。"))
    if tag == "burst":
        assumptions.append("C0 Q 自身只有本次 DEF 岩伤；12秒超级钻探领域改变冲天转转范围和骑乘移动，不产生Q所属后续伤害。后续E震荡归属E。C2及以上的夜魂、场内防御和护盾触发另属其他条件，当前仅C0。")
    row = {"id": f"kachina-{action}-hit-{instance}", "characterSlug": "kachina", "talentSetId": "talent-set:kachina", "abilityKey": ability_key,
           "parameterKey": parameter_key, "skillId": f"kachina-{action}", "skillLabel": label, "hitLabel": f"{label}·第 {instance} 段", "element": element,
           "attackTag": tag, "scalingStat": stat, "sourceCoefficientValues": values, "coefficientTolerance": 0,
           "sourceRepository": manifest["repository"], "sourceCommit": manifest["commit"], "sourcePaths": source_paths,
           "assumptions": assumptions, "exclusions": ["夜魂消耗/迸发触发、领域时间、命座和团队增益时序未由这个独立伤害组件建立。"], "completeAction": complete}
    if tag == "skill":
        if params["passive2"] != [[0.2]]:
            raise ValueError("Kachina A4 coefficient changed")
        row["fixedTerms"] = [{"scalingStat": "def", "coefficient": 0.2, "minimumAscension": 4, "sourceField": f"{sheet_path}:a4_skill_dmgInc<-{stats_path}:passive2[0][0]"}]
    mappings.append(row)
output = ('// Generated by generate-optimizer-kachina-mappings.py from a reviewed allowlist.\n'
          'import type { SourceHitMapping } from "./types";\n'
          'import sourceEvidence from "./optimizer-kachina-source-manifest.json";\n'
          'export const optimizerKachinaSourceEvidence = sourceEvidence;\n'
          'export const optimizerKachinaMappings: SourceHitMapping[] = ' + json.dumps(mappings, ensure_ascii=False, indent=2) + ';\n')
(folder / "optimizer-kachina-mappings.ts").write_text(output)
print(json.dumps({"character": "kachina", "rows": len(mappings), "numericValues": len(mappings) * 15, "exactCatalogVersion": catalog["catalogVersion"]}))
