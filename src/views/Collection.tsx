import { useDeferredValue, useState } from 'react'
import { DB, eur, fdate, norm, type Card } from '../data'
import { importCollection, ownedByDex, ownedEntries, useStore } from '../store'
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
  const [backup, setBackup] = useState(false)
  const query = useDeferredValue(norm(q))
  const list = ownedEntries().map(([id, n]) => ({ c: DB.byId.get(id)!, n })).filter((x) => x.c)
  const total = list.reduce((s, x) => s + x.n, 0)
  const value = list.reduce((s, x) => s + (x.c.price ?? 0) * x.n, 0)
  const shown = list.filter((x) => !query || norm(x.c.name).includes(query) || norm(x.c.set.name).includes(query)).sort(BY[sort])

  return (
    <div className="page">
      <Header title="Collection" right={list.length ? <button className="icon-btn" onClick={() => setBackup(!backup)} aria-label="Sauvegarde"><Icon name="folder" size={22} /></button> : undefined} />
      {list.length ? (
        <>
          <dl className="stats">
            <Stat icon="layers" label="Cartes"><span className="pixel">{total}</span></Stat>
            <Stat icon="cards" label="Différentes"><span className="pixel">{list.length}</span></Stat>
            <Stat icon="pokeball" label="Pokémon"><span className="pixel">{ownedByDex().size}</span>/{DB.dex.length}</Stat>
            <Stat icon="euro" label="Valeur">{eur(value)}</Stat>
          </dl>
          <p className="hint">Prix Cardmarket au {fdate(DB.updated, true)}.</p>
          {backup && <Backup />}
          <label className="field">
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
          <p>Scanne tes cartes, ou ouvre une extension dans Séries et active l’ajout rapide.</p>
          <a className="btn outline" href="#/scan">Scanner mes cartes</a>
          <button className="link" onClick={() => setBackup(!backup)}>Restaurer une sauvegarde</button>
          {backup && <Backup />}
        </div>
      )}
    </div>
  )
}

function Backup() {
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const data = JSON.stringify(Object.fromEntries(ownedEntries()))
  return (
    <div className="backup">
      <p className="hint">Copie ce texte et garde-le (Notes, mail…). Colle-le ici sur un autre téléphone pour tout retrouver.</p>
      <button className="btn outline" onClick={() => navigator.clipboard.writeText(data).then(() => setMsg('Collection copiée'), () => setText(data))}>Copier ma collection</button>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder='{"sv03.5-025": 2, …}' aria-label="Sauvegarde à restaurer" />
      <button className="btn" disabled={!text.trim()} onClick={() => {
        try { setMsg(importCollection(JSON.parse(text)) + ' cartes restaurées') } catch { setMsg('Ce texte n’est pas une sauvegarde valide') }
      }}>Restaurer</button>
      {msg && <p className="hint" role="status">{msg}</p>}
    </div>
  )
}
