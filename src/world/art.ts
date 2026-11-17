// Décors dessinés pixel par pixel : arbres, rochers, ruines, centrale… Chaque objet est une petite image
// avec un contour sombre, une lumière venant d'en haut à gauche et une ombre portée au sol.
export type Sprite = { img: HTMLCanvasElement; ax: number; ay: number }

function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  return [c, c.getContext('2d')!] as const
}
const px = (g: CanvasRenderingContext2D, x: number, y: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h) }

// Remplit une forme décrite par une fonction (x, y) → dedans ? avec contour et ombrage à 3 tons.
function blob(g: CanvasRenderingContext2D, w: number, h: number, inside: (x: number, y: number) => boolean, [light, base, dark, line]: string[], lx = 0.3, ly = 0.25) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
    if (edge) { px(g, x, y, line); continue }
    const d = Math.hypot(x / w - lx, y / h - ly)
    const below = !inside(x, y + 2) || !inside(x + 2, y + 1)
    px(g, x, y, below ? dark : d < 0.28 ? light : d > 0.62 ? dark : base)
  }
}
const shadow = (g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) => {
  g.fillStyle = 'rgba(20,30,40,.28)'
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1) g.fillRect(cx + x, cy + y, 1, 1)
}

export function tree(leaf: string[], seed = 0): Sprite {
  const [c, g] = canvas(28, 34)
  shadow(g, 14, 31, 10, 3)
  px(g, 12, 21, '#3B2615', 4, 11); px(g, 13, 21, '#6E4A2A', 2, 10); px(g, 12, 31, '#3B2615', 4, 1)
  const puffs = [[14, 11, 10], [8, 15, 6.5], [20, 15, 6.5], [14, 6 + (seed % 2), 6.5]]
  blob(g, 28, 26, (x, y) => puffs.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r), leaf)
  px(g, 10, 6, leaf[0], 2, 1); px(g, 9, 7, leaf[0], 1, 1)
  return { img: c, ax: 14, ay: 31 }
}
export function pine(leaf: string[], snow = false): Sprite {
  const [c, g] = canvas(22, 36)
  shadow(g, 11, 33, 8, 3)
  px(g, 10, 27, '#3B2615', 3, 7); px(g, 11, 27, '#6E4A2A', 1, 6)
  const tiers = [[2, 12, 6], [8, 19, 8], [15, 28, 10]]
  blob(g, 22, 30, (x, y) => tiers.some(([t, b, hw]) => y >= t && y <= b && Math.abs(x - 11) <= hw * (y - t + 2) / (b - t + 2)), leaf, 0.35, 0.2)
  if (snow) for (const [t, , hw] of tiers) for (let x = -hw / 2; x <= hw / 2; x++) px(g, 11 + Math.round(x), t + 2 + Math.abs(Math.round(x)) / 2, '#FFFFFF')
  return { img: c, ax: 11, ay: 33 }
}
export function rock(col: string[], w = 14, h = 10): Sprite {
  const [c, g] = canvas(w + 4, h + 4)
  shadow(g, (w + 4) / 2, h + 1, w / 2, 2)
  blob(g, w + 4, h + 2, (x, y) => ((x - (w + 4) / 2) / (w / 2)) ** 2 + ((y - h / 2 - 1) / (h / 2)) ** 2 <= 1 && y < h + 1, col)
  return { img: c, ax: (w + 4) / 2, ay: h + 1 }
}
export function spire(col: string[]): Sprite {
  const [c, g] = canvas(20, 30)
  shadow(g, 10, 27, 8, 2)
  blob(g, 20, 28, (x, y) => y > 1 && Math.abs(x - 10 + (y < 12 ? 2 : 0)) <= 2 + y * 0.28, col, 0.2, 0.3)
  return { img: c, ax: 10, ay: 27 }
}
export function bush(col: string[]): Sprite {
  const [c, g] = canvas(16, 12)
  shadow(g, 8, 10, 7, 2)
  blob(g, 16, 11, (x, y) => Math.hypot(x - 5, y - 6) <= 4.5 || Math.hypot(x - 10, y - 6) <= 4.5 || Math.hypot(x - 8, y - 4) <= 4, col)
  return { img: c, ax: 8, ay: 10 }
}
export function deadTree(): Sprite {
  const [c, g] = canvas(24, 32)
  shadow(g, 12, 30, 8, 2)
  const col = '#4A3F4F', hi = '#6E6275'
  px(g, 11, 10, col, 3, 20); px(g, 12, 10, hi, 1, 19)
  for (const [x, y, dx, dy, n] of [[11, 14, -1, -1, 7], [13, 12, 1, -1, 7], [11, 20, -1, -0.5, 6], [13, 18, 1, -0.6, 5], [12, 10, 0.3, -1, 7]]) {
    for (let k = 0; k < n; k++) px(g, Math.round(x + dx * k), Math.round(y + dy * k), col, 2, 1)
  }
  return { img: c, ax: 12, ay: 30 }
}
export function grave(): Sprite {
  const [c, g] = canvas(12, 15)
  shadow(g, 6, 13, 5, 2)
  blob(g, 12, 14, (x, y) => x >= 1 && x <= 10 && y <= 13 && (y >= 5 || Math.hypot(x - 5.5, y - 5) <= 4.6), ['#C9C6D6', '#A9A5BA', '#87829B', '#3E3A4D'])
  px(g, 5, 6, '#5E5972', 2, 5); px(g, 3, 8, '#5E5972', 6, 1)
  return { img: c, ax: 6, ay: 13 }
}
export function pillar(broken: boolean): Sprite {
  const [c, g] = canvas(14, 34)
  shadow(g, 7, 32, 6, 2)
  const top = broken ? 12 : 3
  blob(g, 14, 33, (x, y) => y >= top && ((y >= 29 || (y <= top + 3 && !broken)) ? x >= 1 && x <= 12 : x >= 3 && x <= 10) && y <= 32 && !(broken && y < top + 3 && (x + y) % 5 === 0), ['#F2EBDD', '#D9CFBC', '#B4A891', '#5C5444'], 0.2, 0.2)
  for (let y = top + 5; y < 28; y += 3) px(g, 5, y, '#C4B9A3', 1, 2), px(g, 8, y + 1, '#C4B9A3', 1, 2)
  return { img: c, ax: 7, ay: 32 }
}
export function temple(): Sprite {
  const [c, g] = canvas(56, 44)
  shadow(g, 28, 41, 26, 3)
  const stone = ['#F2EBDD', '#D9CFBC', '#B4A891', '#5C5444']
  blob(g, 56, 43, (x, y) => (y >= 36 && y <= 42 && x >= 2 && x <= 53) || (y >= 33 && y < 36 && x >= 5 && x <= 50), stone)
  for (const x of [9, 19, 33, 43]) blob(g, 56, 43, (xx, yy) => yy >= 14 && yy <= 33 && xx >= x && xx <= x + 4, stone, 0.2, 0.2)
  blob(g, 56, 43, (x, y) => y >= 3 && y <= 14 && Math.abs(x - 28) <= 25 - (14 - y) * 0 && y >= 3 + Math.abs(x - 28) * 0.42, ['#F7D9A8', '#E8B96E', '#C99446', '#5C4424'], 0.4, 0.2)
  px(g, 26, 7, '#FA7179', 4, 4)
  return { img: c, ax: 28, ay: 41 }
}
export function cone(): Sprite {
  const [c, g] = canvas(96, 64)
  shadow(g, 48, 60, 44, 4)
  blob(g, 96, 62, (x, y) => y >= 8 && y <= 61 && Math.abs(x - 48) <= 9 + (y - 8) * 0.72, ['#8C7A76', '#6B5A57', '#4E403E', '#251B1A'], 0.35, 0.3)
  for (let y = 8; y < 13; y++) px(g, 48 - 9 + (y - 8), y, '#FF8A2A', 18 - (y - 8) * 2, 1)
  for (const [x0, len, dir] of [[42, 26, -0.35], [53, 20, 0.4], [47, 34, 0.08]]) for (let k = 0; k < len; k++) {
    const x = Math.round(x0 + k * dir + Math.sin(k / 3) * 1.2), y = 12 + k
    px(g, x, y, k % 7 === 0 ? '#FFD45C' : '#F2621F', 2, 1)
  }
  return { img: c, ax: 48, ay: 60 }
}
export function pylon(): Sprite {
  const [c, g] = canvas(20, 46)
  shadow(g, 10, 44, 8, 2)
  const m = '#4D5560', h = '#7C8692'
  for (let y = 4; y < 44; y++) { const hw = 1 + (y - 4) * 0.17; px(g, Math.round(10 - hw), y, m); px(g, Math.round(10 + hw), y, m); if (y % 6 === 0) for (let x = Math.round(10 - hw); x <= 10 + hw; x++) px(g, x, y, h) }
  px(g, 2, 10, m, 16, 2); px(g, 4, 18, m, 12, 2); px(g, 2, 9, '#F2C318', 2, 2); px(g, 16, 9, '#F2C318', 2, 2)
  return { img: c, ax: 10, ay: 44 }
}
export function building(): Sprite {
  const [c, g] = canvas(60, 46)
  shadow(g, 30, 43, 28, 3)
  blob(g, 60, 44, (x, y) => x >= 3 && x <= 56 && y >= 12 && y <= 43, ['#E7EAEE', '#C9CED4', '#A3A9B1', '#3E444C'], 0.2, 0.1)
  px(g, 3, 10, '#3E444C', 54, 4); px(g, 4, 11, '#F2C318', 52, 2)
  for (let x = 6; x < 54; x += 8) px(g, x, 11, '#2B2B2B', 4, 2)
  for (const x of [9, 21, 33, 45]) { px(g, x, 18, '#3E444C', 7, 7); px(g, x + 1, 19, '#7FB6E0', 5, 5) }
  px(g, 25, 31, '#3E444C', 10, 12); px(g, 26, 32, '#56606B', 8, 11)
  px(g, 44, 0, '#3E444C', 6, 12); px(g, 45, 1, '#A3A9B1', 4, 10)
  return { img: c, ax: 30, ay: 43 }
}
export function solar(): Sprite {
  const [c, g] = canvas(24, 16)
  shadow(g, 12, 14, 10, 2)
  px(g, 5, 10, '#4D5560', 2, 5); px(g, 17, 10, '#4D5560', 2, 5)
  px(g, 1, 2, '#22324A', 22, 9)
  for (let y = 3; y < 10; y += 2) for (let x = 2; x < 22; x += 3) px(g, x, y, '#3D6FA8', 2, 1)
  px(g, 2, 3, '#8CC2F0', 4, 1)
  return { img: c, ax: 12, ay: 14 }
}
export function crystal(): Sprite {
  const [c, g] = canvas(14, 18)
  shadow(g, 7, 16, 6, 2)
  const col = ['#F2FCFF', '#A8E4F5', '#6CC3E2', '#2C6C8C']
  blob(g, 14, 17, (x, y) => (Math.abs(x - 7) <= (y - 1) * 0.35 && y <= 16) || (Math.abs(x - 3) <= (y - 8) * 0.3 && y >= 8 && y <= 16) || (Math.abs(x - 11) <= (y - 6) * 0.3 && y >= 6 && y <= 16), col, 0.3, 0.1)
  return { img: c, ax: 7, ay: 16 }
}
export function mushroom(cap: string): Sprite {
  const [c, g] = canvas(10, 10)
  shadow(g, 5, 8, 4, 1)
  px(g, 4, 5, '#F2EBDD', 2, 4)
  blob(g, 10, 6, (x, y) => Math.hypot(x - 5, (y - 5) * 1.3) <= 4.6 && y <= 5, [cap, cap, cap, '#3A1E24'])
  px(g, 3, 2, '#FFFFFF'); px(g, 6, 3, '#FFFFFF')
  return { img: c, ax: 5, ay: 8 }
}
export function crate(): Sprite {
  const [c, g] = canvas(14, 14)
  shadow(g, 7, 12, 6, 2)
  px(g, 1, 2, '#5C3E22', 12, 11); px(g, 2, 3, '#B8834C', 10, 9); px(g, 2, 7, '#8E6235', 10, 1); px(g, 6, 3, '#8E6235', 1, 9)
  return { img: c, ax: 7, ay: 12 }
}
export function sign(): Sprite {
  const [c, g] = canvas(16, 18)
  shadow(g, 8, 16, 5, 1)
  px(g, 7, 9, '#4A3018', 2, 8)
  px(g, 1, 2, '#4A3018', 14, 9); px(g, 2, 3, '#C08A50', 12, 7); px(g, 3, 5, '#7A5430', 9, 1); px(g, 3, 7, '#7A5430', 6, 1)
  return { img: c, ax: 8, ay: 16 }
}

