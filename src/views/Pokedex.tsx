import { useDeferredValue, useState } from 'react'
import { DB, norm, type Species } from '../data'
import { GENS, TYPES, TYPE_KEYS, type TypeKey } from '../types'
import { isFav, ownedByDex, toggleFav, useStore } from '../store'
import { HeartButton, Icon, SelectPill, Sprite, TypeChip, TypeMark } from '../ui/kit'

const keep = <T,>(k: string, d: T): [T, (v: T) => void] => {
  const [v, set] = useState<T>(() => { try { return JSON.parse(sessionStorage.getItem(k) ?? 'null') ?? d } catch { return d } })
  return [v, (x: T) => { set(x); try { sessionStorage.setItem(k, JSON.stringify(x)) } catch { /* navigation privée */ } }]
}

const SHOW: [string, string][] = [
  ['all', 'Tous les Pokémon'], ['own', 'Possédés'], ['miss', 'Manquants'], ['fav', 'Favoris'],
  ...GENS.map((g, i): [string, string] => [`gen${i + 1}`, `${g} · ${i + 1}ᵉ gén.`]),
]

// Ligne de la liste (maquette « Kanto ») : fond teinté, bloc coloré à droite avec l'icône du type et le sprite.
export function MonRow({ p, n }: { p: Species; n: number }) {
  const t = p.types[0]
  return (
    <a href={'#/pokemon/' + p.id} className={'mon' + (n ? '' : ' miss')} style={{ ['--t' as string]: TYPES[t].color }}>
      <span className="mon-txt">
        <span className="mon-no">N°{String(p.id).padStart(3, '0')}</span>
        <span className="mon-name">{p.name}</span>
        <span className="mon-chips">{p.types.map((x) => <TypeChip key={x} type={x} size="sm" />)}</span>
      </span>
      <span className="mon-art">
        <TypeMark type={t} className="mon-mark" />
        <Sprite id={p.id} size={96} className="mon-sprite" />
        {n > 0 && <span className="mon-count">{n}</span>}
        <HeartButton on={isFav(p.id)} onClick={() => toggleFav(p.id)} />
      </span>
    </a>
  )
}

export function Pokedex() {
  useStore()
  const [q, setQ] = keep('dex-q', '')
  const [type, setType] = keep<TypeKey | ''>('dex-type', '')
  const [show, setShow] = keep('dex-show', 'all')
  const query = useDeferredValue(norm(q))
  const have = ownedByDex()
  const list = DB.dex.filter((p) =>
    (!query || norm(p.name).includes(query) || String(p.id) === query) &&
    (!type || p.types.includes(type)) &&
    (show === 'all' || (show === 'fav' ? isFav(p.id) : show.startsWith('gen') ? p.gen === +show.slice(3) : (show === 'own') === have.has(p.id))))

  return (
    <div className="page">
      <header className="brand">
        <h1 className="pixel">Pokédex</h1>
        <p className="brand-count"><b className="pixel">{have.size}</b>/{DB.dex.length} en cartes</p>
      </header>

      <label className="field">
        <Icon name="search" size={18} stroke={1.8} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un Pokémon…" autoComplete="off" enterKeyHint="search" aria-label="Rechercher un Pokémon" />
      </label>

      <div className="pills">
        <SelectPill label="Type" value={type} color={type ? TYPES[type].color : undefined} onChange={setType}
          options={[['', 'Tous les types'], ...TYPE_KEYS.map((t): [TypeKey, string] => [t, TYPES[t].label])]} />
        <SelectPill label="Afficher" value={show} onChange={setShow} options={SHOW} />
      </div>

      <div className="dex">{list.map((p) => <MonRow key={p.id} p={p} n={have.get(p.id) ?? 0} />)}</div>
      {!list.length && (
        <div className="empty-state">
          <Sprite id={129} size={96} className="ghost" />
          <p className="empty-title">Aucun Pokémon ici</p>
          <p>Change de filtre ou de recherche.</p>
        </div>
      )}
    </div>
  )
}
