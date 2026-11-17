import { useDeferredValue, useState } from 'react'
import { DB, fdate, latestSets, norm } from '../data'
import { ownedByDex, ownedEntries, useStore } from '../store'
import { go } from '../App'
import { Ball, Icon } from '../ui/kit'
import { MonCard } from './Pokedex'
import { progress, SetMark } from './Series'

// Accueil (maquette « Find your favorite Pokémon ») : grande carte rouge avec recherche, puis raccourcis pastel.
export function Home() {
  useStore()
  const [q, setQ] = useState('')
  const query = useDeferredValue(norm(q))
  const have = ownedByDex()
  const results = query ? DB.dex.filter((p) => norm(p.name).includes(query) || String(p.id) === query).slice(0, 12) : []
  const cards = ownedEntries().reduce((s, [, n]) => s + n, 0)

  return (
    <div className="page">
      <section className="hero-card">
        <Ball className="hero-ball" />
        <p className="hero-kicker"><Ball className="mini-ball" />Pokédex Cartes</p>
        <h1>Trouve tes cartes Pokémon</h1>
        <label className="hero-search">
          <Icon name="search" size={16} stroke={2} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un Pokémon" autoComplete="off" enterKeyHint="search" aria-label="Rechercher un Pokémon" />
        </label>
      </section>

      {query ? (
        results.length
          ? <div className="mon-grid">{results.map((p) => <MonCard key={p.id} p={p} n={have.get(p.id) ?? 0} />)}</div>
          : <p className="empty">Aucun Pokémon ne s’appelle comme ça.</p>
      ) : (
        <>
          <nav className="shortcuts" aria-label="Raccourcis">
            <Shortcut label="Pokédex" icon="grid" color="#7CCB8A" onClick={() => go('dex')} />
            <Shortcut label="Types" icon="pokeball" color="#F5A66B" onClick={() => go('types')} />
            <Shortcut label="Séries et extensions" icon="cards" color="#7DA7E8" onClick={() => go('series')} />
            <Shortcut label="Favoris" icon="heart" color="#F07A7A" onClick={() => { sessionStorage.setItem('dex-show', '"fav"'); go('dex') }} />
          </nav>

          <section className="progress-card">
            <div><b>{have.size}</b><span>Pokémon sur {DB.dex.length}</span></div>
            <div><b>{cards}</b><span>cartes</span></div>
            <a className="scan-cta" href="#/scan"><Icon name="scan" size={20} stroke={2} />Scanner</a>
          </section>

          <div className="row-head"><h2>Dernières sorties</h2><a href="#/series">Tout voir</a></div>
          <div className="rail">
            {latestSets(8).map((st) => {
              const { n, of } = progress(st)
              return (
                <a key={st.id} href={'#/set/' + st.id} className="release">
                  <span className="release-mark"><SetMark set={st} /></span>
                  <span className="release-name">{st.name}</span>
                  <span className="release-meta">{fdate(st.date)} · {n}/{of}</span>
                </a>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Shortcut({ label, icon, color, onClick }: { label: string; icon: 'grid' | 'pokeball' | 'cards' | 'heart'; color: string; onClick: () => void }) {
  return (
    <button className="shortcut" style={{ background: color }} onClick={onClick}>
      <span>{label}</span>
      <span className="shortcut-ico"><Icon name={icon} size={16} stroke={2} /></span>
    </button>
  )
}
