// Collection et favoris : gardés sur le téléphone (IndexedDB) et, une fois connecté, enregistrés
// sur le compte (Supabase, e-mail + mot de passe). Un compte = la même collection sur tous les téléphones.
import { get, set, del } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import { createClient } from '@supabase/supabase-js'
import { DB } from './data'

const owned = new Map<string, number>()
const favs = new Set<number>()
let version = 0
const listeners = new Set<() => void>()
const emit = () => { version++; listeners.forEach((l) => l()) }

/* ---------- Compte ---------- */
const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase = SB_URL && SB_KEY
  ? createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } })
  : null

export type SyncState = { status: 'signedout' | 'saving' | 'saved' | 'offline' | 'error'; at?: string }
export let sync: SyncState = { status: 'signedout' }
export let user: { id: string; email?: string } | null = null
export let recovering = false     // arrivée par le lien « mot de passe oublié »
let syncedAt = ''                 // date serveur de la version que ce téléphone connaît
let dirty = false                 // des changements faits sur ce téléphone attendent d'être envoyés
const setSync = (s: SyncState) => { sync = s; emit() }
const failed = () => setSync({ status: navigator.onLine ? 'error' : 'offline', at: sync.at })

type Payload = { cards?: Record<string, number>; favorites?: number[] }
const snapshot = (): Payload => ({ cards: Object.fromEntries(owned), favorites: [...favs] })

function replaceLocal(d: Payload) {
  owned.clear(); favs.clear()
  for (const [id, n] of Object.entries(d.cards ?? {})) if (DB.byId.has(id) && n > 0) owned.set(id, n)
  for (const id of d.favorites ?? []) favs.add(id)
  saveLocal(); emit()
}
// Première connexion sur ce téléphone : on additionne ce qu'il contenait à ce qui est déjà sur le compte.
function mergeLocal(d: Payload) {
  for (const [id, n] of Object.entries(d.cards ?? {})) if (DB.byId.has(id) && n > (owned.get(id) ?? 0)) owned.set(id, n)
  for (const id of d.favorites ?? []) favs.add(id)
  saveLocal(); emit()
}

let pushT: ReturnType<typeof setTimeout> | undefined
let queue: Promise<void> = Promise.resolve()
function schedulePush(delay = 1200) {
  if (!supabase || !user) return
  clearTimeout(pushT)
  setSync({ status: 'saving', at: sync.at })
  pushT = setTimeout(() => { queue = queue.then(push) }, delay)
}
async function push() {
  if (!supabase || !user) return
  if (!owned.size) {
    const { data: remote } = await supabase.from('user_collections').select('data').eq('user_id', user.id).maybeSingle()
    const remoteCount = Object.keys((remote?.data as Payload | undefined)?.cards ?? {}).length
    if (remoteCount > 1 && !confirmEmptyPush) { await pull(true); return }   // garde-fou : on ne vide pas un compte par erreur
  }
  confirmEmptyPush = false
  const { data, error } = await supabase.from('user_collections')
    .upsert({ user_id: user.id, data: snapshot() }).select('updated_at').single()
  if (error || !data) return failed()
  dirty = false
  syncedAt = data.updated_at; await set('sync-at:' + user.id, syncedAt)
  setSync({ status: 'saved', at: syncedAt })
}
let confirmEmptyPush = false

// Relit le compte : la version en ligne gagne si elle est plus récente que celle du téléphone.
export async function pull(force = false) {
  if (!supabase || !user) return
  const { data, error } = await supabase.from('user_collections').select('data, updated_at').eq('user_id', user.id).maybeSingle()
  if (error) return failed()
  if (!data) { dirty = true; return schedulePush(0) }       // compte neuf : on y envoie ce que le téléphone contient
  const remoteMoved = data.updated_at > syncedAt
  if (force || !dirty) {
    // Rien de neuf ici : le compte fait foi (téléphone vidé par iOS, réinstallation, autre appareil…).
    replaceLocal(data.data)
  } else if (dirty && (remoteMoved || !syncedAt)) {
    // Les deux ont bougé, ou ce téléphone ne connaît pas l'état du compte : on fusionne, on ne perd rien.
    mergeLocal(data.data)
    return schedulePush(0)
  } else if (dirty) {
    return schedulePush(0)
  }
  syncedAt = data.updated_at; await set('sync-at:' + user.id, syncedAt)
  setSync({ status: 'saved', at: syncedAt })
}

