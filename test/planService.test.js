const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  loadDatabase,
  validateProfile,
  calculateDailyTarget,
  getMonday,
  generatePlan
} = require("../src/server/planService");

const db = loadDatabase(path.join(__dirname, "..", "Datenbank"));

const validProfile = {
  dietCategory: "vegetarisch",
  goal: "diaet",
  calorieAdjustment: 500,
  macroPreference: "protein",
  maintenanceCalories: 2200,
  allergens: ["A01", "A07"]
};

test("akzeptiert ein vollständiges Onboarding-Profil", () => {
  assert.deepEqual(validateProfile(validProfile, db), validProfile);
});

test("lehnt ungültige Onboarding-Eingaben ab", () => {
  assert.throws(() => validateProfile({ ...validProfile, dietCategory: "carnivor" }, db), /Ernährungsform/);
  assert.throws(() => validateProfile({ ...validProfile, goal: undefined }, db), /Ernährungsziel/);
  assert.throws(() => validateProfile({ ...validProfile, macroPreference: "" }, db), /Makronährstoff/);
  assert.throws(() => validateProfile({ ...validProfile, allergens: ["A99"] }, db), /Unbekannte Allergene/);
});

test("FR03: Slider erlaubt nur 100–1000 kcal in 50er-Schritten", () => {
  assert.throws(() => validateProfile({ ...validProfile, calorieAdjustment: 50 }, db));
  assert.throws(() => validateProfile({ ...validProfile, calorieAdjustment: 1050 }, db));
  assert.throws(() => validateProfile({ ...validProfile, calorieAdjustment: 125 }, db));
  assert.equal(validateProfile({ ...validProfile, calorieAdjustment: 1000 }, db).calorieAdjustment, 1000);
});

test("Maintenance ignoriert den Slider-Wert", () => {
  const profile = validateProfile({ ...validProfile, goal: "maintenance", calorieAdjustment: 12345 }, db);
  assert.equal(profile.calorieAdjustment, 0);
  assert.equal(calculateDailyTarget(profile), 2200);
});

test("berechnet das Tagesziel aus Bedarf und Ziel", () => {
  assert.equal(calculateDailyTarget({ ...validProfile, goal: "diaet" }), 1700);
  assert.equal(calculateDailyTarget({ ...validProfile, goal: "zunahme" }), 2700);
});

test("Wochenbeginn ist immer der Montag", () => {
  assert.equal(getMonday(new Date(2026, 9, 7)).getDate(), 5); // Mittwoch -> Montag
  assert.equal(getMonday(new Date(2026, 9, 11)).getDate(), 5); // Sonntag -> Montag
  assert.equal(getMonday(new Date(2026, 9, 5)).getDate(), 5); // Montag bleibt
});

test("generiert 7 Tage mit je 3 Mahlzeiten, exaktem Wochenziel und ohne Allergene", () => {
  const profile = validateProfile(validProfile, db);
  const plan = generatePlan(db, profile, new Date(2026, 9, 7));
  const allergenFoods = new Set(
    db.foodAllergens.filter((fa) => profile.allergens.includes(fa.allergen_id)).map((fa) => fa.food_id)
  );

  assert.equal(plan.weekStart, "2026-10-05");
  assert.equal(plan.days.length, 7);
  assert.equal(plan.days[6].date, "2026-10-11");
  assert.equal(plan.weeklyTarget, 1700 * 7);
  assert.ok(Math.abs(plan.weeklyDeviation) < 0.1);

  for (const day of plan.days) {
    assert.deepEqual(
      day.meals.map((meal) => meal.mealType),
      ["Frühstück", "Mittagessen", "Abendessen"]
    );
    assert.ok(Math.abs(day.deviation) <= 50);

    for (const meal of day.meals) {
      for (const ingredient of meal.ingredients) {
        assert.ok(!allergenFoods.has(ingredient.foodId), `${ingredient.name} enthält ein Allergen`);
      }
    }
  }
});
