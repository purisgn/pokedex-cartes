// Fiche Pokémon en français (description, taille, poids, catégorie, talent, statistiques, évolutions),
// lue en direct sur PokéAPI et gardée en mémoire.
import { useEffect, useState } from 'react'

export type Evo = { id: number; to: Evo[] }
export type SpeciesInfo = {
  text?: string; genus?: string; height?: number; weight?: number; ability?: string
  stats?: { hp: number; atk: number; def: number; satk: number; sdef: number; spd: number }
  evolution?: Evo
}

const API = 'https://pokeapi.co/api/v2'
const cache = new Map<number, Promise<SpeciesInfo | null>>()
const fr = <T extends { language: { name: string } }>(list: T[] = []) => list.filter((x) => x.language.name === 'fr')
const idOf = (url: string) => +url.replace(/\/$/, '').split('/').pop()!

type ChainNode = { species: { url: string }; evolves_to: ChainNode[] }
const toEvo = (n: ChainNode): Evo => ({ id: idOf(n.species.url), to: n.evolves_to.map(toEvo) })

async function load(id: number): Promise<SpeciesInfo | null> {
  try {
    const [sp, pk] = await Promise.all([
      fetch(`${API}/pokemon-species/${id}`).then((r) => r.json()),
      fetch(`${API}/pokemon/${id}`).then((r) => r.json()),
    ])
    const text = fr<{ flavor_text: string; language: { name: string } }>(sp.flavor_text_entries).at(-1)?.flavor_text.replace(/\s+/g, ' ')
    const genus = fr<{ genus: string; language: { name: string } }>(sp.genera)[0]?.genus.replace(/^Pokémon\s+/, '')
    const ab = pk.abilities?.find((a: { is_hidden: boolean }) => !a.is_hidden)?.ability?.url
    const [ability, chain] = await Promise.all([
      ab ? fetch(ab).then((r) => r.json()).then((a) => fr<{ name: string; language: { name: string } }>(a.names)[0]?.name) : undefined,
      sp.evolution_chain?.url ? fetch(sp.evolution_chain.url).then((r) => r.json()) : undefined,
    ])
    const st = Object.fromEntries((pk.stats as { stat: { name: string }; base_stat: number }[]).map((s) => [s.stat.name, s.base_stat]))
    return {
      text, genus, ability, height: pk.height / 10, weight: pk.weight / 10,
      stats: { hp: st.hp, atk: st.attack, def: st.defense, satk: st['special-attack'], sdef: st['special-defense'], spd: st.speed },
      evolution: chain ? toEvo(chain.chain) : undefined,
    }
  } catch {
    cache.delete(id)
    return null
  }
}

export function useSpecies(id: number) {
  const [s, set] = useState<{ id: number; data: SpeciesInfo | null; done: boolean }>({ id, data: null, done: false })
  useEffect(() => {
    let alive = true
    if (!cache.has(id)) cache.set(id, load(id))
    cache.get(id)!.then((data) => alive && set({ id, data, done: true }))
    return () => { alive = false }
  }, [id])
  return s.id === id ? s : { id, data: null, done: false }
}
