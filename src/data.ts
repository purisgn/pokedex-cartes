// Catalogue embarqué (cartes FR de TCGdex) et empreintes de scan, chargés une fois au démarrage.
import type { TypeKey } from './types'

export type Species = { id: number; name: string; types: TypeKey[]; gen: number }
export type Serie = { id: string; name: string; date?: string; sets: CardSet[] }
export type CardSet = {
  id: string; name: string; date?: string; abbr?: string; official: number; total: number
  logo?: string; img?: string; serie: Serie; cards: Card[]
}
export type Card = {
  i: number; id: string; localId: string; name: string; category: string; rarity: string; type: string
  dexId: number[]; price: number | null; hasImg: boolean; hp: number | null; set: CardSet
}

type Raw = {
  updated: string
  dex: Species[]
  series: (Omit<Serie, 'sets'> & { sets: Omit<CardSet, 'serie' | 'cards'>[] })[]
  cards: [string, string, string, string, string, string, number[], number | null, number, number | null, string][]
}

export const DB = {
  updated: '',
  dex: [] as Species[],
  series: [] as Serie[],
  sets: new Map<string, CardSet>(),
  cards: [] as Card[],
  byId: new Map<string, Card>(),
  byDex: new Map<number, Card[]>(),
  hashes: new Uint8Array(),
  colors: new Uint8Array(),   // empreinte couleur 6×6 Lab par carte (108 octets), pour le scan en main
}

export const norm = (s?: string | null) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export async function loadData() {
  const base = import.meta.env.BASE_URL
  const [raw, hashes] = await Promise.all([
    fetch(base + 'catalog.json').then((r) => r.json() as Promise<Raw>),
    fetch(base + 'hashes.bin').then((r) => r.arrayBuffer()),
  ])
  // Les empreintes couleur ne servent qu'au scanner : chargées en arrière-plan.
  fetch(base + 'colors.bin').then((r) => r.arrayBuffer()).then((b) => { DB.colors = new Uint8Array(b) }).catch(() => {})
  DB.updated = raw.updated
  DB.dex = raw.dex
  DB.hashes = new Uint8Array(hashes)
  for (const s of raw.series) {
    const serie: Serie = { ...s, sets: [] }
    for (const st of s.sets) {
      const set: CardSet = { ...st, serie, cards: [] }
      serie.sets.push(set)
      DB.sets.set(set.id, set)
    }
    DB.series.push(serie)
  }
  // La toute dernière extension arrive parfois sans n° Pokédex : on le retrouve par le nom.
  const byName = DB.dex.map((p) => [' ' + norm(p.name) + ' ', p.id] as const).sort((a, b) => b[0].length - a[0].length)
  const guess = (name: string) => {
    const n = ' ' + norm(name) + ' '
    const hit = byName.find(([k]) => n.includes(k))
    return hit ? [hit[1]] : []
  }
  raw.cards.forEach(([id, localId, name, category, rarity, type, dexId, price, img, hp, setId], i) => {
    const set = DB.sets.get(setId)!
    const card: Card = {
      i, id, localId, name, category, rarity, type, price, hp, set, hasImg: img === 1,
      dexId: dexId.length || category !== 'Pokémon' ? dexId : guess(name),
    }
    DB.cards.push(card)
    DB.byId.set(id, card)
    // Les cartes sans image ne sont pas proposées (elles restent lisibles si on les possède déjà).
    if (!card.hasImg || !set.img) return
    set.cards.push(card)
    for (const d of card.dexId) (DB.byDex.get(d) ?? DB.byDex.set(d, []).get(d)!).push(card)
  })
  pruneEmpty()
}

// Extensions sans aucune carte illustrée : masquées.
export function pruneEmpty() {
  for (const s of DB.series) s.sets = s.sets.filter((st) => st.cards.length)
  DB.series = DB.series.filter((s) => s.sets.length)
  for (const [id, st] of DB.sets) if (!st.cards.length) DB.sets.delete(id)
}

export const cardImg = (c: Card, q: 'low' | 'high' = 'low') =>
  c.set.img ? `${c.set.img}/${encodeURIComponent(c.localId)}/${q}.webp` : undefined

export const dexNo = (id: number) => 'N°' + String(id).padStart(3, '0')

export const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

export const fdate = (iso?: string, long = false) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { month: 'short', year: 'numeric' }) : ''

export const latestSets = (n: number) =>
  [...DB.sets.values()].filter((s) => s.date && s.cards.length).sort((a, b) => b.date!.localeCompare(a.date!)).slice(0, n)

// Couleur dominante de l'illustration d'une carte, tirée de son empreinte couleur (grille 6×6 Lab 8 bits d'OpenCV) :
// les cellules les plus vives de la zone d'illustration, converties en sRGB.
export function cardTint(c: Card): string | null {
  const C = DB.colors
  if (!C.length || !c.hasImg) return null
  const o = c.i * 108, cells: { L: number; a: number; b: number; ch: number }[] = []
  for (let row = 1; row <= 3; row++) for (let col = 0; col < 6; col++) {
    const k = o + (row * 6 + col) * 3, L = C[k] * 100 / 255, a = C[k + 1] - 128, b = C[k + 2] - 128
    cells.push({ L, a, b, ch: Math.hypot(a, b) })
  }
  const top = cells.sort((x, y) => y.ch - x.ch).slice(0, 3)
  if (top[0].ch < 12) return null   // illustration presque grise : on garde la couleur du type
  const L = top.reduce((s, x) => s + x.L, 0) / 3, a = top.reduce((s, x) => s + x.a, 0) / 3, b = top.reduce((s, x) => s + x.b, 0) / 3
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787)
  const X = 0.95047 * inv(fx), Y = inv(fy), Z = 1.08883 * inv(fz)
  const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z]
  const srgb = lin.map((v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))))
  return '#' + srgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}
