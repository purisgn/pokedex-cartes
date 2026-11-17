# Empreintes visuelles (dHash 256 bits) de l'illustration de chaque carte, pour le scan en direct.
import json, hashlib, io, sys
from pathlib import Path
from PIL import Image
import numpy as np
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.cache'
API = 'https://api.tcgdex.net/v2/fr'
ART = (0.08, 0.10, 0.92, 0.50)  # zone de l'illustration (x0, y0, x1, y1) en fraction de la carte
N = 16

def cached(url, kind):
    p = CACHE / kind / hashlib.md5(url.encode()).hexdigest()
    return p.read_bytes() if p.exists() and p.stat().st_size else None

def dhash(im):
    """im : image PIL de la carte entière (déjà redressée)."""
    w, h = im.size
    g = im.convert('L').crop((int(ART[0]*w), int(ART[1]*h), int(ART[2]*w), int(ART[3]*h)))
    a = np.asarray(g.resize((N + 1, N), Image.BOX), dtype=np.float32)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return np.packbits(bits)

def card_image(cid):
    j = cached(f'{API}/cards/{cid}', 'json')
    if not j: return None
    c = json.loads(j)
    b = c.get('image') and cached(c['image'] + '/low.webp', 'img')
    return Image.open(io.BytesIO(b)).convert('RGB') if b else None

if __name__ == '__main__':
    cat = json.loads((ROOT / 'artifact/catalog.json').read_text())
    ids, hs = [], []
    for row in cat['cards']:
        im = card_image(row[0])
        if im is None: continue
        ids.append(row[0]); hs.append(dhash(im))
    np.save(CACHE / 'hashes.npy', np.stack(hs)); (CACHE / 'hash_ids.json').write_text(json.dumps(ids))
    print(len(ids), 'empreintes')
