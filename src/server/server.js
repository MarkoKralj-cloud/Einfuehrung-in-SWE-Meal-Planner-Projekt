const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { createStateStore } = require("./stateStore");
const {
  loadDatabase,
  validateProfile,
  generatePlan,
  getMonday,
  toIsoDate,
  validatePlan,
} = require("./planService");
const { createIcs } = require("./icsExport");
const ROOT = path.join(__dirname, "../..");
const PUBLIC = path.join(ROOT, "src/Frontend/app");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};
function validateLegacyView(view, db) {
  const types = ["Frühstück", "Mittagessen", "Abendessen"];
  const foods = new Set(db.foods.map((f) => f.food_id));
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(view.weekStart) ||
    !Array.isArray(view.days) ||
    view.days.length !== 7
  )
    throw new TypeError("Unvollständiger JSON-Wochenplan");
  const start = new Date(view.weekStart + "T12:00:00");
  if (
    !Number.isFinite(start.getTime()) ||
    toIsoDate(start) !== view.weekStart ||
    start.getDay() !== 1
  )
    throw new TypeError("Ungültiger JSON-Wochenbeginn");
  const dates = new Set();
  let index = 0;
  for (const day of view.days) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
      dates.has(day.date) ||
      !Array.isArray(day.meals) ||
      day.meals.length !== 3 ||
      new Set(day.meals.map((m) => m.mealType)).size !== 3
    )
      throw new TypeError("Ungültige JSON-Tagesstruktur");
    const expected = new Date(start);
    expected.setDate(expected.getDate() + index++);
    if (day.date !== toIsoDate(expected))
      throw new TypeError("Ungültiges JSON-Tagesdatum");
    dates.add(day.date);
    for (const meal of day.meals) {
      if (
        !types.includes(meal.mealType) ||
        !Array.isArray(meal.ingredients) ||
        !meal.ingredients.length
      )
        throw new TypeError("Ungültige JSON-Mahlzeit");
      for (const ingredient of meal.ingredients) {
        if (
          !foods.has(ingredient.foodId) ||
          !Number.isFinite(ingredient.amountG) ||
          ingredient.amountG <= 0
        )
          throw new TypeError("Ungültige JSON-Zutat");
      }
    }
  }
}
function createApplication({
  dataDir = process.env.DATA_DIR || path.join(ROOT, "data"),
  now = () => new Date(),
  fileSystem = fs,
} = {}) {
  const store = createStateStore(dataDir, fileSystem);
  const db = loadDatabase(path.join(ROOT, "Datenbank"));
  let current = { profile: null, plan: null };
  function commit(profile, plan) {
    const result = { profile, plan: validatePlan(db, profile, plan) };
    store.save(result);
    current = result;
    return result;
  }
  try {
    const saved = store.read();
    if (saved) {
      const profile = validateProfile(saved.profile, db);
      if (
        !require("node:util").isDeepStrictEqual(
          validateProfile(saved.plan.profile, db),
          profile,
        )
      )
        throw new Error("Profil und Plan passen nicht zusammen");
      current = { profile, plan: validatePlan(db, profile, saved.plan) };
    } else {
      const profileFile = path.join(dataDir, "profile.json");
      const planFile = path.join(dataDir, "weekplan.json");
      if (fs.existsSync(profileFile)) {
        const profile = validateProfile(
          JSON.parse(fs.readFileSync(profileFile, "utf8")),
          db,
        );
        if (fs.existsSync(planFile)) {
          const view = JSON.parse(fs.readFileSync(planFile, "utf8"));
          if (
            !require("node:util").isDeepStrictEqual(
              validateProfile(view.profile, db),
              profile,
            )
          )
            throw new Error("JSON-Profil und Plan passen nicht zusammen");
          validateLegacyView(view, db);
        }
        commit(profile, generatePlan(db, profile, now()));
      }
    }
  } catch (error) {
    throw new Error(
      "Lokale Daten konnten nicht sicher übernommen werden: " + error.message,
    );
  }
  function state(refresh = true) {
    if (
      refresh &&
      current.plan &&
      current.plan.weekStart !== toIsoDate(getMonday(now()))
    ) {
      try {
        return commit(
          current.profile,
          generatePlan(db, current.profile, now()),
        );
      } catch (error) {
        return {
          ...current,
          warning: "Der gespeicherte Plan ist veraltet. " + error.message,
        };
      }
    }
    return current;
  }
  const json = (res, status, value) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  async function body(req) {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      throw new TypeError("Content-Type muss application/json sein");
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 100000) throw new RangeError("Anfrage zu groß");
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new TypeError("Ungültiges JSON");
    }
  }
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (!pathname.startsWith("/api/")) {
        if (req.method !== "GET" && req.method !== "HEAD")
          return json(res, 405, { error: "Methode nicht erlaubt" });
        const file = path.resolve(
          PUBLIC,
          "." + (pathname === "/" ? "/index.html" : pathname),
        );
        if (!file.startsWith(PUBLIC + path.sep) || !mime[path.extname(file)])
          return json(res, 404, { error: "Nicht gefunden" });
        let contents;
        try {
          contents = await fs.promises.readFile(file);
        } catch (error) {
          if (error.code === "ENOENT" || error.code === "EISDIR")
            return json(res, 404, { error: "Nicht gefunden" });
          throw error;
        }
        res.writeHead(200, {
          "Content-Type": mime[path.extname(file)],
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(req.method === "HEAD" ? undefined : contents);
      }
      if (req.method === "GET" && pathname === "/api/allergens")
        return json(res, 200, db.allergens);
      if (req.method === "GET" && pathname === "/api/options")
        return json(res, 200, {
          diets: ["normal", "vegetarisch", "pescetarisch", "vegan"],
          goals: ["diaet", "maintenance", "zunahme"],
          macroPreferences: ["protein", "lowcarb", "keto"],
          suggestedAdjustments: { diaet: 300, zunahme: 500, maintenance: 0 },
          allergens: db.allergens,
        });
      if (req.method === "GET" && pathname === "/api/state")
        return json(res, 200, state());
      if (req.method === "PUT" && pathname === "/api/profile") {
        const profile = validateProfile(await body(req), db);
        let plan;
        try {
          plan = generatePlan(db, profile, now());
        } catch (error) {
          error.status = 422;
          throw error;
        }
        return json(res, 200, commit(profile, plan));
      }
      if (req.method === "POST" && pathname === "/api/plan") {
        const current = state(false);
        if (!current.profile)
          return json(res, 400, {
            error: "Bitte zuerst das Onboarding abschließen",
          });
        let plan;
        try {
          plan = generatePlan(db, current.profile, now());
        } catch (error) {
          error.status = 422;
          throw error;
        }
        return json(res, 200, commit(current.profile, plan));
      }
      if (req.method === "GET" && pathname === "/api/plan.ics") {
        const current = state();
        if (!current.plan)
          return json(res, 404, { error: "Noch kein Wochenplan vorhanden" });
        res.writeHead(200, {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="essensplan-${current.plan.weekStart}.ics"`,
          "Cache-Control": "no-store",
        });
        return res.end(createIcs(current.plan));
      }
      return json(res, 404, { error: "Unbekannter Endpunkt" });
    } catch (error) {
      const status =
        error.status ||
        (error instanceof URIError ||
        error instanceof TypeError ||
        error instanceof RangeError ||
        /Bitte|Tagesbedarf|Kalorienanpassung|Profil|Allergen|Kalorienziel/.test(
          error.message,
        )
          ? 400
          : 500);
      if (status === 500) console.error(error);
      json(res, status, {
        error: status === 500 ? "Interner Serverfehler" : error.message,
      });
    }
  });
  return { server, state };
}
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new RangeError("Ungültiger Port");
  const app = createApplication();
  app.server.on("error", (error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? `Port ${port} ist schon belegt.`
        : error.message,
    );
    process.exitCode = 1;
  });
  app.server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`seali V2 läuft auf ${url}`);
    if (process.argv.includes("--open")) {
      if (process.platform === "win32")
        execFile("cmd", ["/c", "start", "", url]);
      else execFile(process.platform === "darwin" ? "open" : "xdg-open", [url]);
    }
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () =>
      app.server.close(() => {
        process.exit(0);
      }),
    );
}
module.exports = { createApplication };
