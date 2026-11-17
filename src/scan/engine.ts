// Moteur du scan en direct : trouver la carte dans l'image (OpenCV), la redresser, calculer son empreinte
// et la comparer aux 17 000 empreintes du catalogue. Mêmes réglages que scripts/build-hashes.py.
import { DB } from '../data'

/* eslint-disable @typescript-eslint/no-explicit-any */
type CV = any
declare global { interface Window { cv: CV } }

const OPENCV = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js'
let cvPromise: Promise<{ cv: CV }> | null = null

// OpenCV.js (Emscripten) est un objet « thenable » : on le renvoie dans une boîte, sinon un await boucle sans fin.
export function loadCV(): Promise<{ cv: CV }> {
  cvPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = OPENCV
    s.async = true
    s.onload = async () => {
      let cv = window.cv
      if (cv instanceof Promise) cv = await cv
      if (!cv?.Mat) await new Promise<void>((r) => {
        const prev = cv.onRuntimeInitialized
        cv.onRuntimeInitialized = () => { prev?.(); r() }
      })
      resolve({ cv })
    }
    s.onerror = () => { cvPromise = null; reject(new Error('opencv')) }
    document.head.append(s)
  })
  return cvPromise
}

export const CW = 245, CH = 342
const ART = [0.08, 0.10, 0.92, 0.50] // zone de l'illustration, en fraction de la carte
const N = 16
const CARD_RATIO = 63 / 88

export type Quad = [number, number][]

function order(pts: Quad): Quad {
  const s = pts.map(([x, y]) => x + y), d = pts.map(([x, y]) => y - x)
  const tl = pts[s.indexOf(Math.min(...s))], br = pts[s.indexOf(Math.max(...s))]
  const tr = pts[d.indexOf(Math.min(...d))], bl = pts[d.indexOf(Math.max(...d))]
  return [tl, tr, br, bl]
}
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

// Cherche les contours qui ressemblent à une carte (4 coins, proportions 63×88) ; les plus grands d'abord.
// On garde plusieurs candidats : sur une table texturée, le plus grand contour n'est pas toujours la carte.
export function findCards(cv: CV, src: CV, max = 3, soft = false): Quad[] {
  const gray = new cv.Mat(), edges = new cv.Mat(), contours = new cv.MatVector(), hier = new cv.Mat()
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
  const frame = src.cols * src.rows, found: { q: Quad; area: number }[] = []
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0)
    cv.Canny(gray, edges, soft ? 12 : 30, soft ? 45 : 100) // second passage plus sensible : carte peu contrastée avec la table
    cv.dilate(edges, edges, kernel)
    cv.findContours(edges, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i), area = cv.contourArea(c)
      if (area < 0.05 * frame || area > 0.95 * frame) continue
      const approx = new cv.Mat()
      cv.approxPolyDP(c, approx, 0.03 * cv.arcLength(c, true), true)
      let pts: Quad | null = null
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        pts = []
        for (let k = 0; k < 4; k++) pts.push([approx.data32S[k * 2], approx.data32S[k * 2 + 1]])
      } else {
        const r = cv.minAreaRect(c)
        if (area / (r.size.width * r.size.height) > 0.85) pts = cv.RotatedRect.points(r).map((p: { x: number; y: number }) => [p.x, p.y])
      }
      approx.delete()
      if (!pts) continue
      let q = order(pts)
      if (dist(q[0], q[1]) > dist(q[1], q[2])) q = [q[1], q[2], q[3], q[0]] // carte couchée
      const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, h = (dist(q[1], q[2]) + dist(q[0], q[3])) / 2
      if (w / h < CARD_RATIO * 0.82 || w / h > CARD_RATIO * 1.18) continue
      const tol = 0.03 * src.cols
      if (found.some((f) => f.q.every((p, k) => dist(p, q[k]) < tol))) continue // doublon (bord intérieur/extérieur du trait)
      found.push({ q, area: w * h })
    }
    return found.sort((a, b) => b.area - a.area).slice(0, max).map((f) => f.q)
  } finally {
    gray.delete(); edges.delete(); contours.delete(); hier.delete(); kernel.delete()
  }
}


// Bords de la carte comme des droites, côté par côté, autour du cadre guide (méthode des scanners de documents).
// Les doigts qui cachent un bord ne gênent pas : 3 côtés suffisent, le 4ᵉ est déduit du format 63 × 88.
type Line = { a: [number, number]; d: [number, number]; len: number }
const cross = (l1: Line, l2: Line): [number, number] | null => {
  const det = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0]
  if (Math.abs(det) < 1e-6) return null
  const t = ((l2.a[0] - l1.a[0]) * l2.d[1] - (l2.a[1] - l1.a[1]) * l2.d[0]) / det
  return [l1.a[0] + t * l1.d[0], l1.a[1] + t * l1.d[1]]
}
const shift = (l: Line, nx: number, ny: number, dist: number): Line => ({ a: [l.a[0] + nx * dist, l.a[1] + ny * dist], d: l.d, len: l.len })

