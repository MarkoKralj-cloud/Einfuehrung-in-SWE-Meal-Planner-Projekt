# V2 – Prüfung

## Lokal (08.10.2026)

- Node 20 und Node 24: jeweils 38/38 Tests bestanden (`node --test`).
- Reproduzierbare Matrix: 108 Kombinationen aus Ernährungsform, Ziel, Makropräferenz und Allergenen. Erfolgreiche Pläne erfüllen Zutaten-, Tages- und Wochenbedingungen.
- Regressionen: fehlende Alternativen, unvollständige Pläne, Makroeinfluss nach Ersatz, ungültige Nährwerte, gescheiterte Speicherung ohne Profil-/Planverlust, Wochenwechsel, V1-JSON-Import und ungültige URLs.
- Browser: Onboarding, Allergenersatz mit tatsächlichen Zutaten im Rezeptdialog, Profiländerung, Neugenerierung, Reload und Export. Nach Entfernung von SQLite erneut mit CSV/JSON ausgeführt.
- Home, Plan, Rezepte und Profil bei 390, 768 und 1440 Pixeln visuell geprüft anhand der Library-HTML-Vorlagen. Onboarding, Lade- und Fehlerzustand geprüft. Kein automatischer Pixelvergleich.
- ICS: 21 gespeicherte Mahlzeiten, Textbehandlung und Zeilenfaltung geprüft; Download und tatsächlicher Import von 21 Terminen in Apple Kalender durchgeführt. Separater Testkalender danach ausgeblendet.
- Unabhängiger Review: Speicher- und Validatorpfade geprüft; NaN-Lücke korrigiert und durch Regressionstest abgedeckt.

## Umfang

CSV-Daten sind Beispieldaten für einen Studienprototyp; Nährwertquellen wurden nicht vollständig verifiziert. Diese Einschränkung ist ausdrücklich akzeptiert. Fehlende passende Fotos verwenden gestaltete Platzhalter. Kalenderimport wurde lokal auf macOS geprüft, nicht auf Windows/Linux.

## CI

Workflow prüft Node 24 auf macOS, Windows und Linux. Remote-Ergebnis ist bei der zugehörigen GitHub-PR sichtbar; lokale Ergebnisse beweisen keine Remote-Ausführung.

## Nachbesserung: Rezeptvielfalt

Node 20 und Node 24: jeweils 40/40 Tests bestanden. Regression zunächst rot: nur 21 geladene Rezepte und 3 statt 7 verschiedene Frühstücke bei normaler Ernährung. Neue Auswahl nutzt alle 45 Rezepte, minimiert Wiederholungen pro Mahlzeitentyp und verteilt nötige Wiederholungen. Prüfungen decken alle Ernährungsformen und Makropräferenzen ab; die bestehende 108-Kombinationen-Matrix prüft weiterhin Zutaten und Kalorien. Der Makrotest nach Allergenersatz prüft die bevorzugte erste Auswahl statt einer absichtlich eintönigen Woche.
