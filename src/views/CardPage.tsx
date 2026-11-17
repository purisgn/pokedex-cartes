import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { DB, eur, fdate, norm, type Card } from '../data'
import { qty, setQty, useStore } from '../store'
import { back, go } from '../App'
import { tcgType, TYPES, type TypeKey } from '../types'
import { useLiveCard, type LiveCard } from '../live'
import { Ball, CardImg, Icon, Sprite, TypeGlyph, pastel } from '../ui/kit'

type Tab = 'infos' | 'prix' | 'versions'

// Fiche carte, dans la grammaire de la fiche Pokémon (maquette « UI Study ») : fond pastel du type,
// la carte en grand qui s'incline et brille sous le doigt, onglets en pilule, barre d'action flottante.
export function CardPage({ id }: { id: string }) {
  useStore()
  const c = DB.byId.get(id)
  const [tab, setTab] = useState<Tab>('infos')
  const live = useLiveCard(id)
  if (!c) return <p className="empty">Carte introuvable.</p>
  const t = tcgType(c.type || live.data?.types?.[0])
  const n = qty(c.id)
  const i = c.set.cards.indexOf(c)
  const step = (d: number) => go('card/' + encodeURIComponent(c.set.cards[(i + d + c.set.cards.length) % c.set.cards.length].id))
  const mons = c.dexId.map((d) => DB.dex[d - 1]).filter(Boolean)
  const rare = !/^(commune|peu commune)$/i.test(c.rarity) && !!c.rarity

  return (
    <div className="detail cardpage" style={{ ['--c' as string]: TYPES[t].color, ['--p' as string]: pastel(t, 45), ['--pp' as string]: pastel(t, 16) }}>
      <header className="detail-top">
        <button className="tb-btn" onClick={back} aria-label="Retour"><Icon name="back" size={22} stroke={2} /></button>
        <h1><Ball className="mini-ball" /><span className="cp-name">{c.name}</span></h1>
        <span className="cp-no">{c.localId}<small>/{c.set.official || c.set.cards.length}</small></span>
      </header>

      <div className="stage">
        <button className="stage-arrow" onClick={() => step(-1)} aria-label="Carte précédente de l’extension"><Icon name="back" size={18} stroke={2.2} /></button>
        <div className="cp-stage">
          <div className="stage-disc cp-disc"><Ball className="stage-ball" /></div>
          <TiltCard card={c} holo={rare} />
        </div>
        <button className="stage-arrow" onClick={() => step(1)} aria-label="Carte suivante de l’extension"><Icon name="next" size={18} stroke={2.2} /></button>
      </div>

      <div className="stage-types">
        <span className="tpill" style={{ background: TYPES[t].color }}>{c.type ? c.type.toLowerCase() : c.category.toLowerCase()}</span>
        {c.rarity && <span className="tpill soft">{c.rarity.toLowerCase()}</span>}
        {c.hp ? <span className="tpill soft">{c.hp} PV</span> : null}
      </div>

      <div className="page">
        <div className="cp-links">
          {mons.slice(0, 2).map((p) => (
            <a key={p.id} href={'#/pokemon/' + p.id} className="cp-link" style={{ background: pastel(p.types[0], 80) }}>
              <Sprite id={p.id} size={40} className="cp-link-sprite" />
              <span>{p.name}</span><Icon name="next" size={14} stroke={2.4} />
            </a>
          ))}
          <a href={'#/set/' + c.set.id} className="cp-link set">
            <span>{c.set.name}</span><Icon name="next" size={14} stroke={2.4} />
          </a>
        </div>

        <div className="tabs" role="tablist">
          {([['infos', 'Infos'], ['prix', 'Prix'], ['versions', 'Versions']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'infos' && <Infos card={c} live={live.data} loading={!live.done} />}
        {tab === 'prix' && <Prices card={c} live={live.data} loading={!live.done} owned={n} />}
        {tab === 'versions' && <Versions card={c} />}
      </div>

      <div className="cp-action">
        {n ? (
          <div className="cp-stepper">
            <button onClick={() => setQty(c.id, n - 1)} aria-label="Retirer un exemplaire"><Icon name="minus" size={20} stroke={2.2} /></button>
            <span><b>{n}</b> exemplaire{n > 1 ? 's' : ''}</span>
            <button className="plus" onClick={() => setQty(c.id, n + 1)} aria-label="Ajouter un exemplaire"><Icon name="plus" size={20} stroke={2.2} /></button>
          </div>
        ) : (
          <button className="cp-add" onClick={() => setQty(c.id, 1)}><Icon name="plus" size={20} stroke={2.4} />Ajouter à ma collection</button>
        )}
      </div>
    </div>
  )
}

// La carte suit le doigt : légère inclinaison 3D, reflet, et irisation pour les cartes rares.
function TiltCard({ card, holo }: { card: Card; holo: boolean }) {
  const el = useRef<HTMLDivElement>(null)
  const move = (e: PointerEvent) => {
    const r = el.current!.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    el.current!.style.setProperty('--rx', `${(0.5 - y) * 16}deg`)
    el.current!.style.setProperty('--ry', `${(x - 0.5) * 18}deg`)
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
      <TypeGlyph type={k} size={size * 0.6} />
    </span>
  )
}

function Infos({ card, live, loading }: { card: Card; live: LiveCard | null; loading: boolean }) {
  if (loading) return <div className="panel"><span className="skel" /><span className="skel short" /><span className="skel" /></div>
  const text = live?.effect || live?.description
  return (
    <>
      {(live?.abilities?.length || live?.attacks?.length || text) ? (
        <div className="panel moves">
          {live?.abilities?.map((a) => (
            <div key={a.name} className="move">
              <div className="move-head"><span className="talent">{a.type}</span><b>{a.name}</b></div>
              <p>{a.effect}</p>
            </div>
          ))}
          {live?.attacks?.map((a) => (
            <div key={a.name} className="move">
              <div className="move-head">
                <span className="cost">{(a.cost ?? []).map((e, k) => <Energy key={k} type={e} />)}</span>
                <b>{a.name}</b>
                {a.damage !== undefined && <span className="dmg">{a.damage}</span>}
              </div>
              {a.effect && <p>{a.effect}</p>}
            </div>
          ))}
          {text && <p className="quote">« {text} »</p>}
        </div>
      ) : null}

      <div className="panel">
        <dl className="rows">
          {live?.weaknesses?.length ? <Row label="Faiblesse">{live.weaknesses.map((w) => <span key={w.type} className="inline"><Energy type={w.type} size={18} />{w.value}</span>)}</Row> : null}
          {live?.resistances?.length ? <Row label="Résistance">{live.resistances.map((w) => <span key={w.type} className="inline"><Energy type={w.type} size={18} />{w.value}</span>)}</Row> : null}
          {live?.retreat ? <Row label="Retraite"><span className="cost">{Array.from({ length: live.retreat }, (_, k) => <Energy key={k} type="Incolore" size={18} />)}</span></Row> : null}
          {live?.stage && <Row label="Stade">{live.stage}{live.evolveFrom ? ` · évolue de ${live.evolveFrom}` : ''}</Row>}
          {!live?.stage && live?.trainerType && <Row label="Catégorie">{live.trainerType}</Row>}
          <Row label="Extension">{card.set.name}{card.set.abbr ? ` · ${card.set.abbr}` : ''}</Row>
          <Row label="Sortie">{fdate(card.set.date, true) || '—'}</Row>
          {live?.illustrator && <Row label="Illustration">{live.illustrator}</Row>}
          {live?.regulationMark && <Row label="Marque de règlement">{live.regulationMark}</Row>}
        </dl>
      </div>
      {!live && <p className="hint">Hors ligne : attaques et détails s’afficheront avec une connexion.</p>}
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>
}

function Prices({ card, live, loading, owned }: { card: Card; live: LiveCard | null; loading: boolean; owned: number }) {
  const cm = live?.pricing?.cardmarket ?? null
  const num = (k: string) => (typeof cm?.[k] === 'number' ? (cm[k] as number) : null)
  const trend = num('trend') ?? card.price
  const items: [string, number | null][] = [
    ['Plus bas', num('low')], ['Moyenne 7 jours', num('avg7')], ['Moyenne 30 jours', num('avg30')],
    ['Tendance holo', num('trend-holo')],
  ]
  return (
    <>
      <div className="panel price-hero">
        <span>Tendance Cardmarket</span>
        <b>{trend ? eur(trend) : '—'}</b>
        {owned > 0 && trend ? <small>Tes {owned} exemplaire{owned > 1 ? 's' : ''} : {eur(trend * owned)}</small> : null}
      </div>
      {loading ? <div className="panel"><span className="skel" /><span className="skel short" /></div> : (
        <div className="price-grid">
          {items.filter(([, v]) => v !== null && v > 0).map(([l, v]) => <div key={l}><span>{l}</span><b>{eur(v!)}</b></div>)}
        </div>
      )}
      <a className="btn ghost" href={`https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=${encodeURIComponent(card.name)}`} target="_blank" rel="noreferrer">Voir sur Cardmarket</a>
    </>
  )
}

function Versions({ card }: { card: Card }) {
  const key = card.dexId[0]
  const list = (key ? DB.byDex.get(key) ?? [] : DB.cards.filter((x) => norm(x.name) === norm(card.name)))
    .filter((x) => x.id !== card.id)
    .sort((a, b) => +!!qty(b.id) - +!!qty(a.id) || (b.set.date ?? '').localeCompare(a.set.date ?? ''))
  if (!list.length) return <p className="empty">Aucune autre version de cette carte.</p>
  return (
    <div className="grid">
      {list.map((x) => (
        <a key={x.id} href={'#/card/' + encodeURIComponent(x.id)} className={'gcard' + (qty(x.id) ? '' : ' miss')}>
          <CardImg card={x} />
          {qty(x.id) > 0 && <span className="badge">{qty(x.id)}</span>}
          <span className="gcap">{x.set.name}</span>
        </a>
      ))}
    </div>
  )
}
