# Marauder

Kartbasert [PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) for å utforske Harry Potter-universet i Storbritannia og Irland.

Finn den her: [elzacka.github.io/marauder-pwa](https://elzacka.github.io/marauder-pwa/)

## Funksjoner

Kan installeres som app på iPhone og Android.

### Tilgjengelig offline

- Kart med HP-steder (innspillingssteder, kanoniske steder, HP-atmosfære), vises i nedlastede kartområder
- Last ned kartområder for offline-bruk
- Søk og filtrer HP-steder etter kategori og sted
- Søk på vanlige steder og adresser (som vanlige kart-apper)
- Merk steder som favoritter, legg til egne steder og se dem under hhv. Favoritter og Mine steder i menyen
- Marauder's Hunt Score: Antall HP-steder stemplet som "besøkt".
- OWLs and NEWT: Quiz med 115 spørsmål fordelt på kategoriene Generelt, alle bøkene og NEWT (eksamen)
- Hogwarts Library's Restricted Section: 30 Harry Potter fun facts

### Ikke tilgjengelig offline

- Vanlig adresse-/stedsnavnsøk
- Satellittkart

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

## Personvern

Se [PERSONVERN.md](PERSONVERN.md).
