"""Extract an explicit reviewed action allowlist; never execute upstream code."""
from pathlib import Path
import argparse, hashlib, json, re

parser = argparse.ArgumentParser()
parser.add_argument('--source-root', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[3]
source = args.source_root
commit = 'a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd'
manifest = json.loads((root / 'packages/game-data/src/character-mappings/current-skill-source-manifest.json').read_text())
for relative, expected in manifest['files'].items():
    if hashlib.sha256((source / relative).read_bytes()).hexdigest() != expected:
        raise ValueError('Pinned source differs: ' + relative)
selection = root / 'packages/game-data/manifests/runtime/current.ts'
catalog_relative = re.search(r'"(\./datasets/[^\"]+/catalog.json)"', selection.read_text()).group(1)
catalog = json.loads((selection.parent / catalog_relative).read_text())
talents = {entry['id']: entry for entry in catalog['talentSets']}
rows = []

def add(character, table, label, ability='combat2', file='skill.go', count=1, complete=False, group=None, assumptions=None):
    rows.append(dict(character=character, table=table, label=label, ability=ability, file=file, count=count, complete=complete, group=group, assumptions=assumptions or []))

add('iansan', 'skill', '霆针战阵·突进命中', complete=True)
# Iansan swift is blocked: source table is attack {4}, but implementation indexes TalentLvlSkill().
add('iansan', 'burst', '力的三原理·初击', ability='combat3', file='burst.go', complete=True)
add('ifa', 'skillDmg', '救援射击·一次弹丸', file='attack.go', assumptions=['已处于战技飞行状态；此弹丸按普通攻击伤害分类，使用战技天赋。'])
add('ifa', 'burstDmg', '复合镇静领域·无元素转化', ability='combat3', file='burst.go', complete=True, assumptions=['命中目标及检查区域没有可吸收的水/火/冰/雷，故镇静标记不产生额外元素弹；不含独立扩散伤害。'])
add('jahoda', 'unfilledFlask', '宝瓶未满·释放命中', complete=True, assumptions=['宝瓶未满而结束追影状态；不产生满瓶后续猫猫球。'])
add('jahoda', 'filledFlask', '宝瓶已满·低月兆释放', complete=True, assumptions=['宝瓶已满，月兆等级低于2；此分支不会生成后续猫猫球。'])
add('jahoda', 'burst', '猎手的七道具·初始伤害', ability='combat3', file='burst.go')
add('prune', 'skill', '狩猎开始·风伤初击', assumptions=['只含初始风元素伤害，不含后续转化元素伤害或独立扩散。'])
add('prune', 'burst', '狩猎之铃·初击', ability='combat3', file='burst.go', complete=True, group='no-extra-triggers', assumptions=['C0；未重新施放，目标全程留在10米检测范围；不触发另列的突破/命座反应伤害。'])
add('prune', 'burstDot', '狩猎之铃·六次持续伤害', ability='combat3', file='burst.go', count=6, complete=True, group='no-extra-triggers', assumptions=['固定实现初次tick为137帧、周期117帧、C0截止813帧：137/254/371/488/605/722，共6次；目标全程有效且无额外状态延长。'])
add('odette', 'skill', '幻夜舞伴·普通技能初击', assumptions=['未处于爆发后的特殊技能替代窗口；不含独舞重影后续攻击。'])
add('odette', 'codaDoT', '黎明终曲·一次普通冰伤', assumptions=['爆发后的特殊技能窗口已生效；只含普通战技伤害，星感电/星扩散终结项尚未纳入。'])
add('odette', 'burst', '蓝鸟终章·三段斩击', ability='combat3', file='burst.go', count=3, group='direct-four-hits', assumptions=['只计算本次爆发三段普通斩击与最终普通冰伤；不含召唤或刷新的独舞重影生命周期。'])
add('odette', 'burstFinal', '蓝鸟终章·最终冰伤', ability='combat3', file='burst.go', group='direct-four-hits')

def blocks(code):
    masked = re.sub(r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*.*?\*/', lambda m: ' ' * len(m.group()), code, flags=re.S)
    result = []
    for found in re.finditer(r'info\.AttackInfo\s*\{', masked):
        start = found.end(); end = start; depth = 1
        while depth and end < len(masked):
            depth += (masked[end] == '{') - (masked[end] == '}'); end += 1
        if depth: raise ValueError('Unclosed AttackInfo')
        result.append(code[start:end-1])
    return result

mapped = []; evidence = {}
for row in rows:
    char = row['character']; directory = source / 'internal/characters' / char
    tablepath = next(directory.glob('zz_*.dm.go')); raw = tablepath.read_text()
    stripped = re.sub(r'//[^\n]*', '', raw)
    literal = re.search(r'\b' + re.escape(row['table']) + r'\s*=\s*\[\]float64\s*\{([^{}]+)\}', stripped)
    if not literal: raise ValueError(f'No scalar literal {char}/{row["table"]}')
    tokens = [t.strip() for t in literal.group(1).split(',') if t.strip()]
    if any(not re.fullmatch(r'-?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?', value, re.I) for value in tokens): raise ValueError('Non-literal numeric table')
    values = [float(value) for value in tokens]
    if len(values) != 15: raise ValueError('Unexpected table size')
    talent = talents['talent-set:' + char]; ability = next(entry for entry in talent['abilities'] if entry['key'] == row['ability'])
    matches = [key for key, vector in ability['parameters'].items() if vector == values]
    if len(matches) != 1: raise ValueError(f'Nonunique complete vector: {char}/{row["table"]}: {matches}')
    code = (directory / row['file']).read_text()
    matched = [block for block in blocks(code) if re.search(r'Mult:\s*' + re.escape(row['table']) + r'\[c\.TalentLvl(?:Skill|Burst)\(\)\]', block)]
    if not matched: raise ValueError('No reviewed attack literal: ' + char + '/' + row['table'])
    elements = {re.search(r'Element:\s*attributes\.(\w+)', block).group(1).lower() for block in matched}
    tags = {re.search(r'AttackTag:\s*attacks\.(\w+)', block).group(1) for block in matched}
    tagmap = {'AttackTagElementalArt':'skill','AttackTagElementalBurst':'burst','AttackTagExtra':'charged','AttackTagNormal':'normal'}
    if len(elements) != 1 or len(tags) != 1 or next(iter(tags)) not in tagmap: raise ValueError('Non-scalar element or tag')
    paths = [str(p.relative_to(source)) for p in directory.glob('*.go') if not p.name.endswith('_test.go')] + ['pkg/enemy/damage.go']
    for path in paths:
        actual = hashlib.sha256((source / path).read_bytes()).hexdigest()
        if manifest['files'].get(path) != actual: raise ValueError('Unreviewed source: ' + path)
        evidence[path] = actual
    family = 'skill' if row['ability'] == 'combat2' else 'burst'
    skillid = f'{char}-{family}-{row["group"] or row["table"].lower()}'
    grouplabel = {'no-extra-triggers':'狩猎之铃·初击与六次持续伤害', 'direct-four-hits':'蓝鸟终章·四段普通冰伤'}
    mapped.append(dict(id=f'{char}-{family}-{row["table"].lower()}-hit', characterSlug=char, talentSetId=talent['id'], abilityKey=row['ability'], parameterKey=matches[0], skillId=skillid, skillLabel=grouplabel.get(row['group'],row['label']), hitLabel=row['label'], element=next(iter(elements)), scalingStat='atk', attackTag=tagmap[next(iter(tags))], instanceCount=row['count'], sourceCoefficientValues=values, coefficientTolerance=0, sourceCommit=commit, sourcePaths=paths, completeAction=row['complete'], assumptions=['C0；最终面板与命中适用增伤由用户明确提供；本映射不自动模拟夜魂、月兆或星兆队伍条件。'] + row['assumptions'], exclusions=['不含队友、反应生成实体、未列出的召唤物伤害、其他输入动作或命座额外触发。'] + ([] if row['complete'] else ['只计算所列伤害组成，不能当作完整技能生命周期。'])))
out = root / 'packages/game-data/src/character-mappings/current-skill-mappings.ts'
out.write_text('import type { SourceHitMapping } from "./types";\n\n/** Fixed a7dc4bf reviewed fields; old b4ae769 source families remain separate. */\nexport const currentSkillMappings: SourceHitMapping[] = ' + json.dumps(mapped,ensure_ascii=False,indent=2) + ';\n\nexport const currentSkillSourceEvidence = ' + json.dumps(dict(commit=commit,archiveSha256=manifest['archiveSha256'],files=evidence),indent=2) + ' as const;\n')
print(json.dumps(dict(mappings=len(mapped),characters=len(set(row['characterSlug'] for row in mapped)),instances=sum(row['instanceCount'] for row in mapped))))
