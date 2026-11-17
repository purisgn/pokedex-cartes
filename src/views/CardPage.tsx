import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { DB, cardTint, eur, fdate, norm, type Card } from '../data'
import { qty, setQty, useStore } from '../store'
import { back, go } from '../App'
import { inkOn, tcgType, TYPES, type TypeKey } from '../types'
import { useLiveCard, type LiveCard } from '../live'
import { CardImg, Icon, Sprite, TypeGlyph } from '../ui/kit'
import { SetMark } from './Series'

// Fiche carte (maquette « Pokedesk ») : la carte en grand sur un fond teinté quadrillé,
// puis un panneau blanc : extension, prix et tendance, quantité, attaques et autres versions.
export function CardPage({ id }: { id: string }) {
  useStore()
  const c = DB.byId.get(id)
  const live = useLiveCard(id)
  const [tab, setTab] = useState<'moves' | 'versions'>('moves')
  if (!c) return <p className="empty">Carte introuvable.</p>
  const t = tcgType(c.type || live.data?.types?.[0])
  const color = cardTint(c) ?? TYPES[t].color
  const n = qty(c.id)
  const i = c.set.cards.indexOf(c)
  const step = (d: number) => i >= 0 && go('card/' + encodeURIComponent(c.set.cards[(i + d + c.set.cards.length) % c.set.cards.length].id))
  const mon = c.dexId.map((d) => DB.dex[d - 1]).find(Boolean)
  const rare = !!c.rarity && !/^(commune|peu commune)$/i.test(c.rarity)
  const trend = live.data?.pricing?.cardmarket?.trend
  const price = typeof trend === 'number' ? trend : c.price

  return (
    <div className="cp" style={{ '--t': color, '--ink': inkOn(color) } as CSSProperties}>
      <section className="cp-stage">
        <header className="cp-top">
          <button className="round light" onClick={back} aria-label="Retour"><Icon name="back" size={22} stroke={2.2} /></button>
          <span className="cp-num pixel">{c.localId}<small>/{c.set.official || c.set.cards.length}</small></span>
        </header>
        <div className="cp-card">
          {i >= 0 && <button className="cp-arrow" onClick={() => step(-1)} aria-label="Carte précédente"><Icon name="back" size={18} stroke={2.4} /></button>}
          <TiltCard card={c} holo={rare} />
          {i >= 0 && <button className="cp-arrow" onClick={() => step(1)} aria-label="Carte suivante"><Icon name="next" size={18} stroke={2.4} /></button>}
        </div>
        <div className="cp-title">
          <h1>{c.name}</h1>
          <p>
            <span className="cp-type" style={{ background: TYPES[t].color }}><TypeGlyph type={t} size={11} /></span>
            {c.rarity || c.category}{c.hp ? <> · <span className="pixel">{c.hp}</span> PV</> : null}
          </p>
        </div>
      </section>

      <section className="cp-sheet">
        <a className="cp-row" href={'#/set/' + c.set.id}>
          <span className="cp-set-mark"><SetMark set={c.set} /></span>
          <span className="cp-row-txt"><b>{c.set.name}</b><small>{c.set.serie.name} · {fdate(c.set.date)}</small></span>
          <Icon name="next" size={18} stroke={2} />
        </a>

        <div className="cp-price">
          <div>
            <small>Prix moyen Cardmarket</small>
            <b>{price ? eur(price) : '—'}</b>
            <Trend live={live.data} />
          </div>
          {n > 0 && price ? <div className="cp-mine"><small>Tes {n}</small><b>{eur(price * n)}</b></div> : null}
        </div>

        <div className="cp-own">
          {n ? (
            <>
              <div className="qty">
                <button onClick={() => setQty(c.id, n - 1)} aria-label="Retirer un exemplaire"><Icon name="minus" size={18} stroke={2.4} /></button>
                <b className="pixel" aria-live="polite">{n}</b>
                <button onClick={() => setQty(c.id, n + 1)} aria-label="Ajouter un exemplaire"><Icon name="plus" size={18} stroke={2.4} /></button>
              </div>
              <p className="cp-own-txt"><span className="ok-dot"><Icon name="check" size={11} stroke={3} /></span>Dans ta collection</p>
            </>
          ) : (
            <button className="btn" onClick={() => setQty(c.id, 1)}><Icon name="plus" size={18} stroke={2.4} />Ajouter à ma collection</button>
          )}
        </div>

        {mon && (
          <a className="cp-row" href={'#/pokemon/' + mon.id}>
            <span className="cp-mon"><Sprite id={mon.id} size={56} /></span>
            <span className="cp-row-txt"><b>{mon.name}</b><small>Voir sa fiche Pokédex</small></span>
            <Icon name="next" size={18} stroke={2} />
          </a>
        )}

        <div className="seg block">
          <button className={tab === 'moves' ? 'on' : ''} onClick={() => setTab('moves')}>{c.category === 'Pokémon' ? 'Attaques' : 'Effet'}</button>
          <button className={tab === 'versions' ? 'on' : ''} onClick={() => setTab('versions')}>Autres versions</button>
        </div>
        {tab === 'moves' ? <Moves live={live.data} loading={!live.done} /> : <Versions card={c} />}
        {tab === 'moves' && live.data?.illustrator && <p className="hint center">Illustration de {live.data.illustrator}</p>}
      </section>
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
  return <span className="energy" title={type} style={{ width: size, height: size, background: TYPES[k].color }}><TypeGlyph type={k} size={size * 0.58} /></span>
}

function Moves({ live, loading }: { live: LiveCard | null; loading: boolean }) {
  if (loading) return <div className="moves"><span className="skel" /><span className="skel short" /></div>
  if (!live) return <p className="hint center">Les attaques s’afficheront avec une connexion.</p>
  const text = live.effect || live.description
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
            {a.damage !== undefined && <span className="dmg">{a.damage}</span>}
          </div>
          {a.effect && <p>{a.effect}</p>}
        </div>
      ))}
      {text && <p className="lore">{text}</p>}
      {(live.weaknesses?.length || live.retreat) ? (
        <div className="metas">
          {live.weaknesses?.map((w) => <span key={w.type} className="meta">Faiblesse <Energy type={w.type} size={16} /><b>{w.value}</b></span>)}
          {live.resistances?.map((w) => <span key={w.type} className="meta">Résistance <Energy type={w.type} size={16} /><b>{w.value}</b></span>)}
          {live.retreat ? <span className="meta">Retraite <span className="cost">{Array.from({ length: live.retreat }, (_, k) => <Energy key={k} type="Incolore" size={16} />)}</span></span> : null}
        </div>
      ) : null}
    </div>
  )
}

