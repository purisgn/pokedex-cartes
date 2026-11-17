// Moteur du monde : caméra au doigt (avec inertie), vie des Pokémon (marche dans 8 directions, repos,
// sommeil, sauts, émotions, rencontres), lumière du jour et de la nuit, particules d'ambiance.
import { DB } from '../data'
import { bubble, EMOTES, type Sprite } from './art'
import { buildWorld, MH, MW, REGIONS, RH, RW, regionCenter, regionOfType, TS, type World } from './map'
import { hash } from './noise'
import { dirOf, frameAt, loadAnim, type Anim } from './sprites'

type Mode = 'land' | 'swim' | 'fly' | 'float'
type State = 'idle' | 'walk' | 'sleep' | 'hop'
type Mon = {
  id: number; region: number; mode: Mode
  x: number; y: number; path: { x: number; y: number }[]
  dir: number; state: State; t0: number; until: number; speed: number; phase: number
  anims: { w?: Anim | null; i?: Anim | null; s?: Anim | null; h?: Anim | null }
  emote?: Sprite; emoteUntil: number; nextEmote: number
}
export type Time = 'day' | 'dusk' | 'night'
export const timeOfDay = (h = new Date().getHours()): Time => (h >= 8 && h < 18 ? 'day' : (h >= 6 && h < 8) || (h >= 18 && h < 21) ? 'dusk' : 'night')

const SPRITE_SHEET = import.meta.env.BASE_URL + 'sprites.webp'
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const BUBBLES = Object.fromEntries(EMOTES.map((k) => [k, bubble(k)])) as Record<string, Sprite>

export class WorldEngine {
  world!: World
  mons: Mon[] = []
  ctx: CanvasRenderingContext2D
  dpr = Math.min(3, devicePixelRatio || 1)
  zoom = 2
  cam = { x: 0, y: 0 }
  vel = { x: 0, y: 0 }
  pan: { from: { x: number; y: number }; to: { x: number; y: number }; t0: number } | null = null
  picked: number | null = null
  time: Time = timeOfDay()
  sheet = new Image()
  particles: { x: number; y: number; vx: number; vy: number; kind: 'snow' | 'ember' | 'fly' | 'fog'; p: number }[] = []
  private raf = 0
  private last = 0
  private regionNow = -1
  private drag: { id: number; x: number; y: number; cx: number; cy: number; moved: boolean; t: number; lx: number; ly: number } | null = null

  canvas: HTMLCanvasElement
  private cb: { pick: (id: number | null) => void; region: (r: number) => void }
  constructor(canvas: HTMLCanvasElement, ids: number[], cb: { pick: (id: number | null) => void; region: (r: number) => void }) {
    this.canvas = canvas; this.cb = cb
    this.ctx = canvas.getContext('2d')!
    this.sheet.src = SPRITE_SHEET
    this.world = buildWorld()
    this.spawn(ids)
    this.seedParticles()
    const counts = REGIONS.map((_, r) => this.mons.filter((m) => m.region === r).length)
    const start = counts.indexOf(Math.max(...counts))
    this.resize()
    const c = regionCenter(start < 0 ? 4 : start)
    this.cam = this.clamp({ x: c.x - this.vw / 2, y: c.y - this.vh / 2 })
    this.bind()
  }

  get vw() { return this.canvas.clientWidth / this.zoom }
  get vh() { return this.canvas.clientHeight / this.zoom }

