import { useRef, type PointerEvent, type ReactNode } from 'react'
import { DB, eur, fdate, norm, type Card } from '../data'
import { qty, setQty, useStore } from '../store'
import { back, go } from '../App'
import { tcgType, TYPES, type TypeKey } from '../types'
import { useLiveCard, type LiveCard } from '../live'
import { CardImg, Icon, Stat, TypeChip, TypeGlyph, TypeMark } from '../ui/kit'

// Fiche carte, même grammaire que la fiche Pokémon (maquette Junior Saraiva) :
// disque de la couleur du type, la carte en grand à la place du sprite, puces, caractéristiques encadrées.
export function CardPage({ id }: { id: string }) {
  useStore()
  const c = DB.byId.get(id)
  const live = useLiveCard(id)
  if (!c) return <p className="empty">Carte introuvable.</p>
  const t = tcgType(c.type || live.data?.types?.[0])
  const n = qty(c.id)
  const i = c.set.cards.indexOf(c)
  const step = (d: number) => go('card/' + encodeURIComponent(c.set.cards[(i + d + c.set.cards.length) % c.set.cards.length].id))
  const mon = c.dexId.map((d) => DB.dex[d - 1]).find(Boolean)
  const rare = !!c.rarity && !/^(commune|peu commune)$/i.test(c.rarity)
  const trend = live.data?.pricing?.cardmarket?.trend
  const price = typeof trend === 'number' ? trend : c.price

  return (
    <div className="detail" style={{ ['--t' as string]: TYPES[t].color }}>
      <div className="hero card-hero">
        <div className="hero-disc" />
        <TypeMark type={t} className="hero-mark" />
        <button className="hero-arrow left" onClick={() => step(-1)} aria-label="Carte précédente"><Icon name="back" size={20} stroke={2.4} /></button>
        <TiltCard card={c} holo={rare} />
        <button className="hero-arrow right" onClick={() => step(1)} aria-label="Carte suivante"><Icon name="next" size={20} stroke={2.4} /></button>
        <button className="hero-btn left" onClick={back} aria-label="Retour"><Icon name="back" size={26} stroke={2.2} /></button>
        <span className="hero-btn right hero-no pixel">{c.localId}/{c.set.official || c.set.cards.length}</span>
      </div>

      <div className="page">
        <h1 className="title">{c.name}</h1>
        <p className="subtitle"><a href={'#/set/' + c.set.id}>{c.set.name}</a>{c.rarity ? ` · ${c.rarity}` : ''}</p>
        <div className="chips">
          {c.type ? <TypeChip type={t} /> : <span className="chip neutral">{c.category}</span>}
          {c.hp ? <span className="chip neutral">{c.hp} PV</span> : null}
          {mon && <a className="chip outline" href={'#/pokemon/' + mon.id}>Voir {mon.name}<Icon name="next" size={12} stroke={2.4} /></a>}
        </div>

        <Moves live={live.data} loading={!live.done} />

        <dl className="stats">
          <Stat icon="euro" label="Prix Cardmarket">{price ? eur(price) : '—'}</Stat>
          <Stat icon="layers" label="Mes exemplaires">{n}</Stat>
          <Stat icon="calendar" label="Sortie">{fdate(c.set.date) || '—'}</Stat>
          <Stat icon="tag" label="Illustration">{live.data?.illustrator ?? '—'}</Stat>
        </dl>
        <PriceDetail live={live.data} />

        <div className="actions">
          {n ? (
            <div className="stepper">
              <button onClick={() => setQty(c.id, n - 1)} aria-label="Retirer un exemplaire"><Icon name="minus" size={20} stroke={2.2} /></button>
              <span><b>{n}</b> dans ma collection</span>
              <button onClick={() => setQty(c.id, n + 1)} aria-label="Ajouter un exemplaire"><Icon name="plus" size={20} stroke={2.2} /></button>
            </div>
          ) : (
            <button className="btn" onClick={() => setQty(c.id, 1)}>Ajouter à ma collection</button>
          )}
        </div>

        <Versions card={c} />
      </div>
    </div>
  )
}

