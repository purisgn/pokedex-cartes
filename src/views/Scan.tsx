import { useEffect, useRef, useState } from 'react'
import { DB, type Card } from '../data'
import { addCard, qty, useStore } from '../store'
import { back } from '../App'
import { CardImg, Icon } from '../ui/kit'
import { SAME_ART, candidates, confident, identify, loadCV, type Match, type Quad } from '../scan/engine'

type Status = 'start' | 'denied' | 'nocam' | 'loading' | 'error' | 'live'
const PROC = 720 // côté long de l'image analysée

export function Scan() {
  useStore()
  const video = useRef<HTMLVideoElement>(null)
  const overlay = useRef<HTMLCanvasElement>(null)
  const guideEl = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('start')
  const [seen, setSeen] = useState(false)          // une carte est dans le champ
  const [last, setLast] = useState<{ card: Card; at: number } | null>(null)
  const [choice, setChoice] = useState<Card[] | null>(null)
  const [count, setCount] = useState(0)
  const [auto, setAuto] = useState(() => localStorage.getItem('scan-auto') !== '0')
  const [torch, setTorch] = useState<boolean | null>(null)
  const [diag, setDiag] = useState(() => localStorage.getItem('scan-diag') === '1')
  const diagRef = useRef(diag)
  diagRef.current = diag
  const diagCanvas = useRef<HTMLCanvasElement>(null)
  const [diagText, setDiagText] = useState('')
  const paused = useRef(false)
  const autoRef = useRef(auto)
  autoRef.current = auto
  paused.current = !!choice

  useEffect(() => {
    let stop = false, stream: MediaStream | null = null, timer = 0
    const proc = document.createElement('canvas'), pctx = proc.getContext('2d', { willReadFrequently: true })!
    let lastKey = -1, streak = 0, misses = 0, lock = -1

    const add = (card: Card, group: number) => {
      addCard(card.id); lock = group
      setLast({ card, at: Date.now() }); setCount((n) => n + 1)
      navigator.vibrate?.(35)
    }

    const draw = (q: Quad | null, ok: boolean, sx: number) => {
      const cv = overlay.current, v = video.current
      if (!cv || !v) return
      const W = cv.clientWidth, H = cv.clientHeight
      if (cv.width !== W * devicePixelRatio) { cv.width = W * devicePixelRatio; cv.height = H * devicePixelRatio }
      const g = cv.getContext('2d')!
      g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); g.clearRect(0, 0, W, H)
      if (!q) return
      const s = Math.max(W / v.videoWidth, H / v.videoHeight), ox = (W - v.videoWidth * s) / 2, oy = (H - v.videoHeight * s) / 2
      g.beginPath()
      q.forEach(([x, y], k) => { const px = x * sx * s + ox, py = y * sx * s + oy; if (k) g.lineTo(px, py); else g.moveTo(px, py) })
      g.closePath(); g.lineWidth = 3; g.lineJoin = 'round'
      g.strokeStyle = ok ? '#4ADE80' : 'rgba(255,255,255,.9)'; g.stroke()
    }

    // Le cadre guide affiché, ramené dans les coordonnées de l'image analysée (vidéo en « cover »).
    const guideQuad = (v: HTMLVideoElement, k: number): Quad | null => {
      const el = guideEl.current, box = overlay.current
      if (!el || !box) return null
      const g = el.getBoundingClientRect(), b = box.getBoundingClientRect()
      const s = Math.max(b.width / v.videoWidth, b.height / v.videoHeight)
      const ox = (b.width - v.videoWidth * s) / 2, oy = (b.height - v.videoHeight * s) / 2
      const P = (x: number, y: number): [number, number] => [((x - b.left - ox) / s) * k, ((y - b.top - oy) / s) * k]
      return [P(g.left, g.top), P(g.right, g.top), P(g.right, g.bottom), P(g.left, g.bottom)]
    }

    const showDiag = (m: Match | null, n: number) => {
      const c = diagCanvas.current
      if (c && m) { c.width = m.img.width; c.height = m.img.height; c.getContext('2d')!.putImageData(m.img, 0, 0) }
      else if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
      setDiagText(!m ? `${n} contour(s), pas d'analyse`
        : `${n ? n + ' contour(s)' : 'cadre guide'} · distance ${m.d1} · suivante ${m.d2}${confident(m.d1, m.d2) ? ' ✓' : ''}\n${m.hits.slice(0, 3).map((h) => `${DB.cards[h.i].name} (${DB.cards[h.i].set.name}) ${h.d}`).join('\n')}`)
    }

    const tick = (cv: Awaited<ReturnType<typeof loadCV>>['cv']) => {
      if (stop) return
      const v = video.current
      if (v && v.readyState >= 2 && !paused.current && !document.hidden) {
        const k = PROC / Math.max(v.videoWidth, v.videoHeight)
        proc.width = Math.round(v.videoWidth * k); proc.height = Math.round(v.videoHeight * k)
        pctx.drawImage(v, 0, 0, proc.width, proc.height)
        const src = cv.imread(proc)
        let found = 0, m: Match | null = null
        try {
          const c = candidates(cv, src, guideQuad(v, k))
          found = c.found
          m = identify(cv, src, c.quads)
        } finally { src.delete() }
        const ok = !!m && confident(m.d1, m.d2)
        draw(found || ok ? m?.quad ?? null : null, ok, 1 / k)
        setSeen(found > 0 || ok)
        if (diagRef.current) showDiag(m, found)
        if (!m || !ok) {
          if (++misses >= 4) { lock = -1; lastKey = -1; streak = 0 }
        } else {
          misses = 0
          // Rééditions à l'illustration identique : on les regroupe (même clé) et on laisse choisir.
          const group = m.hits.filter((h) => h.d <= m!.d1 + SAME_ART).map((h) => DB.cards[h.i])
          const groupKey = Math.min(...group.map((c) => c.i))
          streak = groupKey === lastKey ? streak + 1 : 1
          lastKey = groupKey
          if (streak >= 2 && groupKey !== lock) {
            if (group.length === 1 && autoRef.current) add(group[0], groupKey)
            else { lock = groupKey; setChoice(group.sort((x, y) => (y.set.date ?? '').localeCompare(x.set.date ?? ''))) }
          }
        }
      }
      timer = window.setTimeout(() => tick(cv), 90)
    }

    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('nocam'); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
        })
      } catch (e) {
        setStatus((e as DOMException).name === 'NotAllowedError' ? 'denied' : 'nocam'); return
      }
      if (stop) { stream.getTracks().forEach((t) => t.stop()); return }
      const v = video.current!
      v.srcObject = stream
      await v.play().catch(() => {})
      const track = stream.getVideoTracks()[0]
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] }
      if (caps.torch) setTorch(false)
      if (caps.focusMode?.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
      setStatus('loading')
      try {
        const { cv } = await loadCV()
        if (stop) return
        setStatus('live'); tick(cv)
      } catch { setStatus('error') }
    })()

    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  const toggleTorch = () => {
    const track = (video.current?.srcObject as MediaStream | null)?.getVideoTracks()[0]
    if (!track || torch === null) return
    track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }).then(() => setTorch(!torch), () => setTorch(null))
  }
  const pick = (c: Card) => { addCard(c.id); setLast({ card: c, at: Date.now() }); setCount((n) => n + 1); setChoice(null); navigator.vibrate?.(35) }

  return (
    <div className="scan">
      <video ref={video} playsInline muted autoPlay className="scan-video" />
      <canvas ref={overlay} className="scan-overlay" />
      <div ref={guideEl} className={'scan-guide' + (seen ? ' seen' : '')}><i /><i /><i /><i /></div>

      <header className="scan-top">
        <button className="round" onClick={back} aria-label="Fermer le scanner"><Icon name="close" size={22} stroke={2} /></button>
        <button className="scan-count" onClick={() => { const v = !diag; setDiag(v); localStorage.setItem('scan-diag', v ? '1' : '0') }} aria-pressed={diag}>
          {count ? `${count} carte${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''}` : 'Scanner'}{diag ? ' · diagnostic' : ''}
        </button>
        {torch !== null
          ? <button className={'round' + (torch ? ' on' : '')} onClick={toggleTorch} aria-label="Lampe" aria-pressed={torch}><Icon name="bolt" size={20} stroke={2} /></button>
          : <span className="round ghost" />}
      </header>

      {diag && (
        <div className="scan-diag">
          <canvas ref={diagCanvas} />
          <pre>{diagText || 'En attente…'}</pre>
        </div>
      )}

      <p className="scan-tip" role="status">
        {status === 'start' && 'Ouverture de la caméra…'}
        {status === 'loading' && 'Préparation du scanner…'}
        {status === 'live' && (seen ? 'Carte détectée, ne bouge plus' : 'Place une carte dans le cadre, sur un fond uni')}
      </p>

      {(status === 'denied' || status === 'nocam' || status === 'error') && (
        <div className="scan-msg">
          <p className="empty-title">{status === 'denied' ? 'Caméra refusée' : status === 'nocam' ? 'Caméra indisponible' : 'Le scanner n’a pas pu démarrer'}</p>
          <p>{status === 'denied' ? 'Autorise la caméra pour ce site dans les réglages de Safari, puis rouvre le scanner.' : status === 'nocam' ? 'Ouvre l’app sur ton téléphone pour scanner tes cartes.' : 'Vérifie ta connexion : le moteur de reconnaissance se télécharge la première fois.'}</p>
        </div>
      )}

      <div className="scan-bottom">
        <label className="switch dark">
          <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); localStorage.setItem('scan-auto', e.target.checked ? '1' : '0') }} />
          <span className="track"><span className="thumb" /></span>
          <span>Ajout automatique</span>
        </label>

        {choice ? (
          <div className="scan-card">
            <p className="scan-q">{choice.length > 1 ? 'Quelle version ?' : 'Ajouter cette carte ?'}</p>
            <div className="versions">
              {choice.slice(0, 4).map((c) => (
                <button key={c.id} onClick={() => pick(c)}>
                  <CardImg card={c} />
                  <span>{c.set.name}</span>
                </button>
              ))}
            </div>
            <button className="btn ghost light" onClick={() => setChoice(null)}>Ce n’est pas ça</button>
          </div>
        ) : last ? (
          <div className="scan-card row" key={last.at}>
            <CardImg card={last.card} />
            <div className="scan-info">
              <b>{last.card.name}</b>
              <span>{last.card.set.name} · {last.card.localId}/{last.card.set.official || last.card.set.cards.length}</span>
              <span className="ok">Ajoutée · {qty(last.card.id)} exemplaire{qty(last.card.id) > 1 ? 's' : ''}</span>
            </div>
            <button className="round light" onClick={() => { addCard(last.card.id, -1); setCount((n) => n - 1); setLast(null) }} aria-label="Annuler l’ajout">
              <Icon name="undo" size={20} stroke={2} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
