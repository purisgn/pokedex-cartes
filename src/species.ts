// Fiche Pokémon (description, taille, poids, catégorie, talent) en français, lue en direct sur PokéAPI.
import { useEffect, useState } from 'react'

export type SpeciesInfo = { text?: string; genus?: string; height?: number; weight?: number; ability?: string }

const API = 'https://pokeapi.co/api/v2'
const cache = new Map<number, Promise<SpeciesInfo | null>>()
const fr = <T extends { language: { name: string } }>(list: T[] = []) => list.filter((x) => x.language.name === 'fr')

async function load(id: number): Promise<SpeciesInfo | null> {
  try {
    const [sp, pk] = await Promise.all([
      fetch(`${API}/pokemon-species/${id}`).then((r) => r.json()),
      fetch(`${API}/pokemon/${id}`).then((r) => r.json()),
    ])
    const text = fr<{ flavor_text: string; language: { name: string } }>(sp.flavor_text_entries).at(-1)?.flavor_text.replace(/\s+/g, ' ')
    const genus = fr<{ genus: string; language: { name: string } }>(sp.genera)[0]?.genus.replace(/^Pokémon\s+/, '')
    const ab = pk.abilities?.find((a: { is_hidden: boolean }) => !a.is_hidden)?.ability?.url
    const ability = ab ? fr<{ name: string; language: { name: string } }>((await fetch(ab).then((r) => r.json())).names)[0]?.name : undefined
    return { text, genus, height: pk.height / 10, weight: pk.weight / 10, ability }
  } catch {
    cache.delete(id)
    return null
  }
}

export function useSpecies(id: number) {
  const [s, set] = useState<{ id: number; data: SpeciesInfo | null }>({ id, data: null })
  useEffect(() => {
    let alive = true
    if (!cache.has(id)) cache.set(id, load(id))
    cache.get(id)!.then((data) => alive && set({ id, data }))
    return () => { alive = false }
  }, [id])
  return s.id === id ? s.data : null
}
