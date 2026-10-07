/**
 * Webserver für den Smart Weekly Meal Planner
 * Start (im Projektordner): npm start   oder   node src/server/server.js [--open]
 *
 * DR02: Benutzerprofil wird in data/profile.json gespeichert
 * DR04: Wochenplan wird in data/weekplan.json gespeichert
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");
const { loadDatabase, validateProfile, generatePlan } = require("./planService");
const { createIcs } = require("./icsExport");

const ROOT_DIR = path.join(__dirname, "..", "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "src", "Frontend", "app");
const DB_DIR = path.join(ROOT_DIR, "Datenbank");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, "data");
const PROFILE_FILE = path.join(DATA_DIR, "profile.json");
const PLAN_FILE = path.join(DATA_DIR, "weekplan.json");
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const db = loadDatabase(DB_DIR);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) reject(new Error("Anfrage zu groß"));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Ungültiges JSON"));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const filePath = path.join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath);

  // Keine Dateien außerhalb des App-Ordners ausliefern
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Nicht gefunden");
    return;
  }

  const type = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, pathname) {
  // FR05: Allergenliste aus der Datenbank
  if (req.method === "GET" && pathname === "/api/allergens") {
    return sendJson(res, 200, db.allergens);
  }

  if (req.method === "GET" && pathname === "/api/state") {
    return sendJson(res, 200, { profile: readJson(PROFILE_FILE), plan: readJson(PLAN_FILE) });
  }

  // Onboarding speichern und direkt einen neuen Plan erzeugen
  if (req.method === "PUT" && pathname === "/api/profile") {
    const profile = validateProfile(await readBody(req), db);
    const plan = generatePlan(db, profile);
    writeJson(PROFILE_FILE, profile);
    writeJson(PLAN_FILE, plan);
    return sendJson(res, 200, { profile, plan });
  }

  // FR07: Woche neu generieren
  if (req.method === "POST" && pathname === "/api/plan") {
    const profile = readJson(PROFILE_FILE);
    if (!profile) return sendJson(res, 400, { error: "Bitte zuerst das Onboarding abschließen" });
    const plan = generatePlan(db, profile);
    writeJson(PLAN_FILE, plan);
    return sendJson(res, 200, { profile, plan });
  }

  // FR08: ICS-Download
  if (req.method === "GET" && pathname === "/api/plan.ics") {
    const plan = readJson(PLAN_FILE);
    if (!plan) return sendJson(res, 404, { error: "Noch kein Wochenplan vorhanden" });
    res.writeHead(200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="essensplan-${plan.weekStart}.ics"`
    });
    return res.end(createIcs(plan));
  }

  return sendJson(res, 404, { error: "Unbekannter Endpunkt" });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");

  if (!pathname.startsWith("/api/")) {
    return serveStatic(req, res);
  }

  try {
    await handleApi(req, res, pathname);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} ist schon belegt. Läuft der Meal Planner bereits in einem anderen Fenster?`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`🥗 Meal Planner läuft auf ${url}  (Beenden mit Strg+C)`);

  if (process.argv.includes("--open")) {
    const command = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open ${url}` : `xdg-open ${url}`;
    exec(command);
  }
});
