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
   * @param {string} config.dietCategory - Diätkategorie (z.B. 'vegan', 'vegetarisch', 'normal', 'pescetarisch')
   * @param {string} config.macroPreference - 'keto', 'proteinHeavy' oder 'lowCarb'
   * @param {Array<string>} config.mealTypePreferences - Mahlzeitentypen-Vorlieben
   * @returns {Object} - Wochenplan mit optimierten Rezepten und Kalorienausgleich
   */
  generateWeeklyMealPlan(config) {
    const {
      weeklyCalorieTarget,
      allergens = [],
      dietCategory = null,
      macroPreference = null,
      mealTypePreferences = ["Frühstück", "Mittagessen", "Abendessen"],
    } = config;

    if (!Number.isFinite(weeklyCalorieTarget) || weeklyCalorieTarget <= 0)
      throw new RangeError("Kalorienziel muss positiv sein");
    this.userAllergens = allergens;
    this.dietCategory = dietCategory;
    const dailyCalorieTarget = weeklyCalorieTarget / 7;
    this.weekPlan = [];
    this.dailyCalorieVariances = new Array(7).fill(0);

    console.log(
      `🎯 Ziel: ${weeklyCalorieTarget} kcal/Woche (${dailyCalorieTarget} kcal/Tag)`,
    );

    // Phase 1: Rohes Rezeptauswahl für jeden Tag
    const rawWeekPlan = this._selectRecipesForWeek(
      7,
      mealTypePreferences,
      allergens,
      dietCategory,
      macroPreference,
    );

    // Phase 2: Allergen-Substitution (AR02)
    const substitutedWeekPlan = this._performAllergenSubstitution(
      rawWeekPlan,
      allergens,
      dietCategory,
    );

    // Phase 3: Mengenberechnung mit Kalorien-Toleranzausgleich (AR01)
    const optimizedWeekPlan = this._optimizeCaloriesWithWeeklyConstraint(
      substitutedWeekPlan,
      dailyCalorieTarget,
      weeklyCalorieTarget,
    );

    return {
      weekPlan: optimizedWeekPlan,
      summary: this._generateSummary(optimizedWeekPlan, weeklyCalorieTarget),
      dailyVariances: this.dailyCalorieVariances,
    };
  }

  /**
   * Phase 1: Wähle Rezepte für die Woche aus
   */
  _selectRecipesForWeek(
    days,
    mealTypes,
    allergens,
    dietCategory,
    macroPreference,
  ) {
    const weekPlan = [];

    for (let day = 0; day < days; day++) {
      const dayPlan = {};

      for (const mealType of mealTypes) {
        // Finde verfügbare Rezepte für diesen Mahlzeitentyp
        let availableRecipes = this.db.recipes.filter(
          (r) => r.meal_type === mealType,
        );

        // Filtere nach Diätkategorie
        if (dietCategory) {
          availableRecipes = availableRecipes.filter((recipe) => {
            return this._checkDietCategoryCompatibility(
              recipe.recipe_id,
              dietCategory,
            );
          });
        }

        if (availableRecipes.length === 0) {
          throw new Error(`Kein kompatibles Rezept für ${mealType} verfügbar`);
        }
        // Die Makroverteilung ist eine Präferenz, keine harte Grenze.
        // Bei genügend Alternativen zwischen ähnlich passenden Rezepten wechseln.
        let selectedRecipe;
        if (macroPreference) {
          const rankedRecipes = [...availableRecipes].sort(
            (first, second) =>
              this._recipeMacroScore(first.recipe_id, macroPreference) -
              this._recipeMacroScore(second.recipe_id, macroPreference),
          );
          const poolSize = Math.min(
            3,
            Math.max(1, Math.floor(rankedRecipes.length / 2)),
          );
          selectedRecipe =
            rankedRecipes[
              (day + Math.floor(Math.random() * poolSize)) % poolSize
            ];
        } else {
          selectedRecipe =
            availableRecipes[
              Math.floor(Math.random() * availableRecipes.length)
            ];
        }

        if (selectedRecipe) {
          dayPlan[mealType] = {
            recipe_id: selectedRecipe.recipe_id,
            name: selectedRecipe.name,
            originalIngredients: this._getRecipeIngredients(
              selectedRecipe.recipe_id,
            ),
          };
        }
      }

      weekPlan.push({
        day: day + 1,
        dayName: [
          "Montag",
          "Dienstag",
          "Mittwoch",
          "Donnerstag",
          "Freitag",
          "Samstag",
          "Sonntag",
        ][day],
        meals: dayPlan,
      });
    }

    return weekPlan;
  }

  _recipeMacroScore(recipeId, preference) {
    const targets = {
      keto: { carbs: 0.05, protein: 0.25, fat: 0.7 },
      proteinHeavy: { carbs: 0.3, protein: 0.4, fat: 0.3 },
      lowCarb: { carbs: 0.2, protein: 0.3, fat: 0.5 },
    };
    const target = targets[preference];
    if (!target)
      throw new RangeError(`Unbekannte Makroverteilung: ${preference}`);
    const macros = { carbs: 0, protein: 0, fat: 0 };
    for (const ingredient of this._getRecipeIngredients(recipeId)) {
      let food = this.db.foods.find(
        (entry) => entry.food_id === ingredient.food_id,
      );
      if (
        this.db.foodAllergens.some(
          (a) =>
            a.food_id === ingredient.food_id &&
            this.userAllergens?.includes(a.allergen_id),
        )
      ) {
        food = this._findSubstitute(
          ingredient.food_id,
          [],
          this.userAllergens,
          this.dietCategory,
        );
        if (!food)
          throw new Error(
            `Für ${this._getFoodName(ingredient.food_id)} ist kein sicherer Ersatz verfügbar`,
          );
      }
      if (!food)
        throw new Error(`Unbekanntes Lebensmittel: ${ingredient.food_id}`);
      macros.carbs +=
        ((food.carbs_per_100g * ingredient.base_amount_g) / 100) * 4;
      macros.protein +=
        ((food.protein_per_100g * ingredient.base_amount_g) / 100) * 4;
      macros.fat += ((food.fat_per_100g * ingredient.base_amount_g) / 100) * 9;
    }
    const total = macros.carbs + macros.protein + macros.fat;
    if (total <= 0) return Infinity;
    return (
      Math.abs(macros.carbs / total - target.carbs) +
      Math.abs(macros.protein / total - target.protein) +
      Math.abs(macros.fat / total - target.fat)
    );
  }

  /**
   * Phase 2: Allergen-Substitution (AR02)
   * Ersetzt allergenhaltige Zutaten durch makronährstoff-ähnliche Alternativen
   */
  _performAllergenSubstitution(weekPlan, userAllergens, dietCategory) {
    const substitutedPlan = JSON.parse(JSON.stringify(weekPlan));

    for (const day of substitutedPlan) {
      for (const mealType in day.meals) {
        const meal = day.meals[mealType];
        const originalIngredients = meal.originalIngredients;

        meal.ingredients = originalIngredients.map((ingredient) => {
          const allergenIds = this.db.foodAllergens
            .filter((fa) => fa.food_id === ingredient.food_id)
            .map((fa) => fa.allergen_id);

          const hasAllergen = allergenIds.some((a) =>
            userAllergens.includes(a),
          );

          if (hasAllergen) {
            const alternative = this._findSubstitute(
              ingredient.food_id,
              allergenIds.filter((a) => userAllergens.includes(a)),
              userAllergens,
              dietCategory,
            );

            if (alternative) {
              console.log(
                `✏️ [${day.dayName}] ${mealType}: ${this._getFoodName(ingredient.food_id)} → ${alternative.name}`,
              );
              return {
                ...alternative,
                original_food_id: ingredient.food_id,
                base_amount_g: ingredient.base_amount_g,
                substituted: true,
              };
            }
            throw new Error(
              `Für ${this._getFoodName(ingredient.food_id)} ist kein sicherer Ersatz verfügbar`,
            );
          }

          return ingredient;
        });

        meal.substitutions = meal.ingredients.filter(
          (i) => i.substituted || false,
        );
      }
    }

    return substitutedPlan;
  }

  /**
   * Finde eine makronährstoff-ähnliche Alternative ohne Allergen
   */
  _findSubstitute(foodId, allergenIds, userAllergens, dietCategory = null) {
    const originalFood = this.db.foods.find((f) => f.food_id === foodId);
    if (!originalFood) return null;

    const tolerance = {
      carbs: originalFood.carbs_per_100g * 0.15,
      protein: originalFood.protein_per_100g * 0.15,
      fat: originalFood.fat_per_100g * 0.15,
    };

    const candidates = this.db.foods.filter((f) => {
      if (f.food_type !== originalFood.food_type) return false;
      if (dietCategory && !this._isFoodDietCompatible(f, dietCategory))
        return false;

      const candidateAllergens = this.db.foodAllergens
        .filter((fa) => fa.food_id === f.food_id)
        .map((fa) => fa.allergen_id);

      if (candidateAllergens.some((a) => userAllergens.includes(a))) {
        return false;
      }

      const carbsDiff = Math.abs(
        f.carbs_per_100g - originalFood.carbs_per_100g,
      );
      const proteinDiff = Math.abs(
        f.protein_per_100g - originalFood.protein_per_100g,
      );
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
  _optimizeCaloriesWithWeeklyConstraint(
    weekPlan,
    dailyCalorieTarget,
    weeklyCalorieTarget,
  ) {
    const optimizedPlan = JSON.parse(JSON.stringify(weekPlan));

    let totalWeeklyCalories = 0;

    for (let dayIndex = 0; dayIndex < optimizedPlan.length; dayIndex++) {
      const day = optimizedPlan[dayIndex];
      let dayCalories = 0;

      for (const mealType in day.meals) {
        const meal = day.meals[mealType];
        const ingredients = meal.ingredients || meal.originalIngredients;

        meal.ingredients = ingredients.map((ingredient) => {
          const food = this.db.foods.find(
            (f) => f.food_id === ingredient.food_id,
          );
          if (!food) throw new Error("Unbekanntes Lebensmittel im Rezept");

          const baseCalories =
            (food.kcal_per_100g / 100) * ingredient.base_amount_g;

          return {
            ...ingredient,
            original_amount_g: ingredient.base_amount_g,
            calories: baseCalories,
          };
        });

        const mealCalories = meal.ingredients.reduce(
          (sum, i) => sum + (i.calories || 0),
          0,
        );
        meal.totalCalories = mealCalories;
        dayCalories += mealCalories;
      }

      day.dayCalories = dayCalories;
      totalWeeklyCalories += dayCalories;
    }

    console.log(
      `\n📊 Vor Optimierung: ${totalWeeklyCalories.toFixed(1)} kcal/Woche`,
    );

    const adjustedPlan = this._iterativeCalorieAdjustment(
      optimizedPlan,
      dailyCalorieTarget,
      weeklyCalorieTarget,
    );

    return adjustedPlan;
  }

  /**
   * Iterative Kalorien-Anpassung mit Dual-Constraint (täglich ±50, wöchentlich 0)
   */
  _iterativeCalorieAdjustment(
    weekPlan,
    dailyCalorieTarget,
    weeklyCalorieTarget,
  ) {
    // Scale actual ingredient quantities, then correct the floating-point residual.
    // Every day meets its target, which is stronger than the required ±50 kcal.
    const sumDay = (day) =>
      Object.values(day.meals).reduce(
        (sum, meal) =>
          sum + meal.ingredients.reduce((total, i) => total + i.calories, 0),
        0,
      );
    for (const day of weekPlan) {
      const total = sumDay(day);
      if (!Number.isFinite(total) || total <= 0)
        throw new Error(
          "Kalorienoptimierung ohne gültige Zutaten nicht möglich",
        );
      for (const meal of Object.values(day.meals))
        for (const ingredient of meal.ingredients) {
          const food = this.db.foods.find(
            (f) => f.food_id === ingredient.food_id,
          );
          if (
            !food ||
            !Number.isFinite(food.kcal_per_100g) ||
            food.kcal_per_100g < 0
          )
            throw new Error("Ungültiges Lebensmittel im Rezept");
          ingredient.amount_g =
            ((ingredient.amount_g ?? ingredient.original_amount_g) *
              dailyCalorieTarget) /
            total;
          ingredient.calories =
            (food.kcal_per_100g * ingredient.amount_g) / 100;
          if (!Number.isFinite(ingredient.amount_g) || ingredient.amount_g <= 0)
            throw new Error("Ungültige Zutatenmenge");
        }
    }
    const last = weekPlan[6];
    const correction = Object.values(last.meals)
      .flatMap((m) => m.ingredients)
      .find((i) => i.calories > 0);
    const food = this.db.foods.find((f) => f.food_id === correction?.food_id);
    if (!food) throw new Error("Kalorienkorrektur nicht möglich");
    for (let step = 0; step < 4; step++) {
      const residual =
        weeklyCalorieTarget -
        weekPlan.reduce((sum, day) => sum + sumDay(day), 0);
      if (Math.abs(residual) <= 1e-9) break;
      correction.amount_g += (residual * 100) / food.kcal_per_100g;
      correction.calories = (food.kcal_per_100g * correction.amount_g) / 100;
    }
    const difference =
      weekPlan.reduce((sum, day) => sum + sumDay(day), 0) - weeklyCalorieTarget;
    if (Math.abs(difference) > 1e-9)
      throw new Error(
        "Kalorienoptimierung hat kein exaktes Wochenziel erreicht",
      );
    for (const [index, day] of weekPlan.entries()) {
      day.dayCalories = sumDay(day);
      this.dailyCalorieVariances[index] = day.dayCalories - dailyCalorieTarget;
      if (Math.abs(this.dailyCalorieVariances[index]) > 50)
        throw new Error("Tages-Toleranz überschritten");
    }
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

    return (
      ingredients.length > 0 &&
      ingredients.every((ingredient) => {
        const food = this.db.foods.find(
          (f) => f.food_id === ingredient.food_id,
        );
        if (!food) return false;

        return this._isFoodDietCompatible(food, dietCategory);
      })
    );
  }

  _isFoodDietCompatible(food, dietCategory) {
    const validCategories = {
      vegan: ["vegan"],
      vegetarisch: ["vegan", "vegetarisch"],
      pescetarisch: ["vegan", "vegetarisch", "pescetarisch"],
      normal: ["vegan", "vegetarisch", "pescetarisch", "normal"],
    };

    return validCategories[dietCategory]?.includes(food.diet_category) || false;
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
      days: [],
    };

    for (const day of weekPlan) {
      let dayTotal = 0;
      const dayMeals = [];

      for (const mealType in day.meals) {
        const meal = day.meals[mealType];
        const mealCalories = meal.ingredients.reduce(
          (sum, i) => sum + (i.calories || 0),
          0,
        );
        dayTotal += mealCalories;

        dayMeals.push({
          mealType,
          recipeName: meal.name,
          calories: mealCalories.toFixed(1),
          ingredients: meal.ingredients.map((ing) => ({
            food_id: ing.food_id,
            name: this._getFoodName(ing.food_id),
            amount_g: ing.amount_g
              ? ing.amount_g.toFixed(1)
              : ing.base_amount_g,
            calories: ing.calories ? ing.calories.toFixed(1) : 0,
            substituted: ing.substituted || false,
          })),
        });
      }

      totalCalories += dayTotal;
      summary.days.push({
        day: day.day,
        dayName: day.dayName,
        totalCalories: dayTotal.toFixed(1),
        deviation: (dayTotal - weeklyCalorieTarget / 7).toFixed(1),
        meals: dayMeals,
      });
    }

    summary.weeklyTotal = totalCalories.toFixed(1);
    summary.weeklyTarget = weeklyCalorieTarget;
    summary.weeklyDeviation = (totalCalories - weeklyCalorieTarget).toFixed(1);

    return summary;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = MealPlannerAlgorithm;
}