// La carte suit le doigt : légère inclinaison 3D, reflet, irisation discrète pour les rares.
function TiltCard({ card, holo }: { card: Card; holo: boolean }) {
  const el = useRef<HTMLDivElement>(null)
  const move = (e: PointerEvent) => {
    const r = el.current!.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    el.current!.style.setProperty('--rx', `${(0.5 - y) * 14}deg`)
    el.current!.style.setProperty('--ry', `${(x - 0.5) * 16}deg`)
    el.current!.style.setProperty('--mx', `${x * 100}%`)
    el.current!.style.setProperty('--my', `${y * 100}%`)
    el.current!.classList.add('live')
  }
  const leave = () => el.current?.classList.remove('live')
  return (
    <div ref={el} className={'tilt' + (holo ? ' holo' : '')} onPointerMove={move} onPointerLeave={leave} onPointerUp={leave} onPointerCancel={leave}>
      <CardImg card={card} q="high" />
      <span className="tilt-shine" />
    </div>
  )
}

function Energy({ type, size = 20 }: { type: string; size?: number }) {
  const k: TypeKey = tcgType(type)
  return (
    <span className="energy" title={type} style={{ width: size, height: size, background: TYPES[k].color }}>
      <TypeGlyph type={k} size={size * 0.58} />
    </span>
  )
}

function Moves({ live, loading }: { live: LiveCard | null; loading: boolean }) {
  if (loading) return <div className="moves"><span className="skel" /><span className="skel short" /></div>
  if (!live) return <p className="lore">Attaques et talents s’afficheront avec une connexion.</p>
  const text = live.effect || live.description
  const extra: ReactNode[] = []
  if (live.weaknesses?.length) extra.push(<span key="w" className="meta">Faiblesse {live.weaknesses.map((w) => <span key={w.type} className="inline"><Energy type={w.type} size={16} />{w.value}</span>)}</span>)
  if (live.retreat) extra.push(<span key="r" className="meta">Retraite <span className="cost">{Array.from({ length: live.retreat }, (_, k) => <Energy key={k} type="Incolore" size={16} />)}</span></span>)
  return (
    <div className="moves">
      {live.abilities?.map((a) => (
        <div key={a.name} className="move">
          <div className="move-head"><span className="talent">{a.type}</span><b>{a.name}</b></div>
          <p>{a.effect}</p>
        </div>
      ))}
      {live.attacks?.map((a) => (
        <div key={a.name} className="move">
          <div className="move-head">
            <span className="cost">{(a.cost ?? []).map((e, k) => <Energy key={k} type={e} />)}</span>
            <b>{a.name}</b>
            {a.damage !== undefined && <span className="dmg pixel">{a.damage}</span>}
          </div>
          {a.effect && <p>{a.effect}</p>}
        </div>
      ))}
      {text && <p className="lore">“{text}”</p>}
      {extra.length > 0 && <div className="metas">{extra}</div>}
    </div>
  )
}

function PriceDetail({ live }: { live: LiveCard | null }) {
  const cm = live?.pricing?.cardmarket
  const v = (k: string) => (typeof cm?.[k] === 'number' && (cm[k] as number) > 0 ? eur(cm[k] as number) : null)
  const rows = ([['Plus bas', v('low')], ['Moy. 7 jours', v('avg7')], ['Moy. 30 jours', v('avg30')]] as const).filter(([, x]) => x)
  if (!rows.length) return null
  return <p className="price-line">{rows.map(([l, x]) => <span key={l}>{l} <b>{x}</b></span>)}</p>
}

function Versions({ card }: { card: Card }) {
  const key = card.dexId[0]
  const list = (key ? DB.byDex.get(key) ?? [] : DB.cards.filter((x) => norm(x.name) === norm(card.name)))
    .filter((x) => x.id !== card.id)
    .sort((a, b) => +!!qty(b.id) - +!!qty(a.id) || (b.set.date ?? '').localeCompare(a.set.date ?? ''))
  if (!list.length) return null
  return (
    <>
      <div className="section-head"><h2>Autres versions</h2><span className="muted pixel">{list.length}</span></div>
      <div className="rail">
        {list.slice(0, 30).map((x) => (
          <a key={x.id} href={'#/card/' + encodeURIComponent(x.id)} className={'rail-card' + (qty(x.id) ? '' : ' miss')}>
            <CardImg card={x} />
            {qty(x.id) > 0 && <span className="badge">{qty(x.id)}</span>}
            <span className="gcap">{x.set.name}</span>
          </a>
        ))}
      </div>
    </>
  )
}
