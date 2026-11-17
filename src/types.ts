// Types de Pokémon : libellé FR, couleur (palette « Cores » de la maquette) et icône.
const icons = import.meta.glob<string>('./assets/types/*.svg', { eager: true, query: '?url', import: 'default' })

export type TypeKey =
  | 'water' | 'dragon' | 'electric' | 'fairy' | 'ghost' | 'fire' | 'ice' | 'grass' | 'bug'
  | 'fighting' | 'normal' | 'dark' | 'steel' | 'rock' | 'psychic' | 'ground' | 'poison' | 'flying'

// Couleurs officielles des jeux récents (Écarlate et Violet), reprises des icônes de type.
export const TYPES: Record<TypeKey, { label: string; color: string }> = {
  water: { label: 'Eau', color: '#3A9DE2' },
  dragon: { label: 'Dragon', color: '#576FBC' },
  electric: { label: 'Électrik', color: '#F2C318' },
  fairy: { label: 'Fée', color: '#E18CE1' },
  ghost: { label: 'Spectre', color: '#6F4570' },
  fire: { label: 'Feu', color: '#E4613E' },
  ice: { label: 'Glace', color: '#47C8C8' },
  grass: { label: 'Plante', color: '#439837' },
  bug: { label: 'Insecte', color: '#9F9F28' },
  fighting: { label: 'Combat', color: '#E49021' },
  normal: { label: 'Normal', color: '#828282' },
  dark: { label: 'Ténèbres', color: '#4F4747' },
  steel: { label: 'Acier', color: '#77B2CB' },
  rock: { label: 'Roche', color: '#A9A481' },
  psychic: { label: 'Psy', color: '#E96C8C' },
  ground: { label: 'Sol', color: '#A4733C' },
  poison: { label: 'Poison', color: '#9354CB' },
  flying: { label: 'Vol', color: '#74AAD0' },
}

export const TYPE_KEYS = Object.keys(TYPES) as TypeKey[]
export const typeIcon = (t: TypeKey) => icons[`./assets/types/${t}.svg`]

// Énergies du jeu de cartes : symbole imprimé sur les cartes et couleur de son rond.
const energyIcons = import.meta.glob<string>('./assets/energy/*.svg', { eager: true, query: '?url', import: 'default' })
export type EnergyKey = 'grass' | 'fire' | 'water' | 'electric' | 'psychic' | 'fighting' | 'dark' | 'steel' | 'fairy' | 'dragon' | 'normal'
export const ENERGY: Record<EnergyKey, { label: string; color: string }> = {
  grass: { label: 'Plante', color: '#3E9B3A' },
  fire: { label: 'Feu', color: '#E2432A' },
  water: { label: 'Eau', color: '#1E8AD6' },
  electric: { label: 'Électrique', color: '#F4C21B' },
  psychic: { label: 'Psy', color: '#9A4FA8' },
  fighting: { label: 'Combat', color: '#C25A27' },
  dark: { label: 'Obscurité', color: '#23424C' },
  steel: { label: 'Métal', color: '#8E9AA4' },
  fairy: { label: 'Fée', color: '#E2508C' },
  dragon: { label: 'Dragon', color: '#B8962A' },
  normal: { label: 'Incolore', color: '#ECEAE4' },
}
export const energyIcon = (e: EnergyKey) => energyIcons[`./assets/energy/${e}.svg`]
export const energyOf = (t?: string): EnergyKey => tcgType(t) as EnergyKey

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

// Couleur franche : même teinte, mais clarté et saturation ramenées dans une plage vive (jamais pastel ni boueuse).
export function vivid(hex: string) {
  const lin = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const lms = [
    0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2],
    0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2],
    0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2],
  ].map(Math.cbrt)
  const L = 0.2104542553 * lms[0] + 0.793617785 * lms[1] - 0.0040720468 * lms[2]
  const A = 1.9779984951 * lms[0] - 2.428592205 * lms[1] + 0.4505937099 * lms[2]
  const B = 0.0259040371 * lms[0] + 0.7827717662 * lms[1] - 0.808675766 * lms[2]
  const C0 = Math.hypot(A, B), h = Math.atan2(B, A)
  if (C0 < 0.03) return hex                                   // gris : on n'invente pas de couleur
  const deg = (h * 180 / Math.PI + 360) % 360
  const l = Math.min(deg > 70 && deg < 118 ? 0.86 : 0.72, Math.max(0.5, L))   // les jaunes restent clairs, sinon ils virent au moutarde
  const toHex = (c: number) => {
    const a = c * Math.cos(h), b = c * Math.sin(h)
    const m = [l + 0.3963377774 * a + 0.2158037573 * b, l - 0.1055613458 * a - 0.0638541728 * b, l - 0.0894841775 * a - 1.291485548 * b].map((v) => v ** 3)
    const rgb = [4.0767416621 * m[0] - 3.3077115913 * m[1] + 0.2309699292 * m[2], -1.2684380046 * m[0] + 2.6097574011 * m[1] - 0.3413193965 * m[2], -0.0041960863 * m[0] - 0.7034186147 * m[1] + 1.707614701 * m[2]]
    if (rgb.some((v) => v < -0.001 || v > 1.001)) return null
    return '#' + rgb.map((v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))).toString(16).padStart(2, '0')).join('').toUpperCase()
  }
  for (let c = Math.max(C0, 0.15); c > 0.02; c -= 0.005) { const out = toHex(c); if (out) return out }
  return hex
}
