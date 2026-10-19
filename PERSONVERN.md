# Personvernerklæring – Marauder

Sist oppdatert: 19.10.2026

## Hva samles inn

Marauder har ingen brukerkontoer og sender ikke data til egne servere. Appen teller besøk på startsiden, se [Besøksstatistikk](#besøksstatistikk).

## Data som behandles lokalt på enheten

| Data | Formål | Lagring |
|------|--------|---------|
| GPS-posisjon | Vise nærliggende steder og flytte kartet | Kun i minnet mens appen er åpen |
| Favoritter | Huske steder du har merket | localStorage på enheten |
| Egne steder | Lagre steder du har opprettet | localStorage på enheten |
| Besøkte steder | Huske hvilke steder du har stemplet | localStorage på enheten |
| Kartfliser (offline) | Vise kart uten internett | Cache API på enheten |

## Tredjepartstjenester

**Photon (komoot)**: Adressesøk. Søketeksten du skriver, sendes til `photon.komoot.io`. Når du laster ned et kartområde, sendes midtpunktet i området dit, slik at området får et stedsnavn. Photon er en åpen geokodingstjeneste basert på OpenStreetMap-data. Se [komoots personvernerklæring](https://www.komoot.com/privacy).

**Protomaps / openfreemap.org**: Kartfliser ved online-bruk. Nettverksforespørsler sendes til tjenesteleverandøren for å laste inn kartdata. Ingen brukeridentifikator overføres.

**Esri**: Satellittkart. Når du velger satellittkart, henter appen bilder fra `server.arcgisonline.com`.

**GitHub Pages**: Appen ligger på GitHub Pages. GitHub får IP-adressen din når du åpner appen.

## Besøksstatistikk

Appen teller besøk med GoatCounter. Tallene viser hvor mye appen blir brukt.

- Appen sender bare adressen til startsiden, `/marauder-pwa/`. Steder, søk, posisjon og annet innhold sendes ikke.
- Appen lagrer ingenting på enheten din for å telle besøk.
- GoatCounter bruker IP-adressen din og informasjon om nettleseren i opptil 8 timer for å telle deg én gang. De lagres ikke.
- GoatCounter lagrer bare samlede tall. GoatCounter drives fra Irland og lagrer tallene hos Hetzner i Finland og Tyskland.
- Grunnlaget er berettiget interesse (personvernforordningen artikkel 6 nr. 1 bokstav f): Å se hvilke apper som brukes.
- Du kan unngå tellingen ved å blokkere `goatcounter.com`, for eksempel med en annonseblokkering.

## Dine rettigheter: Sletting

All data lagret lokalt kan du slette ved å tømme nettleserens lagringsdata for dette nettstedet. Offline-kartdata slettes via Innstillinger → Offline kart i appen.

## Kontaktinfo

https://github.com/elzacka
