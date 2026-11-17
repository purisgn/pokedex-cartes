// Petites pièces partagées : icônes, puce de type, sprite, image de carte.
import type { CSSProperties, ReactNode } from 'react'
import { TYPES, typeIcon, type TypeKey } from '../types'
import { cardImg, type Card } from '../data'

const SPRITE_URL = import.meta.env.BASE_URL + 'sprites.webp'

export function Icon({ name, size = 24, stroke = 1.5 }: { name: keyof typeof PATHS; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>
  )
}

const PATHS = {
  back: <path d="m15 18-6-6 6-6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  pokeball: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h5.5m6 0h5.5" /><circle cx="12" cy="12" r="2.6" /></>,
  cards: <><rect x="4.5" y="3.5" width="10" height="14" rx="2" /><path d="M9 20.5h8.5a2 2 0 0 0 2-2V7.5" /></>,
  scan: <><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M9 8.5h6v7H9z" /></>,
  collection: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" /></>,
  layers: <><path d="m12 4 8 4-8 4-8-4Z" /><path d="m4 12 8 4 8-4M4 16l8 4 8-4" /></>,
  euro: <><path d="M17 6.5A6.5 6.5 0 1 0 17 17.5" /><path d="M4.5 10.5h8M4.5 13.5h8" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  sparkle: <path d="M12 3.5 13.8 10.2 20.5 12 13.8 13.8 12 20.5 10.2 13.8 3.5 12 10.2 10.2Z" />,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z" />,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  share: <><path d="M12 15V4m0 0L8 8m4-4 4 4" /><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
  minus: <path d="M6 12h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
}

// Icône de type colorée (masque CSS sur l'icône blanche d'origine).
export function TypeGlyph({ type, color, size = 14 }: { type: TypeKey; color?: string; size?: number }) {
  const url = `url("${typeIcon(type)}")`
  return <span className="glyph" style={{ width: size, height: size, background: color ?? '#fff', maskImage: url, WebkitMaskImage: url }} />
}

// Puce de type de la maquette : pastille colorée, rond blanc avec l'icône dans la couleur du type.
export function TypeChip({ type, small }: { type: TypeKey; small?: boolean }) {
  const { label, color } = TYPES[type]
  return (
    <span className={'chip' + (small ? ' sm' : '')} style={{ background: color }}>
      <span className="chip-dot"><TypeGlyph type={type} color={color} size={small ? 10 : 13} /></span>
      {label}
    </span>
  )
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

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head"><h2>{title}</h2>{aside}</div>
      {children}
    </section>
  )
}