// Petites bulles d'émotion dessinées au pixel près.
const ICONS: Record<string, string[]> = {
  love: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  note: ['...###', '...#.#', '...#.#', '.###.#', '####..', '.##...'],
  joy: ['#.....#', '.#...#.', '.......', '#.....#', '.#####.'],
  bang: ['##', '##', '##', '##', '..', '##'],
  what: ['.###.', '#...#', '...#.', '..#..', '.....', '..#..'],
  dots: ['.......', '.......', '.......', '.......', '#.#.#..'],
  zz: ['####...', '..#....', '.#.....', '####...', '....###', '.....#.', '....###'],
}
export const EMOTES = Object.keys(ICONS)
const COLORS: Record<string, string> = { love: '#E2508C', note: '#3A6FD8', joy: '#E8A21A', bang: '#E2432A', what: '#3A6FD8', dots: '#56606B', zz: '#3A6FD8' }
export function bubble(kind: string): Sprite {
  const ic = ICONS[kind], w = Math.max(...ic.map((r) => r.length)) + 6, h = ic.length + 6
  const [c, g] = canvas(w, h + 3)
  px(g, 1, 0, '#2B2E33', w - 2, 1); px(g, 1, h - 1, '#2B2E33', w - 2, 1); px(g, 0, 1, '#2B2E33', 1, h - 2); px(g, w - 1, 1, '#2B2E33', 1, h - 2)
  px(g, 1, 1, '#FFFFFF', w - 2, h - 2)
  px(g, 3, h - 1, '#FFFFFF', 3, 1); px(g, 3, h, '#2B2E33', 1, 2); px(g, 4, h, '#FFFFFF', 1, 1); px(g, 4, h + 1, '#2B2E33', 1, 1); px(g, 5, h, '#2B2E33', 1, 1)
  ic.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && px(g, 3 + x, 3 + y, COLORS[kind])))
  return { img: c, ax: 4, ay: h + 2 }
}
