import { useEffect, useMemo, useRef, useState } from 'react'
import { DB } from '../data'
import { ownedByDex, useStore } from '../store'
import { back, go } from '../App'
import { AnimSprite, Icon } from '../ui/kit'
import { LAYOUT, cloudSprite, drawScene, timeOfDay } from '../world/scene'

type Zone = 'ground' | 'sky' | 'water'
type Mon = {
  id: number; zone: Zone; x: number; y: number; tx: number; ty: number
  state: 'idle' | 'walk' | 'sleep'; until: number; speed: number; face: 1 | -1; phase: number
  emote: string; emoteUntil: number; nextEmote: number
}
const MAX = 60
const EMOTES = ['♥', '♪', '!', '?', '…']
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const P = LAYOUT.pond

// Où chacun vit : les Pokémon Vol dans le ciel, ceux de type Eau près de l'étang, les autres dans la prairie.
function zoneOf(id: number): Zone {
  const t = DB.dex[id - 1]?.types ?? []
  if (t.includes('flying') && Math.random() < 0.75) return 'sky'
  if (t[0] === 'water') return 'water'
  return 'ground'
}
function spot(zone: Zone): [number, number] {
  if (zone === 'sky') return [rand(0.08, 0.92), rand(0.12, 0.38)]
  if (zone === 'water') return [rand(P.x0 + 0.05, P.x1 - 0.05), rand(P.y0 + 0.02, P.y1 - 0.01)]
  return [rand(0.06, 0.94), rand(0.56, 0.95)]
}

