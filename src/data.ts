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
    set.cards.push(card)
    for (const d of card.dexId) (DB.byDex.get(d) ?? DB.byDex.set(d, []).get(d)!).push(card)
  })
}

export const cardImg = (c: Card, q: 'low' | 'high' = 'low') =>
  c.set.img ? `${c.set.img}/${encodeURIComponent(c.localId)}/${q}.webp` : undefined

export const dexNo = (id: number) => 'N°' + String(id).padStart(3, '0')

export const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

export const fdate = (iso?: string, long = false) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { month: 'short', year: 'numeric' }) : ''

export const latestSets = (n: number) =>
  [...DB.sets.values()].filter((s) => s.date && s.cards.length).sort((a, b) => b.date!.localeCompare(a.date!)).slice(0, n)