export function findByLines(cv: CV, src: CV, guide: Quad): Quad | null {
  const gx0 = Math.min(guide[0][0], guide[3][0]), gx1 = Math.max(guide[1][0], guide[2][0])
  const gy0 = Math.min(guide[0][1], guide[1][1]), gy1 = Math.max(guide[2][1], guide[3][1])
  const gw = gx1 - gx0, gh = gy1 - gy0
  const mx = gw * 0.28, my = gh * 0.22
  const rx = Math.max(0, Math.round(gx0 - mx)), ry = Math.max(0, Math.round(gy0 - my))
  const rw = Math.min(src.cols - rx, Math.round(gw + 2 * mx)), rh = Math.min(src.rows - ry, Math.round(gh + 2 * my))
  if (rw < 40 || rh < 40) return null
  const roi = src.roi(new cv.Rect(rx, ry, rw, rh))
  const gray = new cv.Mat(), edges = new cv.Mat(), lines = new cv.Mat()
  try {
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0)
    cv.Canny(gray, edges, 35, 110)
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 35, Math.min(gw, gh) * 0.22, 14)
    const best: Record<'top' | 'bottom' | 'left' | 'right', { l: Line; score: number } | null> = { top: null, bottom: null, left: null, right: null }
    for (let i = 0; i < lines.rows; i++) {
      const x1 = lines.data32S[i * 4] + rx, y1 = lines.data32S[i * 4 + 1] + ry, x2 = lines.data32S[i * 4 + 2] + rx, y2 = lines.data32S[i * 4 + 3] + ry
      const len = Math.hypot(x2 - x1, y2 - y1)
      const ang = Math.abs(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI) % 180
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
      const l: Line = { a: [x1, y1], d: [(x2 - x1) / len, (y2 - y1) / len], len }
      const horiz = ang < 22 || ang > 158, vert = Math.abs(ang - 90) < 22
      const pick = (side: keyof typeof best, off: number, span: number) => {
        if (Math.abs(off) > span) return
        const score = len * (1 - Math.abs(off) / span)
        if (!best[side] || score > best[side]!.score) best[side] = { l, score }
      }
      if (horiz && cx > gx0 - mx * 0.3 && cx < gx1 + mx * 0.3) { pick('top', cy - gy0, my * 1.6); pick('bottom', cy - gy1, my * 1.6) }
      if (vert && cy > gy0 - my * 0.3 && cy < gy1 + my * 0.3) { pick('left', cx - gx0, mx * 1.2); pick('right', cx - gx1, mx * 1.2) }
    }
    let { top, bottom, left, right } = { top: best.top?.l, bottom: best.bottom?.l, left: best.left?.l, right: best.right?.l }
    const found = [top, bottom, left, right].filter(Boolean).length
    if (found < 3) return null
    // Côté manquant : parallèle au côté opposé, à la distance que donne le format de la carte.
    if (top && bottom && left && !right) { const h = Math.abs(cross(left, bottom)![1] - cross(left, top)![1]); right = shift(left, 1, 0, h * CARD_RATIO) }
    if (top && bottom && right && !left) { const h = Math.abs(cross(right, bottom)![1] - cross(right, top)![1]); left = shift(right, -1, 0, h * CARD_RATIO) }
    if (left && right && top && !bottom) { const w = Math.abs(cross(top, right)![0] - cross(top, left)![0]); bottom = shift(top, 0, 1, w / CARD_RATIO) }
    if (left && right && bottom && !top) { const w = Math.abs(cross(bottom, right)![0] - cross(bottom, left)![0]); top = shift(bottom, 0, -1, w / CARD_RATIO) }
    const q = [cross(top!, left!), cross(top!, right!), cross(bottom!, right!), cross(bottom!, left!)]
    if (q.some((p) => !p)) return null
    const quad = q as Quad
    const w = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2, h = (dist(quad[1], quad[2]) + dist(quad[0], quad[3])) / 2
    if (w / h < CARD_RATIO * 0.82 || w / h > CARD_RATIO * 1.18 || w < gw * 0.5 || w > gw * 1.5) return null
    return quad
  } finally {
    roi.delete(); gray.delete(); edges.delete(); lines.delete()
  }
}

// Redresse la carte en CW×CH et renvoie ses pixels RGBA.
export function warp(cv: CV, src: CV, q: Quad): ImageData {
  const from = cv.matFromArray(4, 1, cv.CV_32FC2, q.flat())
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, CW, 0, CW, CH, 0, CH])
  const M = cv.getPerspectiveTransform(from, to), dst = new cv.Mat()
  cv.warpPerspective(src, dst, M, new cv.Size(CW, CH), cv.INTER_LINEAR)
  const img = new ImageData(new Uint8ClampedArray(dst.data), CW, CH)
  from.delete(); to.delete(); M.delete(); dst.delete()
  return img
}

