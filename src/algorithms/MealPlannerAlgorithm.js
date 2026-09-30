/**
 * Meal Planner Algorithm
 * AR01: Kalorien- & Toleranzausgleich
 * AR02: Allergen-Substitution
 */

class MealPlannerAlgorithm {
  constructor(database) {
    this.db = database;
    this.weekPlan = [];
    this.dailyCalorieVariances = [];
  }

  /**
   * Hauptmethode: Erstellt einen wöchentlichen Essensplan
   * @param {Object} config - Konfiguration mit Benutzerpräferenzen
   * @param {number} config.weeklyCalorieTarget - Zielkalorien pro Woche
   * @param {number} config.dailyCalorieTarget - Zielkalorien pro Tag (weeklyCalorieTarget / 7)
   * @param {Array<string>} config.allergens - Liste von Allergen-IDs (z.B. ['A01', 'A07'])
   * @param {Array<string>} config.dietCategory - Diätkategorie (z.B. 'vegan', 'vegetarisch', 'normal', 'pescetarisch')
   * @param {Array<string>} config.mealTypePreferences - Mahlzeitentypen-Vorlieben
   * @returns {Object} - Wochenplan mit optimierten Rezepten und Kalorienausgleich
   */
  generateWeeklyMealPlan(config) {
    const {
      weeklyCalorieTarget,
      allergens = [],
      dietCategory = null,
      mealTypePreferences = ['Frühstück', 'Mittagessen', 'Abendessen']
    } = config;

    const dailyCalorieTarget = weeklyCalorieTarget / 7;
    this.weekPlan = [];
    this.dailyCalorieVariances = new Array(7).fill(0);

    console.log(`🎯 Ziel: ${weeklyCalorieTarget} kcal/Woche (${dailyCalorieTarget} kcal/Tag)`);

    // Phase 1: Rohes Rezeptauswahl für jeden Tag
    const rawWeekPlan = this._selectRecipesForWeek(
      7,
      mealTypePreferences,
      allergens,
      dietCategory
    );

    // Phase 2: Allergen-Substitution (AR02)
    const substitutedWeekPlan = this._performAllergenSubstitution(
      rawWeekPlan,
      allergens
    );

    // Phase 3: Mengenberechnung mit Kalorien-Toleranzausgleich (AR01)
    const optimizedWeekPlan = this._optimizeCaloriesWithWeeklyConstraint(
      substitutedWeekPlan,
      dailyCalorieTarget,
      weeklyCalorieTarget
    );

    return {
      weekPlan: optimizedWeekPlan,
      summary: this._generateSummary(optimizedWeekPlan, weeklyCalorieTarget),
      dailyVariances: this.dailyCalorieVariances
    };
  }

  /**
   * Phase 1: Wähle Rezepte für die Woche aus
   */
  _selectRecipesForWeek(days, mealTypes, allergens, dietCategory) {
    const weekPlan = [];

    for (let day = 0; day < days; day++) {
      const dayPlan = {};

      for (const mealType of mealTypes) {
        // Finde verfügbare Rezepte für diesen Mahlzeitentyp
        let availableRecipes = this.db.recipes.filter(
          (r) => r.meal_type === mealType
        );

        // Filtere nach Diätkategorie
        if (dietCategory) {
          availableRecipes = availableRecipes.filter((recipe) => {
            return this._checkDietCategoryCompatibility(recipe.recipe_id, dietCategory);
          });
        }

        // Wähle zufällig ein Rezept (später kann hier eine intelligentere Auswahl erfolgen)
        const selectedRecipe =
          availableRecipes[Math.floor(Math.random() * availableRecipes.length)];

        if (selectedRecipe) {
          dayPlan[mealType] = {
            recipe_id: selectedRecipe.recipe_id,
            name: selectedRecipe.name,
            originalIngredients: this._getRecipeIngredients(selectedRecipe.recipe_id)
          };
        }
      }

      weekPlan.push({
        day: day + 1,
        dayName: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'][day],
        meals: dayPlan
      });
    }

    return weekPlan;
  }

  /**
   * Phase 2: Allergen-Substitution (AR02)
   * Ersetzt allergenhaltige Zutaten durch makronährstoff-ähnliche Alternativen
   */
  _performAllergenSubstitution(weekPlan, userAllergens) {
    const substitutedPlan = JSON.parse(JSON.stringify(weekPlan));

    for (const day of substitutedPlan) {
      for (const mealType in day.meals) {
        const meal = day.meals[mealType];
        const originalIngredients = meal.originalIngredients;

        meal.ingredients = originalIngredients.map((ingredient) => {
          const allergenIds = this.db.foodAllergens
            .filter((fa) => fa.food_id === ingredient.food_id)
            .map((fa) => fa.allergen_id);

          const hasAllergen = allergenIds.some((a) => userAllergens.includes(a));

          if (hasAllergen) {
            const alternative = this._findSubstitute(
              ingredient.food_id,
              allergenIds.filter((a) => userAllergens.includes(a)),
              userAllergens
            );

            if (alternative) {
              console.log(
                `✏️ [${day.dayName}] ${mealType}: ${this._getFoodName(ingredient.food_id)} → ${alternative.name}`
              );
              return {
                ...alternative,
                original_food_id: ingredient.food_id,
                base_amount_g: ingredient.base_amount_g,
                substituted: true
              };
            }
          }

          return ingredient;
        });

        meal.substitutions = meal.ingredients.filter((i) => i.substituted || false);
      }
    }

    return substitutedPlan;
  }

