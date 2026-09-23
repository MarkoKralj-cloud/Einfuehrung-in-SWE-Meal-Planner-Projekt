const { readFoods } = require("./food_reader");


function displayFoods(foods) {
  foods.forEach((food) => console.log(food));
}


if (require.main === module) {
  const foods = readFoods("foods_sample.csv");
  displayFoods(foods);
}


module.exports = { displayFoods };
