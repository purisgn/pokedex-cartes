import { useState } from 'react'
import { DB, dexNo, eur } from '../data'
import { GENS, TYPES, typeIcon } from '../types'
import { isFav, qty, toggleFav, useStore } from '../store'
import { back } from '../App'
import { CardImg, Icon, Sprite, TypeChip } from '../ui/kit'
import { sheet } from './CardSheet'

export function Pokemon({ id }: { id: number }) {
  useStore()
  const [mine, setMine] = useState(false)
  const p = DB.dex[id - 1]
  if (!p) return <p className="empty">Pokémon introuvable.</p>
  const color = TYPES[p.types[0]].color
  const all = (DB.byDex.get(id) ?? []).slice().sort((a, b) => +!!qty(b.id) - +!!qty(a.id) || (b.set.date ?? '').localeCompare(a.set.date ?? ''))
  const owned = all.filter((c) => qty(c.id))
  const count = owned.reduce((s, c) => s + qty(c.id), 0)
  const value = owned.reduce((s, c) => s + (c.price ?? 0) * qty(c.id), 0)
  const first = all.map((c) => c.set.date).filter(Boolean).sort()[0]
  const shown = mine ? owned : all
  const fav = isFav(id)

  return (
    <div className="detail">
      <div className="hero" style={{ ['--c' as string]: color }}>
        <div className="hero-disc" />
        <span className="hero-wm" style={{ maskImage: `url("${typeIcon(p.types[0])}")`, WebkitMaskImage: `url("${typeIcon(p.types[0])}")` }} />
        <Sprite id={id} size={96} className={'hero-sprite' + (owned.length ? '' : ' silhouette')} />
        <button className="hero-btn left" onClick={back} aria-label="Retour"><Icon name="back" size={28} stroke={2} /></button>
        <button className={'hero-btn right' + (fav ? ' on' : '')} onClick={() => toggleFav(id)} aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={fav}>
          <Icon name="heart" size={26} stroke={2} />
        </button>
      </div>

      <div className="page">
        <h1 className="name">{p.name}</h1>
        <p className="sub">{dexNo(id)}</p>
        <div className="chips-row">{p.types.map((t) => <TypeChip key={t} type={t} />)}</div>

        <dl className="facts">
          <Fact icon="layers" label="Mes cartes" value={String(count)} />
          <Fact icon="cards" label="Versions" value={`${owned.length} / ${all.length}`} />
          <Fact icon="euro" label="Valeur" value={value ? eur(value) : '—'} />
          <Fact icon="calendar" label="Région" value={`${GENS[p.gen - 1]}${first ? ' · ' + first.slice(0, 4) : ''}`} />
        </dl>

        <div className="section-head">
          <h2>Cartes</h2>
          <div className="seg">
            <button className={mine ? '' : 'on'} onClick={() => setMine(false)}>Toutes</button>
            <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>Les miennes</button>
          </div>
        </div>
        {shown.length ? (
          <div className="grid">
            {shown.map((c) => (
              <button key={c.id} className={'gcard' + (qty(c.id) ? '' : ' miss')} onClick={() => sheet.open(c.id)}>
                <CardImg card={c} />
                {qty(c.id) > 0 && <span className="badge">{qty(c.id)}</span>}
                <span className="gcap">{c.set.name}</span>
              </button>
            ))}
          </div>
        ) : <p className="empty">Pas encore de carte de {p.name}. Scanne-la pour l’ajouter.</p>}
      </div>
    </div>
  )
}

function Fact({ icon, label, value }: { icon: 'layers' | 'cards' | 'euro' | 'calendar'; label: string; value: string }) {
  return (
    <div className="fact">
      <dt><Icon name={icon} size={14} />{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
