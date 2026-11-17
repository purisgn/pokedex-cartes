import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { DB, cardTint, eur, fdate, norm, type Card } from '../data'
import { qty, setQty, useStore } from '../store'
import { back, go } from '../App'
import { ENERGY, energyOf, inkOn, vivid } from '../types'
import { useLiveCard, type LiveCard } from '../live'
import { CardImg, Energy, FolderTabs, Icon, usePageColor, PokeballMark, Sprite } from '../ui/kit'

type Tab = 'infos' | 'moves' | 'price' | 'versions'

// Fiche carte dans la grammaire de la fiche Pokémon (maquette « Pikachu #025 », UI Study) :
// toute la page dans la couleur de la carte, la carte en grand dans le rond pâle, onglets colorés,
// caractéristiques en lignes libellé / valeur, ajout dans la barre flottante.
export function CardPage({ id }: { id: string }) {
  useStore()
  const c = DB.byId.get(id)
  const live = useLiveCard(id)
  const [tab, setTab] = useState<Tab>('infos')
  const e = energyOf(c?.type || live.data?.types?.[0])
  const color = c ? vivid(cardTint(c) ?? ENERGY[e].color) : '#FFFFFF'
  usePageColor(color)
  if (!c) return <p className="empty">Carte introuvable.</p>
  const n = qty(c.id)
  const i = c.set.cards.indexOf(c)
  const step = (d: number) => i >= 0 && go('card/' + encodeURIComponent(c.set.cards[(i + d + c.set.cards.length) % c.set.cards.length].id))
  const rare = !!c.rarity && !/^(commune|peu commune)$/i.test(c.rarity)
  const pokemon = c.category === 'Pokémon'

  return (
    <div className="mon-page card-v" style={{ '--t': color, '--ink': inkOn(color) } as CSSProperties}>
      <header className="mon-top">
        <button className="icon-btn" onClick={back} aria-label="Retour"><Icon name="back" size={24} stroke={2.2} /></button>
        <h1><PokeballMark size={22} /><span>{c.name}</span><small className="pixel">#{c.localId}</small></h1>
      </header>

      <div className="mon-stage card-stage">
        <div className="mon-disc"><span className="mon-disc-ball" /></div>
        <TiltCard card={c} holo={rare} />
        {i >= 0 && <button className="mon-arrow left" onClick={() => step(-1)} aria-label="Carte précédente de l’extension"><Icon name="back" size={18} stroke={2.4} /></button>}
        {i >= 0 && <button className="mon-arrow right" onClick={() => step(1)} aria-label="Carte suivante de l’extension"><Icon name="next" size={18} stroke={2.4} /></button>}
      </div>
      <div className="mon-types">
        <span className="tpill light energy-pill"><Energy type={c.type || live.data?.types?.[0]} size={20} />{c.type ? ENERGY[e].label : c.category}</span>
        {c.rarity && <span className="tpill light">{c.rarity.toLowerCase()}</span>}
      </div>

      <div className="mon-body">
        <FolderTabs tabs={[['infos', 'Infos'], ['moves', pokemon ? 'Attaques' : 'Effet'], ['price', 'Prix'], ['versions', 'Versions']] as const} value={tab} onChange={setTab} />
        <div className="mon-panel"><div className="tab-pane" key={tab}>
          {tab === 'infos' && <Infos card={c} live={live.data} />}
          {tab === 'moves' && <Moves live={live.data} loading={!live.done} />}
          {tab === 'price' && <Price card={c} live={live.data} owned={n} />}
          {tab === 'versions' && <Versions card={c} />}
        </div></div>
      </div>

      <nav className="mon-bar card-bar" aria-label="Ma collection">
        <button onClick={() => setQty(c.id, n - 1)} disabled={!n} aria-label="Retirer un exemplaire"><Icon name="minus" size={20} stroke={2.2} /></button>
        <span className="card-bar-n"><b className="pixel num-pop" key={n}>{n}</b>{n > 1 ? 'exemplaires' : 'exemplaire'}</span>
        <button className="card-bar-add" onClick={() => setQty(c.id, n + 1)} aria-label="Ajouter un exemplaire"><Icon name="plus" size={20} stroke={2.6} /></button>
      </nav>
    </div>
  )
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => <div><dt>{label}</dt><dd>{children}</dd></div>

function Infos({ card: c, live }: { card: Card; live: LiveCard | null }) {
  const mon = c.dexId.map((d) => DB.dex[d - 1]).find(Boolean)
  const type = c.type || live?.types?.[0]
  return (
    <div className="about">
      {(live?.description || live?.effect) && c.category !== 'Pokémon' ? <p className="quote">“{live.effect || live.description}”</p> : null}
      <dl className="rows-plain">
        <Row label="Extension"><a className="row-link" href={'#/set/' + c.set.id}>{c.set.name}<Icon name="next" size={14} stroke={2.4} /></a></Row>
        <Row label="Numéro"><span className="pixel">{c.localId}</span> / {c.set.official || c.set.cards.length}{c.set.abbr ? ` · ${c.set.abbr}` : ''}</Row>
        {c.rarity && <Row label="Rareté">{c.rarity}</Row>}
        <Row label="Type"><span className="row-type">{type && <Energy type={type} size={22} />}{type ? ENERGY[energyOf(type)].label : c.category}</span></Row>
        {c.hp ? <Row label="PV"><span className="pixel">{c.hp}</span></Row> : null}
        {live?.stage && <Row label="Stade">{live.stage}{live.evolveFrom ? `, évolue de ${live.evolveFrom}` : ''}</Row>}
        {!live?.stage && live?.trainerType && <Row label="Catégorie">{live.trainerType}</Row>}
        {mon && <Row label="Pokémon"><a className="row-link" href={'#/pokemon/' + mon.id}><Sprite id={mon.id} size={32} className="row-sprite" />{mon.name}<Icon name="next" size={14} stroke={2.4} /></a></Row>}
        <Row label="Sortie">{fdate(c.set.date, true) || '—'}</Row>
        {live?.illustrator && <Row label="Illustration">{live.illustrator}</Row>}
        {live?.regulationMark && <Row label="Règlement"><span className="reg pixel">{live.regulationMark}</span></Row>}
      </dl>
      {!live && <p className="hint">Hors ligne : stade, illustrateur et règlement s’afficheront avec une connexion.</p>}
    </div>
  )
}


function Moves({ live, loading }: { live: LiveCard | null; loading: boolean }) {
  if (loading) return <div className="mon-loading"><span className="skel" /><span className="skel short" /></div>
  if (!live) return <p className="hint">Hors ligne : les attaques s’afficheront avec une connexion.</p>
  const text = live.effect || live.description
  return (
    <div className="about">
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
      {text && !live.attacks?.length && <p className="quote">“{text}”</p>}
      {(live.weaknesses?.length || live.resistances?.length || live.retreat) ? (
        <dl className="rows-plain">
          {live.weaknesses?.length ? <Row label="Faiblesse"><span className="row-type">{live.weaknesses.map((w) => <span key={w.type} className="inline"><Energy type={w.type} size={20} /><b>{w.value}</b></span>)}</span></Row> : null}
          {live.resistances?.length ? <Row label="Résistance"><span className="row-type">{live.resistances.map((w) => <span key={w.type} className="inline"><Energy type={w.type} size={20} /><b>{w.value}</b></span>)}</span></Row> : null}
          {live.retreat ? <Row label="Retraite"><span className="cost">{Array.from({ length: live.retreat }, (_, k) => <Energy key={k} type="Incolore" size={20} />)}</span></Row> : null}
        </dl>
      ) : null}
    </div>
  )
}

function Price({ card, live, owned }: { card: Card; live: LiveCard | null; owned: number }) {
  const cm = live?.pricing?.cardmarket
  const num = (k: string) => (typeof cm?.[k] === 'number' && (cm[k] as number) > 0 ? (cm[k] as number) : null)
  const trend = num('trend') ?? card.price
  const a7 = num('avg7'), a30 = num('avg30')
  const d = a7 && a30 ? (a7 - a30) / a30 : null
  return (
    <div className="about">
      <div className="price-big">
        <span>Prix moyen Cardmarket</span>
        <b>{trend ? eur(trend) : '—'}</b>
        {d !== null && Math.abs(d) >= 0.01 && <em className={d > 0 ? 'up' : 'down'}><Icon name={d > 0 ? 'up' : 'downtrend'} size={14} stroke={2.2} />{d > 0 ? '+' : ''}{Math.round(d * 100)} % en 7 jours</em>}
      </div>
      <dl className="rows-plain">
        {num('low') && <Row label="Plus bas">{eur(num('low')!)}</Row>}
        {a7 && <Row label="Moy. 7 jours">{eur(a7)}</Row>}
        {a30 && <Row label="Moy. 30 jours">{eur(a30)}</Row>}
        {num('trend-holo') && <Row label="Version holo">{eur(num('trend-holo')!)}</Row>}
        {owned > 0 && trend ? <Row label={`Tes ${owned}`}><b>{eur(trend * owned)}</b></Row> : null}
      </dl>
      <a className="text-link" href={`https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=${encodeURIComponent(card.name)}`} target="_blank" rel="noreferrer">Voir les offres sur Cardmarket <Icon name="next" size={14} stroke={2.4} /></a>
    </div>
  )
}

function Versions({ card }: { card: Card }) {
  const key = card.dexId[0]
  const list = (key ? DB.byDex.get(key) ?? [] : DB.cards.filter((x) => x.hasImg && x.set.img && norm(x.name) === norm(card.name)))
    .filter((x) => x.id !== card.id)
    .sort((a, b) => +!!qty(b.id) - +!!qty(a.id) || (b.set.date ?? '').localeCompare(a.set.date ?? ''))
  if (!list.length) return <p className="hint">Aucune autre version de cette carte.</p>
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
