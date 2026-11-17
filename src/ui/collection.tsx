// Progression et vignettes de cartes, partagées par Collection, Extension et Compte.
import { eur, type Card } from '../data'
import { CardImg } from './kit'

// Une seule barre de progression dans toute l'app : « n / total · % » à gauche, valeur à droite, barre dessous.
export function Meter({ n, of, value, unit = 'cartes' }: { n: number; of: number; value?: number; unit?: string }) {
  const pct = of ? (n / of) * 100 : 0
  return (
    <div className="meter">
      <div className="meter-row">
        <span className="meter-num"><b className="pixel">{n}</b> / {of} {unit} · {pct > 0 && pct < 1 ? '< 1' : Math.round(pct)} %</span>
        {value !== undefined && <span className="meter-value">{eur(value)}</span>}
      </div>
      <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={of} aria-valuenow={n} aria-label={`${n} sur ${of} ${unit}`}>
        <i style={{ width: `${Math.max(pct, n ? 1.5 : 0)}%` }} />
      </span>
    </div>
  )
}

export function CardTile({ card, n, onClick }: { card: Card; n: number; onClick: () => void }) {
  return (
    <button className="tile" onClick={onClick}>
      <span className="tile-img"><CardImg card={card} />{n > 1 && <span className="badge pixel">×{n}</span>}</span>
      <span className="tile-name">{card.name}</span>
      <span className="tile-price">{card.price ? eur(card.price) : 'Prix inconnu'}</span>
    </button>
  )
}
