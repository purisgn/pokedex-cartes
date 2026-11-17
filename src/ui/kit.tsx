// Petites pièces partagées : icônes, pastilles de type, pokéball en filigrane, sprite, image de carte.
import type { CSSProperties, ReactNode } from 'react'
import { TYPES, typeIcon, type TypeKey } from '../types'
import { cardImg, type Card } from '../data'

const SPRITE_URL = import.meta.env.BASE_URL + 'sprites.webp'

// Couleur de type adoucie (maquette « UI Study » : pastels sur fond crème).
export const pastel = (t: TypeKey, k = 72) => `color-mix(in srgb, ${TYPES[t].color} ${k}%, white)`

export function Icon({ name, size = 24, stroke = 1.6 }: { name: keyof typeof PATHS; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>
  )
}

const PATHS = {
  back: <path d="m15 18-6-6 6-6" />,
  next: <path d="m9 6 6 6-6 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  pokeball: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h5.5m6 0h5.5" /><circle cx="12" cy="12" r="2.6" /></>,
  cards: <><rect x="4.5" y="3.5" width="10" height="14" rx="2" /><path d="M9 20.5h8.5a2 2 0 0 0 2-2V7.5" /></>,
  scan: <><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M9 8.5h6v7H9z" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" /></>,
  shuffle: <><path d="M4 7h3.5c4.5 0 4.5 10 9 10H20" /><path d="M4 17h3.5c1.6 0 2.6-1.2 3.4-2.8M13.1 9.8C13.9 8.2 14.9 7 16.5 7H20" /><path d="m17.5 4.5 2.5 2.5-2.5 2.5M17.5 14.5l2.5 2.5-2.5 2.5" /></>,
  star: <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8Z" />,
  layers: <><path d="m12 4 8 4-8 4-8-4Z" /><path d="m4 12 8 4 8-4M4 16l8 4 8-4" /></>,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z" />,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  minus: <path d="M6 12h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
}

// Pokéball en filigrane (fonds de cartes, cercles derrière les sprites).
export function Ball({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={'ball ' + (className ?? '')} style={style} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="9" />
      <path d="M6 50h30M64 50h30" stroke="currentColor" strokeWidth="9" />
      <circle cx="50" cy="50" r="13" fill="none" stroke="currentColor" strokeWidth="9" />
    </svg>
  )
}

export function TypeGlyph({ type, color, size = 14 }: { type: TypeKey; color?: string; size?: number }) {
  const url = `url("${typeIcon(type)}")`
  return <span className="glyph" style={{ width: size, height: size, background: color ?? '#fff', maskImage: url, WebkitMaskImage: url }} />
}

// Pastille de type de la maquette : texte blanc minuscule sur la couleur du type.
export function TypePill({ type }: { type: TypeKey }) {
  return <span className="tpill" style={{ background: TYPES[type].color }}>{TYPES[type].label}</span>
}

export function Sprite({ id, size = 96, style, className }: { id: number; size?: number; style?: CSSProperties; className?: string }) {
  const i = id - 1
  return (
    <span className={'sprite ' + (className ?? '')} role="img" aria-hidden="true" style={{
      width: size, height: size, backgroundImage: `url(${SPRITE_URL})`, backgroundSize: `${size * 32}px auto`,
      backgroundPosition: `${-(i % 32) * size}px ${-Math.floor(i / 32) * size}px`, ...style,
    }} />
  )
}

export function CardImg({ card, q = 'low', className }: { card: Card; q?: 'low' | 'high'; className?: string }) {
  const src = card.hasImg ? cardImg(card, q) : undefined
  return src
    ? <img className={'cimg ' + (className ?? '')} src={src} alt={card.name} loading="lazy" decoding="async" />
    : <span className={'cimg ph ' + (className ?? '')}>{card.name}</span>
}

export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="topbar">
      {onBack ? <button className="tb-btn" onClick={onBack} aria-label="Retour"><Icon name="back" size={22} stroke={2} /></button> : <span className="tb-ball"><Ball /></span>}
      <h1>{title}</h1>
      {right ?? <span className="tb-btn" />}
    </header>
  )
}
