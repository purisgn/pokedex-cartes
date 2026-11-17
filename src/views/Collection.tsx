import { useDeferredValue, useState } from 'react'
import { DB, cardImg, eur, norm, type Card, type CardSet } from '../data'
import { ownedByDex, ownedEntries, sync, user, useStore } from '../store'
import { Icon, PokeballMark, SelectPill, Sprite } from '../ui/kit'
import { CardTile, Meter } from '../ui/collection'
import { SetMark } from './Series'
import { sheet } from './CardSheet'

type Sort = 'recent' | 'value' | 'dex' | 'name'
const SORTS: [Sort, string][] = [['recent', 'Plus récentes'], ['value', 'Plus chères'], ['dex', 'N° Pokédex'], ['name', 'A – Z']]
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
  const pick = (v: 'sets' | 'all') => { setView(v); sessionStorage.setItem('col-view', v) }

  if (!list.length) return (
    <div className="page">
      <Hero total={0} distinct={0} value={0} star={null} />
      <Sync />
      <div className="empty-state">
        <Sprite id={129} size={96} className="ghost" />
        <p className="empty-title">Ta collection est vide</p>
        <p>Scanne tes cartes, ou ouvre une extension dans Séries et active l’ajout rapide.</p>
        <a className="btn" href="#/scan">Scanner mes cartes</a>
        {!user && <a className="link" href="#/compte">J’ai déjà un compte</a>}
      </div>
    </div>
  )

  const total = list.reduce((s, x) => s + x.n, 0)
  const value = list.reduce((s, x) => s + (x.c.price ?? 0) * x.n, 0)
  const star = list.reduce((a, b) => ((b.c.price ?? 0) > (a.c.price ?? 0) ? b : a)).c
  const groups = new Map<CardSet, { c: Card; n: number }[]>()
  for (const x of list) (groups.get(x.c.set) ?? groups.set(x.c.set, []).get(x.c.set)!).push(x)
  const sets = [...groups].sort((a, b) => (b[0].date ?? '').localeCompare(a[0].date ?? ''))
  const shown = list.filter((x) => !query || norm(x.c.name).includes(query) || norm(x.c.set.name).includes(query)).sort(BY[sort])

  return (
    <div className="page">
      <Hero total={total} distinct={list.length} value={value} star={star} />
      <Sync />

      <div className="seg block">
        <button className={view === 'sets' ? 'on' : ''} onClick={() => pick('sets')}>Par extension · {sets.length}</button>
        <button className={view === 'all' ? 'on' : ''} onClick={() => pick('all')}>Toutes · {list.length}</button>
      </div>

      {view === 'sets' ? (
        <div className="groups">
          {sets.map(([st, items]) => {
            const sorted = items.slice().sort((a, b) => (b.c.price ?? 0) - (a.c.price ?? 0))
            const v = items.reduce((s, x) => s + (x.c.price ?? 0) * x.n, 0)
            return (
              <section key={st.id} className="group">
                <a className="group-head" href={'#/set/' + st.id}>
                  <span className="group-mark"><SetMark set={st} /></span>
                  <span className="group-title"><b>{st.name}</b><small>{st.serie.name}</small></span>
                  <Icon name="next" size={18} stroke={2} />
                </a>
                <Meter n={items.length} of={st.official || st.cards.length} value={v} />
                <div className="strip">{sorted.map(({ c, n }) => <CardTile key={c.id} card={c} n={n} onClick={() => sheet.open(c.id)} />)}</div>
              </section>
            )
          })}
        </div>
      ) : (
        <>
          <label className="field">
            <Icon name="search" size={18} stroke={1.8} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Une carte, une extension…" autoComplete="off" />
          </label>
          <div className="row-between">
            <span className="muted">{shown.length} carte{shown.length > 1 ? 's' : ''}</span>
            <SelectPill label="Trier" value={sort} onChange={setSort} options={SORTS} />
          </div>
          <div className="tiles">{shown.map(({ c, n }) => <CardTile key={c.id} card={c} n={n} onClick={() => sheet.open(c.id)} />)}</div>
        </>
      )}
    </div>
  )
}

// En-tête rouge, même famille que l'accueil : valeur, chiffres clés, progression du Pokédex, carte la plus chère.
function Hero({ total, distinct, value, star }: { total: number; distinct: number; value: number; star: Card | null }) {
  const img = star && cardImg(star, 'high')
  return (
    <section className="hero-card">
      <span className="hero-ball" aria-hidden="true" />
      <p className="hero-kicker"><PokeballMark size={18} /><span>Ma collection</span></p>
      <p className="hero-value">{eur(value)}</p>
      <p className="hero-sub">{total} carte{total > 1 ? 's' : ''} · {distinct} différente{distinct > 1 ? 's' : ''}</p>
      <div className="hero-progress">
        <span className="bar on-color"><i style={{ width: `${Math.max((ownedByDex().size / DB.dex.length) * 100, ownedByDex().size ? 1.5 : 0)}%` }} /></span>
        <span><b className="pixel">{ownedByDex().size}</b> / {DB.dex.length} Pokémon</span>
      </div>
      {img && <button className="hero-star" onClick={() => sheet.open(star!.id)} aria-label={`Ta carte la plus chère : ${star!.name}`}><img src={img} alt="" /></button>}
    </section>
  )
}

function Sync() {
  if (!user) return (
    <a className="notice" href="#/compte">
      <Icon name="cloud" size={20} stroke={1.8} />
      <span>Crée un compte pour ne jamais perdre ta collection.</span>
      <Icon name="next" size={16} stroke={2.2} />
    </a>
  )
  const time = sync.at ? new Date(sync.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
  const label = { signedout: '', saving: 'Enregistrement…', saved: `Enregistrée sur ton compte${time ? ', ' + time : ''}`, offline: 'Hors ligne, enregistrée au retour du réseau', error: 'Enregistrement impossible pour l’instant' }[sync.status]
  return <p className={'sync ' + sync.status}><Icon name="cloud" size={16} stroke={1.8} />{label}</p>
}
