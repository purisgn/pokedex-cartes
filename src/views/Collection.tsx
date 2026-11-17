import { useDeferredValue, useState } from 'react'
import { DB, cardImg, eur, norm, type Card, type CardSet } from '../data'
import { ownedByDex, ownedEntries, sync, user, useStore } from '../store'
import { tcgType, TYPES } from '../types'
import { Header, Icon, SelectPill, Sprite, TypeMark } from '../ui/kit'
import { CardTile, Meter } from '../ui/collection'
import { SetMark } from './Series'
import { sheet } from './CardSheet'

type Sort = 'recent' | 'value' | 'dex' | 'name'
const SORTS: [Sort, string][] = [['recent', 'Plus récentes'], ['value', 'Valeur'], ['dex', 'N° Pokédex'], ['name', 'A – Z']]
const BY: Record<Sort, (a: { c: Card }, b: { c: Card }) => number> = {
  recent: (a, b) => (b.c.set.date ?? '').localeCompare(a.c.set.date ?? '') || a.c.i - b.c.i,
  value: (a, b) => (b.c.price ?? 0) - (a.c.price ?? 0),
  dex: (a, b) => (a.c.dexId[0] ?? 9999) - (b.c.dexId[0] ?? 9999),
  name: (a, b) => a.c.name.localeCompare(b.c.name, 'fr'),
}

export function Collection() {
  useStore()
  const [view, setView] = useState<'sets' | 'all'>(() => (sessionStorage.getItem('col-view') as 'sets' | 'all') ?? 'sets')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const query = useDeferredValue(norm(q))
  const list = ownedEntries().map(([id, n]) => ({ c: DB.byId.get(id)!, n })).filter((x) => x.c)
  const total = list.reduce((s, x) => s + x.n, 0)
  const value = list.reduce((s, x) => s + (x.c.price ?? 0) * x.n, 0)
  const pick = (v: 'sets' | 'all') => { setView(v); sessionStorage.setItem('col-view', v) }

  if (!list.length) return (
    <div className="page">
      <Header title="Collection" />
      <SyncLine />
      <div className="empty-state">
        <Sprite id={129} size={96} className="ghost" />
        <p className="empty-title">Ta collection est vide</p>
        <p>Scanne tes cartes, ou ouvre une extension dans Séries et active l’ajout rapide.</p>
        <a className="btn outline" href="#/scan">Scanner mes cartes</a>
        {!user && <a className="link" href="#/compte">J’ai déjà un compte</a>}
      </div>
    </div>
  )

  const star = list.reduce((a, b) => ((b.c.price ?? 0) > (a.c.price ?? 0) ? b : a))
  const groups = new Map<CardSet, { c: Card; n: number }[]>()
  for (const x of list) (groups.get(x.c.set) ?? groups.set(x.c.set, []).get(x.c.set)!).push(x)
  const sets = [...groups].sort((a, b) => (b[0].date ?? '').localeCompare(a[0].date ?? ''))
  const shown = list.filter((x) => !query || norm(x.c.name).includes(query) || norm(x.c.set.name).includes(query)).sort(BY[sort])

  return (
    <div className="page">
      <Header title="Collection" />
      <Featured card={star.c} />

      <section className="panel">
        <Meter label="Pokédex en cartes" n={ownedByDex().size} of={DB.dex.length} value={value} unit="Pokémon" />
        <p className="panel-sub"><b>{total}</b> carte{total > 1 ? 's' : ''} · <b>{list.length}</b> différente{list.length > 1 ? 's' : ''} · <b>{sets.length}</b> extension{sets.length > 1 ? 's' : ''}</p>
        <SyncLine inline />
      </section>

      <div className="seg wide">
        <button className={view === 'sets' ? 'on' : ''} onClick={() => pick('sets')}>Par extension</button>
        <button className={view === 'all' ? 'on' : ''} onClick={() => pick('all')}>Toutes mes cartes</button>
      </div>

      {view === 'sets' ? (
        <div className="groups">
          {sets.map(([st, items]) => {
            const top = items.slice().sort((a, b) => (b.c.price ?? 0) - (a.c.price ?? 0)).slice(0, 3)
            const v = items.reduce((s, x) => s + (x.c.price ?? 0) * x.n, 0)
            return (
              <section key={st.id} className="group">
                <a className="group-head" href={'#/set/' + st.id}>
                  <span className="group-mark"><SetMark set={st} /></span>
                  <span className="group-title"><b>{st.name}</b><small>{st.serie.name}</small></span>
                  <Icon name="next" size={18} stroke={2} />
                </a>
                <Meter label="Collection" n={items.length} of={st.official || st.cards.length} value={v} />
                <div className="tiles">{top.map(({ c, n }) => <CardTile key={c.id} card={c} n={n} onClick={() => sheet.open(c.id)} />)}</div>
                <a className="soft-btn" href={'#/set/' + st.id}>Voir l’extension{items.length > 3 ? ` · ${items.length} cartes` : ''}</a>
              </section>
            )
          })}
        </div>
      ) : (
        <>
          <label className="field">
            <Icon name="search" size={18} stroke={1.8} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une carte ou une extension…" autoComplete="off" />
          </label>
          <div className="pills"><SelectPill label="Trier" value={sort} onChange={setSort} options={SORTS} /></div>
          <div className="tiles all">{shown.map(({ c, n }) => <CardTile key={c.id} card={c} n={n} onClick={() => sheet.open(c.id)} />)}</div>
        </>
      )}
    </div>
  )
}

// La carte la plus chère de la collection, mise en avant (maquette : bandeau « Charizard VSTAR »).
function Featured({ card }: { card: Card }) {
  const t = tcgType(card.type)
  const img = cardImg(card, 'high')
  return (
    <button className="featured" style={{ ['--t' as string]: TYPES[t].color }} onClick={() => sheet.open(card.id)}>
      <TypeMark type={t} className="featured-mark" />
      <span className="featured-txt">
        <small>Ta carte phare</small>
        <b>{card.name}</b>
        <span>{card.set.name} · <span className="pixel">{card.localId}</span></span>
        {card.price ? <em>{eur(card.price)}</em> : null}
      </span>
      {img && <img className="featured-card" src={img} alt="" />}
    </button>
  )
}

function SyncLine({ inline }: { inline?: boolean }) {
  if (!user) return (
    <a className={'syncline off' + (inline ? ' inline' : '')} href="#/compte">
      <Icon name="cloud" size={18} stroke={1.8} /><span>Crée un compte pour ne jamais perdre ta collection</span><b>Créer</b>
    </a>
  )
  const time = sync.at ? new Date(sync.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
  const label = { signedout: '', saving: 'Enregistrement…', saved: `Enregistrée sur ton compte${time ? ' · ' + time : ''}`, offline: 'Hors ligne : enregistrée au retour du réseau', error: 'Enregistrement impossible pour l’instant' }[sync.status]
  return <a className={'syncline ' + sync.status + (inline ? ' inline' : '')} href="#/compte"><Icon name="cloud" size={16} stroke={1.8} /><span>{label}</span></a>
}
