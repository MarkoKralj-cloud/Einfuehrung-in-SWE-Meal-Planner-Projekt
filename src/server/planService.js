/**
 * Verbindet Onboarding-Profil, Datenbank und MealPlannerAlgorithm
 * FR01–FR05: Profil validieren
 * FR07: Wochenplan generieren
 */

const path = require("node:path");
const MealPlannerAlgorithm = require("../algorithms/MealPlannerAlgorithm");
const { readCsv } = require("../data/csvLoader");

const DIET_CATEGORIES = ["normal", "vegetarisch", "pescetarisch", "vegan"];
const GOALS = ["diaet", "maintenance", "zunahme"];
const MACRO_PREFERENCES = ["protein", "lowcarb", "keto"];
const MEAL_TYPES = ["Frühstück", "Mittagessen", "Abendessen"];
const DAY_NAMES = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

const MIN_ADJUSTMENT = 100;
const MAX_ADJUSTMENT = 1000;
const ADJUSTMENT_STEP = 50;

function validateFood(food) {
  for (const field of [
    "kcal_per_100g",
    "carbs_per_100g",
    "protein_per_100g",
    "fat_per_100g",
  ]) {
    if (!Number.isFinite(food[field]) || food[field] < 0)
      throw new RangeError(`Ungültiger Nährwert: ${food.name} (${field})`);
  }
}

function loadDatabase(dbDir) {
  const read = (fileName) => readCsv(path.join(dbDir, fileName));

  const db = {
    foods: read("foods.csv"),
    recipes: read("recipes.csv"),
    recipeIngredients: read("recipe_ingredients.csv"),
    foodAllergens: read("food_allergens.csv"),
    allergens: read("allergens.csv"),
  };
  db.foods.forEach(validateFood);
  const foodIds = new Set(db.foods.map((f) => f.food_id));
  const allergenIds = new Set(db.allergens.map((a) => a.allergen_id));
  if (
    db.recipeIngredients.some(
      (i) =>
        !foodIds.has(i.food_id) ||
        !Number.isFinite(i.base_amount_g) ||
        i.base_amount_g <= 0,
    ) ||
    db.foodAllergens.some(
      (a) => !foodIds.has(a.food_id) || !allergenIds.has(a.allergen_id),
    )
  )
    throw new Error("Ungültige CSV-Zuordnung");
  if (
    !db.recipes.length ||
    new Set(db.recipes.map((r) => r.recipe_id)).size !== db.recipes.length
  )
    throw new Error("Rezepte fehlen oder enthalten doppelte IDs");
  return db;
}

/**
 * Prüft die Onboarding-Eingaben und gibt ein bereinigtes Profil zurück.
 * Wirft einen Error mit verständlicher Meldung bei ungültigen Werten.
 */
function validateProfile(input, db) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Profil fehlt");
  }

  const { dietCategory, goal, macroPreference } = input;

  if (!DIET_CATEGORIES.includes(dietCategory)) {
    throw new Error("Bitte genau eine Ernährungsform wählen");
  }
  if (!GOALS.includes(goal)) {
    throw new Error("Bitte ein Ernährungsziel wählen");
  }
  if (!MACRO_PREFERENCES.includes(macroPreference)) {
    throw new Error("Bitte eine Makronährstoffverteilung wählen");
  }

  const maintenanceCalories = Number(input.maintenanceCalories);
  if (
    !Number.isFinite(maintenanceCalories) ||
    maintenanceCalories < 1200 ||
    maintenanceCalories > 4500
  ) {
    throw new Error("Der Tagesbedarf muss zwischen 1200 und 4500 kcal liegen");
  }

  // FR03: Slider nur bei Diät / Gewichtszunahme, 100–1000 kcal in 50er-Schritten
  let calorieAdjustment = 0;
  if (goal !== "maintenance") {
    calorieAdjustment = Number(input.calorieAdjustment);
    const isValidStep = calorieAdjustment % ADJUSTMENT_STEP === 0;
    if (
      calorieAdjustment < MIN_ADJUSTMENT ||
      calorieAdjustment > MAX_ADJUSTMENT ||
      !isValidStep
    ) {
      throw new Error(
        "Die Kalorienanpassung muss zwischen 100 und 1000 kcal in 50er-Schritten liegen",
      );
    }
  }

  if (
    calculateDailyTarget({ goal, maintenanceCalories, calorieAdjustment }) <= 0
  )
    throw new Error("Das tägliche Kalorienziel muss positiv sein");
  if (!Array.isArray(input.allergens))
    throw new Error("Allergene müssen eine Liste sein");
  // FR05: Nur Allergene aus der Datenbank zulassen
  const knownAllergens = new Set(db.allergens.map((a) => a.allergen_id));
  const allergens = Array.isArray(input.allergens)
    ? [...new Set(input.allergens)]
    : [];
  const unknown = allergens.filter((id) => !knownAllergens.has(id));
  if (unknown.length > 0) {
    throw new Error(`Unbekannte Allergene: ${unknown.join(", ")}`);
  }

  return {
    dietCategory,
    goal,
    calorieAdjustment,
    macroPreference,
    maintenanceCalories: Math.round(maintenanceCalories),
    allergens,
  };
}