// dHash 256 bits de la zone d'illustration (gris PIL, réduction par moyenne de surface).
export function dhash(img: ImageData, flip = false, inset = 0): Uint8Array {
  const { width: W, height: H, data } = img
  // inset : on considère que la vraie carte commence un peu à l'intérieur (ou à l'extérieur si négatif) du contour trouvé.
  const ix = inset * W, iy = inset * H, IW = W - 2 * ix, IH = H - 2 * iy
  const x0 = Math.floor(ix + ART[0] * IW), y0 = Math.floor(iy + ART[1] * IH), x1 = Math.floor(ix + ART[2] * IW), y1 = Math.floor(iy + ART[3] * IH)
  const cw = x1 - x0, ch = y1 - y0, OW = N + 1, OH = N
  const g = new Float32Array(cw * ch)
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    let sx = Math.min(W - 1, Math.max(0, x0 + x)), sy = Math.min(H - 1, Math.max(0, y0 + y))
    if (flip) { sx = W - 1 - sx; sy = H - 1 - sy }
    const k = (sy * W + sx) * 4
    g[y * cw + x] = (data[k] * 299 + data[k + 1] * 587 + data[k + 2] * 114) / 1000
  }
  const out = new Float32Array(OW * OH), fx = cw / OW, fy = ch / OH
  for (let oy = 0; oy < OH; oy++) for (let ox = 0; ox < OW; ox++) {
    const ax = ox * fx, bx = ax + fx, ay = oy * fy, by = ay + fy
    let sum = 0, area = 0
    for (let y = Math.floor(ay); y < Math.ceil(by); y++) {
      const wy = Math.min(by, y + 1) - Math.max(ay, y)
      for (let x = Math.floor(ax); x < Math.ceil(bx); x++) {
        const w = (Math.min(bx, x + 1) - Math.max(ax, x)) * wy
        sum += g[y * cw + x] * w; area += w
      }
    }
    out[oy * OW + ox] = sum / area
  }
  const bits = new Uint8Array(32)
  for (let r = 0, b = 0; r < OH; r++) for (let c = 0; c < N; c++, b++)
    if (out[r * OW + c + 1] > out[r * OW + c]) bits[b >> 3] |= 0x80 >> (b & 7)
  return bits
}

const POP = new Uint8Array(256).map((_, i) => { let n = 0, v = i; while (v) { n += v & 1; v >>= 1 } return n })

export type Hit = { i: number; d: number }

// Les k cartes les plus proches.
export function nearest(h: Uint8Array, k = 6): Hit[] {
  const H = DB.hashes, cards = DB.cards, top: Hit[] = []
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].hasImg) continue
    let d = 0
    const o = i * 32
    for (let j = 0; j < 32; j++) d += POP[H[o + j] ^ h[j]]
    if (top.length < k || d < top[k - 1].d) {
      top.push({ i, d }); top.sort((a, b) => a.d - b.d)
      if (top.length > k) top.pop()
    }
  }
  return top
}

export const SAME_ART = 12 // écart sous lequel deux cartes sont des rééditions de la même illustration

// Mesuré en simulation : bonne carte ≈ 18, carte absente ≥ 78. Une vraie caméra éloigne la bonne carte :
// on accepte donc aussi une distance plus grande si la carte suivante (autre illustration) est nettement plus loin.
export const confident = (d1: number, d2: number) => (d1 <= 58 && d2 - d1 >= 16) || (d1 <= 84 && d2 - d1 >= 22)

// Contours de cartes : passage normal, puis sensible ; on ajoute toujours la zone du cadre guide en dernier recours.
export function candidates(cv: CV, src: CV, guide?: Quad | null): { quads: Quad[]; found: number } {
  let quads = findCards(cv, src)
  if (!quads.length) quads = findCards(cv, src, 2, true)
  if (guide) {
    const byLines = findByLines(cv, src, guide)
    if (byLines) quads = [byLines, ...quads]
  }
  const found = quads.length
  if (guide) quads = [...quads, guide]
  return { quads, found }
}

export type Match = { quad: Quad; img: ImageData; hits: Hit[]; d1: number; d2: number }

// Essaie chaque contour candidat, dans les deux sens et avec trois marges ; garde la meilleure correspondance.
export function identify(cv: CV, src: CV, quads: Quad[]): Match | null {
  let best: Match | null = null
  for (const [n, quad] of quads.entries()) {
    const img = warp(cv, src, quad)
    for (const inset of n < 2 ? [0, 0.035, -0.02] : [0]) for (const flip of [false, true]) {
      const hits = nearest(dhash(img, flip, inset), 10)
      if (!best || hits[0].d < best.d1) {
        const d1 = hits[0].d, other = hits.find((h) => h.d > d1 + SAME_ART)
        best = { quad, img, hits, d1, d2: other?.d ?? hits[hits.length - 1].d }
      }
    }
  }
  return best
}
