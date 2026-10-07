# Einführung-in-SWE-Meal-Planner-Projekt
Das Projekt zeigt die mögliche Umsetzung einer Meal Planner App welche in der Lage ist anhand von diatären Präferenzen einen wöchentlichen Essensplan zu entwickeln.

## Starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20. Weitere Pakete werden nicht benötigt.

- **Windows:** Doppelklick auf `start.bat`
- **Terminal:** `npm start`

Die App öffnet sich unter <http://localhost:3000>. Beenden mit `Strg+C` im Terminalfenster.

Profil und Wochenplan werden in `data/` gespeichert (nicht im Git). Ordner löschen = Onboarding beginnt neu.

## Weitere Befehle

| Befehl | Zweck |
|---|---|
| `npm test` | Alle Tests ausführen |
| `npm run server` | Server starten, ohne Browser zu öffnen |
| `npm run demo` | Algorithmus ohne Oberfläche in der Konsole testen |

## Projektstruktur

```
Datenbank/                  CSV-Daten: Lebensmittel, Rezepte, Allergene
src/algorithms/             MealPlannerAlgorithm (AR01, AR02)
src/data/                   CSV-Loader
src/server/server.js        Webserver + API
src/server/planService.js   Onboarding-Validierung, Kalorienziel, Plan-Aufbau
src/server/icsExport.js     Kalender-Export nach RFC 5545 (FR08, NFR03)
src/Frontend/app/           Weboberfläche (Onboarding, Wochen- und Tagesansicht)
src/Frontend/Design System Library/   Stitch-Entwürfe und DESIGN.md
test/                       Tests (node:test)
```

## API

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/allergens` | Allergenliste aus der Datenbank (FR05) |
| GET | `/api/state` | Gespeichertes Profil und Wochenplan |
| PUT | `/api/profile` | Onboarding speichern und Plan erzeugen |
| POST | `/api/plan` | Woche neu generieren (FR07) |
| GET | `/api/plan.ics` | Wochenplan als `.ics` herunterladen (FR08) |
