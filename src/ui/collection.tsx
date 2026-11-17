// Pièces de l'écran Collection, d'après la maquette « Pokedesk » (MIND) : barre de complétion avec valeur,
// vignette de carte avec quantité, nom et prix.
import { eur, type Card } from '../data'
import { CardImg } from './kit'

export function Meter({ label, n, of, value, unit = 'cartes' }: { label: string; n: number; of: number; value: number; unit?: string }) {
  const pct = of ? Math.min(100, (n / of) * 100) : 0
  return (
    <div className="meter">
      <div className="meter-top"><span>{label}</span><span>Valeur totale</span></div>
      <div className="meter-bar" role="progressbar" aria-valuemin={0} aria-valuemax={of} aria-valuenow={n} aria-label={label}>
        <i style={{ width: `${Math.max(pct, n ? 2 : 0)}%` }} />
      </div>
      <div className="meter-foot">
        <span className="meter-pct pixel">{pct < 1 && n ? '<1' : Math.round(pct)}%</span>
        <span className="meter-count"><i className="dot" />{n} – {of} {unit}</span>
        <b className="meter-value">{eur(value)}</b>
      </div>
    </div>
  )
}

export function CardTile({ card, n, onClick, dim }: { card: Card; n: number; onClick: () => void; dim?: boolean }) {
  return (
    <button className={'tile' + (dim && !n ? ' miss' : '')} onClick={onClick}>
      <span className="tile-img">
        <CardImg card={card} />
        {n > 0 && <span className="badge">{n}</span>}
      </span>
      <span className="tile-kind">{card.rarity || card.category}</span>
      <span className="tile-name">{card.name}</span>
      <span className="tile-price">{card.price ? eur(card.price) : '—'}</span>
    </button>
  )
}
