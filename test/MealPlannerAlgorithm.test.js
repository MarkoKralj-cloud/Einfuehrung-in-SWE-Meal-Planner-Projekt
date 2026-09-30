const test = require("node:test");
const assert = require("node:assert/strict");

const MealPlannerAlgorithm = require("../src/algorithms/MealPlannerAlgorithm");

function createDatabase() {
  const foods = [
    {
      food_id: "F001",
      name: "Testzutat",
      kcal_per_100g: 100,
      carbs_per_100g: 20,
      protein_per_100g: 3,
      fat_per_100g: 1,
      food_type: "Carb",
      diet_category: "vegan"
    }
  ];

  const recipes = [
    { recipe_id: "R001", name: "Testfruehstueck", meal_type: "Frühstück" },
    { recipe_id: "R002", name: "Testmittagessen", meal_type: "Mittagessen" },
    { recipe_id: "R003", name: "Testabendessen", meal_type: "Abendessen" }
  ];

  return {
    foods,
    recipes,
    recipeIngredients: recipes.map((recipe) => ({
      recipe_id: recipe.recipe_id,
      food_id: "F001",
      base_amount_g: 100
    })),
    foodAllergens: [],
    allergens: []
  };
}

test("erreicht das Wochenziel und hält jeden Tag innerhalb von 50 kcal", () => {
  const planner = new MealPlannerAlgorithm(createDatabase());
  const originalLog = console.log;
  console.log = () => {};

  let result;
  try {
    result = planner.generateWeeklyMealPlan({ weeklyCalorieTarget: 14000 });
  } finally {
    console.log = originalLog;
  }

  assert.ok(Math.abs(Number(result.summary.weeklyDeviation)) < 0.1);
  assert.ok(
    result.summary.days.every((day) => Math.abs(Number(day.deviation)) <= 50)
  );
});
