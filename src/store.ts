// Collection et favoris, gardés sur le téléphone (IndexedDB).
import { get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import { DB } from './data'

const owned = new Map<string, number>()
const favs = new Set<number>()
let version = 0
const listeners = new Set<() => void>()
const emit = () => { version++; listeners.forEach((l) => l()) }

export async function loadStore() {
  const [col, fav] = await Promise.all([get<[string, number][]>('collection'), get<number[]>('favorites')])
  for (const [id, n] of col ?? []) owned.set(id, n)
  for (const id of fav ?? []) favs.add(id)
  navigator.storage?.persist?.().catch(() => {})
  emit()
}

let saveT: ReturnType<typeof setTimeout> | undefined
const save = () => {
  clearTimeout(saveT)
  saveT = setTimeout(() => { set('collection', [...owned]); set('favorites', [...favs]) }, 250)
}

export const qty = (id: string) => owned.get(id) ?? 0

export function setQty(id: string, n: number) {
  n = Math.max(0, Math.min(999, Math.round(n)))
  if (n) owned.set(id, n); else owned.delete(id)
  save(); emit()
}
export const addCard = (id: string, d = 1) => setQty(id, qty(id) + d)

export const isFav = (id: number) => favs.has(id)
export function toggleFav(id: number) {
  if (favs.has(id)) favs.delete(id); else favs.add(id)
  save(); emit()
}

export const ownedEntries = () => [...owned]

export function importCollection(data: Record<string, number>) {
  let k = 0
  for (const [id, n] of Object.entries(data)) if (DB.byId.has(id) && +n > 0) { owned.set(id, +n); k++ }
  save(); emit()
  return k
}

// Nombre de cartes possédées par n° Pokédex.
let dexCache = { v: -1, m: new Map<number, number>() }
export function ownedByDex() {
  if (dexCache.v === version) return dexCache.m
  const m = new Map<number, number>()
  for (const [id, n] of owned) for (const d of DB.byId.get(id)?.dexId ?? []) m.set(d, (m.get(d) ?? 0) + n)
  dexCache = { v: version, m }
  return m
}

export function useStore() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => version)
}
