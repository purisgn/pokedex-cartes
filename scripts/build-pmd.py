# Index des sprites animés « Donjon Mystère » (PMDCollab SpriteCollab, CC BY-NC 4.0) :
# pour chaque Pokémon, taille des images et durées des animations Marche, Repos, Sommeil, Saut.
import json, re, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import xml.etree.ElementTree as ET

BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite'
WANT = {'Walk': 'w', 'Idle': 'i', 'Sleep': 's', 'Hop': 'h'}
cache = Path('.cache/pmd'); cache.mkdir(parents=True, exist_ok=True)

def get(i):
    f = cache / f'{i:04d}.xml'
    if f.exists(): return f.read_text() or None
    for k in range(4):
        try:
            with urllib.request.urlopen(f'{BASE}/{i:04d}/AnimData.xml', timeout=20) as r:
                t = r.read().decode(); f.write_text(t); return t
        except urllib.error.HTTPError as e:
            if e.code == 404: f.write_text(''); return None
            time.sleep(1 + k)
        except Exception:
            time.sleep(1 + k)
    return None

def parse(t):
    root = ET.fromstring(t); anims = {}
    for a in root.iter('Anim'):
        anims[a.findtext('Name')] = a
    def resolve(name, depth=0):
        a = anims.get(name)
        if a is None or depth > 4: return None
        if a.findtext('CopyOf'): return resolve(a.findtext('CopyOf'), depth + 1)
        return (name, int(a.findtext('FrameWidth')), int(a.findtext('FrameHeight')), [int(d.text) for d in a.iter('Duration')])
    out = {}
    for name, key in WANT.items():
        r = resolve(name)
        if r: out[key] = [r[0], r[1], r[2], r[3]]
    return out if 'w' in out else None

ids = range(1, 1026)
with ThreadPoolExecutor(8) as ex: texts = list(ex.map(get, ids))
index = {}
for i, t in zip(ids, texts):
    if not t: continue
    try:
        p = parse(t)
        if p: index[i] = p
    except ET.ParseError: pass
Path('public/pmd.json').write_text(json.dumps(index, separators=(',', ':')))
print(len(index), 'Pokémon animés ;', Path('public/pmd.json').stat().st_size // 1024, 'Ko')