// Tendance : moyenne des 7 derniers jours comparée à celle des 30 derniers.
function Trend({ live }: { live: LiveCard | null }) {
  const cm = live?.pricing?.cardmarket
  const a7 = typeof cm?.avg7 === 'number' ? cm.avg7 : null, a30 = typeof cm?.avg30 === 'number' ? cm.avg30 : null
  if (!a7 || !a30) return null
  const d = (a7 - a30) / a30
  if (Math.abs(d) < 0.01) return <span className="trend flat">Stable sur 30 jours</span>
  return <span className={'trend ' + (d > 0 ? 'up' : 'down')}><Icon name={d > 0 ? 'up' : 'downtrend'} size={14} stroke={2.2} />{d > 0 ? '+' : ''}{Math.round(d * 100)} % en 7 jours</span>
}

function Versions({ card }: { card: Card }) {
  const key = card.dexId[0]
  const list = (key ? DB.byDex.get(key) ?? [] : DB.cards.filter((x) => x.hasImg && x.set.img && norm(x.name) === norm(card.name)))
    .filter((x) => x.id !== card.id)
    .sort((a, b) => +!!qty(b.id) - +!!qty(a.id) || (b.set.date ?? '').localeCompare(a.set.date ?? ''))
  if (!list.length) return <p className="hint center">Aucune autre version de cette carte.</p>
  return (
    <div className="grid">
      {list.slice(0, 60).map((x) => (
        <a key={x.id} href={'#/card/' + encodeURIComponent(x.id)} className={'gcard' + (qty(x.id) ? '' : ' miss')}>
          <CardImg card={x} />
          {qty(x.id) > 0 && <span className="badge pixel">×{qty(x.id)}</span>}
          <span className="gcap">{x.set.name}</span>
        </a>
      ))}
    </div>
  )
}
