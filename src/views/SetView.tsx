import { useState } from 'react'
import { DB, eur, fdate } from '../data'
import { addCard, qty, useStore } from '../store'
import { back } from '../App'
import { CardImg, Icon } from '../ui/kit'
import { sheet } from './CardSheet'
import { progress, SetMark } from './Series'

export function SetView({ id }: { id: string }) {
  useStore()
  const [filter, setFilter] = useState<'all' | 'own' | 'miss'>('all')
  const [quick, setQuick] = useState(false)
  const st = DB.sets.get(id)
  if (!st) return <p className="empty">Extension introuvable.</p>
  const { n, of } = progress(st)
  const value = st.cards.reduce((s, c) => s + (c.price ?? 0) * qty(c.id), 0)
  const list = st.cards.filter((c) => filter === 'all' || (filter === 'own') === !!qty(c.id))

  return (
    <div className="page">
      <header className="bar-head">
        <button className="icon-btn" onClick={back} aria-label="Retour"><Icon name="back" size={26} stroke={2} /></button>
        <span className="bar-title">{st.serie.name}</span>
        <span className="icon-btn" />
      </header>

      <div className="set-hero">
        <SetMark set={st} big />
        <h1>{st.name}</h1>
        <p className="sub">{st.abbr ? st.abbr + ' · ' : ''}{fdate(st.date, true)}</p>
        <p className="set-score"><b>{n}</b> / {of}{value ? <span> · {eur(value)}</span> : null}</p>
        <span className="bar wide"><i style={{ width: `${Math.min(100, (n / of) * 100)}%` }} /></span>
      </div>

      <div className="toolbar">
        <div className="seg">
          {(['all', 'own', 'miss'] as const).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{{ all: 'Toutes', own: 'Possédées', miss: 'Manquantes' }[f]}</button>
          ))}
        </div>
        <label className="switch">
          <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
          <span className="track"><span className="thumb" /></span>
          <span>Ajout rapide</span>
        </label>
      </div>
      {quick && <p className="hint">Touche une carte pour ajouter un exemplaire.</p>}

      <div className="grid">
        {list.map((c) => (
          <button key={c.id} className={'gcard' + (qty(c.id) ? '' : ' miss')} onClick={() => (quick ? addCard(c.id) : sheet.open(c.id))}>
            <CardImg card={c} />
            {qty(c.id) > 0 && <span className="badge">{qty(c.id)}</span>}
            <span className="gcap">{c.localId} · {c.name}</span>
          </button>
        ))}
      </div>
      {!list.length && <p className="empty">Rien ici pour l’instant.</p>}
    </div>
  )
}
