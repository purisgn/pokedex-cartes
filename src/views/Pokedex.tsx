import { useDeferredValue, useState } from 'react'
import { DB, norm, type Species } from '../data'
import { GENS, TYPES, TYPE_KEYS, type TypeKey } from '../types'
import { isFav, ownedByDex, useStore } from '../store'
import { back } from '../App'
import { Ball, Icon, Sprite, TopBar, pastel } from '../ui/kit'

const keep = <T,>(k: string, d: T): [T, (v: T) => void] => {
  const [v, set] = useState<T>(() => { try { return JSON.parse(sessionStorage.getItem(k) ?? 'null') ?? d } catch { return d } })
  return [v, (x: T) => { set(x); try { sessionStorage.setItem(k, JSON.stringify(x)) } catch { /* navigation privée */ } }]
}

const SHOW: Record<string, string> = {
  all: 'Tous', own: 'Possédés', miss: 'Manquants', fav: 'Favoris',
  ...Object.fromEntries(GENS.map((g, i) => [`gen${i + 1}`, `${i + 1}G · ${g}`])),
}

// Carte de la grille (maquette « Grass type ») : fond blanc, numéro dans une pastille de la couleur du type.
export function MonCard({ p, n }: { p: Species; n: number }) {
  const t = p.types[0]
  return (
    <a href={'#/pokemon/' + p.id} className={'mon' + (n ? '' : ' miss')} style={{ ['--c' as string]: TYPES[t].color, ['--p' as string]: pastel(t, 13) }}>
      <span className="mon-no">#{String(p.id).padStart(3, '0')}</span>
      <span className="mon-art"><Ball className="mon-ball" /><Sprite id={p.id} size={96} /></span>
      <span className="mon-name">{p.name}</span>
      {n > 0 && <span className="mon-count">{n} carte{n > 1 ? 's' : ''}</span>}
    </a>
  )
}

export function Pokedex({ type: typeArg }: { type?: string }) {
  useStore()
  const [q, setQ] = keep('dex-q', '')
  const [show, setShow] = keep('dex-show', 'all')
  const type = (typeArg && typeArg in TYPES ? typeArg : '') as TypeKey | ''
  const query = useDeferredValue(norm(q))
  const have = ownedByDex()
  const list = DB.dex.filter((p) =>
    (!query || norm(p.name).includes(query) || String(p.id) === query) &&
    (!type || p.types.includes(type)) &&
    (show === 'all' || (show === 'fav' ? isFav(p.id) : show.startsWith('gen') ? p.gen === +show.slice(3) : (show === 'own') === have.has(p.id))))
  const got = list.filter((p) => have.has(p.id)).length

  return (
    <div className="page">
      <TopBar title={type ? `Type ${TYPES[type].label}` : 'Pokédex'} onBack={type ? back : undefined} />
      <label className="search">
        <Icon name="search" size={16} stroke={2} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" autoComplete="off" enterKeyHint="search" aria-label="Rechercher un Pokémon" />
      </label>

      <div className="filters">
        <label className="fpill">
          <span>{SHOW[show] ?? 'Tous'}</span><Icon name="chevron" size={14} stroke={2.2} />
          <select value={show} onChange={(e) => setShow(e.target.value)} aria-label="Afficher">
            {Object.entries(SHOW).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {!typeArg && (
          <label className="fpill">
            <span>Type</span><Icon name="chevron" size={14} stroke={2.2} />
            <select value="" onChange={(e) => { if (e.target.value) location.hash = '/dex/' + e.target.value }} aria-label="Type">
              <option value="">Tous les types</option>
              {TYPE_KEYS.map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
            </select>
          </label>
        )}
        <span className="filters-count">{got}/{list.length}</span>
      </div>

      <div className="mon-grid">
        {list.map((p) => <MonCard key={p.id} p={p} n={have.get(p.id) ?? 0} />)}
      </div>
      {!list.length && <p className="empty">Aucun Pokémon ne correspond.</p>}
    </div>
  )
}
