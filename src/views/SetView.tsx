import { useState } from 'react'
import { DB, eur, fdate } from '../data'
import { addCard, qty, useStore } from '../store'
import { back } from '../App'
import { CardImg, Header, SelectPill } from '../ui/kit'
import { sheet } from './CardSheet'
import { progress, SetMark } from './Series'

type Filter = 'all' | 'own' | 'miss'

export function SetView({ id }: { id: string }) {
  useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [quick, setQuick] = useState(false)
  const st = DB.sets.get(id)
  if (!st) return <p className="empty">Extension introuvable.</p>
  const { n, of } = progress(st)
  const value = st.cards.reduce((s, c) => s + (c.price ?? 0) * qty(c.id), 0)
  const list = st.cards.filter((c) => filter === 'all' || (filter === 'own') === !!qty(c.id))

  return (
    <div className="page">
      <Header title={st.serie.name} onBack={back} />
      <div className="set-hero">
        <SetMark set={st} big />
        <h1 className="title">{st.name}</h1>
        <p className="subtitle">{fdate(st.date, true)}{st.abbr ? ` · ${st.abbr}` : ''}</p>
        <dl className="stats three">
          <div className="stat"><dt>Possédées</dt><dd><span className="pixel">{n}</span>/{of}</dd></div>
          <div className="stat"><dt>Complétion</dt><dd className="pixel">{Math.round((n / of) * 100)}%</dd></div>
          <div className="stat"><dt>Valeur</dt><dd>{value ? eur(value) : '—'}</dd></div>
        </dl>
      </div>

      <div className="pills">
        <SelectPill label="Afficher" value={filter} onChange={setFilter}
          options={[['all', `Toutes · ${st.cards.length}`], ['own', `Possédées · ${n}`], ['miss', `Manquantes · ${st.cards.length - n}`]]} />
        <label className="toggle">
          <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
          <span className="track"><span className="thumb" /></span>
          Ajout rapide
        </label>
      </div>
      {quick && <p className="hint">Touche une carte pour ajouter un exemplaire.</p>}

      <div className="grid">
        {list.map((c) => (
          <button key={c.id} className={'gcard' + (qty(c.id) ? '' : ' miss')} onClick={() => (quick ? addCard(c.id) : sheet.open(c.id))}>
            <CardImg card={c} />
            {qty(c.id) > 0 && <span className="badge">{qty(c.id)}</span>}
            <span className="gcap"><span className="pixel">{c.localId}</span> · {c.name}</span>
          </button>
        ))}
      </div>
      {!list.length && <p className="empty">Rien ici pour l’instant.</p>}
    </div>
  )
}
