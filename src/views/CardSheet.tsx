import { useEffect } from 'react'
import { DB, eur, fdate } from '../data'
import { qty, setQty, useStore } from '../store'
import { go } from '../App'
import { tcgType, TYPES } from '../types'
import { CardImg, Icon } from '../ui/kit'

// Fiche d'une carte, en feuille qui monte du bas. Ouverte de partout via sheet.open(id).
let current: string | null = null
const subs = new Set<() => void>()
export const sheet = {
  get: () => current,
  subscribe: (l: () => void) => { subs.add(l); return () => { subs.delete(l) } },
  open: (id: string) => { current = id; subs.forEach((l) => l()) },
  close: () => { current = null; subs.forEach((l) => l()) },
}

export function CardSheet({ id }: { id: string }) {
  useStore()
  const c = DB.byId.get(id)
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && sheet.close()
    addEventListener('keydown', esc); addEventListener('hashchange', sheet.close)
    return () => { removeEventListener('keydown', esc); removeEventListener('hashchange', sheet.close) }
  }, [])
  if (!c) return null
  const n = qty(c.id)
  const color = TYPES[tcgType(c.type)].color

  return (
    <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && sheet.close()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={c.name}>
        <button className="sheet-x" onClick={sheet.close} aria-label="Fermer"><Icon name="close" size={22} /></button>
        <div className="sheet-card" style={{ ['--c' as string]: color }}><CardImg card={c} q="high" /></div>
        <h2 className="sheet-name">{c.name}</h2>
        <p className="sub">{c.set.name} · {c.localId}/{c.set.official || c.set.cards.length}{c.rarity ? ' · ' + c.rarity : ''}</p>

        <dl className="facts compact">
          <div className="fact"><dt>Prix Cardmarket</dt><dd>{c.price ? eur(c.price) : '—'}</dd></div>
          <div className="fact"><dt>Sortie</dt><dd>{fdate(c.set.date) || '—'}</dd></div>
        </dl>

        {n ? (
          <div className="stepper">
            <button onClick={() => setQty(c.id, n - 1)} aria-label="Retirer un exemplaire"><Icon name="minus" size={22} stroke={2} /></button>
            <span><b>{n}</b> dans ma collection</span>
            <button onClick={() => setQty(c.id, n + 1)} aria-label="Ajouter un exemplaire"><Icon name="plus" size={22} stroke={2} /></button>
          </div>
        ) : (
          <button className="btn" onClick={() => setQty(c.id, 1)}>Ajouter à ma collection</button>
        )}
        <div className="links">
          {c.dexId.slice(0, 2).map((d) => DB.dex[d - 1] && (
            <button key={d} className="btn ghost" onClick={() => { sheet.close(); go('pokemon/' + d) }}>Voir {DB.dex[d - 1].name}</button>
          ))}
          <button className="btn ghost" onClick={() => { sheet.close(); go('set/' + c.set.id) }}>Voir {c.set.name}</button>
        </div>
      </div>
    </div>
  )
}
