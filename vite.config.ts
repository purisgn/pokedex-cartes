import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Chemins relatifs : l'app marche quelle que soit l'adresse d'hébergement.
export default defineConfig({
  base: './',
  plugins: [react()],
})