  // Chaque Pokémon vit dans la région de son type principal ; les Eau nagent, les Vol volent, les Spectre flottent.
  private spawn(ids: number[]) {
    const w = this.world
    for (const id of ids) {
      const p = DB.dex[id - 1]
      if (!p) continue
      const t = p.types
      const region = t[0] === 'flying' ? 4 : regionOfType(t[0])
      const mode: Mode = t[0] === 'water' ? 'swim' : t[0] === 'ghost' ? 'float' : t.includes('flying') ? 'fly' : 'land'
      const spot = this.randomTile(region, mode) ?? this.randomTile(region, 'land') ?? { x: regionCenter(region).x, y: regionCenter(region).y }
      const m: Mon = {
        id, region, mode: spot && mode === 'swim' && !this.ok(Math.floor(spot.x / TS), Math.floor(spot.y / TS), region, 'swim') ? 'land' : mode,
        x: spot.x, y: spot.y, path: [], dir: Math.floor(Math.random() * 8), state: 'idle', t0: 0, until: rand(500, 4000), speed: mode === 'fly' ? 34 : mode === 'swim' ? 20 : 24 + Math.random() * 6,
        phase: Math.random() * 6, anims: {}, emoteUntil: 0, nextEmote: rand(3000, 20000),
      }
      if (this.time === 'night' && m.mode !== 'fly' && Math.random() < 0.6) { m.state = 'sleep'; m.until = rand(20000, 60000) }
      this.mons.push(m)
      for (const k of ['w', 'i', 's', 'h'] as const) loadAnim(id, k).then((a) => { m.anims[k] = a })
    }
    void w
  }
  private ok(tx: number, ty: number, region: number, mode: Mode) {
    if (tx < 1 || ty < 1 || tx >= MW - 1 || ty >= MH - 1) return false
    const i = ty * MW + tx, k = this.world.walk[i]
    if (this.world.region[i] !== region) return false
    if (mode === 'swim') return k === 2
    if (mode === 'fly') return true
    return k === 1 || k === 3
  }
  private randomTile(region: number, mode: Mode) {
    const ox = (region % 3) * RW, oy = Math.floor(region / 3) * RH
    for (let k = 0; k < 400; k++) {
      const tx = ox + Math.floor(Math.random() * RW), ty = oy + Math.floor(Math.random() * RH)
      if (this.ok(tx, ty, region, mode)) return { x: tx * TS + 8 + rand(-3, 3), y: ty * TS + 10 + rand(-3, 3) }
    }
    return null
  }
  // Petit chemin case par case (parcours en largeur) vers un point proche de sa région.
  private route(m: Mon) {
    const sx = Math.floor(m.x / TS), sy = Math.floor(m.y / TS)
    for (let k = 0; k < 14; k++) {
      const tx = sx + Math.round(rand(-8, 8)), ty = sy + Math.round(rand(-6, 6))
      if (!this.ok(tx, ty, m.region, m.mode) || (tx === sx && ty === sy)) continue
      if (m.mode === 'fly' || m.mode === 'float') {
        if (m.mode === 'float' && !this.ok(tx, ty, m.region, 'land')) continue
        return [{ x: tx * TS + 8 + rand(-4, 4), y: ty * TS + 10 + rand(-4, 4) }]
      }
      const prev = new Map<number, number>([[sy * MW + sx, -1]]), q = [sy * MW + sx]
      let found = false
      for (let h = 0; h < q.length && q.length < 600; h++) {
        const c = q[h], cx = c % MW, cy = (c / MW) | 0
        if (cx === tx && cy === ty) { found = true; break }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const nx = cx + dx, ny = cy + dy, n = ny * MW + nx
          if (prev.has(n) || !this.ok(nx, ny, m.region, m.mode)) continue
          if (dx && dy && (!this.ok(cx + dx, cy, m.region, m.mode) || !this.ok(cx, cy + dy, m.region, m.mode))) continue
          prev.set(n, c); q.push(n)
        }
      }
      if (!found) continue
      const path: { x: number; y: number }[] = []
      for (let c = ty * MW + tx; c !== -1 && c !== sy * MW + sx; c = prev.get(c)!) path.unshift({ x: (c % MW) * TS + 8 + rand(-3, 3), y: ((c / MW) | 0) * TS + 10 + rand(-3, 3) })
      return path
    }
    return []
  }

  private seedParticles() {
    const add = (region: number, n: number, kind: 'snow' | 'ember' | 'fly' | 'fog') => {
      const ox = (region % 3) * RW * TS, oy = Math.floor(region / 3) * RH * TS
      for (let k = 0; k < n; k++) this.particles.push({ x: ox + Math.random() * RW * TS, y: oy + Math.random() * RH * TS, vx: 0, vy: 0, kind, p: Math.random() * 10 })
    }
    add(0, 160, 'snow'); add(2, 60, 'ember'); add(6, 14, 'fog')
    if (this.time !== 'day') { add(3, 40, 'fly'); add(4, 30, 'fly'); add(6, 30, 'fly') }
  }

  // ——— Caméra et gestes ———
  clamp(c: { x: number; y: number }) {
    return { x: Math.max(0, Math.min(MW * TS - this.vw, c.x)), y: Math.max(0, Math.min(MH * TS - this.vh, c.y)) }
  }
  panTo(x: number, y: number) { this.vel = { x: 0, y: 0 }; this.pan = { from: { ...this.cam }, to: this.clamp({ x: x - this.vw / 2, y: y - this.vh / 2 }), t0: performance.now() } }
  panToRegion(r: number) { const c = regionCenter(r); this.panTo(c.x, c.y) }
  setZoom(z: number) {
    const cx = this.cam.x + this.vw / 2, cy = this.cam.y + this.vh / 2
    this.zoom = z; this.cam = this.clamp({ x: cx - this.vw / 2, y: cy - this.vh / 2 })
  }
  resize() {
    const c = this.canvas
    c.width = Math.round(c.clientWidth * this.dpr); c.height = Math.round(c.clientHeight * this.dpr)
    this.cam = this.clamp(this.cam)
  }
  private bind() {
    const c = this.canvas
    c.onpointerdown = (e) => {
      if (this.drag) return                       // un seul doigt pilote la caméra
      c.setPointerCapture(e.pointerId)
      this.pan = null; this.vel = { x: 0, y: 0 }
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y, moved: false, t: performance.now(), lx: e.clientX, ly: e.clientY }
    }
    c.onpointermove = (e) => {
      const d = this.drag
      if (!d || d.id !== e.pointerId) return
      const dx = e.clientX - d.x, dy = e.clientY - d.y
      if (Math.hypot(dx, dy) > 6) d.moved = true
      const now = performance.now(), dt = Math.max(1, now - d.t)
      this.vel = { x: -(e.clientX - d.lx) / this.zoom / dt * 1000, y: -(e.clientY - d.ly) / this.zoom / dt * 1000 }
      d.t = now; d.lx = e.clientX; d.ly = e.clientY
      this.cam = this.clamp({ x: d.cx - dx / this.zoom, y: d.cy - dy / this.zoom })
    }
    const up = (e: PointerEvent) => {
      const d = this.drag
      if (!d || d.id !== e.pointerId) return
      this.drag = null
      if (performance.now() - d.t > 80) this.vel = { x: 0, y: 0 }
      if (!d.moved) { this.vel = { x: 0, y: 0 }; this.tap(e) }
    }
    c.onpointerup = up; c.onpointercancel = up
  }
  private tap(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect()
    const wx = this.cam.x + (e.clientX - r.left) / this.zoom, wy = this.cam.y + (e.clientY - r.top) / this.zoom
    let best: Mon | null = null, bd = 22
    for (const m of this.mons) {
      const lift = m.mode === 'fly' ? 16 : m.mode === 'float' ? 8 : 0
      const d = Math.hypot(m.x - wx, m.y - lift - 10 - wy)
      if (d < bd) { bd = d; best = m }
    }
    this.picked = best?.id ?? null
    if (best) { this.panTo(best.x, best.y); best.emote = BUBBLES[best.state === 'sleep' ? 'zz' : 'joy']; best.emoteUntil = performance.now() + 1600; if (best.state !== 'sleep') { best.state = 'idle'; best.until = performance.now() + 2500; best.path = [] } }
    this.cb.pick(this.picked)
  }

  // ——— Vie ———
  private update(t: number, dt: number) {
    for (const m of this.mons) {
      if (m.state === 'idle' && t > m.until) {
        const r = Math.random()
        if (this.time === 'night' && m.mode !== 'fly' && r < 0.5) { m.state = 'sleep'; m.t0 = t; m.until = t + rand(20000, 50000) }
        else if (r < 0.1 && m.anims.h) { m.state = 'hop'; m.t0 = t; m.until = t + m.anims.h.total }
        else if (r < 0.16 && this.time === 'day' && m.mode === 'land') { m.state = 'sleep'; m.t0 = t; m.until = t + rand(6000, 14000) }
        else { m.path = this.route(m); if (m.path.length) { m.state = 'walk'; m.t0 = t } else m.until = t + rand(1000, 3000) }
      } else if (m.state === 'walk') {
        const p = m.path[0]
        if (!p) { this.rest(m, t); continue }
        const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy), step = m.speed * dt
        if (d > 0.5) m.dir = dirOf(dx, dy)
        if (d <= step) { m.x = p.x; m.y = p.y; m.path.shift(); if (!m.path.length) this.rest(m, t) }
        else { m.x += (dx / d) * step; m.y += (dy / d) * step }
      } else if ((m.state === 'sleep' || m.state === 'hop') && t > m.until) { m.state = 'idle'; m.t0 = t; m.until = t + rand(800, 2500) }
      if (m.state !== 'sleep' && t > m.nextEmote) {
        m.emote = BUBBLES[['note', 'joy', 'what', 'dots', 'bang', 'love'][Math.floor(Math.random() * 6)]]
        m.emoteUntil = t + 1800; m.nextEmote = t + rand(14000, 32000)
      }
    }
    for (const p of this.particles) {
      p.p += dt
      if (p.kind === 'snow') { p.y += 12 * dt; p.x += Math.sin(p.p * 1.3) * 6 * dt }
      else if (p.kind === 'ember') { p.y -= 14 * dt; p.x += Math.sin(p.p * 2) * 8 * dt }
      else if (p.kind === 'fly') { p.x += Math.sin(p.p * 0.9) * 10 * dt; p.y += Math.cos(p.p * 1.1) * 8 * dt }
      else { p.x += 5 * dt }
      const reg = { snow: 0, ember: 2, fly: -1, fog: 6 }[p.kind]
      if (reg >= 0) {
        const ox = (reg % 3) * RW * TS, oy = Math.floor(reg / 3) * RH * TS
        if (p.y > oy + RH * TS) p.y = oy; if (p.y < oy) p.y = oy + RH * TS
        if (p.x > ox + RW * TS) p.x = ox
      }
    }
  }
  // À l'arrêt : si un voisin est tout près, ils se regardent et échangent une émotion.
  private rest(m: Mon, t: number) {
    m.state = 'idle'; m.t0 = t; m.until = t + rand(1500, 5000)
    const o = this.mons.find((n) => n !== m && n.state !== 'sleep' && Math.hypot(n.x - m.x, n.y - m.y) < 30)
    if (o && Math.random() < 0.7) {
      m.dir = dirOf(o.x - m.x, o.y - m.y); o.dir = dirOf(m.x - o.x, m.y - o.y)
      if (o.state === 'walk') { o.state = 'idle'; o.path = []; o.t0 = t; o.until = t + 2500 }
      const k = ['love', 'note', 'joy'][Math.floor(Math.random() * 3)]
      m.emote = BUBBLES[k]; m.emoteUntil = t + 1800; o.emote = BUBBLES[k]; o.emoteUntil = t + 2100
    }
  }

  // ——— Dessin ———
  private draw(t: number) {
    const { ctx, world: w } = this, k = this.dpr * this.zoom
    const tx = Math.round(-this.cam.x * k), ty = Math.round(-this.cam.y * k)
    const cx = -tx / k, cy = -ty / k, vw = this.vw, vh = this.vh
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#2C5E2A'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(k, 0, 0, k, tx, ty)
    const sx = Math.max(0, Math.floor(cx)), sy = Math.max(0, Math.floor(cy)), sw = Math.min(MW * TS - sx, Math.ceil(vw) + 2), sh = Math.min(MH * TS - sy, Math.ceil(vh) + 2)
    ctx.drawImage(w.terrain, sx, sy, sw, sh, sx, sy, sw, sh)
    const inView = (x: number, y: number, m = 40) => x > cx - m && x < cx + vw + m && y > cy - m && y < cy + vh + m * 2

    // Reflets sur l'eau et bulles de lave.
    for (const p of w.water) if (inView(p.x, p.y, 4) && ((t / 900 + hash(p.x, p.y, 1) * 10) % 1) < 0.3) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(p.x, p.y, 3, 1) }
    for (const p of w.lava) if (inView(p.x, p.y, 4)) { const ph = (t / 1400 + hash(p.x, p.y, 2) * 10) % 1; if (ph < 0.4) { ctx.fillStyle = ph < 0.2 ? '#FFE07A' : '#FFB13B'; ctx.fillRect(p.x, p.y - Math.floor(ph * 6), 2, 2) } }

    // Objets et Pokémon triés du fond vers l'avant.
    const items: { y: number; f: () => void }[] = []
    for (const o of w.objects) if (inView(o.x, o.y, 60)) items.push({ y: o.y, f: () => ctx.drawImage(o.s.img, Math.round(o.x - o.s.ax), Math.round(o.y - o.s.ay)) })
    for (const m of this.mons) if (inView(m.x, m.y, 50)) items.push({ y: m.y, f: () => this.drawMon(m, t) })
    items.sort((a, b) => a.y - b.y)
    for (const it of items) it.f()

    // Ambiance : neige, braises, brume, lucioles.
    for (const p of this.particles) {
      if (!inView(p.x, p.y, 10)) continue
      if (p.kind === 'snow') { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1) }
      else if (p.kind === 'ember') { ctx.fillStyle = (p.p % 1) < 0.5 ? '#FFB13B' : '#F2621F'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1) }
      else if (p.kind === 'fog') { ctx.fillStyle = 'rgba(220,230,220,.07)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 60, 18, 0, 0, Math.PI * 2); ctx.fill() }
    }
    // Lumière : teinte du soir ou de la nuit, puis lueurs.
    if (this.time !== 'day') {
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillStyle = this.time === 'night' ? '#4E57A0' : '#F2B79A'
      ctx.fillRect(cx - 2, cy - 2, vw + 4, vh + 4)
      ctx.globalCompositeOperation = 'lighter'
      for (const l of w.lights) if (inView(l.x, l.y, l.r)) {
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); g.addColorStop(0, `rgba(${l.c},.35)`); g.addColorStop(1, `rgba(${l.c},0)`)
        ctx.fillStyle = g; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2)
      }
      for (const p of this.particles) if (p.kind === 'fly' && inView(p.x, p.y, 10)) {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(p.p * 2))
        ctx.fillStyle = `rgba(255,240,120,${a * 0.25})`; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3)
        ctx.fillStyle = `rgba(255,250,170,${a})`; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1)
      }
      ctx.globalCompositeOperation = 'source-over'
    }
    // Bulles d'émotion par-dessus tout.
    for (const m of this.mons) {
      if (!inView(m.x, m.y, 50)) continue
      const b = m.state === 'sleep' ? (Math.floor(t / 900) % 2 ? BUBBLES.zz : null) : t < m.emoteUntil ? m.emote : null
      if (b) ctx.drawImage(b.img, Math.round(m.x + 2), Math.round(this.headY(m, t) - b.img.height + 2))
    }
  }
  private lift(m: Mon, t: number) { return m.mode === 'fly' ? 16 + Math.sin(t / 420 + m.phase) * 3 : m.mode === 'float' ? 7 + Math.sin(t / 600 + m.phase) * 2 : 0 }
  private headY(m: Mon, t: number) {
    const a = m.anims.w
    return m.y - this.lift(m, t) - (a ? Math.min(a.fh / 2 + 5, 34) : 30)
  }
  private drawMon(m: Mon, t: number) {
    const ctx = this.ctx, lift = this.lift(m, t)
    const x = Math.round(m.x), y = Math.round(m.y)
    // ombre au sol
    if (m.mode !== 'swim') {
      ctx.fillStyle = `rgba(20,30,40,${m.mode === 'land' ? 0.28 : 0.16})`
      ctx.beginPath(); ctx.ellipse(x, y, m.mode === 'land' ? 7 : 5, m.mode === 'land' ? 2.5 : 2, 0, 0, Math.PI * 2); ctx.fill()
    }
    if (this.picked === m.id) {
      ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(t / 200)})`; ctx.lineWidth = 1
      ctx.beginPath(); ctx.ellipse(x, y, 11, 4, 0, 0, Math.PI * 2); ctx.stroke()
    }
    const key = m.state === 'walk' ? 'w' : m.state === 'sleep' ? (m.anims.s ? 's' : 'i') : m.state === 'hop' ? 'h' : (m.mode === 'fly' ? 'w' : 'i')
    const a = m.anims[key] ?? m.anims.w ?? m.anims.i
    if (m.mode === 'swim') { ctx.save(); ctx.beginPath(); ctx.rect(x - 60, y - 120, 120, 117); ctx.clip() }
    if (a) {
      const f = frameAt(a, t - m.t0, m.state === 'hop'), row = a.rows === 1 ? 0 : m.dir
      ctx.drawImage(a.img, f * a.fw, row * a.fh, a.fw, a.fh, x - a.fw / 2, Math.round(y - lift - a.fh / 2 - 5), a.fw, a.fh)
    } else if (this.sheet.complete && this.sheet.width) {
      // Pas d'animation pour ce Pokémon : sprite fixe qui sautille en marchant.
      const cell = this.sheet.width / 32, i = m.id - 1, s = 34
      const bob = m.state === 'walk' ? -Math.abs(Math.sin((t - m.t0) / 110)) * 3 : 0
      ctx.drawImage(this.sheet, (i % 32) * cell, Math.floor(i / 32) * cell, cell, cell, x - s / 2, Math.round(y - lift - s + 4 + bob), s, s)
    }
    if (m.mode === 'swim') {
      ctx.restore()
      const r = 8 + ((t / 90 + m.phase * 10) % 8)
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - (r - 8) / 8)})`; ctx.lineWidth = 1
      ctx.beginPath(); ctx.ellipse(x, y - 3, r, r * 0.32, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 8, y - 3, 16, 1)
    }
  }

  // ——— Boucle ———
  start() {
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - (this.last || t)) / 1000); this.last = t
      if (this.pan) {
        const p = Math.min(1, (t - this.pan.t0) / 700), e = 1 - (1 - p) ** 3
        this.cam = { x: this.pan.from.x + (this.pan.to.x - this.pan.from.x) * e, y: this.pan.from.y + (this.pan.to.y - this.pan.from.y) * e }
        if (p >= 1) this.pan = null
      } else if (!this.drag && (Math.abs(this.vel.x) > 2 || Math.abs(this.vel.y) > 2)) {
        this.cam = this.clamp({ x: this.cam.x + this.vel.x * dt, y: this.cam.y + this.vel.y * dt })
        const f = Math.pow(0.04, dt); this.vel.x *= f; this.vel.y *= f
      }
      this.update(t, dt)
      this.draw(t)
      const ctr = Math.floor((this.cam.y + this.vh / 2) / TS) * MW + Math.floor((this.cam.x + this.vw / 2) / TS)
      const reg = this.world.region[ctr] ?? 4
      if (reg !== this.regionNow) { this.regionNow = reg; this.cb.region(reg) }
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }
  stop() { cancelAnimationFrame(this.raf) }
  countIn(r: number) { return this.mons.filter((m) => m.region === r).length }
}
