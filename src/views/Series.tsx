import { useState } from 'react'
import { DB, fdate, latestSets, type CardSet } from '../data'
import { qty, useStore } from '../store'
import { CardImg, Icon } from '../ui/kit'

export const progress = (st: CardSet) => {
  let n = 0
  for (const c of st.cards) if (qty(c.id)) n++
  return { n, of: st.official || st.cards.length }
}

// Logo de l'extension, ou à défaut un éventail de ses trois dernières cartes (les plus rares).
export function SetMark({ set, big }: { set: CardSet; big?: boolean }) {
  if (set.logo) return <img className={'set-logo' + (big ? ' big' : '')} src={set.logo} alt="" />
  const picks = set.cards.filter((c) => c.hasImg).slice(-3)
  if (!picks.length) return <span className="set-abbr">{set.abbr ?? set.name.slice(0, 3)}</span>
  return <span className={'fan' + (big ? ' big' : '')}>{picks.map((c) => <CardImg key={c.id} card={c} />)}</span>
}

export function Series() {
  useStore()
  const [open, setOpen] = useState<string | null>(() => sessionStorage.getItem('serie-open') ?? DB.series[0]?.id ?? null)
  const toggle = (id: string) => { const v = open === id ? '' : id; setOpen(v); sessionStorage.setItem('serie-open', v) }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Séries</h1>
        <p className="count">{DB.sets.size} extensions françaises · à jour au {fdate(DB.updated, true)}</p>
      </header>

      <h2 className="h2">Dernières sorties</h2>
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

      <h2 className="h2">Toutes les séries</h2>
      <ul className="series">
        {DB.series.map((s) => {
          const isOpen = open === s.id
          const n = s.sets.reduce((a, st) => a + progress(st).n, 0)
          const years = [...new Set(s.sets.map((st) => st.date?.slice(0, 4)).filter(Boolean))].sort()
          return (
            <li key={s.id} className={isOpen ? 'open' : ''}>
              <button className="serie-head" onClick={() => toggle(s.id)} aria-expanded={isOpen}>
                <span className="serie-name">{s.name}</span>
                <span className="serie-meta">{years.length ? (years[0] === years.at(-1) ? years[0] : `${years[0]}–${years.at(-1)}`) : ''}{n ? ` · ${n}` : ''}</span>
                <Icon name="chevron" size={20} />
              </button>
              {isOpen && (
                <div className="sets">
                  {s.sets.map((st) => {
                    const { n, of } = progress(st)
                    return (
                      <a key={st.id} href={'#/set/' + st.id} className="set-row">
                        <span className="set-mark"><SetMark set={st} /></span>
                        <span className="set-info">
                          <span className="set-name">{st.name}</span>
                          <span className="bar"><i style={{ width: `${Math.min(100, (n / of) * 100)}%` }} /></span>
                        </span>
                        <span className="set-count"><b>{n}</b>/{of}</span>
                      </a>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
