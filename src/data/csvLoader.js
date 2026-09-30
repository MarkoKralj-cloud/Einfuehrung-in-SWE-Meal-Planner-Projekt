const fs = require("node:fs");

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) {
    throw new Error("Ungültige CSV-Zeile: nicht geschlossenes Anführungszeichen");
  }

  values.push(value);
  return values;
}

function readCsv(filePath) {
  const [headerLine, ...dataLines] = fs
    .readFileSync(filePath, "utf8")
    .replace(/\r/g, "")
    .trim()
    .split("\n");
  const headers = parseCsvLine(headerLine);

  return dataLines.map((line) => {
    const values = parseCsvLine(line);

    if (values.length !== headers.length) {
      throw new Error(`Ungültige CSV-Zeile in ${filePath}: ${line}`);
    }

    return Object.fromEntries(
      headers.map((header, index) => {
        const value = values[index];
        const isNumber = value !== "" && !Number.isNaN(Number(value));
        return [header, isNumber ? Number(value) : value];
      })
    );
  });
}

module.exports = { parseCsvLine, readCsv };
