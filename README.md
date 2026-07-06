# Marauder

Kartbasert app[^1] for å utforske Harry Potter-universet i Storbritannia og Irland.

Finn den her: [elzacka.github.io/marauder-pwa](https://elzacka.github.io/marauder-pwa/)

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

- **Standard** – vektorkart fra openfreemap. Fungerer offline i nedlastede
  områder (Verktøy → Offline kart).
- **Satellitt** – flyfoto fra Esri World Imagery med steds- og veinavn fra
  standardkartet lagt oppå (hybrid). Krever internett; nedlastede
  offline-områder gjelder bare Standard-kartet. Esri-bildene er gratis å bruke
  med attribusjon, men er ikke åpen kildekode – de reelt åpne alternativene
  (f.eks. Sentinel-2, 10 m oppløsning) mangler detaljnivået som trengs for
  navigasjon i byer.

## Personvern

Se [PERSONVERN.md](PERSONVERN.md).

----
[^1]: En [Progressive Web App(PWA)]([https://elzacka.github.io/marauder-pwa/](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps))
