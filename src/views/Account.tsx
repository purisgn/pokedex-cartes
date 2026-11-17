import { useState, type FormEvent } from 'react'
import { DB } from '../data'
import { newPassword, ownedByDex, ownedEntries, recovering, resetPassword, signIn, signOut, signUp, sync, user, useStore } from '../store'
import { Header, Icon, Sprite, Stat } from '../ui/kit'

// Compte (maquette « Perfil » et « Usuário deslogado ») : connexion par e-mail et mot de passe.
export function Account() {
  useStore()
  if (recovering) return <Recover />
  return user ? <Profile /> : <SignIn />
}

function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('up')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null)
    const err = mode === 'up' ? await signUp(email, pw) : await signIn(email, pw)
    setBusy(false)
    if (err) setMsg({ text: err })
  }
  const forgot = async () => {
    if (!email.includes('@')) return setMsg({ text: 'Écris d’abord ton e-mail ci-dessus.' })
    setBusy(true); const err = await resetPassword(email); setBusy(false)
    setMsg(err ? { text: err } : { ok: true, text: 'E-mail envoyé. Ouvre le lien qu’il contient pour choisir un nouveau mot de passe.' })
  }
  const local = ownedEntries().length

  return (
    <div className="page">
      <Header title="Compte" />
      <div className="auth-hero">
        <Sprite id={25} size={96} />
        <p className="empty-title">{mode === 'up' ? 'Crée ton compte' : 'Content de te revoir'}</p>
        <p>Ta collection est enregistrée sur ton compte, à chaque carte ajoutée. Tu la retrouves sur n’importe quel téléphone.</p>
      </div>

      <div className="seg auth-seg">
        <button className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setMsg(null) }}>Créer un compte</button>
        <button className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setMsg(null) }}>Se connecter</button>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <label className="label" htmlFor="email">E-mail</label>
        <div className="field"><input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.fr" required /></div>
        <label className="label" htmlFor="pw">Mot de passe</label>
        <div className="field">
          <input id="pw" type={show ? 'text' : 'password'} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={mode === 'up' ? '8 caractères minimum' : ''} required />
          <button type="button" className="field-btn" onClick={() => setShow(!show)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}><Icon name="eye" size={20} /></button>
        </div>
        {msg && <p className={'form-msg' + (msg.ok ? ' ok' : '')} role="status">{msg.text}</p>}
        <button className="btn" disabled={busy || !email || pw.length < 8}>{busy ? 'Un instant…' : mode === 'up' ? 'Créer mon compte' : 'Se connecter'}</button>
        {mode === 'in' && <button type="button" className="link" onClick={forgot} disabled={busy}>Mot de passe oublié ?</button>}
      </form>
      {local > 0 && <p className="hint center">Les {local} cartes déjà sur ce téléphone seront ajoutées à ton compte.</p>}
    </div>
  )
}

function Profile() {
  const [busy, setBusy] = useState(false)
  const list = ownedEntries()
  const time = sync.at ? new Date(sync.at).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''
  const status = { signedout: '', saving: 'Enregistrement…', saved: `Enregistrée ${time ? 'le ' + time : ''}`, offline: 'Hors ligne : enregistrée au retour du réseau', error: 'Enregistrement impossible pour l’instant' }[sync.status]
  return (
    <div className="page">
      <Header title="Compte" />
      <div className="profile">
        <span className="avatar pixel">{(user?.email ?? '?')[0].toUpperCase()}</span>
        <div><p className="profile-mail">{user?.email}</p><p className={'profile-sync ' + sync.status}><Icon name="cloud" size={16} stroke={1.8} />{status}</p></div>
      </div>
      <dl className="stats">
        <Stat icon="layers" label="Cartes"><span className="pixel">{list.reduce((s, [, n]) => s + n, 0)}</span></Stat>
        <Stat icon="pokeball" label="Pokémon"><span className="pixel">{ownedByDex().size}</span>/{DB.dex.length}</Stat>
      </dl>
      <p className="hint">Chaque carte ajoutée ou retirée est enregistrée sur ton compte automatiquement.</p>
      <div className="actions">
        <button className="btn outline" disabled={busy} onClick={async () => { setBusy(true); await signOut(); setBusy(false) }}>Se déconnecter</button>
      </div>
      <p className="hint center">Se déconnecter vide ce téléphone ; ta collection reste sur ton compte.</p>
    </div>
  )
}

function Recover() {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true)
    const err = await newPassword(pw); setBusy(false)
    setMsg(err ?? '')
  }
  return (
    <div className="page">
      <Header title="Nouveau mot de passe" />
      <form className="auth-form" onSubmit={submit}>
        <label className="label" htmlFor="npw">Choisis un nouveau mot de passe</label>
        <div className="field"><input id="npw" type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8 caractères minimum" required /></div>
        {msg && <p className="form-msg" role="status">{msg}</p>}
        <button className="btn" disabled={busy || pw.length < 8}>{busy ? 'Un instant…' : 'Enregistrer'}</button>
      </form>
    </div>
  )
}
