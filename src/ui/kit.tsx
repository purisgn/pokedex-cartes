// Composants partagés, tous tirés de la planche « Componentes » de Junior Saraiva.
import { useState, type CSSProperties, type ReactNode } from 'react'
import { typeIcon, type TypeKey } from '../types'
import { cardImg, type Card } from '../data'

const SPRITE_URL = import.meta.env.BASE_URL + 'sprites.webp'
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'

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
  cloud: <path d="M7.5 18.5h9.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.6a4.5 4.5 0 0 0 .5 8.9Z" />,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5a7 7 0 0 1 14 0" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  shuffle: <><path d="M4 7h3.5c4.5 0 4.5 10 9 10H20" /><path d="M4 17h3.5c1.6 0 2.6-1.2 3.4-2.8M13.1 9.8C13.9 8.2 14.9 7 16.5 7H20" /><path d="m17.5 4.5 2.5 2.5-2.5 2.5M17.5 14.5l2.5 2.5-2.5 2.5" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" /></>,
  down: <path d="M12 5v14m0 0-5-5m5 5 5-5" />,
  up: <path d="M4 16l6-6 4 4 6-6M15 8h5v5" />,
  downtrend: <path d="M4 8l6 6 4-4 6 6M15 16h5v-5" />,
  folder: <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" />,
  weight: <><path d="M7 9h10l2 11H5Z" /><circle cx="12" cy="6" r="2.5" /></>,
  ruler: <path d="M12 4v16M8 4h8M8 20h8" />,
  tag: <><path d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8Z" /><circle cx="8.5" cy="8.5" r="1.5" /></>,
  spark: <path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M6.5 17.5 9 15M15 9l2.5-2.5" />,
  euro: <><path d="M17 6.5A6.5 6.5 0 1 0 17 17.5" /><path d="M4.5 10.5h8M4.5 13.5h8" /></>,
  layers: <><path d="m12 4 8 4-8 4-8-4Z" /><path d="m4 12 8 4 8-4M4 16l8 4 8-4" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z" />,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  minus: <path d="M6 12h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
}

// Pokéball de la barre d'onglets active (rouge, blanc, contour bleu), comme dans la maquette.
export function PokeballMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 12a8.5 8.5 0 0 1 17 0Z" fill="var(--red-600)" />
      <path d="M3.5 12a8.5 8.5 0 0 0 17 0Z" fill="#fff" />
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="var(--blue-600)" strokeWidth="1.7" />
      <path d="M3.5 12h5.4m6.2 0h5.4" stroke="var(--blue-600)" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.6" fill="#fff" stroke="var(--blue-600)" strokeWidth="1.7" />
    </svg>
  )
}

export function TypeGlyph({ type, color, size = 14 }: { type: TypeKey; color?: string; size?: number }) {
  const url = `url("${typeIcon(type)}")`
  return <span className="glyph" style={{ width: size, height: size, background: color ?? '#fff', maskImage: url, WebkitMaskImage: url }} />
}

// Sprite fixe, tiré de la planche embarquée (rapide, hors ligne).
export function Sprite({ id, size = 96, style, className }: { id: number; size?: number; style?: CSSProperties; className?: string }) {
  const i = id - 1
  return (
    <span className={'sprite ' + (className ?? '')} role="img" aria-hidden="true" style={{
      width: size, height: size, backgroundImage: `url(${SPRITE_URL})`, backgroundSize: `${size * 32}px auto`,
      backgroundPosition: `${-(i % 32) * size}px ${-Math.floor(i / 32) * size}px`, ...style,
    }} />
  )
}

// Sprite animé (style Noir & Blanc jusqu'au n°649, puis Showdown) ; à défaut, le sprite fixe.
export function AnimSprite({ id, className }: { id: number; className?: string }) {
  const srcs = [
    id <= 649 ? `${SPRITES}/versions/generation-v/black-white/animated/${id}.gif` : null,
    `${SPRITES}/other/showdown/${id}.gif`,
  ].filter(Boolean) as string[]
  const [k, setK] = useState(0)
  if (k >= srcs.length) return <Sprite id={id} size={96} className={className + ' fallback'} />
  return <img className={'anim ' + (className ?? '')} src={srcs[k]} alt="" onError={() => setK(k + 1)} />
}

export function CardImg({ card, q = 'low', className }: { card: Card; q?: 'low' | 'high'; className?: string }) {
  const src = card.hasImg ? cardImg(card, q) : undefined
  return src
    ? <img className={'cimg ' + (className ?? '')} src={src} alt={card.name} loading="lazy" decoding="async" />
    : <span className={'cimg ph ' + (className ?? '')}>{card.name}</span>
}

// Statistique encadrée (maquette : petit libellé en capitales avec icône, valeur dans un cadre).
export function Stat({ icon, label, children }: { icon: keyof typeof PATHS; label: string; children: ReactNode }) {
  return (
    <div className="stat">
      <dt><Icon name={icon} size={13} stroke={1.8} />{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

// Pastille sombre à chevron avec sélecteur natif (maquette : « Todos os tipos ⌄ »).
export function SelectPill<T extends string>({ value, options, onChange, label, color }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; label: string; color?: string
}) {
  return (
    <label className="pill" style={color ? { background: color } : undefined}>
      <span>{options.find(([k]) => k === value)?.[1] ?? label}</span>
      <Icon name="chevron" size={14} stroke={2.4} />
      <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
        {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </label>
  )
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="header">
      {onBack && <button className="icon-btn" onClick={onBack} aria-label="Retour"><Icon name="back" size={24} stroke={2} /></button>}
      <h1>{title}</h1>
      {right}
    </header>
  )
}