function calculateDailyTarget(profile) {
  if (profile.goal === "diaet")
    return profile.maintenanceCalories - profile.calorieAdjustment;
  if (profile.goal === "zunahme")
    return profile.maintenanceCalories + profile.calorieAdjustment;
  return profile.maintenanceCalories;
}

// Montag der Woche, in der `date` liegt (lokale Zeit)
function getMonday(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return monday;
}

function toIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function generatePlan(db, profile, today = new Date()) {
  const dailyTarget = calculateDailyTarget(profile);
  const planner = new MealPlannerAlgorithm(db);

  // Der Algorithmus loggt jeden Iterationsschritt – im Server unterdrücken
  const originalLog = console.log;
  console.log = () => {};

  let result;
  try {
    result = planner.generateWeeklyMealPlan({
      weeklyCalorieTarget: dailyTarget * 7,
      allergens: profile.allergens,
      dietCategory: profile.dietCategory,
      macroPreference: {
        protein: "proteinHeavy",
        lowcarb: "lowCarb",
        keto: "keto",
      }[profile.macroPreference],
    });
  } finally {
    console.log = originalLog;
  }

  return buildPlanView(db, result, profile, dailyTarget, getMonday(today));
}

/**
 * Wandelt das Ergebnis des Algorithmus in eine Struktur für GUI und ICS-Export um
 * DR04: jedem Wochentag werden genau drei Mahlzeiten zugeordnet
 */
function buildPlanView(db, result, profile, dailyTarget, monday) {
  const foodsById = new Map(db.foods.map((food) => [food.food_id, food]));

  const days = result.weekPlan.map((day, dayIndex) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + dayIndex);

    const meals = MEAL_TYPES.filter((mealType) => day.meals[mealType]).map(
      (mealType) => {
        const meal = day.meals[mealType];
        const ingredients = meal.ingredients.map((ingredient) => {
          const food = foodsById.get(ingredient.food_id);
          const amount =
            ingredient.amount_g ??
            ingredient.original_amount_g ??
            ingredient.base_amount_g;
          const original = ingredient.substituted
            ? foodsById.get(ingredient.original_food_id)
            : null;

          return {
            foodId: ingredient.food_id,
            name: food ? food.name : ingredient.food_id,
            amountG: amount,
            kcal: ingredient.calories || 0,
            protein: food ? (food.protein_per_100g * amount) / 100 : 0,
            carbs: food ? (food.carbs_per_100g * amount) / 100 : 0,
            fat: food ? (food.fat_per_100g * amount) / 100 : 0,
            originalFoodId: original ? original.food_id : null,
            substitutedFor: original ? original.name : null,
          };
        });

        return {
          mealType,
          recipeId: meal.recipe_id,
          name:
            meal.name +
            (ingredients.some((i) => i.substitutedFor) ? " (angepasst)" : ""),
          ...sumNutrients(ingredients),
          ingredients,
        };
      },
    );

    const totals = sumNutrients(meals);

    return {
      date: toIsoDate(date),
      dayName: DAY_NAMES[dayIndex],
      ...totals,
      deviation: totals.kcal - dailyTarget,
      meals,
    };
  });

  const weekTotals = sumNutrients(days);

  return {
    generatedAt: new Date().toISOString(),
    weekStart: toIsoDate(monday),
    profile,
    dailyTarget,
    weeklyTarget: dailyTarget * 7,
    weeklyTotal: weekTotals.kcal,
    weeklyDeviation: weekTotals.kcal - dailyTarget * 7,
    macros: {
      protein: weekTotals.protein,
      carbs: weekTotals.carbs,
      fat: weekTotals.fat,
    },
    days,
  };
}