async function onUser(u: { id: string; email?: string } | null) {
  const changedUser = u?.id !== user?.id
  user = u
  if (!u) { setSync({ status: 'signedout' }); return }
  if (changedUser) {
    syncedAt = (await get<string>('sync-at:' + u.id)) ?? ''
    if (!syncedAt && (owned.size || favs.size)) dirty = true
  }
  emit()
  await pull()
}

const frMsg = (m?: string) => {
  if (!m) return 'Une erreur est survenue. Réessaie.'
  if (/invalid login/i.test(m)) return 'E-mail ou mot de passe incorrect.'
  if (/already registered|already exists/i.test(m)) return 'Un compte existe déjà avec cet e-mail : connecte-toi.'
  if (/password should be at least|at least 8/i.test(m)) return 'Le mot de passe doit faire au moins 8 caractères.'
  if (/valid email|invalid email|unable to validate email/i.test(m)) return 'Cet e-mail ne semble pas valide.'
  if (/rate limit|too many/i.test(m)) return 'Trop d’essais d’un coup. Attends une minute.'
  if (/fetch|network/i.test(m)) return 'Pas de connexion. Réessaie dans un instant.'
  return m
}

export async function signUp(email: string, password: string) {
  if (!supabase) return 'Comptes indisponibles.'
  const { error } = await supabase.auth.signUp({ email: email.trim(), password })
  return error ? frMsg(error.message) : null
}
export async function signIn(email: string, password: string) {
  if (!supabase) return 'Comptes indisponibles.'
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return error ? frMsg(error.message) : null
}
export async function resetPassword(email: string) {
  if (!supabase) return 'Comptes indisponibles.'
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname })
  return error ? frMsg(error.message) : null
}
export async function newPassword(password: string) {
  if (!supabase) return 'Comptes indisponibles.'
  const { error } = await supabase.auth.updateUser({ password })
  if (!error) { recovering = false; emit() }
  return error ? frMsg(error.message) : null
}
// Se déconnecter vide aussi ce téléphone : la collection reste sur le compte.
export async function signOut() {
  await queue
  await supabase?.auth.signOut()
  owned.clear(); favs.clear(); saveLocal()
  if (user) await del('sync-at:' + user.id)
  user = null; syncedAt = ''
  setSync({ status: 'signedout' })
}

/* ---------- Stockage local ---------- */
export async function loadStore() {
  const [col, fav] = await Promise.all([get<[string, number][]>('collection'), get<number[]>('favorites')])
  for (const [id, n] of col ?? []) owned.set(id, n)
  for (const id of fav ?? []) favs.add(id)
  navigator.storage?.persist?.().catch(() => {})
  emit()
  if (!supabase) return
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; location.hash = '/compte' }
    // Hors du rappel : le client interdit d'attendre une autre requête Supabase pendant celui-ci.
    setTimeout(() => onUser(session?.user ? { id: session.user.id, email: session.user.email } : null), 0)
  })
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull() })
  addEventListener('online', () => pull())
}

let saveT: ReturnType<typeof setTimeout> | undefined
const saveLocal = () => {
  clearTimeout(saveT)
  saveT = setTimeout(() => { set('collection', [...owned]); set('favorites', [...favs]) }, 250)
}
const changed = () => { dirty = true; if (!owned.size) confirmEmptyPush = true; saveLocal(); schedulePush(); emit() }

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
