import { useState } from 'react'
import { DB, eur } from '../data'
import { GENS, TYPES } from '../types'
import { isFav, ownedByDex, qty, toggleFav, useStore } from '../store'
import { back, go } from '../App'
import { Ball, CardImg, Icon, Sprite, TypePill, pastel } from '../ui/kit'
import { sheet } from './CardSheet'

type Tab = 'mine' | 'all' | 'about'

// Fiche Pokémon (maquette « Pikachu #025 ») : fond pastel du type, grand rond pâle, sprite géant, onglets en pilule.
export function Pokemon({ id }: { id: number }) {
  useStore()
  const p = DB.dex[id - 1]
  const all = (DB.byDex.get(id) ?? []).slice().sort((a, b) => +!!qty(b.id) - +!!qty(a.id) || (b.set.date ?? '').localeCompare(a.set.date ?? ''))
  const owned = all.filter((c) => qty(c.id))
  const [tab, setTab] = useState<Tab>(owned.length ? 'mine' : 'all')
  if (!p) return <p className="empty">Pokémon introuvable.</p>
  const t = p.types[0], color = TYPES[t].color
  const count = owned.reduce((s, c) => s + qty(c.id), 0)
  const value = owned.reduce((s, c) => s + (c.price ?? 0) * qty(c.id), 0)
  const years = all.map((c) => c.set.date?.slice(0, 4)).filter(Boolean).sort()
  const fav = isFav(id)
  const shown = tab === 'mine' ? owned : all
  const nav = (d: number) => go('pokemon/' + (((id - 1 + d + DB.dex.length) % DB.dex.length) + 1))
  const random = () => {
    const have = [...ownedByDex().keys()]
    const pool = have.length > 1 ? have : DB.dex.map((x) => x.id)
    go('pokemon/' + pool[Math.floor(Math.random() * pool.length)])
  }

  return (
    <div className="detail" style={{ ['--c' as string]: color, ['--p' as string]: pastel(t, 45), ['--pp' as string]: pastel(t, 16) }}>
      <header className="detail-top">
        <button className="tb-btn" onClick={back} aria-label="Retour"><Icon name="back" size={22} stroke={2} /></button>
        <h1><Ball className="mini-ball" />{p.name} <span>#{String(id).padStart(3, '0')}</span></h1>
        <span className="tb-btn" />
      </header>

      <div className="stage">
        <button className="stage-arrow" onClick={() => nav(-1)} aria-label="Pokémon précédent"><Icon name="back" size={18} stroke={2.2} /></button>
        <div className="stage-disc">
          <Ball className="stage-ball" />
          <Sprite id={id} size={96} className={'stage-sprite' + (owned.length ? '' : ' silhouette')} />
        </div>
        <button className="stage-arrow" onClick={() => nav(1)} aria-label="Pokémon suivant"><Icon name="next" size={18} stroke={2.2} /></button>
      </div>
      <div className="stage-types">{p.types.map((x) => <TypePill key={x} type={x} />)}</div>

      <div className="page">
        <div className="tabs" role="tablist">
          {([['mine', 'Mes cartes'], ['all', 'Toutes'], ['about', 'Infos']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'about' ? (
          <div className="about">
            <dl>
              <div><dt>Cartes possédées</dt><dd>{count}</dd></div>
              <div><dt>Versions possédées</dt><dd>{owned.length} sur {all.length}</dd></div>
              <div><dt>Valeur estimée</dt><dd>{value ? eur(value) : '—'}</dd></div>
              <div><dt>Région</dt><dd>{GENS[p.gen - 1]} · {p.gen}<sup>e</sup> génération</dd></div>
              <div><dt>En cartes depuis</dt><dd>{years[0] ?? '—'}</dd></div>
            </dl>
          </div>
        ) : shown.length ? (
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
          <p className="empty">Pas encore de carte de {p.name}.<br />Scanne-la pour l’ajouter.</p>
        )}
      </div>

      <nav className="detail-bar" aria-label="Actions">
        <a href="#/dex" aria-label="Pokédex"><Icon name="grid" size={22} stroke={1.8} /></a>
        <button onClick={() => toggleFav(id)} className={fav ? 'fav' : ''} aria-pressed={fav} aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}><Icon name="heart" size={23} stroke={1.8} /></button>
        <button onClick={random} aria-label="Pokémon au hasard"><Icon name="shuffle" size={22} stroke={1.8} /></button>
        <a href="#/scan" aria-label="Scanner"><Icon name="scan" size={22} stroke={1.8} /></a>
      </nav>
    </div>
  )
}
