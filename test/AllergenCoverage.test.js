const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const MealPlannerAlgorithm = require("../src/algorithms/MealPlannerAlgorithm");
const { readCsv } = require("../src/data/csvLoader");

const databaseDir = path.join(__dirname, "..", "Datenbank");

function loadDatabase() {
  return {
    foods: readCsv(path.join(databaseDir, "foods.csv")),
    recipes: readCsv(path.join(databaseDir, "recipes.csv")),
    recipeIngredients: readCsv(path.join(databaseDir, "recipe_ingredients.csv")),
    foodAllergens: readCsv(path.join(databaseDir, "food_allergens.csv")),
    allergens: readCsv(path.join(databaseDir, "allergens.csv"))
  };
}

function hasSimilarMacros(source, candidate) {
  return ["carbs_per_100g", "protein_per_100g", "fat_per_100g"].every(
    (key) => Math.abs(candidate[key] - source[key]) <= source[key] * 0.15
  );
}

test("findet für jede verwendete allergene Zutat eine allergenfreie Alternative", () => {
  const database = loadDatabase();
  const planner = new MealPlannerAlgorithm(database);
  const usedFoodIds = new Set(database.recipeIngredients.map((row) => row.food_id));
  const allAllergenIds = database.allergens.map((row) => row.allergen_id);
  const allergensByFood = new Map();

  for (const row of database.foodAllergens) {
    if (!allergensByFood.has(row.food_id)) allergensByFood.set(row.food_id, []);
    allergensByFood.get(row.food_id).push(row.allergen_id);
  }

  const allergenicFoods = database.foods.filter(
    (food) => usedFoodIds.has(food.food_id) && allergensByFood.has(food.food_id)
  );
  const missingAlternatives = [];
  let foodsWithBuffer = 0;

  for (const food of allergenicFoods) {
    const alternative = planner._findSubstitute(
      food.food_id,
      allergensByFood.get(food.food_id),
      allAllergenIds,
      food.diet_category
    );

    if (!alternative) {
      missingAlternatives.push(`${food.food_id} ${food.name}`);
      continue;
    }

    const alternativeAllergens = allergensByFood.get(alternative.food_id) || [];
    assert.equal(alternativeAllergens.length, 0, `${alternative.name} ist nicht allergenfrei`);

    const safeCandidates = database.foods.filter((candidate) =>
      candidate.food_type === food.food_type &&
      !allergensByFood.has(candidate.food_id) &&
      hasSimilarMacros(food, candidate)
    );
    if (safeCandidates.length >= 2) foodsWithBuffer++;
  }

  assert.deepEqual(missingAlternatives, []);
  assert.ok(foodsWithBuffer >= 5, `Nur ${foodsWithBuffer} Zutaten besitzen einen Puffer`);
});
