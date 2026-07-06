# Marauder

Kartbasert [PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) for å utforske Harry Potter-universet i Storbritannia og Irland.

Finn den her: [elzacka.github.io/marauder-pwa](https://elzacka.github.io/marauder-pwa/)

## Funksjoner

- Kart over innspillingssteder, kanoniske steder og steder med HP-atmosfære
- Filtrer etter kategori og sted (land/by-chips)
- Søk på steds- eller stedsnavn med geokoding
- Favoritter og egne steder (Mine steder) med kartvisning
- Marauders pass: Marker besøkte steder og svar på quizspørsmål
- Offline-kart: Last ned valgte områder for bruk uten internett
- To bakgrunnskart: Standard (vektorkart, offline-støtte) og Satellitt (hybrid)
- Installeres som app på iPhone og Android

## Utvikling

```bash
npm install
npm run dev
```

## Datakilder

| Kilde | Bruk | Lisens |
|-------|------|--------|
| [OpenStreetMap](https://www.openstreetmap.org/) | Kartdata | [ODbL](https://www.openstreetmap.org/copyright) |
| [Photon (komoot)](https://photon.komoot.io/) | Adressesøk (geokoding) | Åpen tjeneste over OSM-data |
| [Protomaps](https://protomaps.com/) / [openfreemap.org](https://openfreemap.org/) | Kartvisning (fliser og stiler) | BSD 3-Clause / CC BY 4.0 |
| [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) | Satellitt-bakgrunnskart | Gratis med attribusjon (Esri, Maxar, Earthstar Geographics) |
| Offentlig tilgjengelige kilder | Harry Potter-steder | Redaksjonell sammenstilling |

Kartdata © OpenStreetMap-bidragsytere, lisensiert under ODbL.

## Bakgrunnskart

Appen har to bakgrunnskart, valgbare i Innstillinger:

- **Standard**: Vektorkart fra openfreemap. Fungerer offline i nedlastede
  områder (Verktøy → Offline kart).
- **Satellitt**: Flyfoto fra Esri World Imagery med steds- og veinavn fra
  standardkartet lagt oppå (hybrid). Krever internett: Nedlastede
  offline-områder gjelder bare Standard-kartet. Esri-bildene er gratis å bruke
  med attribusjon, men er ikke åpen kildekode. Andre datakilder som er åpen kildekode (f.eks. Sentinel-2, 10 m oppløsning) mangler detaljnivået som trengs for
  navigasjon i byer.

## Personvern

Se [PERSONVERN.md](PERSONVERN.md).

