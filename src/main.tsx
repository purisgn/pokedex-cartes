import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'
import { loadData } from './data'
import { loadStore, supabase } from './store'

const root = createRoot(document.getElementById('root')!)

// Retour d'un lien envoyé par e-mail (mot de passe oublié) : le jeton arrive dans l'adresse, avant notre navigation.
const fromEmail = /access_token=|error_description=/.test(location.hash)

Promise.all([loadData(), loadStore()]).then(
  async () => {
    if (fromEmail) {
      await supabase?.auth.getSession()
      history.replaceState(null, '', location.pathname + '#/compte')
    }
    root.render(<StrictMode><App /></StrictMode>)
  },
  () => { document.getElementById('root')!.innerHTML = '<p class="boot">Le catalogue n’a pas pu se charger. Vérifie ta connexion et recharge la page.</p>' },
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
}
