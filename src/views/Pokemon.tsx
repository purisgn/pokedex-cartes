import { useState, type CSSProperties } from 'react'
import { DB, eur } from '../data'
import { GENS, STRONG, TYPES, inkOn, vivid, type TypeKey } from '../types'
import { isFav, ownedByDex, qty, toggleFav, useStore } from '../store'
import { useSpecies, type Evo, type SpeciesInfo } from '../species'
import { back, go } from '../App'
import { AnimSprite, CardImg, FolderTabs, Icon, PokeballMark, Sprite, TypeGlyph } from '../ui/kit'
import { sheet } from './CardSheet'

type Tab = 'about' | 'stats' | 'evo' | 'cards'

// Fiche Pokémon (maquette « Pikachu #025 », UI Study) : toute la page dans la couleur du Pokémon,
// sprite géant dans un grand rond pâle, onglets colorés : infos, statistiques, évolutions, cartes.
export function Pokemon({ id }: { id: number }) {
  useStore()
  const p = DB.dex[id - 1]
  const info = useSpecies(id)
  const all = (DB.byDex.get(id) ?? []).slice().sort((a, b) => +!!qty(b.id) - +!!qty(a.id) || (b.set.date ?? '').localeCompare(a.set.date ?? ''))
  const owned = all.filter((c) => qty(c.id))
  const [tab, setTab] = useState<Tab>('about')
  if (!p) return <p className="empty">Pokémon introuvable.</p>
  const t = p.types[0], color = vivid(TYPES[t].color)
  const nav = (d: number) => go('pokemon/' + (((id - 1 + d + DB.dex.length) % DB.dex.length) + 1))
  const random = () => {
    const mine = [...ownedByDex().keys()]
    const pool = mine.length > 1 ? mine : DB.dex.map((x) => x.id)
    go('pokemon/' + pool[Math.floor(Math.random() * pool.length)])
  }
  const style = { '--t': color, '--ink': inkOn(color) } as CSSProperties

  return (
    <div className="mon-page" style={style}>
      <header className="mon-top">
        <button className="icon-btn" onClick={back} aria-label="Retour"><Icon name="back" size={24} stroke={2.2} /></button>
        <h1><PokeballMark size={22} /><span>{p.name}</span><small className="pixel">#{String(id).padStart(3, '0')}</small></h1>
      </header>

      <div className="mon-stage">
        <div className="mon-disc"><span className="mon-disc-ball" /></div>
        <AnimSprite id={id} className={'mon-sprite' + (owned.length ? '' : ' silhouette')} />
        <button className="mon-arrow left" onClick={() => nav(-1)} aria-label="Pokémon précédent"><Icon name="back" size={18} stroke={2.4} /></button>
        <button className="mon-arrow right" onClick={() => nav(1)} aria-label="Pokémon suivant"><Icon name="next" size={18} stroke={2.4} /></button>
      </div>
      <div className="mon-types">{p.types.map((x) => <span key={x} className="tpill light energy-pill"><span className="type-ico" style={{ background: TYPES[x].color }}><TypeGlyph type={x} size={12} /></span>{TYPES[x].label}</span>)}</div>

      <div className="mon-body">
        <FolderTabs tabs={[['about', 'Infos'], ['stats', 'Stats'], ['evo', 'Évolution'], ['cards', `Cartes${owned.length ? ' · ' + owned.length : ''}`]] as const} value={tab} onChange={setTab} />

        <div className="mon-panel">
        {tab === 'about' && <About info={info.data} done={info.done} types={p.types} fallback={`${p.name}, Pokémon de ${GENS[p.gen - 1]} (${p.gen}ᵉ génération).`} />}
        {tab === 'stats' && <Stats info={info.data} done={info.done} />}
        {tab === 'evo' && <Evolutions info={info.data} done={info.done} current={id} />}
        {tab === 'cards' && <Cards all={all} owned={owned} name={p.name} />}
        </div>
      </div>

      <nav className="mon-bar" aria-label="Actions">
        <a href="#/" aria-label="Pokédex"><Icon name="grid" size={22} stroke={1.8} /></a>
        <button className={isFav(id) ? 'fav' : ''} onClick={() => toggleFav(id)} aria-pressed={isFav(id)} aria-label={isFav(id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}><Icon name="heart" size={24} stroke={1.8} /></button>
        <button onClick={random} aria-label="Pokémon au hasard"><Icon name="shuffle" size={22} stroke={1.8} /></button>
        <a href="#/scan" aria-label="Scanner"><Icon name="scan" size={22} stroke={1.8} /></a>
      </nav>
    </div>
  )
}

const Loading = () => <div className="mon-loading"><span className="skel" /><span className="skel short" /><span className="skel" /></div>

function About({ info, done, types, fallback }: { info: SpeciesInfo | null; done: boolean; types: TypeKey[]; fallback: string }) {
  if (!done) return <Loading />
  const strong = [...new Set(types.flatMap((x) => STRONG[x]))]
  const num = (n?: number, u = '') => (n != null ? `${n.toLocaleString('fr-FR')}${u}` : '—')
  return (
    <div className="about">
      <p className="quote">“{info?.text ?? fallback}”<span> — Pokédex</span></p>
      <dl className="rows-plain">
        <div><dt>Taille</dt><dd>{num(info?.height, ' m')}</dd></div>
        <div><dt>Poids</dt><dd>{num(info?.weight, ' kg')}</dd></div>
        <div><dt>Catégorie</dt><dd>{info?.genus ?? '—'}</dd></div>
        <div><dt>Talent</dt><dd>{info?.ability ?? '—'}</dd></div>
        {strong.length > 0 && (
          <div><dt>Fort contre</dt><dd className="strong">{strong.map((x) => (
            <span key={x} className="strong-ico" title={TYPES[x].label} style={{ background: TYPES[x].color }}><TypeGlyph type={x} size={13} /></span>
          ))}</dd></div>
        )}
      </dl>
      {!info && <p className="hint">Hors ligne : ces informations s’afficheront avec une connexion.</p>}
    </div>
  )
}

const STAT_ROWS = [['hp', 'PV', '#E86A6A'], ['atk', 'ATQ', '#F2A15C'], ['def', 'DÉF', '#F4D23C'], ['satk', 'ATQ S', '#6E9BE6'], ['sdef', 'DÉF S', '#7CC57F'], ['spd', 'VIT', '#F07FA6']] as const

function Stats({ info, done }: { info: SpeciesInfo | null; done: boolean }) {
  if (!done) return <Loading />
  if (!info?.stats) return <p className="hint">Hors ligne : les statistiques s’afficheront avec une connexion.</p>
  const s = info.stats, total = Object.values(s).reduce((a, b) => a + b, 0)
  return (
    <div className="stat-bars">
      {STAT_ROWS.map(([k, l, c]) => (
        <div key={k} className="stat-row">
          <span className="stat-label">{l}</span>
          <span className="stat-num pixel">{s[k]}</span>
          <span className="stat-track"><i style={{ width: `${Math.min(100, (s[k] / 180) * 100)}%`, background: c }} /></span>
        </div>
      ))}
      <div className="stat-row total"><span className="stat-label">Total</span><span className="stat-num pixel">{total}</span><span /></div>
    </div>
  )
}

function Evolutions({ info, done, current }: { info: SpeciesInfo | null; done: boolean; current: number }) {
  if (!done) return <Loading />
  if (!info?.evolution) return <p className="hint">Hors ligne : les évolutions s’afficheront avec une connexion.</p>
  const stages: number[][] = []
  const walk = (e: Evo, d: number) => { (stages[d] ??= []).push(e.id); e.to.forEach((x) => walk(x, d + 1)) }
  walk(info.evolution, 0)
  if (stages.length === 1) return <p className="hint center">Ce Pokémon n’évolue pas.</p>
  return (
    <div className="evo">
      {stages.map((ids, d) => (
        <div key={d} className="evo-stage">
          {d > 0 && <span className="evo-arrow"><Icon name="down" size={18} stroke={2} /></span>}
          <div className="evo-row">
            {ids.filter((x) => DB.dex[x - 1]).map((x) => {
              const q = DB.dex[x - 1], tt = q.types[0]
              return (
                <a key={x} href={'#/pokemon/' + x} className={'evo-mon' + (x === current ? ' current' : '')}>
                  <Sprite id={x} size={72} />
                  <b>{q.name}</b>
                  <span className="tpill sm" style={{ background: TYPES[tt].color, color: inkOn(TYPES[tt].color) }}>{TYPES[tt].label.toLowerCase()}</span>
                </a>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Cards({ all, owned, name }: { all: ReturnType<typeof DB.byDex.get> & object; owned: typeof all; name: string }) {
  const [mine, setMine] = useState(owned.length > 0)
  const shown = mine ? owned : all
  const value = owned.reduce((s, c) => s + (c.price ?? 0) * qty(c.id), 0)
  return (
    <>
      <div className="cards-head">
        <span><b className="pixel">{owned.length}</b> / {all.length} versions{value ? ` · ${eur(value)}` : ''}</span>
        <div className="seg small">
          <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>Les miennes</button>
          <button className={mine ? '' : 'on'} onClick={() => setMine(false)}>Toutes</button>
        </div>
      </div>
      {shown.length ? (
        <div className="grid">
          {shown.map((c) => (
            <button key={c.id} className={'gcard' + (qty(c.id) ? '' : ' miss')} onClick={() => sheet.open(c.id)}>
              <CardImg card={c} />
              {qty(c.id) > 0 && <span className="badge">{qty(c.id)}</span>}
              <span className="gcap">{c.set.name}</span>
            </button>
          ))}
        </div>
      ) : <p className="hint center">Tu n’as pas encore de carte de {name}.</p>}
    </>
  )
}
