const fs = require("node:fs");


function readFoods(csvPath) {
  const [headerLine, ...dataLines] = fs.readFileSync(csvPath, "utf-8").trim().split("\n");
  const headers = headerLine.split(",");

  return dataLines.map((line) => {
    const values = line.split(",");
    const food = Object.fromEntries(headers.map((header, index) => [header, values[index]]));

    food.kcal_per_100g = Number(food.kcal_per_100g);
    food.carbs_g = Number(food.carbs_g);
    food.protein_g = Number(food.protein_g);
    food.fat_g = Number(food.fat_g);

    return food;
  });
}


module.exports = { readFoods };
