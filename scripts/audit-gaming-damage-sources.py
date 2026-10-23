"""Verify retained unmodified pinned sources and all 30 E/Q coefficient positions."""
import argparse
import hashlib
import json
import re
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path,help='Unmodified b4 source root containing internal/characters/gaming')
parser.add_argument('--catalog',type=Path,required=True)
args=parser.parse_args()
repo=Path(__file__).resolve().parents[1]
manifest=json.loads((repo/'packages/game-data/sources/gaming-damage/manifest.json').read_text())
for row in manifest['files']:
    data=(args.source/row['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest()==row['sha256'],row['path']
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['gitBlob'],row['path']
raw=(args.source/'internal/characters/gaming/zz_gaming.dm.go').read_text()
talents=next(t for t in json.loads(args.catalog.read_text())['talentSets'] if t['id']=='talent-set:gaming')
positions=0
for row in manifest['coefficients']:
    match=re.search(r'\b'+row['sourceTable']+r' = \[\]float64\{(.*?)\n\s*\}',raw,re.S)
    assert match,row['sourceTable']
    values=[float(v) for v in re.findall(r'([\d.]+),',match.group(1))]
    active=next(a for a in talents['abilities'] if a['key']==row['abilityKey'])['parameters'][row['parameterKey']]
    assert values==active==row['values'],row['sourceTable']
    positions+=len(values)
assert positions==30
print(json.dumps({'status':'passed','revision':manifest['revision'],'files':len(manifest['files']),'talentPositions':positions,'maximumAbsoluteDifference':0,'gameVerification':'provisional'}))
