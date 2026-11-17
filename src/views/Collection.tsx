import { useDeferredValue, useState } from 'react'
import { DB, eur, fdate, norm, type Card } from '../data'
import { ownedByDex, ownedEntries, restoreFromCode, sync, syncCode, useStore } from '../store'
import { CardImg, Header, Icon, SelectPill, Sprite, Stat } from '../ui/kit'
import { sheet } from './CardSheet'

type Sort = 'recent' | 'dex' | 'name' | 'value'
const SORTS: [Sort, string][] = [['recent', 'Plus récentes'], ['dex', 'N° Pokédex'], ['name', 'A – Z'], ['value', 'Valeur']]
const BY: Record<Sort, (a: { c: Card }, b: { c: Card }) => number> = {
  recent: (a, b) => (b.c.set.date ?? '').localeCompare(a.c.set.date ?? '') || a.c.i - b.c.i,
  dex: (a, b) => (a.c.dexId[0] ?? 9999) - (b.c.dexId[0] ?? 9999),
  name: (a, b) => a.c.name.localeCompare(b.c.name, 'fr'),
  value: (a, b) => (b.c.price ?? 0) - (a.c.price ?? 0),
}
const saved = () => { try { return localStorage.getItem('code-saved') === '1' } catch { return false } }

export function Collection() {
  useStore()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [cloud, setCloud] = useState(!saved())
  const query = useDeferredValue(norm(q))
  const list = ownedEntries().map(([id, n]) => ({ c: DB.byId.get(id)!, n })).filter((x) => x.c)
  const total = list.reduce((s, x) => s + x.n, 0)
  const value = list.reduce((s, x) => s + (x.c.price ?? 0) * x.n, 0)
  const shown = list.filter((x) => !query || norm(x.c.name).includes(query) || norm(x.c.set.name).includes(query)).sort(BY[sort])

  return (
    <div className="page">
      <Header title="Collection" />
      <SyncBar open={cloud} onToggle={() => setCloud(!cloud)} />
      {cloud && <CloudPanel onDone={() => setCloud(false)} />}

      {list.length ? (
        <>
          <dl className="stats">
            <Stat icon="layers" label="Cartes"><span className="pixel">{total}</span></Stat>
            <Stat icon="cards" label="Différentes"><span className="pixel">{list.length}</span></Stat>
            <Stat icon="pokeball" label="Pokémon"><span className="pixel">{ownedByDex().size}</span>/{DB.dex.length}</Stat>
            <Stat icon="euro" label="Valeur">{eur(value)}</Stat>
          </dl>
          <p className="hint">Prix Cardmarket au {fdate(DB.updated, true)}.</p>
          <label className="field" style={{ marginTop: 20 }}>
            <Icon name="search" size={18} stroke={1.8} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une carte ou une extension…" autoComplete="off" />
          </label>
          <div className="pills"><SelectPill label="Trier" value={sort} onChange={setSort} options={SORTS} /></div>
          <div className="grid">
            {shown.map(({ c, n }) => (
              <button key={c.id} className="gcard" onClick={() => sheet.open(c.id)}>
                <CardImg card={c} />
                {n > 1 && <span className="badge">{n}</span>}
                <span className="gcap">{c.set.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Sprite id={129} size={96} className="ghost" />
          <p className="empty-title">Tu n’as encore aucune carte</p>
          <p>Scanne tes cartes, ou ouvre une extension dans Séries et active l’ajout rapide. Tu as déjà une collection ? Utilise ton code ci-dessus.</p>
          <a className="btn outline" href="#/scan">Scanner mes cartes</a>
        </div>
      )}
    </div>
  )
}

// État de la sauvegarde en ligne, toujours visible en haut de la collection.
function SyncBar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const time = sync.at ? new Date(sync.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
  const label = {
    off: 'Sauvegarde en ligne indisponible',
    saving: 'Enregistrement en ligne…',
    saved: `Enregistrée en ligne${time ? ' · ' + time : ''}`,
    offline: 'Hors ligne : enregistrée au retour du réseau',
    error: 'Enregistrement en ligne impossible pour l’instant',
  }[sync.status]
  return (
    <button className={'syncbar ' + sync.status} onClick={onToggle} aria-expanded={open}>
      <Icon name="cloud" size={20} stroke={1.8} />
      <span>{label}</span>
      <b>{open ? 'Fermer' : 'Mon code'}</b>
    </button>
  )
}

function CloudPanel({ onDone }: { onDone: () => void }) {
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const code = syncCode()
  const copy = () => navigator.clipboard.writeText(code).then(
    () => { setMsg('Code copié. Colle-le dans tes Notes.'); try { localStorage.setItem('code-saved', '1') } catch { /* privé */ } },
    () => setMsg('Copie impossible : recopie le code à la main.'),
  )
  const restore = async () => {
    setBusy(true); setMsg('')
    const r = await restoreFromCode(input)
    setBusy(false)
    if (r === 'ok') { setMsg('Collection récupérée.'); setInput(''); try { localStorage.setItem('code-saved', '1') } catch { /* privé */ } onDone() }
    else setMsg(r === 'unknown' ? 'Aucune collection ne correspond à ce code. Vérifie-le.' : 'Pas de connexion. Réessaie dans un instant.')
  }
  return (
    <section className="cloud">
      <p className="cloud-label">Ton code de collection</p>
      <p className="cloud-code pixel" aria-label="Code de collection">{code}</p>
      <button className="btn" onClick={copy}><Icon name="copy" size={18} stroke={2} />Copier mon code</button>
      <p className="hint">Garde-le dans tes Notes. Si tu réinstalles l’app ou changes de téléphone, saisis-le ici et ta collection revient. Ne le partage pas : il donne accès à ta collection.</p>
      <div className="cloud-restore">
        <label className="field">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="J’ai déjà un code" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        </label>
        <button className="btn outline" disabled={busy || input.replace(/[^0-9a-z]/gi, '').length < 20} onClick={restore}>{busy ? 'Recherche…' : 'Récupérer'}</button>
      </div>
      <p className="hint">Récupérer une collection remplace celle de ce téléphone.</p>
      {msg && <p className="cloud-msg" role="status">{msg}</p>}
    </section>
  )
}
