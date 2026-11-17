// La carte du monde : 9 régions (une par famille de types) reliées par des routes, dessinées pixel par pixel.
import type { TypeKey } from '../types'
import * as A from './art'
import { bayer, fbm, hash, noise, rng } from './noise'

export const TS = 16, MW = 96, MH = 72, RW = 32, RH = 24
export type RegionId = 'glacier' | 'mountain' | 'volcano' | 'forest' | 'prairie' | 'lake' | 'marsh' | 'ruins' | 'plant'
export const REGIONS: { id: RegionId; name: string; types: TypeKey[] }[] = [
  { id: 'glacier', name: 'Glacier', types: ['ice'] },
  { id: 'mountain', name: 'Montagne', types: ['rock', 'ground', 'fighting'] },
  { id: 'volcano', name: 'Volcan', types: ['fire'] },
  { id: 'forest', name: 'Forêt', types: ['grass', 'bug'] },
  { id: 'prairie', name: 'Prairie', types: ['normal', 'flying'] },
  { id: 'lake', name: 'Lac', types: ['water'] },
  { id: 'marsh', name: 'Marais hanté', types: ['poison', 'ghost', 'dark'] },
  { id: 'ruins', name: 'Ruines', types: ['psychic', 'fairy', 'dragon'] },
  { id: 'plant', name: 'Centrale', types: ['electric', 'steel'] },
]
export const regionOfType = (t: TypeKey) => Math.max(0, REGIONS.findIndex((r) => r.types.includes(t)))
export const regionCenter = (r: number) => ({ x: ((r % 3) * RW + RW / 2) * TS, y: (Math.floor(r / 3) * RH + RH / 2) * TS })

// Teintes du sol (clair, base, sombre, détail) par région.
const GROUND: string[][] = [
  ['#FFFFFF', '#E9F3F9', '#D2E3EE', '#B5CCDD'],
  ['#CDB083', '#B89A6A', '#A0835A', '#7E6340'],
  ['#857370', '#6E5D5A', '#5A4A48', '#3F3332'],
  ['#5FAE4A', '#4E9C3D', '#3F8633', '#2F6927'],
  ['#96DA67', '#7DCB53', '#69B845', '#4E9A35'],
  ['#8CD467', '#74C455', '#5FB048', '#46913A'],
  ['#6E7C58', '#5D6B4A', '#4C593D', '#394430'],
  ['#9FD67C', '#87C766', '#72B355', '#58974A'],
  ['#A9B0B6', '#979EA5', '#868D94', '#6F757B'],
]
const PATH: string[][] = [
  ['#F3F8FB', '#DCE8F0', '#C6D7E3'], ['#DDC497', '#CBAE7E', '#B49568'], ['#9A8781', '#86746F', '#72625D'],
  ['#D9B77E', '#C9A46B', '#B48F59'], ['#E6C893', '#D9B77E', '#C49F65'], ['#E6C893', '#D9B77E', '#C49F65'],
  ['#9C8F72', '#8A7D62', '#766A52'], ['#E3DACB', '#D2C7B4', '#BBAE98'], ['#B9BEC3', '#A6ACB2', '#92989F'],
]
const WATER = { deep: '#3A8FD8', base: '#4FA3E6', light: '#8CCBF5', edge: '#2E74B5', sand: '#EED9A2', sand2: '#D9C185' }
const MURK = { base: '#4D625B', light: '#6B8077', edge: '#33433E' }
const LAVA = { base: '#F2621F', light: '#FFB13B', edge: '#C23A12', crust: '#3A2A28' }
const ICE = { base: '#A8DDF0', light: '#D8F3FC', edge: '#6FB3D2' }

