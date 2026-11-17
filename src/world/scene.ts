// Paysage en pixel art dessiné à la main dans un petit canvas (agrandi sans lissage) :
// ciel tramé selon l'heure, astre, montagnes, collines, prairie, étang, arbres.
export type Time = 'day' | 'dusk' | 'night'
export const timeOfDay = (h = new Date().getHours()): Time => (h >= 8 && h < 18 ? 'day' : (h >= 6 && h < 8) || (h >= 18 && h < 21) ? 'dusk' : 'night')

const PAL: Record<Time, { sky: string[]; far: string; hill: string; hill2: string; grass: string[]; water: string[]; shade: number }> = {
  day: { sky: ['#5AA8EC', '#6DB6F0', '#84C4F4', '#9DD2F7', '#B8E0FA', '#D3EDFC'], far: '#8FB4D8', hill: '#6CBF5B', hill2: '#58AD4C', grass: ['#7FCB5F', '#6FBE52', '#8ED56B', '#5FA947'], water: ['#4E9BE0', '#6BB2EC', '#A9D8F7', '#3B82C6'], shade: 0 },
  dusk: { sky: ['#4B3F8C', '#6B4E9A', '#A35C93', '#DB7480', '#F59E6B', '#FFC98A'], far: '#7A5A8E', hill: '#5E9A55', hill2: '#4E8748', grass: ['#6FAE57', '#5F9E4B', '#7DBA62', '#548F43'], water: ['#5B6FB8', '#7A86C6', '#E8A28A', '#47549A'], shade: 0.12 },
  night: { sky: ['#0B1030', '#111A40', '#18234F', '#1F2D5E', '#28396C', '#31457A'], far: '#25335C', hill: '#2E5A45', hill2: '#264D3B', grass: ['#335F45', '#2B5340', '#3B6B4E', '#244836'], water: ['#1F3A6E', '#2A4A82', '#6C86C2', '#172C55'], shade: 0.35 },
}

// Générateur pseudo-aléatoire stable : le même paysage à chaque visite.
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }

export const LAYOUT = { horizon: 0.5, pond: { x0: 0.07, x1: 0.46, y0: 0.7, y1: 0.82 } }