// Prüft die tatsächlichen Zutaten und baut Anzeige- und Exportwerte aus CSV neu auf.
function validatePlan(db, profile, plan) {
  const monday = new Date(plan?.weekStart + "T12:00:00");
  if (
    !Number.isFinite(monday.getTime()) ||
    toIsoDate(monday) !== plan.weekStart ||
    monday.getDay() !== 1
  )
    throw new RangeError("Ungültiger Wochenbeginn");
  if (!Array.isArray(plan.days) || plan.days.length !== 7)
    throw new RangeError("Der Plan muss sieben Tage enthalten");
  const planner = new MealPlannerAlgorithm(db);
  const dailyTarget = calculateDailyTarget(profile);
  const foods = new Map(db.foods.map((f) => [f.food_id, f]));
  const weekPlan = plan.days.map((day, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    if (
      day.date !== toIsoDate(date) ||
      !Array.isArray(day.meals) ||
      day.meals.length !== 3 ||
      new Set(day.meals.map((m) => m.mealType)).size !== 3
    )
      throw new RangeError("Jeder Tag muss genau drei Mahlzeiten enthalten");
    const meals = {};
    for (const meal of day.meals) {
      const recipe = db.recipes.find(
        (r) => r.recipe_id === meal.recipeId && r.meal_type === meal.mealType,
      );
      if (!recipe || !MEAL_TYPES.includes(meal.mealType))
        throw new RangeError("Ungültiges Basisrezept");
      const ids = db.recipeIngredients
        .filter((i) => i.recipe_id === meal.recipeId)
        .map((i) => i.food_id);
      if (
        !Array.isArray(meal.ingredients) ||
        !ids.length ||
        meal.ingredients.length !== ids.length ||
        new Set(meal.ingredients.map((i) => i.originalFoodId || i.foodId))
          .size !== ids.length
      )
        throw new RangeError("Rezept-Zutaten fehlen");
      const ingredients = meal.ingredients.map((i) => {
        const originalId = i.originalFoodId || i.foodId;
        const food = foods.get(i.foodId),
          original = foods.get(originalId);
        if (food) validateFood(food);
        if (original) validateFood(original);
        if (
          !ids.includes(originalId) ||
          !food ||
          !original ||
          !Number.isFinite(i.amountG) ||
          i.amountG <= 0 ||
          !planner._isFoodDietCompatible(food, profile.dietCategory)
        )
          throw new RangeError("Ungültige Zutaten oder Ernährungsform");
        if (
          db.foodAllergens.some(
            (a) =>
              a.food_id === food.food_id &&
              profile.allergens.includes(a.allergen_id),
          )
        )
          throw new RangeError("Allergen im Wochenplan");
        if (originalId !== i.foodId) {
          const affected = db.foodAllergens.some(
            (a) =>
              a.food_id === originalId &&
              profile.allergens.includes(a.allergen_id),
          );
          if (
            !affected ||
            food.food_type !== original.food_type ||
            ["carbs_per_100g", "protein_per_100g", "fat_per_100g"].some(
              (k) =>
                Math.abs(food[k] - original[k]) > original[k] * 0.15 + 1e-12,
            )
          )
            throw new RangeError("Ungültiger Allergenersatz");
        }
        const calories = (food.kcal_per_100g * i.amountG) / 100;
        if (
          !Number.isFinite(calories) ||
          !Number.isFinite(i.kcal) ||
          Math.abs(i.kcal - calories) > 1e-9
        )
          throw new RangeError("Ungültige Zutatenkalorien");
        return {
          food_id: i.foodId,
          original_food_id: originalId,
          substituted: originalId !== i.foodId,
          amount_g: i.amountG,
          calories,
        };
      });
      const kcal = ingredients.reduce((sum, i) => sum + i.calories, 0);
      meals[meal.mealType] = {
        recipe_id: recipe.recipe_id,
        name: recipe.name,
        ingredients,
        kcal,
      };
    }
    const kcal = Object.values(meals).reduce((sum, m) => sum + m.kcal, 0);
    if (!Number.isFinite(kcal) || Math.abs(kcal - dailyTarget) > 50)
      throw new RangeError("Tages-Toleranz überschritten");
    return { day: index + 1, meals };
  });
  const total = weekPlan.reduce(
    (sum, d) => sum + Object.values(d.meals).reduce((s, m) => s + m.kcal, 0),
    0,
  );
  if (!Number.isFinite(total) || Math.abs(total - dailyTarget * 7) > 1e-9)
    throw new RangeError("Wochenplan verfehlt exaktes Kalorienziel");
  const canonical = buildPlanView(
    db,
    { weekPlan },
    profile,
    dailyTarget,
    monday,
  );
  canonical.generatedAt = plan.generatedAt;
  return canonical;
}

function sumNutrients(items) {
  return items.reduce(
    (sum, item) => ({
      kcal: sum.kcal + item.kcal,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

module.exports = {
  DIET_CATEGORIES,
  GOALS,
  MACRO_PREFERENCES,
  MEAL_TYPES,
  loadDatabase,
  validateProfile,
  calculateDailyTarget,
  getMonday,
  toIsoDate,
  generatePlan,
  buildPlanView,
  validatePlan,
};
