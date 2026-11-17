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

// Trouve le contour de carte le plus grand et renvoie ses 4 coins (dans l'image donnée), ou null.
export function findCard(cv: CV, src: CV): Quad | null {
  const gray = new cv.Mat(), edges = new cv.Mat(), contours = new cv.MatVector(), hier = new cv.Mat()
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0)
    cv.Canny(gray, edges, 40, 120)
    cv.dilate(edges, edges, kernel)
    cv.findContours(edges, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    let best = -1, bestArea = 0
    for (let i = 0; i < contours.size(); i++) {
      const a = cv.contourArea(contours.get(i))
      if (a > bestArea) { bestArea = a; best = i }
    }
    if (best < 0 || bestArea < 0.1 * src.cols * src.rows) return null
    const c = contours.get(best), approx = new cv.Mat()
    cv.approxPolyDP(c, approx, 0.02 * cv.arcLength(c, true), true)
    let pts: Quad
    if (approx.rows === 4) {
      pts = []
      for (let i = 0; i < 4; i++) pts.push([approx.data32S[i * 2], approx.data32S[i * 2 + 1]])
    } else {
      const r = cv.minAreaRect(c)
      pts = cv.RotatedRect.points(r).map((p: { x: number; y: number }) => [p.x, p.y])
    }
    approx.delete()
    let q = order(pts)
    if (dist(q[0], q[1]) > dist(q[1], q[2])) q = [q[1], q[2], q[3], q[0]] // carte couchée
    const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, h = (dist(q[1], q[2]) + dist(q[0], q[3])) / 2
    const ratio = w / h
    if (ratio < CARD_RATIO * 0.8 || ratio > CARD_RATIO * 1.2) return null
    return q
  } finally {
    gray.delete(); edges.delete(); contours.delete(); hier.delete(); kernel.delete()
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
export function dhash(img: ImageData, flip = false): Uint8Array {
  const { width: W, height: H, data } = img
  const x0 = Math.floor(ART[0] * W), y0 = Math.floor(ART[1] * H), x1 = Math.floor(ART[2] * W), y1 = Math.floor(ART[3] * H)
  const cw = x1 - x0, ch = y1 - y0, OW = N + 1, OH = N
  const g = new Float32Array(cw * ch)
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    let sx = x0 + x, sy = y0 + y
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

export const ACCEPT = 55   // au-delà : pas de carte reconnue (mesuré : bonne carte ≈ 18, carte absente ≥ 78)
export const SAME_ART = 12 // écart sous lequel deux cartes sont des rééditions de la même illustration