  /**
   * Finde eine makronährstoff-ähnliche Alternative ohne Allergen
   */
  _findSubstitute(foodId, allergenIds, userAllergens) {
    const originalFood = this.db.foods.find((f) => f.food_id === foodId);
    if (!originalFood) return null;

    const tolerance = {
      carbs: originalFood.carbs_per_100g * 0.15,
      protein: originalFood.protein_per_100g * 0.15,
      fat: originalFood.fat_per_100g * 0.15
    };

    const candidates = this.db.foods.filter((f) => {
      if (f.food_type !== originalFood.food_type) return false;

      const candidateAllergens = this.db.foodAllergens
        .filter((fa) => fa.food_id === f.food_id)
        .map((fa) => fa.allergen_id);

      if (candidateAllergens.some((a) => userAllergens.includes(a))) {
        return false;
      }

      const carbsDiff = Math.abs(f.carbs_per_100g - originalFood.carbs_per_100g);
      const proteinDiff = Math.abs(f.protein_per_100g - originalFood.protein_per_100g);
      const fatDiff = Math.abs(f.fat_per_100g - originalFood.fat_per_100g);

      return (
        carbsDiff <= tolerance.carbs &&
        proteinDiff <= tolerance.protein &&
        fatDiff <= tolerance.fat
      );
    });

    if (candidates.length === 0) return null;

    const best = candidates.reduce((best, candidate) => {
      const score =
        Math.abs(candidate.carbs_per_100g - originalFood.carbs_per_100g) +
        Math.abs(candidate.protein_per_100g - originalFood.protein_per_100g) +
        Math.abs(candidate.fat_per_100g - originalFood.fat_per_100g);

      const bestScore =
        Math.abs(best.carbs_per_100g - originalFood.carbs_per_100g) +
        Math.abs(best.protein_per_100g - originalFood.protein_per_100g) +
        Math.abs(best.fat_per_100g - originalFood.fat_per_100g);

      return score < bestScore ? candidate : best;
    });

    return best;
  }

  /**
   * Phase 3: AR01 - Kalorien-Toleranzausgleich mit Wochenausgleich
   * - Tägliche Abweichung: ±50 kcal
   * - Wöchentliche Abweichung: 0 kcal (exakt)
   */
  _optimizeCaloriesWithWeeklyConstraint(weekPlan, dailyCalorieTarget, weeklyCalorieTarget) {
    const optimizedPlan = JSON.parse(JSON.stringify(weekPlan));

    let totalWeeklyCalories = 0;

    for (let dayIndex = 0; dayIndex < optimizedPlan.length; dayIndex++) {
      const day = optimizedPlan[dayIndex];
      let dayCalories = 0;

      for (const mealType in day.meals) {
        const meal = day.meals[mealType];
        const ingredients = meal.ingredients || meal.originalIngredients;

        meal.ingredients = ingredients.map((ingredient) => {
          const food = this.db.foods.find((f) => f.food_id === ingredient.food_id);
          if (!food) return ingredient;

          const baseCalories = (food.kcal_per_100g / 100) * ingredient.base_amount_g;

          return {
            ...ingredient,
            original_amount_g: ingredient.base_amount_g,
            calories: baseCalories
          };
        });

        const mealCalories = meal.ingredients.reduce((sum, i) => sum + (i.calories || 0), 0);
        meal.totalCalories = mealCalories;
        dayCalories += mealCalories;
      }

      day.dayCalories = dayCalories;
      totalWeeklyCalories += dayCalories;
    }

    console.log(`\n📊 Vor Optimierung: ${totalWeeklyCalories.toFixed(1)} kcal/Woche`);

    const adjustedPlan = this._iterativeCalorieAdjustment(
      optimizedPlan,
      dailyCalorieTarget,
      weeklyCalorieTarget
    );

    return adjustedPlan;
  }

