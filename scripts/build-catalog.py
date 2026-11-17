# Construit le catalogue embarqué dans l'artefact : séries, extensions, cartes (FR), vignettes en planches, sprites.
# Les réponses brutes sont gardées dans .cache/ : relancer ne re-télécharge que les nouveautés.
import json, io, base64, sys, os, csv, hashlib, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen, Request
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE, OUT = ROOT / '.cache', ROOT / 'artifact'
(CACHE / 'json').mkdir(parents=True, exist_ok=True); (CACHE / 'img').mkdir(exist_ok=True)
(OUT / 'atlas').mkdir(parents=True, exist_ok=True)
API = 'https://api.tcgdex.net/v2/fr'
THUMB_W, COLS = 180, 10

def get(url, binary=False, fresh=False):
    key = CACHE / ('img' if binary else 'json') / hashlib.md5(url.encode()).hexdigest()
    if key.exists() and not fresh:
        b = key.read_bytes()
    else:
        b = None
        for attempt in range(6):
            try:
                with urlopen(Request(url, headers={'User-Agent': 'pokedex-cartes/1.0'}), timeout=30) as r: b = r.read(); break
            except Exception as e:
                if getattr(e, 'code', 0) == 404: b = b''; break
                time.sleep(2 ** attempt)
        if b is None:
            print('ÉCHEC', url, file=sys.stderr); return None
        key.write_bytes(b)  # on garde aussi les 404 (vides) pour ne pas les redemander
    if binary: return b or None
    return json.loads(b) if b else None

pool = ThreadPoolExecutor(6)
series = [s for s in get(API + '/series', fresh=True) if s['id'] != 'tcgp']
series = list(pool.map(lambda s: get(f"{API}/series/{s['id']}", fresh=True), series))
set_ids = [st['id'] for s in series for st in s['sets']]
# Les dernières extensions bougent encore (cartes ajoutées) : on les rafraîchit.
recent = set(st['id'] for s in series[-1:] for st in s['sets'])
sets = dict(zip(set_ids, pool.map(lambda i: get(f'{API}/sets/{i}', fresh=i in recent), set_ids)))
card_ids = [c['id'] for i in set_ids if sets[i] for c in sets[i]['cards']]
print(len(series), 'séries', len(set_ids), 'extensions', len(card_ids), 'cartes', flush=True)

done = [0]
def card(cid):
    c = get(f'{API}/cards/{cid}', fresh='--prix' in sys.argv)
    done[0] += 1
    if done[0] % 1000 == 0: print('fiches', done[0], flush=True)
    return c
cards = dict(zip(card_ids, pool.map(card, card_ids)))

def thumb(c):
    if not c or not c.get('image'): return None
    b = get(c['image'] + '/low.webp', binary=True)
    if not b: return None
    im = Image.open(io.BytesIO(b)).convert('RGB')
    return im.resize((THUMB_W, round(im.height * THUMB_W / im.width)), Image.LANCZOS)

def logo(url, h=72):
    b = url and get(url + '.webp', binary=True)
    if not b: return None
    im = Image.open(io.BytesIO(b)).convert('RGBA'); im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=80); return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

def price(c):
    cm = (c.get('pricing') or {}).get('cardmarket') or {}
    v = cm.get('trend') or cm.get('avg')
    return round(v, 2) if v else None

out_series, out_cards, n_img = [], [], 0
for s in reversed(series):  # plus récentes d'abord
    os_ = {'id': s['id'], 'name': s['name'], 'date': s.get('releaseDate'), 'sets': []}
    for st in reversed(s['sets']):
        d = sets.get(st['id'])
        if not d: continue
        thumbs = list(pool.map(lambda b: thumb(cards.get(b['id'])), d['cards']))
        slots, imgs = [], [t for t in thumbs if t]
        if imgs:
            h = max(t.height for t in imgs); rows = -(-len(imgs) // COLS)
            atlas = Image.new('RGB', (THUMB_W * COLS, h * rows), (235, 235, 238))
            k = 0
            for t in thumbs:
                if t: atlas.paste(t, ((k % COLS) * THUMB_W, (k // COLS) * h)); slots.append(k); k += 1
                else: slots.append(-1)
            atlas.save(OUT / 'atlas' / f"{d['id']}.webp", 'WEBP', quality=62, method=6)
            n_img += k
        else:
            h, rows, slots = 0, 0, [-1] * len(d['cards'])
        os_['sets'].append({'id': d['id'], 'name': d['name'], 'date': d.get('releaseDate'),
            'abbr': (d.get('abbreviation') or {}).get('official'), 'official': d['cardCount']['official'],
            'total': d['cardCount']['total'], 'logo': logo(d.get('logo')), 'th': h, 'rows': rows})
        for b, slot in zip(d['cards'], slots):
            c = cards.get(b['id']) or {}
            out_cards.append([b['id'], b['localId'], b['name'], c.get('category', ''), c.get('rarity', ''),
                (c.get('types') or [''])[0], c.get('dexId') or [], price(c), slot, c.get('hp')])
    out_series.append(os_)
    print('série', s['name'], flush=True)

# Sprites des 1025 Pokémon, en une planche (pixel art : sans perte).
SP = 96; dex = json.loads((ROOT / 'src/data/pokedex.json').read_text())
sp = list(pool.map(lambda p: get(f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{p['id']}.png", binary=True), dex))
sheet = Image.new('RGBA', (SP * 32, SP * -(-len(dex) // 32)), (0, 0, 0, 0))
for i, b in enumerate(sp):
    if b: sheet.paste(Image.open(io.BytesIO(b)).convert('RGBA').resize((SP, SP), Image.NEAREST), ((i % 32) * SP, (i // 32) * SP))
sheet.save(OUT / 'sprites.webp', 'WEBP', lossless=True, method=6)

from datetime import date
(OUT / 'catalog.json').write_text(json.dumps({'updated': date.today().isoformat(), 'thumbW': THUMB_W, 'cols': COLS,
    'series': out_series, 'cards': out_cards, 'dex': dex}, ensure_ascii=False, separators=(',', ':')))
print('FINI', len(out_cards), 'cartes,', n_img, 'vignettes')