type Pool = { x: number; y: number; rx: number; ry: number }
const T = (x: number) => x * TS
const LAKE: Pool = { x: T(81), y: T(37.5), rx: T(10.5), ry: T(7.5) }
const ICELAKE: Pool = { x: T(10), y: T(16), rx: T(6.5), ry: T(4) }
const LAVAS: Pool[] = [{ x: T(71), y: T(9), rx: T(2.2), ry: T(1.5) }, { x: T(75), y: T(18.5), rx: T(2.8), ry: T(1.7) }, { x: T(91), y: T(19), rx: T(1.8), ry: T(1.3) }]
const MURKS: Pool[] = [{ x: T(8), y: T(55), rx: T(3.5), ry: T(2.2) }, { x: T(23), y: T(64), rx: T(3), ry: T(2) }, { x: T(9), y: T(66.5), rx: T(2.4), ry: T(1.6) }, { x: T(25), y: T(53), rx: T(2.2), ry: T(1.4) }]
const PLAZA = { x0: T(40), y0: T(53), x1: T(56), y1: T(67) }
const CONCRETE = { x0: T(70), y0: T(52), x1: T(91), y1: T(68) }
const poolField = (p: Pool, x: number, y: number, seed: number) => ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 + (fbm(x / 40, y / 40, seed) - 0.5) * 0.7

export type Obj = { x: number; y: number; s: A.Sprite; frames?: A.Sprite[] }
export type World = {
  terrain: HTMLCanvasElement
  region: Uint8Array      // région de chaque case
  walk: Uint8Array        // 0 bloqué · 1 sol · 2 eau (nage) · 3 glace
  objects: Obj[]
  water: { x: number; y: number }[]   // reflets animés
  lava: { x: number; y: number }[]
  lights: { x: number; y: number; r: number; c: string }[]
  cables: number[][]                  // segments de câbles entre pylônes
  vents: { x: number; y: number }[]   // fumerolles
}

// Région d'un point : grille 3×3 aux frontières ondulées et tramées.
export function regionAt(x: number, y: number) {
  const wx = x + (fbm(x / 110, y / 110, 3) - 0.5) * 120 + (hash(x, y, 9) - 0.5) * 10
  const wy = y + (fbm(x / 110, y / 110, 5) - 0.5) * 120 + (hash(x, y, 11) - 0.5) * 10
  const col = Math.min(2, Math.max(0, Math.floor(wx / T(RW)))), row = Math.min(2, Math.max(0, Math.floor(wy / T(RH))))
  return row * 3 + col
}
// Distance aux routes : un axe est-ouest et trois axes nord-sud, légèrement sinueux.
export const roadY = (x: number) => T(36.5) + (noise(x / 160, 0.5, 21) - 0.5) * 50
export const roadX = (cx: number, y: number) => T(cx) + (noise(0.5, y / 160, 23 + cx) - 0.5) * 50
let horiz = false   // orientation de la route la plus proche (pour les planches des ponts)
function roadDist(x: number, y: number) {
  let d = 1e9
  horiz = false
  if (x > T(5) && x < T(91)) { d = Math.abs(y - roadY(x)); horiz = true }
  for (const cx of [16.5, 48.5, 80.5]) {
    if (y > T(cx === 80.5 ? 15 : 6) && y < T(66)) { const dv = Math.abs(x - roadX(cx, y)); if (dv < d) { d = dv; horiz = false } }
  }
  return d
}
const segDist = (x: number, y: number, a: number[], b: number[]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)
}
const RIVER = [[85, 10.5], [83, 13], [80.5, 14.5], [78, 16.5], [75.5, 18.3]].map(([x, y]) => [T(x), T(y)])
// Plateaux de la montagne : dessus clair, falaise striée au sud.
const plateau = (x: number, y: number) => x > T(33) && x < T(63) && y > T(1) && y < T(31) && regionAt(x, y) === 1 && fbm(x / 80, y / 80, 99) > 0.55

