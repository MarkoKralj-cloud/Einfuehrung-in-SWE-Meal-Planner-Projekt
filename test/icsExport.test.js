const test = require("node:test");
const assert = require("node:assert/strict");

const { createIcs, escapeText, foldLine } = require("../src/server/icsExport");

const plan = {
  weekStart: "2026-10-05",
  days: [
    {
      date: "2026-10-05",
      meals: [
        {
          mealType: "Frühstück",
          name: "Haferbrei mit Banane, Walnüssen; Zimt",
          kcal: 512.3,
          protein: 20,
          carbs: 70,
          fat: 15,
          ingredients: [
            { name: "Quinoa roh", amountG: 60, substitutedFor: "Haferflocken" },
            { name: "Banane", amountG: 100, substitutedFor: null }
          ]
        },
        { mealType: "Mittagessen", name: "Linsen-Dal", kcal: 700, protein: 30, carbs: 90, fat: 20, ingredients: [] },
        { mealType: "Abendessen", name: "Shakshuka", kcal: 600, protein: 25, carbs: 40, fat: 30, ingredients: [] }
      ]
    }
  ]
};

const ics = createIcs(plan, new Date(Date.UTC(2026, 9, 7, 8, 30, 0)));

test("erzeugt einen gültigen VCALENDAR-Rahmen mit CRLF", () => {
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(ics), "Zeilenumbrüche müssen CRLF sein");
});

test("ein VEVENT pro Mahlzeit mit Pflichtfeldern UID und DTSTAMP", () => {
  const events = ics.split("BEGIN:VEVENT").slice(1);
  assert.equal(events.length, 3);

  for (const event of events) {
    assert.match(event, /\r\nUID:[^\r]+@meal-planner\.local\r\n/);
    assert.match(event, /\r\nDTSTAMP:20261007T083000Z\r\n/);
  }
  assert.match(ics, /DTSTART:20261005T073000\r\nDTEND:20261005T080000/);
});

test("escaped Sonderzeichen in Texten", () => {
  assert.equal(escapeText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  assert.match(ics, /SUMMARY:Frühstück: Haferbrei mit Banane\\, Walnüssen\\; Zimt/);
});

test("keine Zeile ist länger als 75 Oktetts", () => {
  for (const line of ics.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, `Zu lang: ${line}`);
  }
});

test("Zeilenumbruch zerschneidet keine Umlaute und lässt sich verlustfrei zurückfalten", () => {
  const line = "DESCRIPTION:" + "Grüße aus der Küche ".repeat(10);
  const folded = foldLine(line);
  assert.equal(folded.replace(/\r\n /g, ""), line);
  assert.ok(!folded.includes("�"));
});
