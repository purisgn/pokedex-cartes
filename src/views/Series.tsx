import { DB, cardImg, fdate, latestSets, type Card, type CardSet, type Serie } from '../data'
import { qty, useStore } from '../store'
import { back } from '../App'
import { CardImg, Header, Icon } from '../ui/kit'

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

// Illustration d'une série : sa carte Pokémon la plus chère (en général la carte phare).
const cover = (s: Serie) => {
  let best: Card | undefined
  for (const st of s.sets) for (const c of st.cards)
    if (c.hasImg && c.category === 'Pokémon' && (!best || (c.price ?? 0) > (best.price ?? 0))) best = c
  return best && cardImg(best, 'high')
}
const years = (s: Serie) => {
  const y = [...new Set(s.sets.map((st) => st.date?.slice(0, 4)).filter(Boolean))].sort()
  return y.length ? (y[0] === y.at(-1) ? y[0] : `${y[0]} – ${y.at(-1)}`) : ''
}

// Liste des séries (maquette « Regiões ») : bannières illustrées, nom et années à gauche.
export function Series() {
  useStore()
  return (
    <div className="page">
      <Header title="Séries" />
      <h2 className="h2">Nouveautés</h2>
      <div className="rail">
        {latestSets(8).map((st) => {
          const { n, of } = progress(st)
          return (
            <a key={st.id} href={'#/set/' + st.id} className="release">
              <span className="release-mark"><SetMark set={st} /></span>
              <span className="release-name">{st.name}</span>
              <span className="release-meta">{fdate(st.date)} · <b className="pixel">{n}</b>/{of}</span>
            </a>
          )
        })}
      </div>
      <h2 className="h2">Toutes les séries</h2>
      <div className="banners">
        {DB.series.map((s) => {
          const img = cover(s)
          const n = s.sets.reduce((a, st) => a + progress(st).n, 0)
          return (
            <a key={s.id} href={'#/serie/' + s.id} className="banner" style={img ? { backgroundImage: `url("${img}")` } : undefined}>
              <span className="banner-txt">
                <b>{s.name}</b>
                <small>{years(s)} · {s.sets.length} extension{s.sets.length > 1 ? 's' : ''}{n ? ` · ${n} possédée${n > 1 ? 's' : ''}` : ''}</small>
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

// Une série : ses extensions, de la plus récente à la plus ancienne.
export function SerieView({ id }: { id: string }) {
  useStore()
  const s = DB.series.find((x) => x.id === id)
  if (!s) return <p className="empty">Série introuvable.</p>
  return (
    <div className="page">
      <Header title={s.name} onBack={back} />
      <p className="lead">{years(s)} · {s.sets.length} extensions</p>
      <div className="sets">
        {s.sets.map((st) => {
          const { n, of } = progress(st)
          return (
            <a key={st.id} href={'#/set/' + st.id} className="set-row">
              <span className="set-mark"><SetMark set={st} /></span>
              <span className="set-info">
                <span className="set-name">{st.name}</span>
                <span className="set-sub">{fdate(st.date)}{st.abbr ? ` · ${st.abbr}` : ''}</span>
                <span className="bar"><i style={{ width: `${Math.min(100, (n / of) * 100)}%` }} /></span>
              </span>
              <span className="set-count"><b className="pixel">{n}</b>/{of}</span>
              <Icon name="next" size={16} stroke={2} />
            </a>
          )
        })}
      </div>
    </div>
  )
}
