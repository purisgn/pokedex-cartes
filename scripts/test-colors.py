# Rappel de la présélection couleur sur tout le catalogue, avec cadrage décalé ET dérive de couleur (caméra).
import json, random, sys
import numpy as np, cv2
sys.path.insert(0, 'scripts')
from importlib import import_module
bh = import_module('build-hashes'); bc = import_module('build-colors')
cat = json.load(open('public/catalog.json'))
C = np.load('.cache/colors.npy').astype(np.float32); has = np.array([r[8] for r in cat['cards']], bool)
random.seed(9)

def center(v):  # par canal : on retire la moyenne de l'image (balance des blancs, luminosité)
    v = v.reshape(-1, 16, 3); return (v - v.mean(1, keepdims=True)).reshape(len(v), -1)
Cc, Cab = center(C), C.reshape(-1, 16, 3)[:, :, 1:].mean(1)

def score(q):
    qc = center(q[None])[0]; qab = q.reshape(16, 3)[:, 1:].mean(0)
    d = np.linalg.norm(Cc - qc, axis=1) + 0.6 * np.linalg.norm(Cab - qab, axis=1)
    d[~has] = 1e9; return d

def camera(im):
    a = np.asarray(im).astype(np.float32)
    a = a * np.array([random.uniform(.85, 1.15), random.uniform(.9, 1.1), random.uniform(.85, 1.15)]) * random.uniform(.75, 1.2)
    w, h = im.size
    M = cv2.getRotationMatrix2D((w/2, h/2), random.uniform(-6, 6), 1 + random.uniform(-.08, .08))
    M[0, 2] += random.uniform(-.08, .08) * w; M[1, 2] += random.uniform(-.08, .08) * h
    return cv2.warpAffine(np.clip(a, 0, 255).astype(np.uint8), M, (w, h), borderMode=cv2.BORDER_REPLICATE)

idx = [i for i in random.sample(range(len(cat['cards'])), 900) if cat['cards'][i][8]][:300]
ranks = []
for i in idx:
    im = bh.card_image(cat['cards'][i][0]); q = bc.color_sig(camera(im)).astype(np.float32)
    d = score(q); ranks.append(int((d < d[i]).sum()))
r = np.array(ranks)
print('catalogue complet, décalage ≤8 %% + dérive couleur : top10 %.2f  top30 %.2f  top60 %.2f' % ((r < 10).mean(), (r < 30).mean(), (r < 60).mean()))
