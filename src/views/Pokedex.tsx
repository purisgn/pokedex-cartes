import { useDeferredValue, useState, type CSSProperties } from 'react'
import { DB, norm, type Species } from '../data'
import { GENS, TYPES, TYPE_KEYS, inkOn, type TypeKey } from '../types'
import { isFav, ownedByDex, useStore } from '../store'
import { Icon, PokeballMark, SelectPill, Sprite, TypeGlyph } from '../ui/kit'

const keep = <T,>(k: string, d: T): [T, (v: T) => void] => {
  const [v, set] = useState<T>(() => { try { return JSON.parse(sessionStorage.getItem(k) ?? 'null') ?? d } catch { return d } })
  return [v, (x: T) => { set(x); try { sessionStorage.setItem(k, JSON.stringify(x)) } catch { /* navigation privée */ } }]
}

const SHOW: [string, string][] = [['all', 'Tous'], ['own', 'Possédés'], ['miss', 'Manquants'], ['fav', 'Favoris']]
const GEN_OPTS: [string, string][] = [['0', 'Toutes générations'], ...GENS.map((g, i): [string, string] => [String(i + 1), `${i + 1}G · ${g}`])]

// Carte de la grille (maquette « UI Study ») : numéro dans la couleur du type, sprite sur un rond pastel.
export function MonCard({ p, n }: { p: Species; n: number }) {
  const t = p.types[0], color = TYPES[t].color
  return (
    <a href={'#/pokemon/' + p.id} className={'mcard' + (n ? '' : ' miss')} style={{ '--t': color, '--ink': inkOn(color) } as CSSProperties}>
      <span className="mcard-no pixel">#{String(p.id).padStart(3, '0')}</span>
      {isFav(p.id) && <span className="mcard-fav"><Icon name="heart" size={14} stroke={2.2} /></span>}
      <span className="mcard-art"><span className="mcard-disc" /><Sprite id={p.id} size={96} className="mcard-sprite" /></span>
      <span className="mcard-name">{p.name}</span>
      <span className="mcard-types">{p.types.map((x) => <i key={x} style={{ background: TYPES[x].color }} title={TYPES[x].label}><TypeGlyph type={x} size={10} /></i>)}</span>
      {n > 0 && <span className="mcard-count">{n} carte{n > 1 ? 's' : ''}</span>}
    </a>
  )
}

export function Pokedex() {
  useStore()
  const [q, setQ] = keep('dex-q', '')
  const [type, setType] = keep<TypeKey | ''>('dex-type', '')
  const [show, setShow] = keep('dex-show', 'all')
  const [gen, setGen] = keep('dex-gen', '0')
  const query = useDeferredValue(norm(q))
  const have = ownedByDex()
  const list = DB.dex.filter((p) =>
    (!query || norm(p.name).includes(query) || String(p.id) === query) &&
    (!type || p.types.includes(type)) && (gen === '0' || p.gen === +gen) &&
    (show === 'all' || (show === 'fav' ? isFav(p.id) : (show === 'own') === have.has(p.id))))
  const pct = Math.round((have.size / DB.dex.length) * 1000) / 10

  return (
    <div className="page">
      <section className="dex-hero">
        <span className="dex-hero-ball" aria-hidden="true" />
        <p className="dex-hero-kicker"><PokeballMark size={18} /><span className="pixel">Pokédex Cartes</span></p>
        <h1>Trouve tes Pokémon</h1>
        <label className="dex-search">
          <Icon name="search" size={17} stroke={2} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou numéro" autoComplete="off" enterKeyHint="search" aria-label="Rechercher un Pokémon" />
          {q && <button onClick={() => setQ('')} aria-label="Effacer"><Icon name="close" size={16} stroke={2.2} /></button>}
        </label>
        <div className="dex-progress">
          <span className="dex-progress-bar"><i style={{ width: `${Math.max(pct, have.size ? 1.5 : 0)}%` }} /></span>
          <span><b className="pixel">{have.size}</b> / {DB.dex.length} Pokémon en cartes</span>
        </div>
      </section>

      {have.size > 0 && (
        <a className="world-entry" href="#/monde">
          <span className="world-entry-txt"><b className="pixel">Mon monde</b><span>{have.size} Pokémon en liberté</span></span>
          <span className="sprites">{[...have.keys()].slice(0, 4).map((id) => <Sprite key={id} id={id} size={64} />)}</span>
          <Icon name="next" size={18} stroke={2.4} />
        </a>
      )}

      <div className="type-rail" role="radiogroup" aria-label="Type">
        <button className={'type-chip all' + (type ? '' : ' on')} onClick={() => setType('')} role="radio" aria-checked={!type}>Tous</button>
        {TYPE_KEYS.map((t) => (
          <button key={t} className={'type-chip' + (type === t ? ' on' : '')} role="radio" aria-checked={type === t}
            style={{ '--t': TYPES[t].color, '--ink': inkOn(TYPES[t].color) } as CSSProperties} onClick={() => setType(type === t ? '' : t)}>
            <span>{TYPES[t].label}</span>
            <i><TypeGlyph type={t} color={TYPES[t].color} size={12} /></i>
          </button>
        ))}
      </div>

      <div className="dex-filters">
        <div className="seg small">
          {SHOW.map(([k, l]) => <button key={k} className={show === k ? 'on' : ''} onClick={() => setShow(k)}>{l}</button>)}
        </div>
      </div>
      <div className="dex-count">
        <span>{list.length} Pokémon{type ? ` · ${TYPES[type].label}` : ''}</span>
        <SelectPill label="Génération" value={gen} onChange={setGen} options={GEN_OPTS} />
      </div>
      <div className="mgrid">{list.map((p) => <MonCard key={p.id} p={p} n={have.get(p.id) ?? 0} />)}</div>
      {!list.length && (
        <div className="empty-state">
          <Sprite id={129} size={96} className="ghost" />
          <p className="empty-title">Aucun Pokémon ici</p>
          <p>Change de type, de filtre ou de recherche.</p>
        </div>
      )}
    </div>
  )
}
