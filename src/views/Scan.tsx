import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { DB, type Card } from '../data'
import { addCard, qty, useStore } from '../store'
import { back, go } from '../App'
import { inkOn, tcgType, TYPES } from '../types'
import { CardImg, Icon } from '../ui/kit'
import { SAME_ART, candidates, confident, identify, loadCV, warp, type Match, type Quad } from '../scan/engine'
import { colorSig, ensureFeatures, shortlist, verify } from '../scan/verify'

type Status = 'start' | 'denied' | 'nocam' | 'loading' | 'error' | 'live'
type Phase = 'idle' | 'seen' | 'ok'
const PROC = 720 // côté long de l'image analysée
const TOAST_MS = 4500

export function Scan() {
  useStore()
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const guideEl = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('start')
  const [phase, setPhase] = useState<Phase>('idle')
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

  // La notification d'ajout se range toute seule.
  useEffect(() => {
    if (!last) return
    const t = setTimeout(() => setLast((l) => (l?.at === last.at ? null : l)), TOAST_MS)
    return () => clearTimeout(t)
  }, [last])

  useEffect(() => {
    let stop = false, stream: MediaStream | null = null, timer = 0
    const proc = document.createElement('canvas'), pctx = proc.getContext('2d', { willReadFrequently: true })!
    let lastKey = -1, streak = 0, misses = 0, lock = -1, okUntil = 0
    let tracked: number[] = []   // dernières cartes reconnues : vérifiées en premier à l'image suivante

    const add = (card: Card, group: number) => {
      addCard(card.id); lock = group
      setLast({ card, at: Date.now() }); setCount((n) => n + 1)
      okUntil = Date.now() + 900
      navigator.vibrate?.(35)
    }

    // Zone de recherche des points-clés : le cadre guide élargi.
    const around = (g: Quad, W: number, H: number) => {
      const xs = g.map((p) => p[0]), ys = g.map((p) => p[1])
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
      const mx = (x1 - x0) * 0.3, my = (y1 - y0) * 0.2
      const x = Math.max(0, Math.round(x0 - mx)), y = Math.max(0, Math.round(y0 - my))
      return { x, y, w: Math.min(W - x, Math.round(x1 - x0 + 2 * mx)), h: Math.min(H - y, Math.round(y1 - y0 + 2 * my)) }
    }

    // Le cadre guide affiché, ramené dans les coordonnées de l'image analysée (vidéo en « cover »).
    const guideQuad = (v: HTMLVideoElement, k: number): Quad | null => {
      const el = guideEl.current, box = root.current
      if (!el || !box) return null
      const g = el.getBoundingClientRect(), b = box.getBoundingClientRect()
      const s = Math.max(b.width / v.videoWidth, b.height / v.videoHeight)
      const ox = (b.width - v.videoWidth * s) / 2, oy = (b.height - v.videoHeight * s) / 2
      const P = (x: number, y: number): [number, number] => [((x - b.left - ox) / s) * k, ((y - b.top - oy) / s) * k]
      return [P(g.left, g.top), P(g.right, g.top), P(g.right, g.bottom), P(g.left, g.bottom)]
    }

    const showDiag = (m: Match | null, n: number, orb: number, ms: number) => {
      const c = diagCanvas.current
      if (c && m) { c.width = m.img.width; c.height = m.img.height; c.getContext('2d')!.putImageData(m.img, 0, 0) }
      else if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
      setDiagText(`${Math.round(ms)} ms · ${n} contour(s)${orb ? ` · points-clés ${orb}` : ''}` + (m
        ? ` · distance ${m.d1}/${m.d2}${confident(m.d1, m.d2) ? ' ✓' : ''}\n${m.hits.slice(0, 3).map((h) => `${DB.cards[h.i].name} (${DB.cards[h.i].set.name}) ${h.d}`).join('\n')}`
        : ''))
    }

    const tick = (cv: Awaited<ReturnType<typeof loadCV>>['cv']) => {
      if (stop) return
      const t0 = performance.now()
      const v = video.current
      if (v && v.readyState >= 2 && !paused.current && !document.hidden) {
        const k = PROC / Math.max(v.videoWidth, v.videoHeight)
        proc.width = Math.round(v.videoWidth * k); proc.height = Math.round(v.videoHeight * k)
        pctx.drawImage(v, 0, 0, proc.width, proc.height)
        const src = cv.imread(proc)
        let found = 0, m: Match | null = null, ok = false, orb = 0
        try {
          const g = guideQuad(v, k)
          const c = candidates(cv, src, g)
          found = c.found
          m = identify(cv, src, c.quads)
          ok = !!m && confident(m.d1, m.d2)
          // Carte tenue en main, doigts sur les bords, fond chargé : présélection par couleurs puis points-clés.
          if (!ok && g && DB.colors.length) {
            const ids = [...new Set([...tracked, ...shortlist(colorSig(cv, warp(cv, src, c.quads[0])), 16), ...(m?.hits.slice(0, 4).map((h) => h.i) ?? [])])]
            ensureFeatures(cv, ids)
            const ver = verify(cv, src, around(g, proc.width, proc.height), ids)
            if (ver.length) {
              orb = ver[0].inliers
              const m2 = identify(cv, src, [ver[0].quad])
              if (m2 && confident(m2.d1, m2.d2)) { m = m2; ok = true }
              else if (ver[0].inliers >= 25 && (ver[1]?.inliers ?? 0) * 2 < ver[0].inliers) {
                m = { quad: ver[0].quad, img: m2?.img ?? m!.img, hits: [{ i: ver[0].i, d: 0 }], d1: 0, d2: 256 }; ok = true
              } else if (m2) m = m2
              if (ver[0].inliers >= 15) found = Math.max(found, 1)
            }
          }
        } finally { src.delete() }
        if (ok && m) tracked = [m.hits[0].i]
        else if (misses > 6) tracked = []
        setPhase(Date.now() < okUntil ? 'ok' : found > 0 || ok ? 'seen' : 'idle')
        if (diagRef.current) showDiag(m, found, orb, performance.now() - t0)
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
      // Rythme adapté à l'appareil : on laisse toujours un peu de temps libre à l'interface.
      const spent = performance.now() - t0
      timer = window.setTimeout(() => tick(cv), Math.max(40, Math.min(160, spent * 0.6)))
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
  const undo = (c: Card) => { addCard(c.id, -1); setCount((n) => Math.max(0, n - 1)); setLast(null) }

  return (
    <div className="scan" ref={root}>
      <video ref={video} playsInline muted autoPlay className="scan-video" />
      <div ref={guideEl} className={'scan-guide ' + phase}><i /><i /><i /><i /></div>

      <header className="scan-top">
        <button className="round" onClick={back} aria-label="Fermer le scanner"><Icon name="close" size={22} stroke={2} /></button>
        <button className="scan-counter" onClick={() => { const v = !diag; setDiag(v); localStorage.setItem('scan-diag', v ? '1' : '0') }} aria-pressed={diag} aria-label="Cartes ajoutées (toucher pour le diagnostic)">
          {count ? <><b className="pixel">{count}</b>{count > 1 ? ' cartes ajoutées' : ' carte ajoutée'}</> : 'Prêt à scanner'}
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
        {status === 'live' && (phase === 'ok' ? 'Ajoutée !' : phase === 'seen' ? 'Carte repérée, ne bouge plus' : 'Place la carte dans le cadre, même tenue en main')}
      </p>

      {(status === 'denied' || status === 'nocam' || status === 'error') && (
        <div className="scan-msg">
          <p className="empty-title">{status === 'denied' ? 'Caméra refusée' : status === 'nocam' ? 'Caméra indisponible' : 'Le scanner n’a pas pu démarrer'}</p>
          <p>{status === 'denied' ? 'Autorise la caméra pour ce site dans les réglages de Safari, puis rouvre le scanner.' : status === 'nocam' ? 'Ouvre l’app sur ton téléphone pour scanner tes cartes.' : 'Vérifie ta connexion : le moteur de reconnaissance se télécharge la première fois.'}</p>
        </div>
      )}

      <div className="scan-bottom">
        {choice ? (
          <section className="scan-sheet" role="dialog" aria-label="Choisir la version">
            <p className="sheet-title">Quelle version ?</p>
            <p className="sheet-sub">Cette illustration existe dans {choice.length} extensions.</p>
            <div className="versions">
              {choice.slice(0, 6).map((c) => (
                <button key={c.id} onClick={() => pick(c)}>
                  <CardImg card={c} />
                  <b>{c.set.name}</b>
                  <span className="pixel">{c.localId}</span>
                </button>
              ))}
            </div>
            <button className="link" onClick={() => setChoice(null)}>Aucune de celles-ci</button>
          </section>
        ) : last ? (
          <Toast key={last.at} card={last.card} onUndo={() => undo(last.card)} />
        ) : (
          <label className="auto-pill">
            <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); localStorage.setItem('scan-auto', e.target.checked ? '1' : '0') }} />
            <span className="track"><span className="thumb" /></span>
            Ajout automatique
          </label>
        )}
      </div>
    </div>
  )
}

// Notification d'ajout, dans la grammaire de la fiche carte : teinte du type, carte inclinée, quantité.
function Toast({ card, onUndo }: { card: Card; onUndo: () => void }) {
  const t = tcgType(card.type), color = TYPES[t].color
  const n = qty(card.id)
  return (
    <section className="toast" style={{ '--t': color, '--ink': inkOn(color) } as CSSProperties} role="status">
      <button className="toast-card" onClick={() => go('card/' + encodeURIComponent(card.id))} aria-label={`Ouvrir ${card.name}`}><CardImg card={card} /></button>
      <div className="toast-txt">
        <p className="toast-kicker"><span className="toast-check"><Icon name="check" size={12} stroke={3} /></span>Ajoutée à ta collection</p>
        <b>{card.name}</b>
        <span>{card.set.name} · <span className="pixel">{card.localId}</span></span>
      </div>
      <div className="toast-side">
        <span className="toast-qty pixel">×{n}</span>
        <button className="toast-undo" onClick={onUndo}>Annuler</button>
      </div>
      <i className="toast-timer" style={{ animationDuration: TOAST_MS + 'ms' }} />
    </section>
  )
}
