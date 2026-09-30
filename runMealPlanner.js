/**
 * Testlauf für den MealPlannerAlgorithm
 * Aufruf (im Projektordner): node runMealPlanner.js
 */

const path = require("node:path");
const MealPlannerAlgorithm = require("./src/algorithms/MealPlannerAlgorithm");
const { readCsv } = require("./src/data/csvLoader");

const DB_DIR = path.join(__dirname, "Datenbank");

const database = {
  foods: readCsv(path.join(DB_DIR, "foods.csv")),
  recipes: readCsv(path.join(DB_DIR, "recipes.csv")),
  recipeIngredients: readCsv(path.join(DB_DIR, "recipe_ingredients.csv")),
  foodAllergens: readCsv(path.join(DB_DIR, "food_allergens.csv")),
  allergens: readCsv(path.join(DB_DIR, "allergens.csv"))
};

// Testkonfiguration – hier Werte anpassen
const config = {
  weeklyCalorieTarget: 14000,
  allergens: ["A01"], // A01 = Gluten
  dietCategory: "vegetarisch"
};

const planner = new MealPlannerAlgorithm(database);
const result = planner.generateWeeklyMealPlan(config);

// Übersicht ausgeben
console.log("\n===== Wochenplan =====");
for (const day of result.summary.days) {
  console.log(`\n${day.dayName}: ${day.totalCalories} kcal (Abweichung: ${day.deviation})`);
  for (const meal of day.meals) {
    console.log(`  ${meal.mealType}: ${meal.recipeName} (${meal.calories} kcal)`);
  }
}
console.log(
  `\nWoche: ${result.summary.weeklyTotal} / ${result.summary.weeklyTarget} kcal ` +
    `(Abweichung: ${result.summary.weeklyDeviation})`
);

// Prüfen, ob noch Allergene im Plan sind
const leftovers = result.summary.days.flatMap((day) =>
  day.meals.flatMap((meal) =>
    meal.ingredients
      .filter((ing) =>
        database.foodAllergens.some(
          (fa) => fa.food_id === ing.food_id && config.allergens.includes(fa.allergen_id)
        )
      )
      .map((ing) => `${day.dayName} / ${meal.mealType}: ${ing.name}`)
  )
);
console.log(
  leftovers.length === 0
    ? "\n✅ Keine Allergene im Plan"
    : `\n❌ ${leftovers.length} Zutaten mit Allergenen:\n  ${leftovers.join("\n  ")}`
);