export function drawScene(canvas: HTMLCanvasElement, W: number, H: number, time: Time) {
  canvas.width = W; canvas.height = H
  const g = canvas.getContext('2d')!
  const p = PAL[time], r = rng(42)
  const px = (x: number, y: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h) }
  const hz = Math.round(H * LAYOUT.horizon)

  // Ciel en bandes, tramées à chaque transition.
  const band = hz / p.sky.length
  p.sky.forEach((c, i) => {
    px(0, i * band, c, W, band + 1)
    if (i > 0) for (let x = 0; x < W; x += 2) px(x + (i % 2), i * band - 1, p.sky[i - 1])
  })
  // Étoiles la nuit.
  if (time === 'night') for (let k = 0; k < 70; k++) px(r() * W, r() * hz * 0.85, r() < 0.2 ? '#FFFFFF' : '#C9D6FF')
  // Astre.
  const sx = time === 'dusk' ? W * 0.78 : W * 0.8, sy = time === 'dusk' ? hz * 0.72 : hz * 0.2, rad = time === 'night' ? 7 : 9
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
    const d = Math.hypot(x, y)
    if (d <= rad) px(sx + x, sy + y, time === 'night' ? (Math.hypot(x - 3, y - 2) < rad - 1 ? p.sky[0] : '#F2F0D8') : d > rad - 1.5 ? '#FFD95A' : time === 'dusk' ? '#FFB066' : '#FFE98A')
  }
  // Montagnes lointaines (marche aléatoire en escalier).
  let h = hz * 0.72
  for (let x = 0; x < W; x++) { h = Math.max(hz * 0.55, Math.min(hz * 0.9, h + (r() - 0.5) * 3)); px(x, h, p.far, 1, hz - h + 1) }
  // Collines arrondies.
  const hill = (cx: number, w: number, top: number, c: string) => {
    for (let x = -w; x <= w; x++) { const y = hz - top * Math.sqrt(Math.max(0, 1 - (x / w) ** 2)); px(cx + x, y, c, 1, hz - y + 1) }
  }
  hill(W * 0.15, W * 0.35, hz * 0.18, p.hill2); hill(W * 0.75, W * 0.45, hz * 0.22, p.hill); hill(W * 0.45, W * 0.3, hz * 0.12, p.hill2)

  // Prairie : fond, ombre au loin, brins d'herbe, fleurs.
  px(0, hz, p.grass[0], W, H - hz)
  for (let y = hz; y < hz + 3; y++) for (let x = (y % 2); x < W; x += 2) px(x, y, p.grass[3])
  for (let k = 0; k < W * H * 0.012; k++) { const x = r() * W, y = hz + 4 + r() * (H - hz); px(x, y, r() < 0.5 ? p.grass[1] : p.grass[2]) }
  for (let k = 0; k < W * H * 0.0035; k++) {   // touffes en « w »
    const x = Math.round(r() * W), y = Math.round(hz + 6 + r() * (H - hz - 6))
    px(x, y, p.grass[3]); px(x + 1, y - 1, p.grass[3]); px(x + 2, y, p.grass[3]); px(x + 3, y - 1, p.grass[3]); px(x + 4, y, p.grass[3])
  }
  const flowers = time === 'night' ? ['#9AA7D6', '#C9C2E8'] : ['#F05A5A', '#FFD34D', '#FFFFFF', '#F59ACB']
  for (let k = 0; k < W * H * 0.0018; k++) {
    const x = r() * W, y = hz + 10 + r() * (H - hz - 10), c = flowers[Math.floor(r() * flowers.length)]
    px(x, y, c); px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c); px(x, y, '#FFE36E')
  }

  // Étang (ellipse pixel, bord sombre, reflets).
  const { x0, x1, y0, y1 } = LAYOUT.pond
  const pcx = (x0 + x1) / 2 * W, pcy = (y0 + y1) / 2 * H, prx = (x1 - x0) / 2 * W, pry = (y1 - y0) / 2 * H
  for (let y = -pry - 1; y <= pry + 1; y++) for (let x = -prx - 1; x <= prx + 1; x++) {
    const e = (x / prx) ** 2 + (y / pry) ** 2
    if (e <= 1) px(pcx + x, pcy + y, e > 0.82 ? p.water[3] : y < -pry * 0.2 ? p.water[1] : p.water[0])
    else if (e <= 1.18) px(pcx + x, pcy + y, p.grass[3])
  }
  for (let k = 0; k < 10; k++) { const x = pcx + (r() - 0.5) * prx * 1.3, y = pcy + (r() - 0.5) * pry * 1.1; px(x, y, p.water[2], 3, 1) }

  // Arbres aux bords.
  const tree = (cx: number, base: number, s: number) => {
    px(cx - 1, base - 6 * s, '#7A5232', 3, 6 * s)
    for (let y = -9 * s; y <= 0; y++) for (let x = -7 * s; x <= 7 * s; x++) {
      const e = (x / (7 * s)) ** 2 + ((y + 4.5 * s) / (5 * s)) ** 2
      if (e <= 1) px(cx + x, base - 6 * s + y - 2, e > 0.7 ? p.hill2 : x < 0 && y < -5 * s ? p.grass[2] : p.hill)
    }
  }
  tree(W * 0.06, hz + 4, 1); tree(W * 0.94, hz + 6, 1.2); tree(W * 0.9, H * 0.98, 1.6)

  // Assombrissement du soir et de la nuit.
  if (p.shade) { g.fillStyle = `rgba(10,14,40,${p.shade})`; g.fillRect(0, hz, W, H - hz) }
}

// Petit nuage en pixel art (canvas séparé, il dérive en CSS).
export function cloudSprite(time: Time, seed: number) {
  const c = document.createElement('canvas'), W = 28, H = 10
  c.width = W; c.height = H
  const g = c.getContext('2d')!, r = rng(seed)
  const body = time === 'dusk' ? '#FBD6C4' : '#FFFFFF', shade = time === 'dusk' ? '#E9A9A0' : '#DCEBF7'
  const puffs = [[8, 6, 4], [15, 5, 5], [21, 6, 4], [12 + r() * 4, 7, 4]]
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inside = puffs.some(([cx, cy, rr]) => Math.hypot(x - cx, (y - cy) * 1.4) <= rr)
    if (inside) { g.fillStyle = y >= H - 3 ? shade : body; g.fillRect(x, y, 1, 1) }
  }
  return c.toDataURL()
}
