const test = require("node:test");
const assert = require("node:assert/strict");
test("V2: Datumsauswahl und veraltete Pläne verwenden lokale Kalenderdaten", async () => {
  const { mondayIso, selectedDay } =
    await import("../src/Frontend/app/model.mjs");
  assert.equal(mondayIso(new Date(2026, 9, 11)), "2026-10-05");
  assert.equal(mondayIso(new Date(2026, 9, 12)), "2026-10-12");
  assert.equal(
    selectedDay(
      { days: [{ date: "2026-10-05" }, { date: "2026-10-06" }] },
      new Date(2026, 9, 6),
    ),
    1,
  );
});
test("V2: ungültiger Kalenderdownload wird statt einer falschen Datei gemeldet", async () => {
  const { getCalendar } = await import("../src/Frontend/app/client.mjs");
  await assert.rejects(
    getCalendar(
      async () =>
        new Response("wrong", { headers: { "content-type": "text/plain" } }),
    ),
    /Kalenderformat/,
  );
  await assert.rejects(
    getCalendar(
      async () => new Response('{"error":"Kein Plan"}', { status: 404 }),
    ),
    /Kein Plan/,
  );
  const r = await getCalendar(
    async () =>
      new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", {
        headers: {
          "content-type": "text/calendar",
          "content-disposition":
            'attachment; filename="essensplan-2026-10-05.ics"',
        },
      }),
  );
  assert.equal(r.filename, "essensplan-2026-10-05.ics");
});
test("V2: API-Fehler bleiben verständlich", async () => {
  const { requestJson } = await import("../src/Frontend/app/client.mjs");
  await assert.rejects(
    requestJson(
      "/api/profile",
      {},
      async () =>
        new Response('{"error":"Keine Alternative"}', { status: 422 }),
    ),
    /Keine Alternative/,
  );
});