  /**
   * Iterative Kalorien-Anpassung mit Dual-Constraint (täglich ±50, wöchentlich 0)
   */
  _iterativeCalorieAdjustment(weekPlan, dailyCalorieTarget, weeklyCalorieTarget) {
    const maxIterations = 100;
    const dailyTolerance = 50;
    let iteration = 0;

    while (iteration < maxIterations) {
      let totalCalories = 0;
      const dayDeviations = [];

      for (let dayIndex = 0; dayIndex < weekPlan.length; dayIndex++) {
        const day = weekPlan[dayIndex];
        let dayCalories = 0;

        for (const mealType in day.meals) {
          const meal = day.meals[mealType];
          const mealCalories = meal.ingredients.reduce((sum, i) => sum + (i.calories || 0), 0);
          dayCalories += mealCalories;
        }

        day.dayCalories = dayCalories;
        const deviation = dayCalories - dailyCalorieTarget;
        dayDeviations.push(deviation);
        totalCalories += dayCalories;
        this.dailyCalorieVariances[dayIndex] = deviation;
      }

      const weeklyDeviation = totalCalories - weeklyCalorieTarget;

      console.log(
        `\n🔄 Iteration ${iteration + 1}: ${totalCalories.toFixed(1)} kcal (Abweichung: ${weeklyDeviation.toFixed(1)} kcal)`
      );

      if (Math.abs(weeklyDeviation) < 0.1) {
        const allDaysTolerant = dayDeviations.every(
          (dev) => Math.abs(dev) <= dailyTolerance
        );

        if (allDaysTolerant) {
          console.log(`✅ AR01 erfolgreich: Wöchentlich 0 kcal, täglich ±${dailyTolerance} kcal`);
          return weekPlan;
        }
      }

      const weeklyScalingFactor = weeklyCalorieTarget / totalCalories;

      for (let dayIndex = 0; dayIndex < weekPlan.length; dayIndex++) {
        const day = weekPlan[dayIndex];
        const dayDeviation = dayDeviations[dayIndex];
        const dayCalories = day.dayCalories;

        for (const mealType in day.meals) {
          const meal = day.meals[mealType];

          meal.ingredients = meal.ingredients.map((ingredient) => {
            const food = this.db.foods.find((f) => f.food_id === ingredient.food_id);
            if (!food) return ingredient;

            let scalingFactor = weeklyScalingFactor;

            if (Math.abs(dayDeviation) > dailyTolerance) {
              const dayScalingFactor = (dayCalories - dayDeviation * 0.5) / dayCalories;
              scalingFactor = (scalingFactor + dayScalingFactor) / 2;
            }

            const currentAmount = ingredient.amount_g ?? ingredient.original_amount_g;
            const newAmount = currentAmount * scalingFactor;
            const newCalories = (food.kcal_per_100g / 100) * newAmount;

            return {
              ...ingredient,
              amount_g: newAmount,
              calories: newCalories,
              scalingFactor: scalingFactor
            };
          });
        }
      }

      iteration++;
    }

    console.log(`⚠️ Optimierung: Max Iterationen (${maxIterations}) erreicht`);
    return weekPlan;
  }

  /**
   * Hilfsfunktion: Hole Zutaten eines Rezepts
   */
  _getRecipeIngredients(recipeId) {
    return this.db.recipeIngredients.filter((ri) => ri.recipe_id === recipeId);
  }

  /**
   * Hilfsfunktion: Prüfe Diätkategorie-Kompatibilität
   */
  _checkDietCategoryCompatibility(recipeId, dietCategory) {
    const ingredients = this._getRecipeIngredients(recipeId);

    return ingredients.every((ingredient) => {
      const food = this.db.foods.find((f) => f.food_id === ingredient.food_id);
      if (!food) return false;

      const validCategories = {
        vegan: ['vegan'],
        vegetarisch: ['vegan', 'vegetarisch'],
        pescetarisch: ['vegan', 'vegetarisch', 'pescetarisch'],
        normal: ['vegan', 'vegetarisch', 'pescetarisch', 'normal']
      };

      return validCategories[dietCategory].includes(food.diet_category);
    });
  }

  /**
   * Hilfsfunktion: Hole Lebensmittelnamen
   */
  _getFoodName(foodId) {
    const food = this.db.foods.find((f) => f.food_id === foodId);
    return food ? food.name : foodId;
  }

  /**
   * Generiere Zusammenfassung des Wochenplans
   */
  _generateSummary(weekPlan, weeklyCalorieTarget) {
    let totalCalories = 0;
    const summary = {
      days: []
    };

    for (const day of weekPlan) {
      let dayTotal = 0;
      const dayMeals = [];

      for (const mealType in day.meals) {
        const meal = day.meals[mealType];
        const mealCalories = meal.ingredients.reduce((sum, i) => sum + (i.calories || 0), 0);
        dayTotal += mealCalories;

        dayMeals.push({
          mealType,
          recipeName: meal.name,
          calories: mealCalories.toFixed(1),
          ingredients: meal.ingredients.map((ing) => ({
            food_id: ing.food_id,
            name: this._getFoodName(ing.food_id),
            amount_g: ing.amount_g ? ing.amount_g.toFixed(1) : ing.base_amount_g,
            calories: ing.calories ? ing.calories.toFixed(1) : 0,
            substituted: ing.substituted || false
          }))
        });
      }

      totalCalories += dayTotal;
      summary.days.push({
        day: day.day,
        dayName: day.dayName,
        totalCalories: dayTotal.toFixed(1),
        deviation: (dayTotal - weeklyCalorieTarget / 7).toFixed(1),
        meals: dayMeals
      });
    }

    summary.weeklyTotal = totalCalories.toFixed(1);
    summary.weeklyTarget = weeklyCalorieTarget;
    summary.weeklyDeviation = (totalCalories - weeklyCalorieTarget).toFixed(1);

    return summary;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MealPlannerAlgorithm;
}
