// Bruit déterministe : le monde est identique à chaque visite.
export function hash(ix: number, iy: number, seed = 0) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const smooth = (t: number) => t * t * (3 - 2 * t)
export function noise(x: number, y: number, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy)
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}
export const fbm = (x: number, y: number, seed = 0) => (noise(x, y, seed) * 4 + noise(x * 2, y * 2, seed + 7) * 2 + noise(x * 4, y * 4, seed + 13)) / 7
export function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}
// Trame ordonnée 4×4 : transitions de teintes en pixel art plutôt qu'en dégradé.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47