// « Mon monde » : tous les Pokémon possédés en carte vivent dans un paysage en pixel art.
export function World() {
  useStore()
  const time = useMemo(() => timeOfDay(), [])
  const ids = useMemo(() => {
    const all = [...ownedByDex().keys()].filter((id) => DB.dex[id - 1])
    return all.sort(() => Math.random() - 0.5).slice(0, MAX)
  }, [])
  const box = useRef<HTMLDivElement>(null)
  const bg = useRef<HTMLCanvasElement>(null)
  const nodes = useRef(new Map<number, HTMLDivElement>())
  const mons = useRef<Mon[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [emotes, setEmotes] = useState<Record<number, string>>({})
  const clouds = useMemo(() => (time === 'night' ? [] : [0, 1, 2, 3].map((k) => ({ src: cloudSprite(time, 7 + k * 13), top: 6 + k * 8, dur: 70 + k * 25, delay: -k * 30 }))), [time])

  // Le paysage, redessiné à la taille de l'écran.
  useEffect(() => {
    const draw = () => {
      const el = box.current, c = bg.current
      if (!el || !c) return
      const W = 180, H = Math.round(W * el.clientHeight / el.clientWidth)
      drawScene(c, W, H, time)
    }
    draw(); addEventListener('resize', draw)
    return () => removeEventListener('resize', draw)
  }, [time])

  // La vie : chacun alterne repos, promenade, petits sauts et émotions ; la nuit, beaucoup dorment.
  useEffect(() => {
    const now = performance.now()
    mons.current = ids.map((id) => {
      const zone = zoneOf(id), [x, y] = spot(zone)
      const asleep = time === 'night' && zone !== 'sky' && Math.random() < 0.55
      return { id, zone, x, y, tx: x, ty: y, state: asleep ? 'sleep' : 'idle', until: now + rand(500, 4000), speed: zone === 'sky' ? rand(0.05, 0.09) : rand(0.03, 0.07), face: Math.random() < 0.5 ? 1 : -1, phase: rand(0, 6), emote: '', emoteUntil: 0, nextEmote: now + rand(3000, 15000) }
    })
    let raf = 0, last = now
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t
      const el = box.current
      if (el) {
        const W = el.clientWidth, H = el.clientHeight
        let emoteChanged = false
        for (const m of mons.current) {
          if (m.state === 'idle' && t > m.until) {
            ;[m.tx, m.ty] = spot(m.zone)
            if (Math.hypot((m.tx - m.x) * W, (m.ty - m.y) * H) > W * 0.4) { m.tx = m.x + (m.tx - m.x) * 0.5; m.ty = m.y + (m.ty - m.y) * 0.5 }
            m.state = 'walk'; m.face = m.tx > m.x ? -1 : 1
          } else if (m.state === 'walk') {
            const dx = (m.tx - m.x) * W, dy = (m.ty - m.y) * H, d = Math.hypot(dx, dy), step = m.speed * W * dt
            if (d <= step) { m.x = m.tx; m.y = m.ty; m.state = 'idle'; m.until = t + rand(1500, 6000) }
            else { m.x += dx / d * step / W; m.y += dy / d * step / H }
          }
          if (m.state !== 'sleep' && t > m.nextEmote) { m.emote = EMOTES[Math.floor(Math.random() * EMOTES.length)]; m.emoteUntil = t + 1800; m.nextEmote = t + rand(9000, 24000); emoteChanged = true }
          if (m.emote && t > m.emoteUntil) { m.emote = ''; emoteChanged = true }
          const n = nodes.current.get(m.id)
          if (!n) continue
          // Profondeur : plus bas à l'écran = plus près = plus grand.
          const depth = m.zone === 'sky' ? 0.75 : 0.55 + 0.6 * Math.max(0, (m.y - 0.5) / 0.45)
          const hop = m.state === 'walk' && m.zone !== 'sky' ? -Math.abs(Math.sin(t / 110 + m.phase)) * 6 * depth : 0
          const bob = m.zone === 'sky' ? Math.sin(t / 420 + m.phase) * 6 : m.zone === 'water' ? Math.sin(t / 600 + m.phase) * 2 : 0
          n.style.transform = `translate3d(${m.x * W}px, ${m.y * H + hop + bob}px, 0) scale(${depth})`
          n.style.zIndex = String(Math.round(m.y * 1000) + (m.zone === 'sky' ? 2000 : 0))
          n.dataset.face = m.face === 1 ? 'l' : 'r'
          n.dataset.state = m.state
        }
        if (emoteChanged) setEmotes(Object.fromEntries(mons.current.filter((m) => m.emote || m.state === 'sleep').map((m) => [m.id, m.state === 'sleep' ? 'zZ' : m.emote])))
      }
      raf = requestAnimationFrame(loop)
    }
    setEmotes(Object.fromEntries(mons.current.filter((m) => m.state === 'sleep').map((m) => [m.id, 'zZ'])))
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [ids, time])

  const p = picked ? DB.dex[picked - 1] : null
  return (
    <div className={'world ' + time} ref={box} onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'CANVAS') setPicked(null) }}>
      <canvas ref={bg} className="world-bg" aria-hidden="true" />
      {clouds.map((c, k) => <img key={k} src={c.src} alt="" className="world-cloud" style={{ top: c.top + '%', animationDuration: c.dur + 's', animationDelay: c.delay + 's' }} />)}
      {time === 'night' && <div className="fireflies" aria-hidden="true">{Array.from({ length: 14 }, (_, k) => <i key={k} style={{ left: (k * 37) % 100 + '%', top: 55 + ((k * 23) % 40) + '%', animationDelay: (k * 0.7) % 4 + 's' }} />)}</div>}

      {ids.map((id) => (
        <div key={id} className="wmon" ref={(el) => { if (el) nodes.current.set(id, el); else nodes.current.delete(id) }}
          onClick={(e) => { e.stopPropagation(); setPicked(id) }}>
          <span className="wmon-shadow" />
          <AnimSprite id={id} className="wmon-sprite" />
          {emotes[id] && <span className="wmon-emote pixel">{emotes[id]}</span>}
          {picked === id && <span className="wmon-ring" />}
        </div>
      ))}

      <header className="world-top">
        <button className="round" onClick={back} aria-label="Retour"><Icon name="back" size={22} stroke={2.2} /></button>
        <div className="world-title"><b className="pixel">Mon monde</b><span>{ids.length} Pokémon en liberté{ownedByDex().size > MAX ? ` sur ${ownedByDex().size}` : ''}</span></div>
        <span className="round ghost" />
      </header>

      {!ids.length && (
        <div className="world-empty"><p className="pixel">Ton monde est vide</p><span>Scanne tes cartes : chaque Pokémon que tu possèdes viendra vivre ici.</span><a className="btn" href="#/scan">Scanner mes cartes</a></div>
      )}

      {p && (
        <button className="world-card" onClick={() => go('pokemon/' + p.id)}>
          <span className="pixel">#{String(p.id).padStart(3, '0')}</span>
          <b>{p.name}</b>
          <span className="world-card-cta">Voir sa fiche <Icon name="next" size={14} stroke={2.4} /></span>
        </button>
      )}
    </div>
  )
}
