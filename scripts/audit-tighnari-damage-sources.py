"""Check retained fixed sources and all 60 talent positions; no network or promotion."""
import argparse
import hashlib
import json
import re
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path,help='Existing gcsim b4 source checkout/tree')
parser.add_argument('--catalog',type=Path,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
evidence=json.loads((root/'packages/game-data/sources/tighnari-damage/manifest.json').read_text())
for row in evidence['files']:
    data=(args.source/row['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest()==row['sha256'],row['path']
    git_blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    assert git_blob==row['gitBlob'],row['path']
raw=(args.source/'internal/characters/tighnari/zz_tighnari.dm.go').read_text()
talent=next(row for row in json.loads(args.catalog.read_text())['talentSets'] if row['id']=='talent-set:tighnari')
positions=0
for row in evidence['coefficients']:
    match=re.search(r'\b'+row['sourceTable']+r' = \[\]float64\{(.*?)\n\s*\}',raw,re.S)
    assert match,row['sourceTable']
    source=[float(s) for s in re.findall(r'([\d.]+),',match.group(1))]
    active=next(a for a in talent['abilities'] if a['key']==row['abilityKey'])['parameters'][row['parameterKey']]
    assert source==active==row['values'],row['sourceTable']
    positions+=len(source)
assert positions==60
print(json.dumps({'status':'passed','revision':evidence['revision'],'files':len(evidence['files']),'talentPositions':positions,'maximumAbsoluteDifference':0,'gameVerification':'provisional'}))
