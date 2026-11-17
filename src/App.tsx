import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { Icon } from './ui/kit'
import { Pokedex } from './views/Pokedex'
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

const TABS = [
  { path: '', label: 'Pokédex', icon: 'pokeball' },
  { path: 'series', label: 'Séries', icon: 'cards' },
  { path: 'scan', label: 'Scanner', icon: 'scan' },
  { path: 'collection', label: 'Collection', icon: 'collection' },
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

  const [page, arg] = route
  const view =
    page === 'pokemon' ? <Pokemon id={+arg} /> :
    page === 'set' ? <SetView id={arg} /> :
    page === 'series' ? <Series /> :
    page === 'scan' ? <Scan /> :
    page === 'collection' ? <Collection /> : <Pokedex />
  const isTab = !arg && page !== 'scan'
  const open = useSyncExternalStore(sheet.subscribe, sheet.get)

  return (
    <>
      <main className={isTab ? 'with-tabs' : ''}>{view}</main>
      {isTab && (
        <nav className="tabbar" aria-label="Navigation">
          {TABS.map((t) => {
            const on = (page ?? '') === t.path
            return (
              <a key={t.path} href={'#/' + t.path} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                <span className="tab-ico">
                  {t.icon === 'pokeball' && on ? <PokeballOn /> : <Icon name={t.icon} size={26} />}
                </span>
                <span className="tab-label">{t.label}</span>
              </a>
            )
          })}
        </nav>
      )}
      {open && <CardSheet id={open} />}
    </>
  )
}

// Pokéball pleine (rouge et blanche) pour l'onglet actif, comme dans la maquette.
function PokeballOn() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 12a8.5 8.5 0 0 1 17 0Z" fill="#CD3131" />
      <path d="M3.5 12a8.5 8.5 0 0 0 17 0Z" fill="#fff" />
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="var(--primary)" strokeWidth="1.6" />
      <path d="M3.5 12h5.4m6.2 0h5.4" stroke="var(--primary)" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.6" fill="#fff" stroke="var(--primary)" strokeWidth="1.6" />
    </svg>
  )
}
