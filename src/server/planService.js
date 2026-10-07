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
const DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

const MIN_ADJUSTMENT = 100;
const MAX_ADJUSTMENT = 1000;
const ADJUSTMENT_STEP = 50;

function loadDatabase(dbDir) {
  const read = (fileName) => readCsv(path.join(dbDir, fileName));

  return {
    foods: read("foods.csv"),
    recipes: read("recipes.csv"),
    recipeIngredients: read("recipe_ingredients.csv"),
    foodAllergens: read("food_allergens.csv"),
    allergens: read("allergens.csv")
  };
}

/**
 * Prüft die Onboarding-Eingaben und gibt ein bereinigtes Profil zurück.
 * Wirft einen Error mit verständlicher Meldung bei ungültigen Werten.
 */
function validateProfile(input, db) {
  if (!input || typeof input !== "object") {
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
  if (!Number.isFinite(maintenanceCalories) || maintenanceCalories < 1200 || maintenanceCalories > 4500) {
    throw new Error("Der Tagesbedarf muss zwischen 1200 und 4500 kcal liegen");
  }

  // FR03: Slider nur bei Diät / Gewichtszunahme, 100–1000 kcal in 50er-Schritten
  let calorieAdjustment = 0;
  if (goal !== "maintenance") {
    calorieAdjustment = Number(input.calorieAdjustment);
    const isValidStep = calorieAdjustment % ADJUSTMENT_STEP === 0;
    if (calorieAdjustment < MIN_ADJUSTMENT || calorieAdjustment > MAX_ADJUSTMENT || !isValidStep) {
      throw new Error("Die Kalorienanpassung muss zwischen 100 und 1000 kcal in 50er-Schritten liegen");
    }
  }

  // FR05: Nur Allergene aus der Datenbank zulassen
  const knownAllergens = new Set(db.allergens.map((a) => a.allergen_id));
  const allergens = Array.isArray(input.allergens) ? [...new Set(input.allergens)] : [];
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
    allergens
  };
}

function calculateDailyTarget(profile) {
  if (profile.goal === "diaet") return profile.maintenanceCalories - profile.calorieAdjustment;
  if (profile.goal === "zunahme") return profile.maintenanceCalories + profile.calorieAdjustment;
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
      dietCategory: profile.dietCategory
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

    const meals = MEAL_TYPES.filter((mealType) => day.meals[mealType]).map((mealType) => {
      const meal = day.meals[mealType];
      const ingredients = meal.ingredients.map((ingredient) => {
        const food = foodsById.get(ingredient.food_id);
        const amount = ingredient.amount_g ?? ingredient.original_amount_g ?? ingredient.base_amount_g;
        const original = ingredient.substituted ? foodsById.get(ingredient.original_food_id) : null;

        return {
          foodId: ingredient.food_id,
          name: food ? food.name : ingredient.food_id,
          amountG: amount,
          kcal: ingredient.calories || 0,
          protein: food ? (food.protein_per_100g * amount) / 100 : 0,
          carbs: food ? (food.carbs_per_100g * amount) / 100 : 0,
          fat: food ? (food.fat_per_100g * amount) / 100 : 0,
          substitutedFor: original ? original.name : null
        };
      });

      return {
        mealType,
        recipeId: meal.recipe_id,
        name: meal.name,
        ...sumNutrients(ingredients),
        ingredients
      };
    });

    const totals = sumNutrients(meals);

    return {
      date: toIsoDate(date),
      dayName: DAY_NAMES[dayIndex],
      ...totals,
      deviation: totals.kcal - dailyTarget,
      meals
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
      fat: weekTotals.fat
    },
    days
  };
}

function sumNutrients(items) {
  return items.reduce(
    (sum, item) => ({
      kcal: sum.kcal + item.kcal,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
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
  generatePlan
};
