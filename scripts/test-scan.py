# Simulation caméra + redressement OpenCV (4 coins → perspective), puis identification par empreinte.
import json, random, sys
import numpy as np, cv2
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
sys.path.insert(0, 'scripts')
from importlib import import_module
bh = import_module('build-hashes')
H = np.load('.cache/hashes.npy'); ids = json.load(open('.cache/hash_ids.json')); idsA = np.array(ids)
bitsH = np.unpackbits(H, axis=1)
random.seed(3)
FW, FH = 480, 640
CW, CH = 245, 342

def frame(card, rot, shift, tilt, glare):
    bg = np.full((FH, FW, 3), [random.randint(40, 210) for _ in range(3)], np.uint8)
    bg = np.clip(bg + np.random.normal(0, 12, bg.shape), 0, 255).astype(np.uint8)
    w = random.uniform(.55, .7) * FW; h = w * 88 / 63
    cx = FW / 2 + random.uniform(-shift, shift) * FW; cy = FH / 2 + random.uniform(-shift, shift) * FH
    pts = np.array([[-w/2, -h/2], [w/2, -h/2], [w/2, h/2], [-w/2, h/2]])
    a = np.radians(rot); R = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
    pts = pts @ R.T + [cx, cy]
    pts += np.random.uniform(-tilt, tilt, pts.shape) * w   # perspective
    src = np.float32([[0, 0], [card.width, 0], [card.width, card.height], [0, card.height]])
    M = cv2.getPerspectiveTransform(src, np.float32(pts))
    c = cv2.warpPerspective(np.asarray(card), M, (FW, FH))
    mask = cv2.warpPerspective(np.full((card.height, card.width), 255, np.uint8), M, (FW, FH))
    out = np.where(mask[..., None] > 0, c, bg)
    im = Image.fromarray(out)
    im = ImageEnhance.Brightness(im).enhance(random.uniform(0.7, 1.2))
    if glare:
        d = ImageDraw.Draw(im, 'RGBA'); gx, gy = int(cx + random.uniform(-w/3, w/3)), int(cy - h/4)
        d.ellipse((gx - 50, gy - 30, gx + 50, gy + 30), fill=(255, 255, 255, 90))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(random.uniform(.5, 1.3))))

def order(p):
    s = p.sum(1); d = np.diff(p, axis=1).ravel()
    return np.float32([p[np.argmin(s)], p[np.argmin(d)], p[np.argmax(s)], p[np.argmax(d)]])

def rectify(rgb):
    g = cv2.GaussianBlur(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), (5, 5), 0)
    e = cv2.dilate(cv2.Canny(g, 40, 120), np.ones((3, 3), np.uint8))
    cs, _ = cv2.findContours(e, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cs: return None
    c = max(cs, key=cv2.contourArea)
    if cv2.contourArea(c) < 0.15 * FW * FH: return None
    ap = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
    quad = ap.reshape(-1, 2) if len(ap) == 4 else cv2.boxPoints(cv2.minAreaRect(c))
    q = order(np.float32(quad))
    if np.linalg.norm(q[0] - q[1]) > np.linalg.norm(q[1] - q[2]):  # carte couchée → on tourne
        q = np.roll(q, -1, axis=0)
    M = cv2.getPerspectiveTransform(q, np.float32([[0, 0], [CW, 0], [CW, CH], [0, CH]]))
    return Image.fromarray(cv2.warpPerspective(rgb, M, (CW, CH)))

def rank(q, cid):
    d = (bitsH != np.unpackbits(q)).sum(1); o = np.argsort(d)
    return int(np.where(idsA[o] == cid)[0][0])

for label, rot, shift, tilt, glare in [('normal', 6, .06, .02, False), ('difficile', 15, .1, .05, True)]:
    r, fails = [], 0
    for cid in random.sample(ids, 250):
        rgb = frame(bh.card_image(cid), random.uniform(-rot, rot), shift, tilt, glare)
        im = rectify(rgb)
        if im is None: fails += 1; r.append(99999); continue
        r.append(rank(bh.dhash(im), cid))
    r = np.array(r)
    print(label, 'carte non trouvée', fails, '| top1 %.2f top3 %.2f top10 %.2f' % ((r == 0).mean(), (r < 3).mean(), (r < 10).mean()))

# Calibrage : distance de la meilleure carte quand c'est la bonne, et quand la carte filmée n'est pas au catalogue.
ok, bad, wrong_same = [], [], 0
known = set(random.sample(range(len(ids)), 200))
for i in known:
    cid = ids[i]; rgb = frame(bh.card_image(cid), random.uniform(-10, 10), .08, .03, random.random() < .5)
    im = rectify(rgb)
    if im is None: continue
    q = np.unpackbits(bh.dhash(im)); d = (bitsH != q).sum(1); o = np.argsort(d)
    if idsA[o[0]] == cid: ok.append((d[o[0]], d[o[1]] - d[o[0]]))
    else: wrong_same += 1; print('raté', cid, '→', idsA[o[0]], d[o[0]], 'rang', int(np.where(idsA[o] == cid)[0][0]))
    # carte "inconnue" : on retire la vraie et ses doublons d'illustration
    mask = (bitsH != bitsH[i]).sum(1) > 40
    bad.append(d[mask].min())
ok = np.array(ok); bad = np.array(bad)
print('bonne carte : distance médiane', np.median(ok[:, 0]), 'p95', np.percentile(ok[:, 0], 95), '| écart au 2e médian', np.median(ok[:, 1]))
print('carte absente : meilleure distance p5', np.percentile(bad, 5), 'médiane', np.median(bad))
