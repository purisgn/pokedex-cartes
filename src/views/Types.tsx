import { DB } from '../data'
import { TYPES, TYPE_KEYS } from '../types'
import { ownedByDex, useStore } from '../store'
import { back } from '../App'
import { Ball, TopBar, TypeGlyph, pastel } from '../ui/kit'

// Écran « Types » de la maquette : deux colonnes de pastilles pastel, pokéball dans un rond à droite.
export function Types() {
  useStore()
  const have = ownedByDex()
  return (
    <div className="page">
      <TopBar title="Types" onBack={back} />
      <div className="types">
        {TYPE_KEYS.map((t) => {
          const all = DB.dex.filter((p) => p.types.includes(t))
          const got = all.filter((p) => have.has(p.id)).length
          return (
            <a key={t} href={'#/dex/' + t} className="type-pill" style={{ background: pastel(t, 80) }}>
              <span className="type-txt"><b>{TYPES[t].label}</b><small>{got}/{all.length}</small></span>
              <span className="type-ico"><Ball className="type-ball" /><TypeGlyph type={t} color={TYPES[t].color} size={16} /></span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
