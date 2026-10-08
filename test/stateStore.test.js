const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createStateStore } = require("../src/server/stateStore");
const {
  loadDatabase,
  generatePlan,
  validatePlan,
} = require("../src/server/planService");
const db = loadDatabase(path.join(__dirname, "../Datenbank"));
const profile = {
  dietCategory: "vegan",
  goal: "maintenance",
  maintenanceCalories: 2000,
  calorieAdjustment: 0,
  macroPreference: "lowcarb",
  allergens: ["A01", "A07"],
};

test("JSON speichert Profil und Plan zusammen über Neustarts hinweg", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meal-state-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createStateStore(dir);
  assert.equal(store.read(), null);
  const state = { profile, plan: generatePlan(db, profile) };
  store.save(state);
  assert.deepEqual(createStateStore(dir).read(), state);
  assert.deepEqual(fs.readdirSync(dir), ["state.json"]);
});
test("Planprüfung verweigert fehlende Mahlzeiten, falsche Kalorien und Allergene", () => {
  const original = generatePlan(db, profile);
  const incomplete = structuredClone(original);
  incomplete.days[0].meals.pop();
  assert.throws(() => validatePlan(db, profile, incomplete), /drei Mahlzeiten/);
  const badCalories = structuredClone(original);
  badCalories.days[0].meals[0].ingredients[0].kcal += 1;
  assert.throws(
    () => validatePlan(db, profile, badCalories),
    /Zutatenkalorien/,
  );
  const allergy = structuredClone(original);
  const affected = allergy.days
    .flatMap((d) => d.meals)
    .flatMap((m) => m.ingredients)
    .find((i) => db.foodAllergens.some((a) => a.food_id === i.foodId));
  const id = db.foodAllergens.find(
    (a) => a.food_id === affected.foodId,
  ).allergen_id;
  assert.throws(
    () =>
      validatePlan(
        db,
        { ...profile, allergens: [...profile.allergens, id] },
        allergy,
      ),
    /Allergen/,
  );
});
test("Anzeige und Export verwenden CSV-Namen und tatsächliche Zutatenwerte", () => {
  const original = generatePlan(db, profile);
  const forged = structuredClone(original);
  forged.days[0].protein = 99999;
  forged.days[0].meals[0].name = "Falsch";
  assert.deepEqual(validatePlan(db, profile, forged), original);
});

test("Ungültige CSV-Nährwerte können Kalorien- und Ersatzprüfungen nicht umgehen", () => {
  const plan = generatePlan(db, profile);
  const used = plan.days[0].meals[0].ingredients[0].foodId;
  for (const field of [
    "kcal_per_100g",
    "protein_per_100g",
    "carbs_per_100g",
    "fat_per_100g",
  ]) {
    const invalid = structuredClone(db);
    invalid.foods.find((f) => f.food_id === used)[field] = "n/a";
    assert.throws(() => validatePlan(invalid, profile, plan), /Nährwert/);
  }
});
