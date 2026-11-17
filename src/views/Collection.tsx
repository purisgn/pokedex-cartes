import { useDeferredValue, useState } from 'react'
import { DB, eur, fdate, norm, type Card } from '../data'
import { ownedByDex, ownedEntries, sync, user, useStore } from '../store'
import { CardImg, Header, Icon, SelectPill, Sprite, Stat } from '../ui/kit'
import { sheet } from './CardSheet'

type Sort = 'recent' | 'dex' | 'name' | 'value'
const SORTS: [Sort, string][] = [['recent', 'Plus récentes'], ['dex', 'N° Pokédex'], ['name', 'A – Z'], ['value', 'Valeur']]
const BY: Record<Sort, (a: { c: Card }, b: { c: Card }) => number> = {
  recent: (a, b) => (b.c.set.date ?? '').localeCompare(a.c.set.date ?? '') || a.c.i - b.c.i,
  dex: (a, b) => (a.c.dexId[0] ?? 9999) - (b.c.dexId[0] ?? 9999),
  name: (a, b) => a.c.name.localeCompare(b.c.name, 'fr'),
  value: (a, b) => (b.c.price ?? 0) - (a.c.price ?? 0),
}

export function Collection() {
  useStore()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const query = useDeferredValue(norm(q))
  const list = ownedEntries().map(([id, n]) => ({ c: DB.byId.get(id)!, n })).filter((x) => x.c)
  const total = list.reduce((s, x) => s + x.n, 0)
  const value = list.reduce((s, x) => s + (x.c.price ?? 0) * x.n, 0)
  const shown = list.filter((x) => !query || norm(x.c.name).includes(query) || norm(x.c.set.name).includes(query)).sort(BY[sort])

  return (
    <div className="page">
      <Header title="Collection" />
      <SyncBar />

      {list.length ? (
        <>
          <dl className="stats">
            <Stat icon="layers" label="Cartes"><span className="pixel">{total}</span></Stat>
            <Stat icon="cards" label="Différentes"><span className="pixel">{list.length}</span></Stat>
            <Stat icon="pokeball" label="Pokémon"><span className="pixel">{ownedByDex().size}</span>/{DB.dex.length}</Stat>
            <Stat icon="euro" label="Valeur">{eur(value)}</Stat>
          </dl>
          <p className="hint">Prix Cardmarket au {fdate(DB.updated, true)}.</p>
          <label className="field" style={{ marginTop: 20 }}>
            <Icon name="search" size={18} stroke={1.8} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une carte ou une extension…" autoComplete="off" />
          </label>
          <div className="pills"><SelectPill label="Trier" value={sort} onChange={setSort} options={SORTS} /></div>
          <div className="grid">
            {shown.map(({ c, n }) => (
              <button key={c.id} className="gcard" onClick={() => sheet.open(c.id)}>
                <CardImg card={c} />
                {n > 1 && <span className="badge">{n}</span>}
                <span className="gcap">{c.set.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Sprite id={129} size={96} className="ghost" />
          <p className="empty-title">Tu n’as encore aucune carte</p>
          <p>Scanne tes cartes, ou ouvre une extension dans Séries et active l’ajout rapide. Tu as déjà un compte ? Connecte-toi pour retrouver ta collection.</p>
          <a className="btn outline" href="#/scan">Scanner mes cartes</a>
        </div>
      )}
    </div>
  )
}

// État de l'enregistrement sur le compte, toujours visible en haut de la collection.
function SyncBar() {
  if (!user) return (
    <a className="syncbar off" href="#/compte">
      <Icon name="cloud" size={20} stroke={1.8} />
      <span>Crée un compte pour ne jamais perdre ta collection</span>
      <b>Créer</b>
    </a>
  )
  const time = sync.at ? new Date(sync.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
  const label = {
    signedout: '', saving: 'Enregistrement sur ton compte…',
    saved: `Enregistrée sur ton compte${time ? ' · ' + time : ''}`,
    offline: 'Hors ligne : enregistrée au retour du réseau',
    error: 'Enregistrement impossible pour l’instant',
  }[sync.status]
  return (
    <a className={'syncbar ' + sync.status} href="#/compte">
      <Icon name="cloud" size={20} stroke={1.8} />
      <span>{label}</span>
    </a>
  )
}
