const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { createApplication } = require("../src/server/server");
const profile = {
  dietCategory: "vegan",
  goal: "maintenance",
  maintenanceCalories: 2000,
  macroPreference: "lowcarb",
  allergens: ["A01", "A07"],
};
async function app(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meal-v2-api-"));
  const application = createApplication({ dataDir: dir, ...options });
  await new Promise((r) => application.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${application.server.address().port}`;
  t.after(async () => {
    await new Promise((r) => application.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { base, application, dir };
}
const put = (base, body) =>
  fetch(base + "/api/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
test("V2: profilspeicherung, reload und export sind kohärent", async (t) => {
  const { base } = await app(t);
  assert.equal((await (await fetch(base + "/api/state")).json()).plan, null);
  const r = await put(base, profile);
  assert.equal(r.status, 200);
  const saved = await r.json();
  const state = await (await fetch(base + "/api/state")).json();
  assert.deepEqual(state, saved);
  assert.equal(saved.plan.days.flatMap((d) => d.meals).length, 21);
  const ics = await (await fetch(base + "/api/plan.ics")).text();
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 21);
});
test("V2: fehlgeschlagene Profiländerung bewahrt alten Zustand", async (t) => {
  const { base } = await app(t);
  const old = await (await put(base, profile)).json();
  assert.equal(
    (await put(base, { ...profile, allergens: ["UNKNOWN"] })).status,
    400,
  );
  assert.deepEqual(await (await fetch(base + "/api/state")).json(), old);
});
test("V2: fehlerhafte statische URLs beenden den Server nicht", async (t) => {
  const { base } = await app(t);
  const status = await new Promise((resolve, reject) => {
    http
      .get(base + "/%ZZ", (r) => {
        r.resume();
        resolve(r.statusCode);
      })
      .on("error", reject);
  });
  assert.equal(status, 400);
  assert.equal((await fetch(base + "/api/state")).status, 200);
});
test("V2: Optionen und lokale Assets werden ausgeliefert; Daten bleiben privat", async (t) => {
  const { base } = await app(t);
  const options = await (await fetch(base + "/api/options")).json();
  assert.equal(options.allergens.length, 14);
  assert.equal(options.suggestedAdjustments.diaet, 300);
  assert.equal((await fetch(base + "/")).status, 200);
  assert.equal((await fetch(base + "/data/state.json")).status, 404);
  assert.equal((await fetch(base + "/app.mjs")).status, 200);
});
test("V2: JSON-Datenimport erfolgt einmalig und verändert die Quelldateien nicht", async (t) => {
  const { loadDatabase, generatePlan } = require("../src/server/planService");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meal-v2-import-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const plan = generatePlan(
    loadDatabase(path.join(__dirname, "../Datenbank")),
    { ...profile, calorieAdjustment: 0 },
  );
  const data = JSON.stringify(plan);
  fs.writeFileSync(
    path.join(dir, "profile.json"),
    JSON.stringify({ ...profile, calorieAdjustment: 0 }),
  );
  fs.writeFileSync(path.join(dir, "weekplan.json"), data);
  let a = createApplication({ dataDir: dir });
  assert.equal(a.state().plan.days.length, 7);
  const imported = a.state().plan;
  a = createApplication({ dataDir: dir });
  assert.deepEqual(a.state().plan, imported);
  assert.equal(fs.readFileSync(path.join(dir, "weekplan.json"), "utf8"), data);
});
test("V2: Speicherfehler bewahren Profil und Plan gemeinsam", async (t) => {
  let fail = false;
  const fileSystem = {
    ...fs,
    renameSync(...args) {
      if (fail) throw new Error("write failed");
      return fs.renameSync(...args);
    },
  };
  const { base, dir } = await app(t, { fileSystem });
  const old = await (await put(base, profile)).json();
  const before = fs.readFileSync(path.join(dir, "state.json"), "utf8");
  fail = true;
  assert.equal(
    (await put(base, { ...profile, maintenanceCalories: 2100 })).status,
    500,
  );
  assert.deepEqual(await (await fetch(base + "/api/state")).json(), old);
  assert.equal(fs.readFileSync(path.join(dir, "state.json"), "utf8"), before);
  assert.ok(!fs.readdirSync(dir).some((f) => f.endsWith(".tmp")));
});
test("V2: Wochenwechsel erneuert den Plan und erhält das Profil", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meal-v2-week-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let date = new Date(2026, 9, 8);
  const application = createApplication({ dataDir: dir, now: () => date });
  await new Promise((r) => application.server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await new Promise((r) => application.server.close(r));
  });
  const base = `http://127.0.0.1:${application.server.address().port}`;
  const old = await (await put(base, profile)).json();
  assert.equal(old.plan.weekStart, "2026-10-05");
  date = new Date(2026, 9, 12);
  const current = await (await fetch(base + "/api/state")).json();
  assert.equal(current.plan.weekStart, "2026-10-12");
  assert.deepEqual(current.profile, old.profile);
});
test("V2: gescheiterter Wochenwechsel zeigt den alten Plan mit Warnung", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meal-v2-week-fail-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let date = new Date(2026, 9, 8);
  const application = createApplication({ dataDir: dir, now: () => date });
  await new Promise((r) => application.server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await new Promise((r) => application.server.close(r));
  });
  const base = `http://127.0.0.1:${application.server.address().port}`;
  const old = await (await put(base, profile)).json();
  const existing = fs.readFileSync(path.join(dir, "state.json"), "utf8");
  fs.renameSync(
    path.join(dir, "state.json"),
    path.join(dir, "state.backup.json"),
  );
  fs.mkdirSync(path.join(dir, "state.json"));
  date = new Date(2026, 9, 12);
  const current = await (await fetch(base + "/api/state")).json();
  assert.deepEqual(current.plan, old.plan);
  assert.match(current.warning, /veraltet/);
  assert.equal(
    fs.readFileSync(path.join(dir, "state.backup.json"), "utf8"),
    existing,
  );
});

test("V2 importiert echte V1-Ersatz-Zutaten durch validierte Neuberechnung", (t) => {
  const source = fs.readFileSync(
    path.join(__dirname, "fixtures/v1-weekplan.json"),
    "utf8",
  );
  const old = JSON.parse(source);
  assert.ok(
    old.days
      .flatMap((d) => d.meals)
      .flatMap((m) => m.ingredients)
      .some((i) => i.substitutedFor && !i.originalFoodId),
  );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meal-v1-real-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "profile.json"), JSON.stringify(old.profile));
  fs.writeFileSync(path.join(dir, "weekplan.json"), source);
  const a = createApplication({
    dataDir: dir,
    now: () => new Date(2026, 9, 8),
  });
  assert.equal(a.state().plan.days.flatMap((d) => d.meals).length, 21);
  assert.deepEqual(a.state().profile, old.profile);
  assert.equal(
    fs.readFileSync(path.join(dir, "weekplan.json"), "utf8"),
    source,
  );
});

test("V2 verweigert ungültige V1-Datumswerte", (t) => {
  const view = JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures/v1-weekplan.json"), "utf8"),
  );
  view.days[0].date = "2026-99-99";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meal-v1-invalid-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(dir, "profile.json"),
    JSON.stringify(view.profile),
  );
  fs.writeFileSync(path.join(dir, "weekplan.json"), JSON.stringify(view));
  assert.throws(() => createApplication({ dataDir: dir }), /Tagesdatum/);
});
