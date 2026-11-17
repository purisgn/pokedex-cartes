import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { Icon } from './ui/kit'
import { Home } from './views/Home'
import { Pokedex } from './views/Pokedex'
import { Types } from './views/Types'
import { Pokemon } from './views/Pokemon'
import { Series } from './views/Series'
import { SetView } from './views/SetView'
import { Scan } from './views/Scan'
import { Collection } from './views/Collection'
import { CardSheet, sheet } from './views/CardSheet'

// Navigation par l'adresse (#/…) : le bouton retour du téléphone marche partout.
const readRoute = () => location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
export const go = (path: string) => { location.hash = '/' + path }
export const back = () => (history.length > 1 ? history.back() : go(''))

const NAV = [
  { path: '', label: 'Accueil', icon: 'pokeball', match: ['', 'types'] },
  { path: 'dex', label: 'Pokédex', icon: 'grid', match: ['dex'] },
  { path: 'scan', label: 'Scanner', icon: 'scan', match: ['scan'] },
  { path: 'series', label: 'Séries', icon: 'cards', match: ['series', 'set'] },
  { path: 'collection', label: 'Collection', icon: 'heart', match: ['collection'] },
] as const

const scrolls = new Map<string, number>()

export function App() {
  const [route, setRoute] = useState(readRoute)
  const key = route.join('/')
  useEffect(() => {
    const on = () => { scrolls.set(key, scrollY); setRoute(readRoute()) }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [key])
  useLayoutEffect(() => { scrollTo(0, scrolls.get(key) ?? 0) }, [key])

  const [page = '', arg] = route
  const view =
    page === 'pokemon' ? <Pokemon key={arg} id={+arg} /> :
    page === 'set' ? <SetView key={arg} id={arg} /> :
    page === 'dex' ? <Pokedex type={arg} /> :
    page === 'types' ? <Types /> :
    page === 'series' ? <Series /> :
    page === 'scan' ? <Scan /> :
    page === 'collection' ? <Collection /> : <Home />
  const showNav = page !== 'scan' && page !== 'pokemon'
  const open = useSyncExternalStore(sheet.subscribe, sheet.get)

  return (
    <>
      <main className={showNav ? 'with-nav' : ''}>{view}</main>
      {showNav && (
        <nav className="nav" aria-label="Navigation">
          {NAV.map((t) => {
            const on = (t.match as readonly string[]).includes(page)
            return (
              <a key={t.path} href={'#/' + t.path} className={(on ? 'on ' : '') + (t.path === 'scan' ? 'cta' : '')} aria-label={t.label} aria-current={on ? 'page' : undefined}>
                <Icon name={t.icon} size={t.path === 'scan' ? 24 : 23} stroke={1.8} />
              </a>
            )
          })}
        </nav>
      )}
      {open && <CardSheet id={open} />}
    </>
  )
}
