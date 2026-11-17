# Prépare public/ pour la web app : catalogue (avec l'adresse des images TCGdex), empreintes de scan, sprites.
import json, hashlib, shutil
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parent.parent
CACHE, PUB = ROOT / '.cache', ROOT / 'public'
API = 'https://api.tcgdex.net/v2/fr'
cat = json.loads((ROOT / 'artifact/catalog.json').read_text())

def card_json(cid):
    p = CACHE / 'json' / hashlib.md5(f'{API}/cards/{cid}'.encode()).hexdigest()
    return json.loads(p.read_text()) if p.exists() and p.stat().st_size else {}

def set_json(sid):
    p = CACHE / 'json' / hashlib.md5(f'{API}/sets/{sid}'.encode()).hexdigest()
    return json.loads(p.read_text()) if p.exists() and p.stat().st_size else {}

# Extension de chaque carte (l'identifiant ne suffit pas toujours, ex. pl4-AR1 rangée ailleurs).
owner = {}
for s in cat['series']:
    for st in s['sets']:
        for c in set_json(st['id']).get('cards', []): owner.setdefault(c['id'], st['id'])
base = {}
for row in cat['cards']:
    sid = owner[row[0]]
    row.append(sid)
    if sid not in base and row[8] >= 0:
        img = card_json(row[0]).get('image')
        if img: base[sid] = img.rsplit('/', 1)[0]
for s in cat['series']:
    for st in s['sets']:
        st['img'] = base.get(st['id']); st.pop('th', None); st.pop('rows', None)
for row in cat['cards']:
    row[8] = 1 if row[8] >= 0 else 0   # a une image
cat.pop('thumbW', None); cat.pop('cols', None)

H = np.load(CACHE / 'hashes.npy'); hid = {c: i for i, c in enumerate(json.loads((CACHE / 'hash_ids.json').read_text()))}
out = np.zeros((len(cat['cards']), 32), np.uint8)
for i, row in enumerate(cat['cards']):
    if row[0] in hid: out[i] = H[hid[row[0]]]
    else: row[8] = 0
PUB.mkdir(exist_ok=True)
(PUB / 'hashes.bin').write_bytes(out.tobytes())
(PUB / 'catalog.json').write_text(json.dumps(cat, ensure_ascii=False, separators=(',', ':')))
shutil.copy(ROOT / 'artifact/sprites.webp', PUB / 'sprites.webp')
print(len(cat['cards']), 'cartes,', int(sum(r[8] for r in cat['cards'])), 'empreintes,', sum(1 for v in base.values()), 'extensions avec images')
