# Icône de l'app : pokéball en pixel art 16×16 dessinée à la main, sur le bleu de la palette.
from pathlib import Path
from PIL import Image
OUT = Path(__file__).resolve().parent.parent / 'public'
BALL = """
.....KKKKKK.....
...KKRRRRRRKK...
..KRRRRRRRRRRK..
.KRHHRRRRRRRRRK.
.KRHRRRRRRRRRRK.
KRRRRRRRRRRRRRRK
KRRRRRKKKKRRRRRK
KKKKKKKWWKKKKKKK
KKKKKKKWWKKKKKKK
KWWWWWKKKKWWWWWK
KWWWWWWWWWWWWWSK
.KWWWWWWWWWWWSK.
.KWWWWWWWWWWSSK.
..KWWWWWWWWSSK..
...KKWWWWSSKK...
.....KKKKKK.....
""".split()
COL = {'.': '#1A3FA8', 'K': '#121317', 'R': '#C93834', 'H': '#EE8A84', 'W': '#F6F7F9', 'S': '#C9CDD5'}
G, M = 24, 4                     # grille 24, la balle de 16 au centre
grid = [['.'] * G for _ in range(G)]
for y, row in enumerate(BALL):
    for x, ch in enumerate(row): grid[M + y][M + x] = ch
img = Image.new('RGB', (G, G))
for y in range(G):
    for x in range(G):
        h = COL[grid[y][x]].lstrip('#'); img.putpixel((x, y), tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)))
big = img.resize((G * 21, G * 21), Image.NEAREST)                    # 504 px, pixels nets
canvas = Image.new('RGB', (512, 512), img.getpixel((0, 0))); canvas.paste(big, (4, 4)); canvas.save(OUT / 'icon-512.png')
canvas.resize((180, 180), Image.NEAREST).save(OUT / 'icon-180.png')
rects = ''.join(f'<rect x="{x}" y="{y}" width="1.03" height="1.03" fill="{COL[grid[y][x]]}"/>' for y in range(G) for x in range(G) if grid[y][x] != '.')
(OUT / 'icon.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {G} {G}" shape-rendering="crispEdges"><rect width="{G}" height="{G}" rx="5" fill="{COL["."]}"/>{rects}</svg>')
print('icônes écrites')
