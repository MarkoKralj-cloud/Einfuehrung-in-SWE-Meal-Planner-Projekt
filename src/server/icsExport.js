/**
 * FR08 / NFR03: Export des Wochenplans als iCalendar-Datei (RFC 5545)
 */

const MEAL_SLOTS = {
  Frühstück: { key: "fruehstueck", start: "073000", end: "080000" },
  Mittagessen: { key: "mittagessen", start: "123000", end: "131500" },
  Abendessen: { key: "abendessen", start: "183000", end: "191500" }
};

const MAX_LINE_OCTETS = 75;

// RFC 5545 3.3.11: Backslash, Semikolon, Komma und Zeilenumbrüche escapen
function escapeText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545 3.1: Zeilen nach 75 Oktetts (nicht Zeichen) umbrechen, Folgezeilen beginnen mit Leerzeichen
function foldLine(line) {
  if (Buffer.byteLength(line, "utf8") <= MAX_LINE_OCTETS) return line;

  const parts = [];
  let current = "";
  let currentOctets = 0;
  let limit = MAX_LINE_OCTETS;

  // for...of iteriert über ganze Zeichen, damit kein UTF-8-Zeichen zerschnitten wird
  for (const character of line) {
    const octets = Buffer.byteLength(character, "utf8");
    if (currentOctets + octets > limit) {
      parts.push(current);
      current = "";
      currentOctets = 0;
      limit = MAX_LINE_OCTETS - 1; // Platz für das führende Leerzeichen
    }
    current += character;
    currentOctets += octets;
  }
  parts.push(current);

  return parts.join("\r\n ");
}

// 2026-10-05 -> 20261005
function toIcsDate(isoDate) {
  return isoDate.replace(/-/g, "");
}

// Zeitstempel in UTC, z.B. 20261005T061500Z
function toIcsTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("de-DE");
}

function describeMeal(meal) {
  const lines = [
    `${formatNumber(meal.kcal)} kcal · ${formatNumber(meal.protein)} g Protein · ` +
      `${formatNumber(meal.carbs)} g Kohlenhydrate · ${formatNumber(meal.fat)} g Fett`,
    "",
    "Zutaten:"
  ];

  for (const ingredient of meal.ingredients) {
    const note = ingredient.substitutedFor ? ` (statt ${ingredient.substitutedFor})` : "";
    lines.push(`- ${formatNumber(ingredient.amountG)} g ${ingredient.name}${note}`);
  }

  return lines.join("\n");
}

function createIcs(plan, now = new Date()) {
  const stamp = toIcsTimestamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FH Einfuehrung SWE//Smart Weekly Meal Planner//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Meal Planner"
  ];

  for (const day of plan.days) {
    for (const meal of day.meals) {
      const slot = MEAL_SLOTS[meal.mealType];
      if (!slot) continue;

      const date = toIcsDate(day.date);
      lines.push(
        "BEGIN:VEVENT",
        // Gleiche UID für denselben Slot: ein neuer Import aktualisiert den Termin statt ihn zu verdoppeln
        `UID:${date}-${slot.key}@meal-planner.local`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${date}T${slot.start}`,
        `DTEND:${date}T${slot.end}`,
        `SUMMARY:${escapeText(`${meal.mealType}: ${meal.name}`)}`,
        `DESCRIPTION:${escapeText(describeMeal(meal))}`,
        "CATEGORIES:Mahlzeit",
        "TRANSP:TRANSPARENT",
        "END:VEVENT"
      );
    }
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

module.exports = { createIcs, escapeText, foldLine };
