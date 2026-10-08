// CSV enthält die Stammdaten. Profil und Plan bilden einen gemeinsamen JSON-Zustand.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

function createStateStore(dataDir, fileSystem = fs) {
  fileSystem.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "state.json");
  return {
    read() {
      if (!fileSystem.existsSync(file)) return null;
      return JSON.parse(fileSystem.readFileSync(file, "utf8"));
    },
    save(state) {
      // Erst vollständig schreiben, dann atomar ersetzen: beide Werte wechseln zusammen.
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        fileSystem.writeFileSync(
          temporary,
          JSON.stringify(state, null, 2) + "\n",
          { flag: "wx" },
        );
        fileSystem.renameSync(temporary, file);
      } finally {
        if (fileSystem.existsSync(temporary)) fileSystem.unlinkSync(temporary);
      }
    },
  };
}
module.exports = { createStateStore };
