import { useEffect, useMemo, useRef, useState } from 'react'
import { DB } from '../data'
import { ownedByDex, useStore } from '../store'
import { back, go } from '../App'
import { TYPES, inkOn } from '../types'
import { Icon, Sprite, TypeGlyph, usePageColor } from '../ui/kit'
import { REGIONS } from '../world/map'
import { WorldEngine } from '../world/engine'

// « Mon monde » : une grande carte en pixel art, découpée en régions, où vivent tous les Pokémon possédés en carte.
export function World() {
  useStore()
  usePageColor('#2C5E2A', '#2C5E2A')
  const ids = useMemo(() => [...ownedByDex().keys()].filter((id) => DB.dex[id - 1]).slice(0, 260), [])
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<WorldEngine | null>(null)
  const rail = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [region, setRegion] = useState(4)
  const [picked, setPicked] = useState<number | null>(null)
  const [zoom, setZoom] = useState(2)
  const [counts, setCounts] = useState<number[]>([])

  useEffect(() => {
    if (!ids.length) return
    // Laisse l'écran de chargement s'afficher, puis dessine le monde (une fraction de seconde).
    const t = setTimeout(() => {
      if (!canvas.current) return
      const e = new WorldEngine(canvas.current, ids, { pick: setPicked, region: setRegion })
      engine.current = e
      setCounts(REGIONS.map((_, r) => e.countIn(r)))
      e.start(); setReady(true)
    }, 60)
    const resize = () => engine.current?.resize()
    addEventListener('resize', resize)
    const vis = () => { if (document.hidden) engine.current?.stop(); else engine.current?.start() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearTimeout(t); engine.current?.stop(); removeEventListener('resize', resize); document.removeEventListener('visibilitychange', vis) }
  }, [ids])

  useEffect(() => { rail.current?.querySelector('.on')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }) }, [region])

  const p = picked ? DB.dex[picked - 1] : null
  const pr = p ? REGIONS.findIndex((r) => r.types.includes(p.types[0])) : -1
  return (
    <div className="world">
      <canvas ref={canvas} className="world-canvas" />
      {!ready && ids.length > 0 && <div className="world-loading"><span className="pixel">Le monde se dessine…</span></div>}

      <header className="world-top">
        <button className="round" onClick={back} aria-label="Retour"><Icon name="back" size={22} stroke={2.2} /></button>
        <div className="world-title">
          <b className="pixel">{REGIONS[region].name}</b>
          <span>{counts[region] ?? 0} Pokémon · {ids.length} en tout</span>
        </div>
        <button className="round" onClick={() => { const z = zoom === 2 ? 3 : 2; setZoom(z); engine.current?.setZoom(z) }} aria-label={zoom === 2 ? 'Zoomer' : 'Dézoomer'}>
          <Icon name={zoom === 2 ? 'plus' : 'minus'} size={20} stroke={2.4} />
        </button>
      </header>

      {p && (
        <button className="world-card" key={p.id} onClick={() => go('pokemon/' + p.id)}>
          <span className="world-card-sprite" style={{ background: TYPES[p.types[0]].color }}><Sprite id={p.id} size={64} /></span>
          <span className="world-card-txt">
            <small className="pixel">#{String(p.id).padStart(3, '0')} · {REGIONS[pr < 0 ? 4 : pr].name}</small>
            <b>{p.name}</b>
            <span className="world-card-types">{p.types.map((t) => <i key={t} style={{ background: TYPES[t].color, color: inkOn(TYPES[t].color) }}><TypeGlyph type={t} size={10} />{TYPES[t].label}</i>)}</span>
          </span>
          <Icon name="next" size={18} stroke={2.4} />
        </button>
      )}

      <nav className="world-rail" ref={rail} aria-label="Régions">
        {REGIONS.map((r, k) => (
          <button key={r.id} className={k === region ? 'on' : ''} onClick={() => { setPicked(null); engine.current?.panToRegion(k) }}>
            {r.name}<span className="pixel">{counts[k] ?? 0}</span>
          </button>
        ))}
      </nav>

      {!ids.length && (
        <div className="world-empty"><p className="pixel">Ton monde est vide</p><span>Scanne tes cartes : chaque Pokémon que tu possèdes viendra vivre dans sa région.</span><a className="btn" href="#/scan">Scanner mes cartes</a></div>
      )}
      <small className="world-credit">Sprites animés : PMD Sprite Collab</small>
    </div>
  )
}
