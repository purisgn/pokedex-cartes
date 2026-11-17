// Sprites animés « Donjon Mystère » (PMD Sprite Collab, CC BY-NC 4.0) : planches de 8 directions,
// durées d'images fournies par l'index public/pmd.json construit par scripts/build-pmd.py.
export type AnimKey = 'w' | 'i' | 's' | 'h'
export type Anim = { img: HTMLImageElement; fw: number; fh: number; dur: number[]; total: number; rows: number }
type Entry = Partial<Record<AnimKey, [string, number, number, number[]]>>

const BASE = 'https://cdn.jsdelivr.net/gh/PMDCollab/SpriteCollab@master/sprite/'
let index: Promise<Record<string, Entry>> | null = null
export const pmdIndex = () => (index ??= fetch(import.meta.env.BASE_URL + 'pmd.json').then((r) => r.json() as Promise<Record<string, Entry>>).catch(() => ({} as Record<string, Entry>)))

const cache = new Map<string, Promise<Anim | null>>()
export function loadAnim(id: number, key: AnimKey): Promise<Anim | null> {
  const k = id + key
  if (!cache.has(k)) cache.set(k, pmdIndex().then((ix) => {
    const e = ix[id]?.[key]
    if (!e) return null
    const [name, fw, fh, frames] = e as [string, number, number, number[]]
    return new Promise<Anim | null>((res) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => res({ img, fw, fh, dur: frames.map((d) => (d * 1000) / 60), total: frames.reduce((a, b) => a + b, 0) * 1000 / 60, rows: Math.round(img.height / fh) })
      img.onerror = () => { cache.delete(k); res(null) }
      img.src = `${BASE}${String(id).padStart(4, '0')}/${name}-Anim.png`
    })
  }))
  return cache.get(k)!
}
// Image de l'animation à l'instant t (ms) ; once = s'arrête sur la dernière image.
export function frameAt(a: Anim, t: number, once = false) {
  if (once && t >= a.total) return a.dur.length - 1
  let x = t % a.total
  for (let i = 0; i < a.dur.length; i++) { if (x < a.dur[i]) return i; x -= a.dur[i] }
  return 0
}
// Direction (0 bas, 1 bas-droite, 2 droite, 3 haut-droite, 4 haut, 5 haut-gauche, 6 gauche, 7 bas-gauche).
export function dirOf(dx: number, dy: number) {
  const a = Math.atan2(dy, dx)                     // 0 = droite, π/2 = bas
  const oct = Math.round(a / (Math.PI / 4))        // -4..4
  return [2, 1, 0, 7, 6, 5, 4, 3][(oct + 8) % 8]
}
