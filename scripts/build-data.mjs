// Génère src/data/pokedex.json (noms FR, types, génération) et récupère les icônes de types.
// À relancer seulement quand une nouvelle génération de Pokémon sort.
import { writeFile, mkdir } from 'node:fs/promises'

const CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
const TYPES = ['', 'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy']

const csv = async (f) => (await (await fetch(CSV + f)).text()).trim().split('\n').slice(1).map((l) => l.split(','))

const names = new Map((await csv('pokemon_species_names.csv')).filter((r) => r[1] === '5').map((r) => [+r[0], r[2]]))
const gens = new Map((await csv('pokemon_species.csv')).map((r) => [+r[0], +r[2]]))
const types = new Map()
for (const [pid, tid, slot] of await csv('pokemon_types.csv')) {
  if (+pid > 10000) continue
  const list = types.get(+pid) ?? []
  list[+slot - 1] = TYPES[+tid]
  types.set(+pid, list)
}

const dex = [...names.keys()].sort((a, b) => a - b).map((id) => ({ id, name: names.get(id), types: types.get(id).filter(Boolean), gen: gens.get(id) }))
await writeFile(new URL('../src/data/pokedex.json', import.meta.url), JSON.stringify(dex))
console.log(dex.length, 'Pokémon', dex.at(-1))

const dir = new URL('../src/assets/types/', import.meta.url)
await mkdir(dir, { recursive: true })
for (const t of TYPES.slice(1)) {
  const svg = await (await fetch(`https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/master/icons/${t}.svg`)).text()
  await writeFile(new URL(`${t}.svg`, dir), svg)
}
console.log('icônes OK')
