// Ouvrir une carte depuis n'importe quel écran : c'est désormais un écran à part entière (#/card/…).
export const sheet = {
  open: (id: string) => { location.hash = '/card/' + encodeURIComponent(id) },
}