export function buildWorld(): World {
  const W = MW * TS, H = MH * TS
  const terrain = document.createElement('canvas'); terrain.width = W; terrain.height = H
  const g = terrain.getContext('2d')!
  const img = g.createImageData(W, H), data = img.data
  const kind = new Uint8Array(W * H)   // 0 sol · 1 route · 2 eau · 3 lave · 4 glace · 5 dalles · 6 béton
  const water: World['water'] = [], lava: World['lava'] = []
  const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
  const cache = new Map<string, number[]>()
  const rgb = (c: string) => cache.get(c) ?? (cache.set(c, hex(c)), cache.get(c)!)
  const r = rng(77)

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, reg = regionAt(x, y), b = bayer(x, y), tex = fbm(x / 9, y / 9, 1) + b * 0.22
    let c: string
    const lake = poolField(LAKE, x, y, 31)
    const murk = Math.min(...MURKS.map((p, k) => poolField(p, x, y, 40 + k)))
    const lav = Math.min(...LAVAS.map((p, k) => poolField(p, x, y, 50 + k)))
    const ice = poolField(ICELAKE, x, y, 60)
    const plaza = x > PLAZA.x0 + (noise(y / 12, 1, 70) - 0.5) * 18 && x < PLAZA.x1 - (noise(y / 12, 2, 70) - 0.5) * 18 && y > PLAZA.y0 + (noise(x / 12, 3, 70) - 0.5) * 18 && y < PLAZA.y1 - (noise(x / 12, 4, 70) - 0.5) * 18
    const conc = x > CONCRETE.x0 && x < CONCRETE.x1 && y > CONCRETE.y0 && y < CONCRETE.y1
    const rd = roadDist(x, y), roadW = 11 + (noise(x / 14, y / 14, 80) - 0.5) * 5
    const river = reg === 2 && x > T(73) && y < T(20) ? Math.min(...RIVER.slice(1).map((b, k) => segDist(x, y, RIVER[k], b))) - (noise(x / 10, y / 10, 81) - 0.5) * 3 : 99
    const plat = reg === 1 && plateau(x, y), cliff = plat && !plateau(x, y + 9)
    if (lake < 1 && rd < roadW - 1) {
      kind[i] = 7
      const along = horiz ? x : y, across = rd
      c = across > roadW - 3 ? '#4A3018' : along % 4 === 0 ? '#6E4A2A' : (Math.floor(along / 4) % 3 === 0 ? '#B98450' : '#A8743E')
    } else if (lake < 1) {
      kind[i] = 2
      const depth = lake < 0.55 ? WATER.deep : WATER.base
      c = lake > 0.9 ? WATER.edge : ((x + Math.floor(y / 3) * 7) % 23 === 0 && y % 3 === 0 ? WATER.light : depth)
      if (hash(x, y, 2) < 0.004 && lake < 0.85) water.push({ x, y })
    } else if (lake < 1.16) c = lake < 1.04 ? WATER.sand2 : tex > 0.6 ? WATER.sand2 : WATER.sand
    else if (murk < 1) { kind[i] = 2; c = murk > 0.86 ? MURK.edge : hash(x >> 2, y >> 1, 4) < 0.05 ? MURK.light : MURK.base }
    else if (river < 4) { kind[i] = 3; c = river < 1.5 ? LAVA.light : LAVA.base; if (hash(x, y, 7) < 0.02) lava.push({ x, y }) }
    else if (river < 6) c = LAVA.crust
    else if (lav < 1) { kind[i] = 3; c = lav > 0.82 ? LAVA.edge : fbm(x / 5, y / 5, 8) + b * 0.2 > 0.62 ? LAVA.light : LAVA.base; if (hash(x, y, 6) < 0.01) lava.push({ x, y }) }
    else if (lav < 1.25) c = LAVA.crust
    else if (ice < 1) { kind[i] = 4; c = ice > 0.88 ? ICE.edge : (Math.abs(noise(x / 7, y / 7, 12) - 0.5) < 0.025 ? ICE.edge : tex > 0.62 ? ICE.light : ICE.base) }
    else if (plaza) {
      kind[i] = 5
      const gx = (x - PLAZA.x0) % 12, gy = (y - PLAZA.y0) % 12, row = Math.floor((y - PLAZA.y0) / 12)
      const grout = gy === 0 || (gx + (row % 2) * 6) % 12 === 0
      const moss = fbm(x / 20, y / 20, 14) > 0.62
      c = grout ? (moss ? GROUND[7][3] : '#A89E8A') : hash(Math.floor((x - PLAZA.x0 + (row % 2) * 6) / 12), row, 15) < 0.15 ? '#C4BAA6' : tex > 0.66 ? '#E3DACB' : '#D2C7B4'
    } else if (conc) {
      kind[i] = 6
      const border = Math.min(x - CONCRETE.x0, CONCRETE.x1 - x, y - CONCRETE.y0, CONCRETE.y1 - y)
      c = border < 4 ? (Math.floor((x + y) / 4) % 2 ? '#F2C318' : '#2B2B2B') : (x - CONCRETE.x0) % 32 === 0 || (y - CONCRETE.y0) % 32 === 0 ? '#7E858C' : tex > 0.64 ? '#B3B9BF' : '#A0A7AD'
    } else if (rd < roadW) {
      kind[i] = 1
      const p = PATH[reg]
      c = rd > roadW - 1.5 ? p[2] : hash(x, y, 16) < 0.03 ? p[2] : tex > 0.62 ? p[0] : p[1]
    } else if (cliff) {
      kind[i] = 8
      const yy = y % 9
      c = yy === 8 ? '#3E3020' : (x + Math.floor(y / 3)) % 5 === 0 ? '#7E6340' : yy < 2 ? '#A0835A' : '#8E7350'
    } else {
      const p = GROUND[reg], t2 = tex + (fbm(x / 70, y / 70, 5) - 0.5) * 0.35 + (plat ? 0.18 : 0)
      c = rd < roadW + 1.5 ? p[3] : t2 > 0.66 ? p[0] : t2 < 0.36 ? p[2] : p[1]
    }
    const [R, G, B] = rgb(c)
    data[i * 4] = R; data[i * 4 + 1] = G; data[i * 4 + 2] = B; data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)

  const region = new Uint8Array(MW * MH), walk = new Uint8Array(MW * MH)
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const cx = tx * TS + 8, cy = ty * TS + 8, k = kind[cy * W + cx]
    region[ty * MW + tx] = regionAt(cx, cy)
    walk[ty * MW + tx] = k === 2 ? 2 : k === 3 || k === 8 ? 0 : k === 4 ? 3 : 1
  }

  // Petits détails au sol : touffes, fleurs, cailloux, flocons.
  const dot = (x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, 1, 1) }
  for (let k = 0; k < 5200; k++) {
    const x = Math.floor(r() * W), y = Math.floor(r() * H), i = y * W + x
    if (kind[i] !== 0) continue
    const reg = regionAt(x, y), p = GROUND[reg], v = r()
    if (reg === 0) { if (v < 0.3) dot(x, y, '#C9DCEA'); continue }
    if (reg === 2 || reg === 1 || reg === 8) { if (v < 0.4) { dot(x, y, p[3]); dot(x + 1, y, p[3]); dot(x, y - 1, p[0]) } continue }
    if (v < 0.62) { dot(x, y, p[3]); dot(x + 1, y - 1, p[3]); dot(x + 2, y, p[3]); dot(x + 3, y - 1, p[3]); dot(x + 4, y, p[3]) }
    else if (reg !== 6 && v < 0.82) {
      const fl = reg === 7 ? ['#FA7FB0', '#FFFFFF'] : reg === 3 ? ['#FFFFFF', '#FFE36E'] : ['#F05A5A', '#FFD34D', '#FFFFFF', '#7FA8FF']
      const fc = fl[Math.floor(r() * fl.length)]
      dot(x, y - 1, fc); dot(x - 1, y, fc); dot(x + 1, y, fc); dot(x, y + 1, fc); dot(x, y, '#FFE36E')
    } else if (reg === 6) { dot(x, y, '#7E6A8C'); dot(x + 1, y, '#7E6A8C') }
  }
  // Nénuphars sur le lac.
  for (let k = 0; k < 18; k++) {
    const x = LAKE.x + (r() - 0.5) * LAKE.rx * 1.5, y = LAKE.y + (r() - 0.5) * LAKE.ry * 1.4
    if (poolField(LAKE, x, y, 31) > 0.8) continue
    g.fillStyle = '#3F9A44'; g.fillRect(x - 2, y - 1, 5, 3); g.fillRect(x - 1, y - 2, 3, 5); g.fillStyle = '#5FC060'; g.fillRect(x - 1, y - 1, 2, 1)
    if (r() < 0.3) { g.fillStyle = '#FA9FC0'; g.fillRect(x, y - 1, 2, 2) }
  }

  // Décors : chaque objet bloque la case de son pied.
  const objects: Obj[] = [], lights: World['lights'] = []
  const free = (tx: number, ty: number) => tx > 0 && ty > 0 && tx < MW - 1 && ty < MH - 1 && walk[ty * MW + tx] === 1 && kind[(ty * TS + 8) * W + tx * TS + 8] === 0
  const place = (tx: number, ty: number, s: A.Sprite, w = 1, extra?: Partial<Obj>) => {
    for (let k = 0; k < w; k++) walk[ty * MW + tx + k - Math.floor(w / 2)] = 0
    objects.push({ x: tx * TS + 8, y: ty * TS + 12, s, ...extra })
  }
  const scatter = (reg: number, n: number, make: () => A.Sprite, opts: { minDist?: number; where?: (tx: number, ty: number) => boolean } = {}) => {
    const ox = (reg % 3) * RW, oy = Math.floor(reg / 3) * RH
    for (let k = 0, tries = 0; k < n && tries < n * 30; tries++) {
      const tx = ox + 1 + Math.floor(r() * (RW - 2)), ty = oy + 1 + Math.floor(r() * (RH - 2))
      if (region[ty * MW + tx] !== reg || !free(tx, ty) || roadDist(tx * TS + 8, ty * TS + 8) < 26) continue
      if (opts.where && !opts.where(tx, ty)) continue
      if (objects.some((o) => Math.abs(o.x - tx * TS - 8) < (opts.minDist ?? 1.5) * TS && Math.abs(o.y - ty * TS - 12) < (opts.minDist ?? 1.5) * TS)) continue
      place(tx, ty, make()); k++
    }
  }
  const LEAF = ['#8ED46A', '#5FAF3E', '#3F8A2C', '#1F4A1A'], DARKLEAF = ['#6DBA52', '#3F8A2C', '#2C6A22', '#173A14']
  const PINE = ['#5FA56A', '#3C7F4D', '#2A5E39', '#15301E']
  const ROCK = ['#D9C29C', '#B89A6A', '#8E7350', '#3E3020'], ASH = ['#8C7A76', '#6B5A57', '#4E403E', '#1F1716'], SNOWROCK = ['#FFFFFF', '#DDEAF2', '#B5CCDD', '#5A7286']
  // Glacier
  scatter(0, 30, () => A.pine(PINE, true), { minDist: 1.6 }); scatter(0, 12, A.crystal, { minDist: 2 }); scatter(0, 8, () => A.rock(SNOWROCK))
  // Montagne
  scatter(1, 14, () => A.spire(ROCK), { minDist: 2.5 }); scatter(1, 34, () => A.rock(ROCK, 10 + Math.floor(r() * 8), 7 + Math.floor(r() * 5)), { minDist: 1.5 }); scatter(1, 8, () => A.pine(PINE))
  // Volcan
  place(85, 9, A.cone(), 7); for (let k = -4; k <= 4; k++) for (let j = 1; j <= 4; j++) walk[(9 - j) * MW + 85 + k] = 0
  lights.push({ x: 85 * TS + 8, y: 6 * TS, r: 70, c: '255,120,40' }, { x: T(79), y: T(15), r: 50, c: '255,110,30' })
  scatter(2, 8, A.charred, { minDist: 2.5 })
  scatter(2, 26, () => A.rock(ASH, 10 + Math.floor(r() * 8), 7 + Math.floor(r() * 4)), { minDist: 1.8 })
  // Forêt : dense, avec des clairières.
  for (let ty = 25; ty < 47; ty++) for (let tx = 1; tx < 31; tx++) {
    if (region[ty * MW + tx] !== 3 || !free(tx, ty) || roadDist(tx * TS + 8, ty * TS + 8) < 24) continue
    if (fbm(tx / 6, ty / 6, 90) > 0.5 && r() < 0.42 && !objects.some((o) => Math.abs(o.x - tx * TS - 8) < 24 && Math.abs(o.y - ty * TS - 12) < 20)) place(tx, ty, r() < 0.7 ? A.tree(DARKLEAF, tx) : A.pine(PINE))
  }
  scatter(3, 18, () => A.mushroom(r() < 0.5 ? '#E2432A' : '#F2C318'), { minDist: 1 }); scatter(3, 10, () => A.bush(DARKLEAF))
  // Prairie
  scatter(4, 16, () => A.tree(LEAF, Math.floor(r() * 4)), { minDist: 3 }); scatter(4, 22, () => A.bush(LEAF), { minDist: 2 }); place(46, 34, A.sign())
  // Lac
  scatter(5, 14, () => A.tree(LEAF, 1), { minDist: 2.5, where: (tx, ty) => poolField(LAKE, tx * TS, ty * TS, 31) > 1.5 }); scatter(5, 10, () => A.rock(['#E3E8EC', '#B9C2C9', '#8C96A0', '#3A424A'], 11, 7)); scatter(5, 10, () => A.bush(LEAF))
  // Marais
  scatter(6, 14, A.deadTree, { minDist: 2.5 }); scatter(6, 14, A.grave, { minDist: 1.6 }); scatter(6, 12, () => A.mushroom('#9354CB'), { minDist: 1 })
  // Ruines
  place(48, 56, A.temple(), 3)
  for (const [tx, ty] of [[42, 55], [54, 55], [42, 61], [54, 61], [45, 65], [51, 65], [41, 58], [55, 64]]) if (walk[ty * MW + tx] !== 0) place(tx, ty, A.pillar(hash(tx, ty, 3) < 0.4))
  scatter(7, 8, () => A.tree(LEAF, 2), { minDist: 3 }); scatter(7, 8, () => A.pillar(true), { minDist: 3 })
  // Centrale
  place(84, 56, A.building(), 4)
  lights.push({ x: 84 * TS, y: 55 * TS, r: 40, c: '140,200,255' })
  for (const [tx, ty] of [[67, 50], [72, 50], [77, 50], [82, 50], [87, 50]]) if (walk[ty * MW + tx] !== 0) place(tx, ty, A.pylon())
  if (walk[60 * MW + 74] !== 0) place(74, 58, A.building(), 4)
  for (let k = 0; k < 6; k++) { const tx = 76 + (k % 3) * 3, ty = 61 + Math.floor(k / 3) * 3; if (walk[ty * MW + tx] !== 0) place(tx, ty, A.solar(), 2) }
  scatter(8, 14, A.crate, { minDist: 1.5 }); scatter(8, 6, () => A.rock(['#C9CED4', '#A3A9B1', '#7C8692', '#3E444C'], 12, 8), { minDist: 2 })
  // Bords du monde : une lisière d'arbres.
  for (let tx = 0; tx < MW; tx += 2) for (const ty of [0, MH - 1]) { const reg = region[ty * MW + tx]; objects.push({ x: tx * TS + 8, y: ty * TS + (ty ? 14 : 10), s: reg === 0 ? A.pine(PINE, true) : reg === 2 ? A.rock(ASH) : reg === 1 ? A.spire(ROCK) : A.tree(DARKLEAF, tx) }); walk[ty * MW + tx] = 0; walk[ty * MW + tx + 1] = 0 }
  for (let ty = 0; ty < MH; ty += 2) for (const tx of [0, MW - 1]) { const reg = region[ty * MW + tx]; objects.push({ x: tx * TS + 8, y: ty * TS + 12, s: reg === 0 ? A.pine(PINE, true) : reg === 2 ? A.rock(ASH) : reg === 1 ? A.spire(ROCK) : A.tree(DARKLEAF, ty) }); walk[ty * MW + tx] = 0; walk[(ty + 1) * MW + tx] = 0 }
  // ——— Enrichissements ———
  // Lampadaires le long des routes (allumés la nuit).
  const lampAt = (tx: number, ty: number) => { if (free(tx, ty) && !objects.some((o) => Math.abs(o.x - tx * TS - 8) < 20 && Math.abs(o.y - ty * TS - 12) < 20)) { place(tx, ty, A.lamp()); lights.push({ x: tx * TS + 8, y: ty * TS - 16, r: 34, c: '255,220,140' }) } }
  for (let tx = 8; tx < 90; tx += 9) lampAt(tx, Math.round(roadY(tx * TS) / TS + 1.4))
  for (const cx of [16.5, 48.5, 80.5]) for (let ty = cx === 80.5 ? 20 : 10; ty < 64; ty += 9) lampAt(Math.round(roadX(cx, ty * TS) / TS + 1.4), ty)
  // Hautes herbes qui ondulent (ne bloquent pas : les Pokémon s'y cachent à moitié).
  for (let ty = 2; ty < MH - 2; ty++) for (let tx = 2; tx < MW - 2; tx++) {
    const reg = region[ty * MW + tx]
    if (![3, 4, 5, 7].includes(reg) || !free(tx, ty) || roadDist(tx * TS + 8, ty * TS + 8) < 22) continue
    if (fbm(tx / 4, ty / 4, 200) < 0.6 || objects.some((o) => Math.abs(o.x - tx * TS - 8) < 12 && Math.abs(o.y - ty * TS - 12) < 12)) continue
    const col = reg === 3 ? ['#7DC45E', '#4E9C3D', '#3F8633', '#1F4A1A'] : undefined
    const f = [A.tallGrass(0, col), A.tallGrass(1, col)]
    objects.push({ x: tx * TS + 8, y: ty * TS + 13, s: f[0], frames: f })
  }
  // Glacier : igloo et bonhomme de neige.
  for (const [tx, ty, s] of [[21, 7, A.igloo()], [24, 9, A.snowman()], [6, 8, A.snowman()]] as const) if (free(tx, ty)) place(tx, ty, s, s.img.width > 30 ? 3 : 1)
  // Montagne : grotte au pied d'une falaise.
  outer: for (let ty = 3; ty < 22; ty++) for (let tx = 36; tx < 60; tx++) if (kind[(ty * TS + 8) * W + tx * TS + 8] === 8 && free(tx, ty + 1)) { place(tx, ty + 1, A.cave(), 3); break outer }
  // Marais : lanternes aux feux verts.
  for (const [tx, ty] of [[12, 52], [19, 58], [6, 61], [27, 60], [15, 67]]) if (free(tx, ty)) { place(tx, ty, A.lantern()); lights.push({ x: tx * TS + 8, y: ty * TS - 10, r: 30, c: '120,255,180' }) }
  // Ruines : fontaine et statues.
  if (walk[63 * MW + 48] !== 0) place(48, 63, A.fountain(), 3)
  for (const [tx, ty] of [[44, 59], [52, 59]]) place(tx, ty, A.statue())
  // Centrale : câbles entre pylônes.
  const pylons = objects.filter((o) => o.s.img.height === 46 && o.s.img.width === 20)
  const cables: number[][] = []
  for (let k = 1; k < pylons.length; k++) { const a = pylons[k - 1], b = pylons[k]; cables.push([a.x - 7, a.y - 34, b.x - 7, b.y - 34], [a.x + 7, a.y - 34, b.x + 7, b.y - 34]) }
  // Volcan : fumerolles.
  const vents = [[72, 13], [89, 15], [77, 6], [68, 19]].map(([x, y]) => ({ x: T(x), y: T(y) }))
  for (const v of vents) { g.fillStyle = '#251B1A'; g.fillRect(v.x - 2, v.y - 1, 5, 3); g.fillStyle = '#F2621F'; g.fillRect(v.x - 1, v.y, 3, 1) }
  return { terrain, region, walk, objects, water, lava, lights, cables, vents }
}
