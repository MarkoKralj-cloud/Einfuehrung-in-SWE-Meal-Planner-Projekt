# V2 – vereinbarter Stand

Basis: `v2-dev` auf der GitHub-Historie (`4bac635`). `v1` und `backup/local-before-v2` bleiben erhalten; alte lokale Commits werden nicht integriert.

Die Nutzerentscheidung vom 08.10.2026 ersetzt die SQLite- und Quellenpflicht des ursprünglichen Plans: verständlicher Studienprototyp, CSV als Rezept-/Lebensmitteldaten, konstruierte Beispieldaten zulässig. Profil und Wochenplan werden gemeinsam in `data/state.json` gespeichert. Alte SQLite-Dateien bleiben ungenutzte Sicherungen.

Umgesetzt: Library-Oberfläche, zwei Onboarding-Schritte, Home/Plan/Rezepte/Profil, alle 45 CSV-Rezepte, möglichst unterschiedliche Gerichte und verteilte Wiederholungen, Makroauswahl nach Allergenersatz, genaue Kalorienkorrektur, geprüfte Zutaten und vollständige Wochenpläne, Speicherung ohne Profilverlust bei Fehlern, Wochenwechsel und ICS-Export. Ein Node-Server, ein Frontend, keine Laufzeitpakete.

Prüfnachweise und verbleibende Grenzen: [verification.md](verification.md).

Nach Nutzerklarstellung: Die ursprüngliche Begrenzung auf 21 Basisgerichte entfällt. Alle 45 Rezepte sollen die Wochen abwechslungsreicher machen. Bestehende gespeicherte Pläne bleiben erhalten; „Woche neu“ erzeugt einen Plan mit der neuen Auswahl. Eine automatische Resteverwertung wurde nicht eingeführt.
