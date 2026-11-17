// Types de Pokémon : libellé FR, couleur (palette « Cores » de la maquette) et icône.
const icons = import.meta.glob<string>('./assets/types/*.svg', { eager: true, query: '?url', import: 'default' })

export type TypeKey =
  | 'water' | 'dragon' | 'electric' | 'fairy' | 'ghost' | 'fire' | 'ice' | 'grass' | 'bug'
  | 'fighting' | 'normal' | 'dark' | 'steel' | 'rock' | 'psychic' | 'ground' | 'poison' | 'flying'

export const TYPES: Record<TypeKey, { label: string; color: string }> = {
  water: { label: 'Eau', color: '#5090D6' },
  dragon: { label: 'Dragon', color: '#0B6DC3' },
  electric: { label: 'Électrik', color: '#F4D23C' },
  fairy: { label: 'Fée', color: '#EC8FE6' },
  ghost: { label: 'Spectre', color: '#5269AD' },
  fire: { label: 'Feu', color: '#FF9D55' },
  ice: { label: 'Glace', color: '#73CEC0' },
  grass: { label: 'Plante', color: '#63BC5A' },
  bug: { label: 'Insecte', color: '#91C12F' },
  fighting: { label: 'Combat', color: '#CE416B' },
  normal: { label: 'Normal', color: '#919AA2' },
  dark: { label: 'Ténèbres', color: '#5A5465' },
  steel: { label: 'Acier', color: '#5A8EA2' },
  rock: { label: 'Roche', color: '#C5B78C' },
  psychic: { label: 'Psy', color: '#FA7179' },
  ground: { label: 'Sol', color: '#D97845' },
  poison: { label: 'Poison', color: '#B567CE' },
  flying: { label: 'Vol', color: '#89AAE3' },
}

export const TYPE_KEYS = Object.keys(TYPES) as TypeKey[]
export const typeIcon = (t: TypeKey) => icons[`./assets/types/${t}.svg`]

// Énergie imprimée sur les cartes → type de jeu, pour la couleur d'une carte.
const TCG: Record<string, TypeKey> = {
  Plante: 'grass', Feu: 'fire', Eau: 'water', 'Électrique': 'electric', Psy: 'psychic', Combat: 'fighting',
  'Obscurité': 'dark', 'Métal': 'steel', Incolore: 'normal', Dragon: 'dragon', 'Fée': 'fairy',
}
export const tcgType = (t?: string): TypeKey => (t && TCG[t]) || 'normal'

export const GENS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unys', 'Kalos', 'Alola', 'Galar', 'Paldea']

// Types contre lesquels un type attaque avec double efficacité (« Fort contre »).
export const STRONG: Record<TypeKey, TypeKey[]> = {
  normal: [], fire: ['grass', 'ice', 'bug', 'steel'], water: ['fire', 'ground', 'rock'], electric: ['water', 'flying'],
  grass: ['water', 'ground', 'rock'], ice: ['grass', 'ground', 'flying', 'dragon'], fighting: ['normal', 'ice', 'rock', 'dark', 'steel'],
  poison: ['grass', 'fairy'], ground: ['fire', 'electric', 'poison', 'rock', 'steel'], flying: ['grass', 'fighting', 'bug'],
  psychic: ['fighting', 'poison'], bug: ['grass', 'psychic', 'dark'], rock: ['fire', 'ice', 'flying', 'bug'], ghost: ['psychic', 'ghost'],
  dragon: ['dragon'], dark: ['psychic', 'ghost'], steel: ['ice', 'rock', 'fairy'], fairy: ['fighting', 'dragon', 'dark'],
}

// Texte lisible posé sur la couleur d'un type : sombre sur les types clairs, blanc sur les foncés.
export function inkOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.36 ? '#2B2620' : '#FFFFFF'
}
