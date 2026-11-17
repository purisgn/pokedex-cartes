// Collection et favoris : gardés sur le téléphone (IndexedDB) et enregistrés en ligne (Supabase)
// sous un « code de collection » secret, pour survivre à une réinstallation ou changer de téléphone.
import { get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import { DB } from './data'

const owned = new Map<string, number>()
const favs = new Set<number>()
let version = 0
const listeners = new Set<() => void>()
const emit = () => { version++; listeners.forEach((l) => l()) }

/* ---------- Synchronisation en ligne ---------- */
const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export type SyncState = { status: 'off' | 'saving' | 'saved' | 'offline' | 'error'; at?: string }
let code = ''
let syncedAt = ''          // date (serveur) de la version enregistrée que ce téléphone connaît
export let sync: SyncState = { status: 'off' }
const setSync = (s: SyncState) => { sync = s; emit() }

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const newCode = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => ALPHABET[b % ALPHABET.length]).join('').replace(/(.{4})(?=.)/g, '$1-')
export const normCode = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/(.{4})(?=.)/g, '$1-')
export const syncCode = () => code

async function rpc<T>(fn: string, body: object): Promise<T> {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', body: JSON.stringify(body),
    headers: { apikey: SB_KEY!, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
  })
  if (!r.ok) throw new Error(`${fn} ${r.status}`)
  return r.json() as Promise<T>
}
type Remote = { data: { cards?: Record<string, number>; favorites?: number[] }; updated_at: string } | null

const snapshot = () => ({ cards: Object.fromEntries(owned), favorites: [...favs] })
function replaceLocal(d: NonNullable<Remote>['data']) {
  owned.clear(); favs.clear()
  for (const [id, n] of Object.entries(d.cards ?? {})) if (DB.byId.has(id) && n > 0) owned.set(id, n)
  for (const id of d.favorites ?? []) favs.add(id)
  saveLocal(); emit()
}

let pushT: ReturnType<typeof setTimeout> | undefined
let pushing: Promise<void> = Promise.resolve()
function schedulePush() {
  if (!SB_URL || !code) return
  clearTimeout(pushT)
  setSync({ status: 'saving', at: sync.at })
  pushT = setTimeout(() => { pushing = pushing.then(push) }, 1200)
}
async function push() {
  try {
    syncedAt = await rpc<string>('save_collection', { code, payload: snapshot() })
    await set('sync-at', syncedAt)
    setSync({ status: 'saved', at: syncedAt })
  } catch {
    setSync({ status: navigator.onLine ? 'error' : 'offline', at: sync.at })
  }
}

// Récupère la version en ligne si elle est plus récente que celle du téléphone.
export async function pull() {
  if (!SB_URL || !code) return
  try {
    const remote = await rpc<Remote>('get_collection', { code })
    if (remote && remote.updated_at > syncedAt) {
      replaceLocal(remote.data)
      syncedAt = remote.updated_at; await set('sync-at', syncedAt)
      setSync({ status: 'saved', at: syncedAt })
    } else if (!remote) {
      schedulePush() // premier passage : on crée la collection en ligne pour que le code existe
    } else {
      setSync({ status: 'saved', at: syncedAt })
    }
  } catch {
    setSync({ status: navigator.onLine ? 'error' : 'offline', at: syncedAt || undefined })
  }
}

// Reprend une collection existante à partir de son code (autre téléphone, réinstallation).
export async function restoreFromCode(input: string): Promise<'ok' | 'unknown' | 'error'> {
  const c = normCode(input)
  if (c.replace(/-/g, '').length < 20) return 'unknown'
  try {
    const remote = await rpc<Remote>('get_collection', { code: c })
    if (!remote) return 'unknown'
    code = c; await set('sync-code', code)
    replaceLocal(remote.data)
    syncedAt = remote.updated_at; await set('sync-at', syncedAt)
    setSync({ status: 'saved', at: syncedAt })
    return 'ok'
  } catch { return 'error' }
}

/* ---------- Stockage local ---------- */
export async function loadStore() {
  const [col, fav, c, at] = await Promise.all([
    get<[string, number][]>('collection'), get<number[]>('favorites'), get<string>('sync-code'), get<string>('sync-at'),
  ])
  for (const [id, n] of col ?? []) owned.set(id, n)
  for (const id of fav ?? []) favs.add(id)
  code = c ?? newCode()
  if (!c) await set('sync-code', code)
  syncedAt = at ?? ''
  navigator.storage?.persist?.().catch(() => {})
  emit()
  pull()
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull() })
  addEventListener('online', () => pull())
}

let saveT: ReturnType<typeof setTimeout> | undefined
const saveLocal = () => {
  clearTimeout(saveT)
  saveT = setTimeout(() => { set('collection', [...owned]); set('favorites', [...favs]) }, 250)
}
const changed = () => { saveLocal(); schedulePush(); emit() }

export const qty = (id: string) => owned.get(id) ?? 0

export function setQty(id: string, n: number) {
  n = Math.max(0, Math.min(999, Math.round(n)))
  if (n) owned.set(id, n); else owned.delete(id)
  changed()
}
export const addCard = (id: string, d = 1) => setQty(id, qty(id) + d)

export const isFav = (id: number) => favs.has(id)
export function toggleFav(id: number) {
  if (favs.has(id)) favs.delete(id); else favs.add(id)
  changed()
}

export const ownedEntries = () => [...owned]

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
