const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { readCsv } = require("../src/data/csvLoader");

test("liest zitierte Kommas als Teil eines CSV-Feldes", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "meal-planner-csv-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const csvPath = path.join(tempDir, "foods.csv");
  fs.writeFileSync(
    csvPath,
    'food_id,name,kcal_per_100g,food_type\nF080,"Naturjoghurt 3,5%",64,Protein\n',
    "utf8"
  );

  assert.deepEqual(readCsv(csvPath), [
    {
      food_id: "F080",
      name: "Naturjoghurt 3,5%",
      kcal_per_100g: 64,
      food_type: "Protein"
    }
  ]);
});
