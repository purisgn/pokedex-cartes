// Détail complet d'une carte (attaques, talents, prix détaillés), lu en direct sur TCGdex au besoin.
import { useEffect, useState } from 'react'

export type Energy = string
export type LiveCard = {
  illustrator?: string
  hp?: number
  types?: Energy[]
  stage?: string
  evolveFrom?: string
  description?: string
  effect?: string
  trainerType?: string
  abilities?: { type: string; name: string; effect: string }[]
  attacks?: { cost?: Energy[]; name: string; effect?: string; damage?: number | string }[]
  weaknesses?: { type: Energy; value?: string }[]
  resistances?: { type: Energy; value?: string }[]
  retreat?: number
  regulationMark?: string
  pricing?: { cardmarket?: Record<string, number | string | null> | null } | null
}

const cache = new Map<string, Promise<LiveCard | null>>()

function fetchLive(id: string) {
  if (!cache.has(id)) {
    const p = fetch(`https://api.tcgdex.net/v2/fr/cards/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<LiveCard>) : null))
      .catch(() => { cache.delete(id); return null })
    cache.set(id, p)
  }
  return cache.get(id)!
}

export function useLiveCard(id: string) {
  const [state, setState] = useState<{ id: string; data: LiveCard | null; done: boolean }>({ id, data: null, done: false })
  useEffect(() => {
    let alive = true
    fetchLive(id).then((data) => { if (alive) setState({ id, data, done: true }) })
    return () => { alive = false }
  }, [id])
  return state.id === id ? state : { id, data: null, done: false }
}
