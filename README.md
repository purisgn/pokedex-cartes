# Pokédex Cartes

Web app (PWA) pour classer sa collection de cartes Pokémon : catalogue français de toutes les séries (TCGdex), Pokédex des Pokémon possédés en carte, scan en direct à la caméra.

- `npm run dev` : développement
- `npm run build` : version de production dans `dist/`

## Données
- `scripts/build-catalog.py` : télécharge le catalogue TCGdex (FR) et les vignettes dans `.cache/`
- `scripts/build-hashes.py` : empreintes visuelles (dHash 256 bits de l'illustration) pour le scan
- `scripts/build-webdata.py` : écrit `public/catalog.json`, `public/hashes.bin`, `public/sprites.webp`

## Scan
OpenCV.js trouve les 4 coins de la carte dans l'image, la redresse en 245×342, puis l'empreinte de l'illustration est comparée aux ~17 000 du catalogue (distance de Hamming). Bonne carte ≈ 18, carte absente ≥ 78, seuil 55.

Données : TCGdex, PokéAPI. Pokémon © Nintendo / Creatures / GAME FREAK. Projet personnel, non affilié.
