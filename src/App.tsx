import { useEffect, useLayoutEffect, useState } from 'react'
import { Icon, PokeballMark } from './ui/kit'
import { Pokedex } from './views/Pokedex'
import { Pokemon } from './views/Pokemon'
import { CardPage } from './views/CardPage'
import { Series, SerieView } from './views/Series'
import { SetView } from './views/SetView'
import { Scan } from './views/Scan'
import { Collection } from './views/Collection'

// Navigation par l'adresse (#/…) : le bouton retour du téléphone marche partout.
const readRoute = () => location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
export const go = (path: string) => { location.hash = '/' + path }
export const back = () => (history.length > 1 ? history.back() : go(''))

const TABS = [
  { path: '', label: 'Pokédex', icon: 'pokeball', match: [''] },
  { path: 'series', label: 'Séries', icon: 'cards', match: ['series', 'serie', 'set'] },
  { path: 'scan', label: 'Scanner', icon: 'scan', match: ['scan'] },
  { path: 'collection', label: 'Collection', icon: 'folder', match: ['collection'] },
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
    page === 'card' ? <CardPage key={arg} id={arg} /> :
    page === 'serie' ? <SerieView key={arg} id={arg} /> :
    page === 'set' ? <SetView key={arg} id={arg} /> :
    page === 'series' ? <Series /> :
    page === 'scan' ? <Scan /> :
    page === 'collection' ? <Collection /> : <Pokedex />
  const showTabs = !['scan', 'pokemon', 'card'].includes(page)

  return (
    <>
      <main className={showTabs ? 'with-tabs' : ''}>{view}</main>
      {showTabs && (
        <nav className="tabbar" aria-label="Navigation">
          {TABS.map((t) => {
            const on = (t.match as readonly string[]).includes(page)
            return (
              <a key={t.path} href={'#/' + t.path} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                {t.icon === 'pokeball' && on ? <PokeballMark size={26} /> : <Icon name={t.icon} size={26} stroke={1.5} />}
                <span>{t.label}</span>
              </a>
            )
          })}
        </nav>
      )}
    </>
  )
}
