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

test("ersetzt Allergene ohne die gewählte Ernährungsform zu verletzen", () => {
  const sourceFood = {
    food_id: "F001",
    name: "Fischzutat",
    kcal_per_100g: 100,
    carbs_per_100g: 0,
    protein_per_100g: 24,
    fat_per_100g: 1,
    food_type: "Protein",
    diet_category: "pescetarisch"
  };
  const database = {
    foods: [
      sourceFood,
      {
        ...sourceFood,
        food_id: "F002",
        name: "Geflügelalternative",
        diet_category: "normal"
      },
      {
        ...sourceFood,
        food_id: "F003",
        name: "Vegane Alternative",
        protein_per_100g: 23,
        diet_category: "vegan"
      }
    ],
    recipes: [
      { recipe_id: "R001", name: "Frühstück", meal_type: "Frühstück" },
      { recipe_id: "R002", name: "Mittagessen", meal_type: "Mittagessen" },
      { recipe_id: "R003", name: "Abendessen", meal_type: "Abendessen" }
    ],
    recipeIngredients: ["R001", "R002", "R003"].map((recipe_id) => ({
      recipe_id,
      food_id: "F001",
      base_amount_g: 100
    })),
    foodAllergens: [{ food_id: "F001", allergen_id: "A04" }],
    allergens: [{ allergen_id: "A04", name: "Fisch" }]
  };
  const originalLog = console.log;
  console.log = () => {};

  let result;
  try {
    result = new MealPlannerAlgorithm(database).generateWeeklyMealPlan({
      weeklyCalorieTarget: 2100,
      dietCategory: "pescetarisch",
      allergens: ["A04"]
    });
  } finally {
    console.log = originalLog;
  }

  const ingredients = result.weekPlan.flatMap((day) =>
    Object.values(day.meals).flatMap((meal) => meal.ingredients)
  );
  assert.ok(ingredients.every((ingredient) => ingredient.food_id === "F003"));
});
