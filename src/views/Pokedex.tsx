import { useDeferredValue, useState } from 'react'
import { DB, dexNo, norm } from '../data'
import { GENS, TYPES, TYPE_KEYS, typeIcon, type TypeKey } from '../types'
import { isFav, ownedByDex, useStore } from '../store'
import { Icon, Sprite, TypeChip } from '../ui/kit'

const keep = <T,>(k: string, d: T): [T, (v: T) => void] => {
  const [v, set] = useState<T>(() => { try { return JSON.parse(sessionStorage.getItem(k) ?? 'null') ?? d } catch { return d } })
  return [v, (x: T) => { set(x); try { sessionStorage.setItem(k, JSON.stringify(x)) } catch { /* privé */ } }]
}

export function Pokedex() {
  useStore()
  const [q, setQ] = keep('dex-q', '')
  const [type, setType] = keep<TypeKey | ''>('dex-type', '')
  const [show, setShow] = keep('dex-show', 'all')
  const query = useDeferredValue(norm(q))
  const have = ownedByDex()
  const got = DB.dex.filter((p) => have.has(p.id)).length

  const list = DB.dex.filter((p) =>
    (!query || norm(p.name).includes(query) || String(p.id) === query) &&
    (!type || p.types.includes(type)) &&
    (show === 'all' || (show === 'fav' ? isFav(p.id) : show.startsWith('gen') ? p.gen === +show.slice(3) : (show === 'own') === have.has(p.id))))

  return (
    <div className="page">
      <header className="page-head">
        <h1>Pokédex</h1>
        <p className="count"><b>{got}</b> / {DB.dex.length} Pokémon en cartes</p>
      </header>

      <label className="field">
        <Icon name="search" size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un Pokémon" autoComplete="off" enterKeyHint="search" />
      </label>

      <div className="pills">
        <label className="pill" style={type ? { background: TYPES[type].color } : undefined}>
          <span>{type ? TYPES[type].label : 'Tous les types'}</span><Icon name="chevron" size={16} stroke={2.2} />
          <select value={type} onChange={(e) => setType(e.target.value as TypeKey | '')} aria-label="Type">
            <option value="">Tous les types</option>
            {TYPE_KEYS.map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
          </select>
        </label>
        <label className="pill">
          <span>{SHOW[show] ?? 'Tous'}</span><Icon name="chevron" size={16} stroke={2.2} />
          <select value={show} onChange={(e) => setShow(e.target.value)} aria-label="Afficher">
            {Object.entries(SHOW).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>

      <ul className="dex">
        {list.map((p) => {
          const n = have.get(p.id) ?? 0, color = TYPES[p.types[0]].color
          return (
            <li key={p.id}>
              <a href={'#/pokemon/' + p.id} className={'mon' + (n ? '' : ' miss')} style={{ ['--c' as string]: color }}>
                <div className="mon-txt">
                  <span className="mon-no">{dexNo(p.id)}{n ? ` · ${n} carte${n > 1 ? 's' : ''}` : ''}</span>
                  <span className="mon-name">{p.name}</span>
                  <span className="mon-chips">{p.types.map((t) => <TypeChip key={t} type={t} small />)}</span>
                </div>
                <div className="mon-art">
                  <span className="mon-wm" style={{ maskImage: `url("${typeIcon(p.types[0])}")`, WebkitMaskImage: `url("${typeIcon(p.types[0])}")` }} />
                  <Sprite id={p.id} size={88} />
                </div>
              </a>
            </li>
          )
        })}
      </ul>
      {!list.length && <p className="empty">Aucun Pokémon ne correspond.</p>}
    </div>
  )
}

const SHOW: Record<string, string> = {
  all: 'Tous', own: 'Possédés', miss: 'Manquants', fav: 'Favoris',
  ...Object.fromEntries(GENS.map((g, i) => [`gen${i + 1}`, `${i + 1}G · ${g}`])),
}
