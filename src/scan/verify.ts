// Second étage du scan, pour une carte tenue en main (doigts sur les bords, fond chargé) :
// 1. présélection des cartes dont les couleurs (grille 6×6 Lab, centrée) ressemblent à ce qui est dans le cadre ;
// 2. vérification par points-clés (ORB) entre l'image et chaque candidate : robuste aux doigts et au fond,
//    et donne la position exacte de la carte, que l'empreinte fine confirme ensuite.
import { DB, cardImg } from '../data'
import { CW, CH, type Quad } from './engine'

/* eslint-disable @typescript-eslint/no-explicit-any */
type CV = any
const N = 6, CELLS = N * N, SIG = CELLS * 3

// Empreinte couleur d'une carte redressée (mêmes réglages que scripts/build-colors.py).
export function colorSig(cv: CV, img: ImageData): Float32Array {
  const m = cv.matFromImageData(img), rgb = new cv.Mat(), lab = new cv.Mat(), small = new cv.Mat()
  try {
    cv.cvtColor(m, rgb, cv.COLOR_RGBA2RGB)
    const crop = rgb.roi(new cv.Rect(9, 13, 227, 316))
    cv.cvtColor(crop, lab, cv.COLOR_RGB2Lab)
    crop.delete()
    cv.resize(lab, small, new cv.Size(N, N), 0, 0, cv.INTER_AREA)
    return Float32Array.from(small.data)
  } finally { m.delete(); rgb.delete(); lab.delete(); small.delete() }
}

// Les k cartes aux couleurs les plus proches (moyenne retirée par canal : insensible à la balance des blancs).
export function shortlist(sig: Float32Array, k = 16): number[] {
  const C = DB.colors
  if (!C.length) return []
  const mq = [0, 0, 0]
  for (let c = 0; c < CELLS; c++) for (let j = 0; j < 3; j++) mq[j] += sig[c * 3 + j] / CELLS
  const W = [0.5, 1, 1]
  const top: { i: number; d: number }[] = []
  const cards = DB.cards
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].hasImg) continue
    const o = i * SIG
    const m = [0, 0, 0]
    for (let c = 0; c < CELLS; c++) for (let j = 0; j < 3; j++) m[j] += C[o + c * 3 + j]
    m[0] /= CELLS; m[1] /= CELLS; m[2] /= CELLS
    let d = 0
    for (let c = 0; c < CELLS; c++) for (let j = 0; j < 3; j++) {
      const x = (C[o + c * 3 + j] - m[j] - (sig[c * 3 + j] - mq[j])) * W[j]
      d += x * x
    }
    if (top.length < k || d < top[k - 1].d) {
      top.push({ i, d }); top.sort((a, b) => a.d - b.d)
      if (top.length > k) top.pop()
    }
  }
  return top.map((t) => t.i)
}

/* ---------- Points-clés des cartes candidates (téléchargées à la demande, gardées en mémoire) ---------- */
type Feat = { pts: Float32Array; des: CV; w: number; h: number }
const feats = new Map<number, Feat | 'loading' | 'none'>()
const order: number[] = []
let orb: CV = null, matcher: CV = null

function tools(cv: CV) {
  orb ??= new cv.ORB(600)
  matcher ??= new cv.BFMatcher(cv.NORM_HAMMING, false)
}

function detect(cv: CV, gray: CV): { pts: Float32Array; des: CV } {
  const kps = new cv.KeyPointVector(), des = new cv.Mat(), none = new cv.Mat()
  orb.detectAndCompute(gray, none, kps, des)
  const pts = new Float32Array(kps.size() * 2)
  for (let i = 0; i < kps.size(); i++) { const p = kps.get(i).pt; pts[i * 2] = p.x; pts[i * 2 + 1] = p.y }
  kps.delete(); none.delete()
  return { pts, des }
}

export function ensureFeatures(cv: CV, ids: number[]) {
  tools(cv)
  let running = [...feats.values()].filter((v) => v === 'loading').length
  for (const i of ids) {
    if (feats.has(i) || running >= 6) continue
    const url = cardImg(DB.cards[i], 'low')
    if (!url) { feats.set(i, 'none'); continue }
    feats.set(i, 'loading'); running++
    fetch(url).then((r) => r.blob()).then((b) => createImageBitmap(b)).then((bmp) => {
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height
      c.getContext('2d')!.drawImage(bmp, 0, 0)
      const m = cv.imread(c), g = new cv.Mat()
      cv.cvtColor(m, g, cv.COLOR_RGBA2GRAY); m.delete()
      const f = detect(cv, g); g.delete()
      feats.set(i, { ...f, w: bmp.width, h: bmp.height })
      order.push(i)
      while (order.length > 120) { const old = feats.get(order[0]); if (old && typeof old === 'object') old.des.delete(); feats.delete(order.shift()!) }
    }).catch(() => feats.set(i, 'none'))
  }
}

export type Verified = { i: number; inliers: number; quad: Quad }

// Cherche, parmi les candidates déjà prêtes, celle dont les points-clés se retrouvent dans l'image (homographie RANSAC).
export function verify(cv: CV, src: CV, roi: { x: number; y: number; w: number; h: number }, ids: number[]): Verified[] {
  tools(cv)
  const ready = ids.map((i) => [i, feats.get(i)] as const).filter((x): x is readonly [number, Feat] => !!x[1] && typeof x[1] === 'object')
  if (!ready.length) return []
  const r = src.roi(new cv.Rect(roi.x, roi.y, roi.w, roi.h)), g = new cv.Mat()
  cv.cvtColor(r, g, cv.COLOR_RGBA2GRAY); r.delete()
  const frame = detect(cv, g); g.delete()
  const out: Verified[] = []
  try {
    if (frame.pts.length < 20) return []
    for (const [i, f] of ready) {
      if (f.pts.length < 20) continue
      const knn = new cv.DMatchVectorVector()
      matcher.knnMatch(f.des, frame.des, knn, 2)
      const a: number[] = [], b: number[] = []
      for (let k = 0; k < knn.size(); k++) {
        const m = knn.get(k)
        if (m.size() < 2) continue
        const m0 = m.get(0), m1 = m.get(1)
        if (m0.distance < 0.78 * m1.distance) {
          a.push(f.pts[m0.queryIdx * 2], f.pts[m0.queryIdx * 2 + 1])
          b.push(frame.pts[m0.trainIdx * 2] + roi.x, frame.pts[m0.trainIdx * 2 + 1] + roi.y)
        }
      }
      knn.delete()
      if (a.length / 2 < 10) continue
      const A = cv.matFromArray(a.length / 2, 1, cv.CV_32FC2, a), B = cv.matFromArray(b.length / 2, 1, cv.CV_32FC2, b), mask = new cv.Mat()
      const H = cv.findHomography(A, B, cv.RANSAC, 6, mask)
      let inl = 0
      for (let k = 0; k < mask.rows; k++) inl += mask.data[k]
      if (!H.empty() && inl >= 10) {
        const corners = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, f.w, 0, f.w, f.h, 0, f.h]), dst = new cv.Mat()
        cv.perspectiveTransform(corners, dst, H)
        const q: Quad = [0, 1, 2, 3].map((k) => [dst.data32F[k * 2], dst.data32F[k * 2 + 1]] as [number, number])
        corners.delete(); dst.delete()
        out.push({ i, inliers: inl, quad: q })
      }
      A.delete(); B.delete(); mask.delete(); H.delete()
    }
  } finally { frame.des.delete() }
  return out.sort((x, y) => y.inliers - x.inliers)
}

export const WARP = { w: CW, h: CH }
