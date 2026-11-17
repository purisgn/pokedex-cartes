import { useDeferredValue, useState } from 'react'
import { DB, eur, norm } from '../data'
import { importCollection, ownedByDex, ownedEntries, useStore } from '../store'
import { CardImg, Icon } from '../ui/kit'
import { sheet } from './CardSheet'

const SORTS = { recent: 'Plus récentes', dex: 'N° Pokédex', name: 'A–Z', value: 'Valeur' } as const

export function Collection() {
  useStore()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<keyof typeof SORTS>('recent')
  const [backup, setBackup] = useState(false)
  const query = useDeferredValue(norm(q))
  const list = ownedEntries().map(([id, n]) => ({ c: DB.byId.get(id)!, n })).filter((x) => x.c)
  const total = list.reduce((s, x) => s + x.n, 0)
  const value = list.reduce((s, x) => s + (x.c.price ?? 0) * x.n, 0)
  const shown = list
    .filter((x) => !query || norm(x.c.name).includes(query) || norm(x.c.set.name).includes(query))
    .sort({
      recent: (a: typeof list[0], b: typeof list[0]) => (b.c.set.date ?? '').localeCompare(a.c.set.date ?? '') || a.c.i - b.c.i,
      dex: (a: typeof list[0], b: typeof list[0]) => (a.c.dexId[0] ?? 9999) - (b.c.dexId[0] ?? 9999),
      name: (a: typeof list[0], b: typeof list[0]) => a.c.name.localeCompare(b.c.name, 'fr'),
      value: (a: typeof list[0], b: typeof list[0]) => (b.c.price ?? 0) - (a.c.price ?? 0),
    }[sort])

  return (
    <div className="page">
      <header className="page-head">
        <h1>Collection</h1>
        <p className="count">Prix Cardmarket du jour de mise à jour</p>
      </header>

      <dl className="stats">
        <div><dt>Cartes</dt><dd>{total}</dd></div>
        <div><dt>Différentes</dt><dd>{list.length}</dd></div>
        <div><dt>Pokémon</dt><dd>{ownedByDex().size}<small> / {DB.dex.length}</small></dd></div>
        <div><dt>Valeur</dt><dd>{eur(value)}</dd></div>
      </dl>

      {list.length ? (
        <>
          <label className="field">
            <Icon name="search" size={20} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Carte ou extension" autoComplete="off" />
          </label>
          <div className="pills">
            <label className="pill">
              <span>{SORTS[sort]}</span><Icon name="chevron" size={16} stroke={2.2} />
              <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} aria-label="Trier">
                {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <button className="pill light" onClick={() => setBackup(!backup)}>Sauvegarde</button>
          </div>
          {backup && <Backup />}
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
          <p className="empty-title">Aucune carte pour l’instant</p>
          <p>Scanne tes cartes une par une, ou ouvre une extension dans Séries et active l’ajout rapide.</p>
          <a className="btn" href="#/scan">Scanner mes cartes</a>
          <button className="btn ghost" onClick={() => setBackup(!backup)}>Restaurer une sauvegarde</button>
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
      <button className="btn ghost" onClick={() => navigator.clipboard.writeText(data).then(() => setMsg('Collection copiée'), () => setText(data))}>Copier ma collection</button>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder='{"sv03.5-025": 2, …}' aria-label="Sauvegarde à restaurer" />
      <button className="btn" disabled={!text.trim()} onClick={() => {
        try { setMsg(importCollection(JSON.parse(text)) + ' cartes restaurées') } catch { setMsg('Ce texte n’est pas une sauvegarde valide') }
      }}>Restaurer</button>
      {msg && <p className="hint" role="status">{msg}</p>}
    </div>
  )
}
