"""Retrieve pinned, MIT-licensed upstream files; does not run a simulator."""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import urllib.request

REVISION = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"
ROOT = Path(__file__).resolve().parent
PATHS = [
    "LICENSE",
    "internal/characters/amber/attack.go",
    "internal/characters/amber/zz_amber.dm.go",
    "internal/characters/amber/amber.go",
    "internal/characters/amber/asc.go",
    "internal/characters/amber/config.yml",
    "internal/frames/frames.go",
    "internal/template/character/character.go",
    "internal/weapons/bow/huntersbow/hunter.go",
    "internal/weapons/bow/huntersbow/zz_huntersbow.dm.go",
    "internal/weapons/bow/huntersbow/config.yml",
    "internal/weapons/common/common.go",
    "pkg/core/player/character/basestat.go",
    "pkg/core/player/character/character.go",
    "pkg/catalog/character.dm.go",
    "pkg/catalog/weapon.dm.go",
    "pkg/catalog/curve.dm.go",
    "pkg/core/attack.go",
    "pkg/core/action/action.go",
    "pkg/core/player/animation/animation.go",
    "pkg/core/player/exec.go",
    "pkg/core/player/player.go",
    "pkg/enemy/attack.go",
    "pkg/enemy/damage.go",
    "pkg/target/icd.go",
    "pkg/core/attacks/icd_groups.dm.go",
    "pkg/core/attacks/icd_tags.dm.go",
    "pkg/simulation/run.go",
]


def retrieve(source_path):
    url = f"https://raw.githubusercontent.com/genshinsim/gcsim/{REVISION}/{source_path}"
    with urllib.request.urlopen(url, timeout=30) as response:
        content = response.read()
        status = response.status
    target = ROOT / "source" / source_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    locator = Path("/tmp/gidps-gcsim-b4ae769") / source_path
    return {
        "path": source_path,
        "url": url,
        "browseUrl": f"https://github.com/genshinsim/gcsim/blob/{REVISION}/{source_path}",
        "revision": REVISION,
        "status": status,
        "sha256": hashlib.sha256(content).hexdigest(),
        "bytes": len(content),
        "lines": len(content.decode().splitlines()),
        "savedPath": str(target.relative_to(ROOT)),
        "localLocatorByteMatch": locator.read_bytes() == content if locator.exists() else None,
        "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    sources = list(pool.map(retrieve, PATHS))
license_source = next(source for source in sources if source["path"] == "LICENSE")
assert license_source["sha256"] == "a100d2f2a4f04058c3986861bcb1b27d1a920e9e7b810714fffc3f66c188f6d4"
assert all(source["localLocatorByteMatch"] is not False for source in sources)
(ROOT / "amber-source-retrievals.json").write_text(json.dumps({
    "revision": REVISION,
    "license": {"type": "MIT", "path": "source/LICENSE", "sha256": license_source["sha256"]},
    "scope": "Pinned third-party community implementation; source and external CLI evidence do not establish official game truth or a complete Amber implementation.",
    "sources": sources,
}, indent=2) + "\n")
print(json.dumps({"files": len(sources), "allHttp200": all(s["status"] == 200 for s in sources), "totalBytes": sum(s["bytes"] for s in sources), "license": "MIT"}))
