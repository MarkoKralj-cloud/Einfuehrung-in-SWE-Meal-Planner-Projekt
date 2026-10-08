const test = require("node:test");
const assert = require("node:assert/strict");
const Planner = require("../src/algorithms/MealPlannerAlgorithm");
const { loadDatabase, generatePlan } = require("../src/server/planService");
const db = loadDatabase(require("node:path").join(__dirname, "../Datenbank"));
const quiet = (fn) => {
  const log = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
  }
};
const profile = {
  dietCategory: "normal",
  goal: "maintenance",
  maintenanceCalories: 2000,
  calorieAdjustment: 0,
  macroPreference: "protein",
  allergens: [],
};

test("V2: Makropräferenz beeinflusst den erzeugten Plan", () => {
  const random = Math.random;
  Math.random = () => 0.42;
  try {
    const protein = quiet(() => generatePlan(db, profile));
    const keto = quiet(() =>
      generatePlan(db, { ...profile, macroPreference: "keto" }),
    );
    assert.notDeepEqual(
      protein.days.map((d) => d.meals.map((m) => m.recipeId)),
      keto.days.map((d) => d.meals.map((m) => m.recipeId)),
    );
  } finally {
    Math.random = random;
  }
});

test("V2: fehlender Allergenersatz wird nicht als gültiger Plan ausgegeben", () => {
  const food = db.foods.find((f) => f.food_id === "F001");
  const fixture = {
    foods: [food],
    recipes: ["Frühstück", "Mittagessen", "Abendessen"].map((meal_type, i) => ({
      recipe_id: String(i),
      meal_type,
      name: "Test",
    })),
    recipeIngredients: [0, 1, 2].map((i) => ({
      recipe_id: String(i),
      food_id: "F001",
      base_amount_g: 100,
    })),
    foodAllergens: [{ food_id: "F001", allergen_id: "A01" }],
  };
  assert.throws(
    () =>
      quiet(() =>
        new Planner(fixture).generateWeeklyMealPlan({
          weeklyCalorieTarget: 14000,
          allergens: ["A01"],
        }),
      ),
    /Ersatz|Alternative/,
  );
});

test("V2: fehlende Mahlzeiten führen zu einem Planungsfehler", () => {
  assert.throws(
    () =>
      quiet(() =>
        new Planner({ ...db, recipes: [] }).generateWeeklyMealPlan({
          weeklyCalorieTarget: 14000,
        }),
      ),
    /Rezept/,
  );
});

test("V2: alle Diäten, Ziele und Makros erfüllen die tatsächlichen Zutatenbedingungen", () => {
  const random = Math.random;
  Math.random = () => 0.42;
  try {
    for (const dietCategory of [
      "normal",
      "vegetarisch",
      "pescetarisch",
      "vegan",
    ])
      for (const goal of ["diaet", "maintenance", "zunahme"])
        for (const macroPreference of ["protein", "lowcarb", "keto"])
          for (const allergens of [
            [],
            ["A01", "A07"],
            db.allergens.map((a) => a.allergen_id),
          ]) {
            const p = quiet(() =>
              generatePlan(db, {
                ...profile,
                dietCategory,
                goal,
                macroPreference,
                allergens,
                calorieAdjustment: goal === "maintenance" ? 0 : 300,
              }),
            );
            assert.ok(
              Math.abs(p.weeklyDeviation) <= 1e-9,
              `${dietCategory}/${goal}/${macroPreference}: ${p.weeklyDeviation}`,
            );
            assert.equal(p.days.length, 7);
            const blocked = new Set(
              db.foodAllergens
                .filter((a) => allergens.includes(a.allergen_id))
                .map((a) => a.food_id),
            );
            for (const day of p.days) {
              assert.equal(day.meals.length, 3);
              assert.ok(Math.abs(day.deviation) <= 50);
              for (const meal of day.meals)
                for (const i of meal.ingredients) {
                  assert.ok(i.amountG > 0);
                  assert.ok(!blocked.has(i.foodId));
                  assert.ok(
                    new Planner(db)._isFoodDietCompatible(
                      db.foods.find((f) => f.food_id === i.foodId),
                      dietCategory,
                    ),
                  );
                }
            }
          }
  } finally {
    Math.random = random;
  }
});

test("V2: Makroauswahl bewertet die Nährwerte nach Allergenersatz", () => {
  const food = (
    food_id,
    protein_per_100g,
    carbs_per_100g,
    fat_per_100g,
    food_type,
  ) => ({
    food_id,
    name: food_id,
    protein_per_100g,
    carbs_per_100g,
    fat_per_100g,
    kcal_per_100g: protein_per_100g * 4 + carbs_per_100g * 4 + fat_per_100g * 9,
    food_type,
    diet_category: "vegan",
  });
  const foods = [
    food("original", 40, 30, 20, "Protein"),
    food("replacement", 35, 34, 22, "Protein"),
    food("other", 37, 32, 21, "Fett"),
  ];
  const recipes = ["Frühstück", "Mittagessen", "Abendessen"].flatMap(
    (meal_type, n) =>
      ["original", "other"].map((id) => ({
        recipe_id: `${n}-${id}`,
        name: id,
        meal_type,
      })),
  );
  const fixture = {
    foods,
    recipes,
    recipeIngredients: recipes.map((r) => ({
      recipe_id: r.recipe_id,
      food_id: r.name,
      base_amount_g: 100,
    })),
    foodAllergens: [{ food_id: "original", allergen_id: "A" }],
  };
  const make = (allergens) =>
    quiet(() =>
      new Planner(fixture).generateWeeklyMealPlan({
        weeklyCalorieTarget: 14000,
        dietCategory: "vegan",
        macroPreference: "proteinHeavy",
        allergens,
      }),
    );
  const before = make([]),
    after = make(["A"]);
  assert.ok(
    before.weekPlan.every((d) =>
      Object.values(d.meals).every((m) => m.name === "original"),
    ),
  );
  assert.ok(
    after.weekPlan.every((d) =>
      Object.values(d.meals).every((m) => m.name === "other"),
    ),
  );
});
