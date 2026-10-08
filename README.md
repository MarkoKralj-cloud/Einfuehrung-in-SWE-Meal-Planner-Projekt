# seali – Meal Planner V2

Ein Studienprototyp zum Lernen von KI-gestützter Codeentwicklung. Die App erstellt
Wochenpläne anhand von Ernährungsform, Kalorienziel, Makropräferenz und Allergenen.
Die vorhandene HTML-Design-Library bestimmt die Gestaltung.

## Start

Node.js ab Version 20 installieren. Keine weiteren Pakete nötig.

```sh
npm start
```

Unter Windows geht auch `start.bat`. Die App öffnet sich auf
`http://127.0.0.1:3000`. Beenden mit `Strg+C`.
`npm run server` startet ohne Browser; `npm test` führt die Tests aus.

## Einfache Datenhaltung

- **CSV:** Lebensmittel, Nährwerte, Rezepte, Zutaten und Allergene liegen in
  `Datenbank/`. IDs verknüpfen die Tabellen. Alle 45 Rezepte stehen für die
  Planung bereit. Passende Gerichte werden zuerst ohne Wiederholung ausgewählt;
  nötige Wiederholungen sind gleichmäßig verteilt und liegen möglichst weit auseinander.
  Die Makropräferenz entscheidet zwischen gleich oft genutzten Alternativen.
- **JSON:** `data/state.json` speichert Profil und Wochenplan gemeinsam. Erst wird
  eine temporäre Datei vollständig geschrieben, dann der alte Zustand ersetzt.
  Bei einem Planungs- oder Schreibfehler bleibt der bisherige Zustand erhalten.
- Vorhandene V1-Dateien `profile.json` und `weekplan.json` werden einmalig geprüft.
  Aus dem Profil wird ein aktueller Plan erstellt; die Quelldateien bleiben erhalten.
- **Keine SQLite-Datenbank und keine Datenbankbibliothek zur Laufzeit.** Eine eventuell
  vorhandene alte `.sqlite`-Datei bleibt lediglich eine unbenutzte Sicherung.

Die CSVs enthalten Beispielwerte und teilweise konstruierte Ersatzprofile. Das ist
für den beauftragten Prototyp ausdrücklich akzeptiert. Es wird keine vollständig
belegte Nährwertdatenbank behauptet. Die Planung prüft trotzdem die tatsächlichen
Zutaten, Allergene, sieben Tage mit je drei Mahlzeiten, Tageskalorien innerhalb
±50 kcal und das genaue Wochenziel (Gleitkommaabweichung höchstens `1e-9` kcal).

## Oberfläche

**Home** zeigt heutige Mahlzeiten und geplante Nährwerte. **Plan** enthält Tages-
und Wochenansicht, Neugenerierung und ICS-Export. **Rezepte** zeigt Zutaten, Mengen
und Ersatzhinweise. **Profil** erlaubt die Bearbeitung der Präferenzen über zwei
Onboarding-Schritte. Schrift und Icons werden lokal ausgeliefert. Fehlende passende
Rezeptbilder haben einheitliche gestaltete Platzhalter.

Bei einem Wochenwechsel erstellt die App einen aktuellen Plan. Schlägt das fehl,
bleibt der alte Plan sichtbar und wird als veraltet gekennzeichnet.

## Dateien

| Pfad                                     | Aufgabe                                                |
| ---------------------------------------- | ------------------------------------------------------ |
| `Datenbank/`                             | CSV-Stammdaten                                         |
| `src/data/csvLoader.js`                  | CSV lesen, einschließlich Anführungszeichen und Zahlen |
| `src/algorithms/MealPlannerAlgorithm.js` | Auswahl, Allergenersatz, Kalorienausgleich             |
| `src/server/planService.js`              | Profile und Pläne prüfen, GUI-Daten aufbauen           |
| `src/server/stateStore.js`               | Profil und Plan in JSON speichern                      |
| `src/server/server.js`                   | Ein lokaler Node-Server und API                        |
| `src/server/icsExport.js`                | Kalenderdatei mit den gespeicherten 21 Mahlzeiten      |
| `src/Frontend/app/`                      | Ein modulares JavaScript-Frontend                      |
| `test/`                                  | Funktions- und Regressionstests                        |

Die API enthält `/api/options`, `/api/allergens`, `/api/state`, `/api/profile`,
`/api/plan` und `/api/plan.ics`. Mit `PORT` und `DATA_DIR` lassen sich ein eigener
Port und ein getrennter Datenordner für Tests wählen.

Prüfstand und bekannte Grenzen: [docs/v2/verification.md](docs/v2/verification.md).
