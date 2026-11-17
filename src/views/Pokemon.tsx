import { useState } from 'react'
import { DB, eur } from '../data'
import { GENS, TYPES } from '../types'
import { isFav, qty, toggleFav, useStore } from '../store'
import { useSpecies } from '../species'
import { back } from '../App'
import { AnimSprite, CardImg, HeartButton, Icon, Stat, TypeChip, TypeMark } from '../ui/kit'
import { sheet } from './CardSheet'

// Fiche Pokémon (maquette « Charizard ») : grand disque de la couleur du type, sprite animé,
// description du Pokédex, caractéristiques encadrées, puis ses cartes.
export function Pokemon({ id }: { id: number }) {
  useStore()
  const p = DB.dex[id - 1]
  const info = useSpecies(id)
  const all = (DB.byDex.get(id) ?? []).slice().sort((a, b) => +!!qty(b.id) - +!!qty(a.id) || (b.set.date ?? '').localeCompare(a.set.date ?? ''))
  const owned = all.filter((c) => qty(c.id))
  const [mine, setMine] = useState(owned.length > 0)
  if (!p) return <p className="empty">Pokémon introuvable.</p>
  const t = p.types[0]
  const value = owned.reduce((s, c) => s + (c.price ?? 0) * qty(c.id), 0)
  const shown = mine ? owned : all

  return (
    <div className="detail" style={{ ['--t' as string]: TYPES[t].color }}>
      <div className="hero">
        <div className="hero-disc" />
        <TypeMark type={t} className="hero-mark" />
        <AnimSprite id={id} className={'hero-sprite' + (owned.length ? '' : ' silhouette')} />
        <button className="hero-btn left" onClick={back} aria-label="Retour"><Icon name="back" size={26} stroke={2.2} /></button>
        <span className="hero-btn right"><HeartButton light on={isFav(id)} onClick={() => toggleFav(id)} /></span>
      </div>

      <div className="page">
        <h1 className="title">{p.name}</h1>
        <p className="subtitle pixel">N°{String(id).padStart(3, '0')}</p>
        <div className="chips">{p.types.map((x) => <TypeChip key={x} type={x} />)}</div>

        <p className="lore">{info?.text ?? `${p.name}, Pokémon de ${GENS[p.gen - 1]} (${p.gen}ᵉ génération).`}</p>

        <dl className="stats">
          <Stat icon="weight" label="Poids">{info?.weight != null ? `${info.weight.toLocaleString('fr-FR')} kg` : '—'}</Stat>
          <Stat icon="ruler" label="Taille">{info?.height != null ? `${info.height.toLocaleString('fr-FR')} m` : '—'}</Stat>
          <Stat icon="tag" label="Catégorie">{info?.genus ?? '—'}</Stat>
          <Stat icon="spark" label="Talent">{info?.ability ?? '—'}</Stat>
          <Stat icon="layers" label="Mes cartes">{owned.length} / {all.length}</Stat>
          <Stat icon="euro" label="Valeur">{value ? eur(value) : '—'}</Stat>
        </dl>

        <div className="section-head">
          <h2>Cartes</h2>
          <div className="seg">
            <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>Les miennes</button>
            <button className={mine ? '' : 'on'} onClick={() => setMine(false)}>Toutes</button>
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
        ) : (
          <p className="empty">Tu n’as pas encore de carte de {p.name}.</p>
        )}
      </div>
    </div>
  )
}
