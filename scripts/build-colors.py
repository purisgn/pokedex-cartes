# Empreinte « couleurs » de chaque carte : moyenne Lab de la carte entière (bordure comprise) sur une grille 6×6 (108 octets).
# Tolérante au cadrage approximatif (carte tenue en main) : sert à présélectionner les candidates.
import json, sys
from pathlib import Path
import numpy as np, cv2
sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module
bh = import_module('build-hashes')
ROOT = Path(__file__).resolve().parent.parent

def color_sig(rgb):
    """rgb : tableau uint8 H×W×3 de la carte entière redressée."""
    a = cv2.resize(rgb, (245, 342), interpolation=cv2.INTER_AREA)[13:329, 9:236]   # carte entière moins un liseré de 4 %
    lab = cv2.cvtColor(np.ascontiguousarray(a), cv2.COLOR_RGB2LAB)
    return cv2.resize(lab, (6, 6), interpolation=cv2.INTER_AREA).reshape(-1)   # 108 octets

if __name__ == '__main__':
    cat = json.loads((ROOT / 'public/catalog.json').read_text())
    out = np.zeros((len(cat['cards']), 108), np.uint8)
    for i, row in enumerate(cat['cards']):
        if not row[8]: continue
        im = bh.card_image(row[0])
        if im is not None: out[i] = color_sig(np.asarray(im))
    (ROOT / 'public/colors.bin').write_bytes(out.tobytes())
    np.save(ROOT / '.cache/colors.npy', out)
    print(out.shape, 'empreintes couleur')
