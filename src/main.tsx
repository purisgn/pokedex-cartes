import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'
import { loadData } from './data'
import { loadStore } from './store'

const root = createRoot(document.getElementById('root')!)

Promise.all([loadData(), loadStore()]).then(
  () => root.render(<StrictMode><App /></StrictMode>),
  () => { document.getElementById('root')!.innerHTML = '<p class="boot">Le catalogue n’a pas pu se charger. Vérifie ta connexion et recharge la page.</p>' },
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
}
