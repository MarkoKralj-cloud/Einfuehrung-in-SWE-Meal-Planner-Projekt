/**
 * Frontend des Smart Weekly Meal Planner
 * Onboarding (FR01–FR05), Kalenderansicht (FR06), Neu generieren (FR07), ICS-Export (FR08)
 */

const DIETS = [
  { value: "normal", label: "Normal" },
  { value: "vegetarisch", label: "Vegetarisch" },
  { value: "pescetarisch", label: "Pescetarisch" },
  { value: "vegan", label: "Vegan" }
];

const GOALS = [
  { value: "diaet", label: "Diät", hint: "Kaloriendefizit zum Abnehmen", recommended: 500 },
  { value: "maintenance", label: "Maintenance", hint: "Gewicht halten" },
  { value: "zunahme", label: "Gewichtszunahme", hint: "Kalorienüberschuss zum Aufbauen", recommended: 300 }
];

const MACROS = [
  { value: "protein", label: "Protein-heavy" },
  { value: "lowcarb", label: "Low Carb" },
  { value: "keto", label: "Keto" }
];

const MEAL_META = {
  Frühstück: { icon: "🌅", time: "07:30" },
  Mittagessen: { icon: "☀️", time: "12:30" },
  Abendessen: { icon: "🌙", time: "18:30" }
};

const DEFAULT_MAINTENANCE = 2000;
const DAILY_TOLERANCE = 50;

const state = {
  profile: null,
  plan: null,
  allergens: [],
  view: "loading",
  mode: "week",
  selectedDay: 0,
  busy: false
};

const app = document.getElementById("app");
const editProfileButton = document.getElementById("edit-profile");
const toast = document.getElementById("toast");

// ---------- Hilfsfunktionen ----------

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(value, digits = 0) {
  return Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function signed(value) {
  const rounded = Math.round(value);
  if (rounded === 0) return "±0";
  return rounded > 0 ? `+${fmt(rounded)}` : `−${fmt(Math.abs(rounded))}`;
}

function parseIsoDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function currentMondayIso() {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${monday.getFullYear()}-${month}-${day}`;
}

// ISO-8601-Kalenderwoche
function isoWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function formatDate(isoDate, options) {
  return parseIsoDate(isoDate).toLocaleDateString("de-DE", options);
}

function labelOf(list, value) {
  return list.find((item) => item.value === value)?.label ?? value;
}

function dailyTargetOf(profile) {
  if (profile.goal === "diaet") return profile.maintenanceCalories - profile.calorieAdjustment;
  if (profile.goal === "zunahme") return profile.maintenanceCalories + profile.calorieAdjustment;
  return profile.maintenanceCalories;
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("toast--error", isError);
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => (toast.hidden = true), 4000);
}

async function api(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unbekannter Fehler");
  return data;
}

// ---------- Onboarding (FR01–FR05) ----------

function renderOnboarding() {
  const profile = state.profile;
  const goal = profile?.goal ?? "";
  const adjustment = profile?.calorieAdjustment || GOALS.find((g) => g.value === goal)?.recommended || 500;
  const isFirstTime = !profile;

  const radioOptions = (name, items, selected, withHint) =>
    items
      .map(
        (item, index) => `
        <label class="${withHint ? "option" : "chip"}">
          <input type="radio" name="${name}" value="${item.value}" ${item.value === selected ? "checked" : ""} ${index === 0 ? "required" : ""}>
          <span>${withHint ? `<strong>${item.label}</strong><small>${item.hint}</small>` : item.label}</span>
        </label>`
      )
      .join("");

  const allergenOptions = state.allergens
    .map(
      (allergen) => `
        <label class="chip">
          <input type="checkbox" name="allergens" value="${escapeHtml(allergen.allergen_id)}" ${profile?.allergens.includes(allergen.allergen_id) ? "checked" : ""}>
          <span>${escapeHtml(allergen.name)}</span>
        </label>`
    )
    .join("");

  app.className = "page page--narrow";
  app.innerHTML = `
    <div class="intro">
      <p class="eyebrow">${isFirstTime ? "Willkommen" : "Profil bearbeiten"}</p>
      <h1 class="display">${isFirstTime ? "Lass uns deinen Wochenplan erstellen" : "Deine Präferenzen"}</h1>
      <p class="muted">Ein paar Angaben, dann stellt der Planer sieben Tage mit je drei Mahlzeiten zusammen – passend zu deinem Kalorienziel und ohne deine Allergene.</p>
    </div>

    <form class="form" id="onboarding" novalidate>
      <fieldset class="card form-section">
        <legend class="section-title"><span class="step">1</span><span class="headline">Ernährungsform</span></legend>
        <div class="chips">${radioOptions("dietCategory", DIETS, profile?.dietCategory)}</div>
      </fieldset>

      <fieldset class="card form-section">
        <legend class="section-title"><span class="step">2</span><span class="headline">Ernährungsziel</span></legend>
        <div class="options">${radioOptions("goal", GOALS, goal, true)}</div>

        <div class="field">
          <label for="maintenance">Dein Tagesbedarf zum Gewicht halten</label>
          <input class="input num" id="maintenance" name="maintenanceCalories" type="number" min="1200" max="4500" step="10"
            value="${profile?.maintenanceCalories ?? DEFAULT_MAINTENANCE}" inputmode="numeric" required>
          <p class="small muted">Ein Richtwert sind etwa 2000 kcal (Frauen) bzw. 2500 kcal (Männer).</p>
        </div>

        <div class="slider" id="adjustment-block" ${goal === "diaet" || goal === "zunahme" ? "" : "hidden"}>
          <div class="slider__head">
            <label for="adjustment" id="adjustment-label">Kaloriendefizit pro Tag</label>
            <output class="slider__value num" id="adjustment-value" for="adjustment">${fmt(adjustment)} kcal</output>
          </div>
          <input id="adjustment" name="calorieAdjustment" type="range" min="100" max="1000" step="50" value="${adjustment}">
          <div class="slider__scale num"><span>100</span><span id="adjustment-hint"></span><span>1000</span></div>
        </div>

        <div class="target-preview num" id="target-preview"></div>
      </fieldset>

      <fieldset class="card form-section">
        <legend class="section-title"><span class="step">3</span><span class="headline">Makronährstoffverteilung</span></legend>
        <div class="chips">${radioOptions("macroPreference", MACROS, profile?.macroPreference)}</div>
      </fieldset>

      <fieldset class="card form-section">
        <legend class="section-title"><span class="step">4</span><span class="headline">Allergien &amp; Unverträglichkeiten</span></legend>
        <p class="muted">Betroffene Zutaten werden durch eine allergenfreie Alternative mit ähnlichen Nährwerten ersetzt.</p>
        <div class="chips">${allergenOptions}</div>
      </fieldset>

      <p class="form-error" id="form-error" hidden></p>

      <button class="btn btn--primary btn--large" type="submit" id="submit">
        ${isFirstTime ? "Wochenplan erstellen ✨" : "Speichern & neu planen ✨"}
      </button>
      ${isFirstTime ? "" : `<button class="btn btn--ghost" type="button" id="cancel">Abbrechen</button>`}
    </form>
  `;

  const form = document.getElementById("onboarding");
  form.addEventListener("change", (event) => onOnboardingChange(form, event));
  form.addEventListener("input", () => {
    document.getElementById("form-error").hidden = true;
    updateOnboardingPreview(form);
  });
  form.addEventListener("submit", (event) => submitOnboarding(event, form));
  document.getElementById("cancel")?.addEventListener("click", () => showPlan());
  updateOnboardingPreview(form);
}

function readOnboarding(form) {
  const data = new FormData(form);
  return {
    dietCategory: data.get("dietCategory"),
    goal: data.get("goal"),
    macroPreference: data.get("macroPreference"),
    maintenanceCalories: Number(data.get("maintenanceCalories")),
    calorieAdjustment: Number(data.get("calorieAdjustment")),
    allergens: data.getAll("allergens")
  };
}

// FR03: Slider nur bei Diät / Gewichtszunahme, mit zielabhängigem Standardwert
function onOnboardingChange(form, event) {
  if (event.target.name !== "goal") return;

  const goal = GOALS.find((g) => g.value === event.target.value);
  const slider = form.elements.calorieAdjustment;
  document.getElementById("adjustment-block").hidden = !goal.recommended;
  if (goal.recommended) slider.value = goal.recommended;
  updateOnboardingPreview(form);
}

function updateOnboardingPreview(form) {
  const values = readOnboarding(form);
  const goal = GOALS.find((g) => g.value === values.goal);

  document.getElementById("adjustment-value").textContent = `${fmt(values.calorieAdjustment)} kcal`;
  document.getElementById("adjustment-label").textContent =
    values.goal === "zunahme" ? "Kalorienüberschuss pro Tag" : "Kaloriendefizit pro Tag";
  document.getElementById("adjustment-hint").textContent = goal?.recommended
    ? `Empfohlen: ${fmt(goal.recommended)} kcal`
    : "";

  const preview = document.getElementById("target-preview");
  if (!goal || !values.maintenanceCalories) {
    preview.innerHTML = `<span>Wähle ein Ziel, um dein Tagesziel zu sehen.</span>`;
    return;
  }

  const daily = dailyTargetOf({ ...values, calorieAdjustment: goal.recommended ? values.calorieAdjustment : 0 });
  preview.innerHTML = `<span>Dein Tagesziel: <strong>${fmt(daily)} kcal</strong></span><span>Wochenziel: ${fmt(daily * 7)} kcal</span>`;
}

async function submitOnboarding(event, form) {
  event.preventDefault();
  const errorBox = document.getElementById("form-error");
  const values = readOnboarding(form);

  const missing = [];
  if (!values.dietCategory) missing.push("eine Ernährungsform");
  if (!values.goal) missing.push("ein Ernährungsziel");
  if (!values.macroPreference) missing.push("eine Makronährstoffverteilung");
  if (missing.length > 0) {
    errorBox.textContent = `Bitte wähle noch ${missing.join(", ")}.`;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const submit = document.getElementById("submit");
  submit.disabled = true;
  submit.textContent = "Plan wird erstellt …";
  errorBox.hidden = true;

  try {
    const { profile, plan } = await api("PUT", "/api/profile", values);
    state.profile = profile;
    state.plan = plan;
    showPlan();
    showToast("Dein Wochenplan ist fertig 🎉");
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    submit.disabled = false;
    submit.textContent = "Erneut versuchen";
  }
}

// ---------- Wochenplan (FR06) ----------

function showPlan() {
  state.view = "plan";
  const todayIndex = state.plan.days.findIndex((day) => day.date === todayIso());
  state.selectedDay = todayIndex >= 0 ? todayIndex : 0;
  render();
}

function macroShares(macros) {
  const kcal = {
    protein: macros.protein * 4,
    carbs: macros.carbs * 4,
    fat: macros.fat * 9
  };
  const total = kcal.protein + kcal.carbs + kcal.fat || 1;
  return {
    protein: (kcal.protein / total) * 100,
    carbs: (kcal.carbs / total) * 100,
    fat: (kcal.fat / total) * 100
  };
}

function renderPlan() {
  const { plan, profile } = state;
  const monday = parseIsoDate(plan.weekStart);
  const sunday = parseIsoDate(plan.days[plan.days.length - 1].date);
  const isOutdated = plan.weekStart < currentMondayIso();
  const weekReached = Math.abs(plan.weeklyDeviation) < 0.5;
  const daysInTolerance = plan.days.every((day) => Math.abs(day.deviation) <= DAILY_TOLERANCE);
  const shares = macroShares(plan.macros);

  const allergenNames = profile.allergens
    .map((id) => state.allergens.find((a) => a.allergen_id === id)?.name ?? id)
    .join(", ");
  const goalTag =
    profile.goal === "maintenance"
      ? "Maintenance"
      : `${labelOf(GOALS, profile.goal)} ${profile.goal === "diaet" ? "−" : "+"}${fmt(profile.calorieAdjustment)} kcal`;

  app.className = "page";
  app.innerHTML = `
    <section class="plan-head">
      <div class="plan-head__title">
        <p class="eyebrow num">KW ${isoWeek(monday)} · ${formatDate(plan.weekStart, { day: "numeric", month: "long" })} – ${sunday.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}</p>
        <h1 class="display">Dein Wochenplan</h1>
      </div>
      <div class="actions">
        <button class="btn btn--primary" type="button" data-action="regenerate" ${state.busy ? "disabled" : ""}>
          ${state.busy ? "Wird erstellt …" : "Woche neu ✨"}
        </button>
        <a class="btn btn--secondary" href="/api/plan.ics" download>Export (.ics) 📅</a>
      </div>
    </section>

    ${
      isOutdated
        ? `<div class="banner"><span>Dieser Plan gehört zu einer vergangenen Woche.</span>
           <button class="btn btn--small btn--secondary" type="button" data-action="regenerate">Für diese Woche planen</button></div>`
        : ""
    }

    <section class="card summary" aria-label="Zusammenfassung">
      <div class="stat">
        <span class="stat__label">Tagesziel</span>
        <span class="stat__value num">${fmt(plan.dailyTarget)} kcal</span>
        <span class="badge ${daysInTolerance ? "badge--ok" : "badge--warn"}">${daysInTolerance ? "✓" : "!"} alle Tage ±${DAILY_TOLERANCE} kcal</span>
      </div>
      <div class="stat">
        <span class="stat__label">Woche geplant / Ziel</span>
        <span class="stat__value num">${fmt(plan.weeklyTotal)} <span class="muted small">/ ${fmt(plan.weeklyTarget)} kcal</span></span>
        <span class="badge ${weekReached ? "badge--ok" : "badge--warn"}">${weekReached ? "✓ Wochenziel exakt erreicht" : `Abweichung ${signed(plan.weeklyDeviation)} kcal`}</span>
      </div>
      <div class="stat macro">
        <span class="stat__label">Makroverteilung der Woche (kcal-Anteil)</span>
        <div class="macro__bar" role="img" aria-label="Protein ${fmt(shares.protein)} %, Kohlenhydrate ${fmt(shares.carbs)} %, Fett ${fmt(shares.fat)} %">
          <span class="c-protein" style="width:${shares.protein}%"></span>
          <span class="c-carbs" style="width:${shares.carbs}%"></span>
          <span class="c-fat" style="width:${shares.fat}%"></span>
        </div>
        <div class="macro__legend num">
          <span><i class="dot c-protein"></i>Protein ${fmt(shares.protein)} %</span>
          <span><i class="dot c-carbs"></i>Kohlenhydrate ${fmt(shares.carbs)} %</span>
          <span><i class="dot c-fat"></i>Fett ${fmt(shares.fat)} %</span>
        </div>
      </div>
      <div class="stat">
        <span class="stat__label">Ø pro Tag</span>
        <span class="stat__value num">${fmt(plan.macros.protein / 7)} g <span class="muted small">Protein</span></span>
        <span class="small muted num">${fmt(plan.macros.carbs / 7)} g Kohlenhydrate · ${fmt(plan.macros.fat / 7)} g Fett</span>
      </div>
      <div class="profile-tags">
        <span class="tag">${labelOf(DIETS, profile.dietCategory)}</span>
        <span class="tag">${goalTag}</span>
        <span class="tag">${labelOf(MACROS, profile.macroPreference)}</span>
        <span class="tag">${allergenNames ? `Ohne ${escapeHtml(allergenNames)}` : "Keine Allergien"}</span>
      </div>
    </section>

    <div class="toolbar">
      <div class="segmented" role="group" aria-label="Ansicht">
        <button type="button" data-mode="week" aria-pressed="${state.mode === "week"}">Woche</button>
        <button type="button" data-mode="day" aria-pressed="${state.mode === "day"}">Tag</button>
      </div>
      <span class="small muted">Tipp: Klick auf eine Mahlzeit zeigt Zutaten und Mengen.</span>
    </div>

    ${state.mode === "week" ? renderWeekGrid() : renderDayView()}
  `;
}

function renderWeekGrid() {
  const today = todayIso();

  return `
    <section class="week-grid" aria-label="Wochenkalender">
      ${state.plan.days
        .map(
          (day, dayIndex) => `
        <article class="week-day ${day.date === today ? "week-day--today" : ""}">
          <header class="week-day__head">
            <span class="week-day__name">${day.dayName}</span>
            <span class="small muted num">${formatDate(day.date, { day: "2-digit", month: "2-digit" })} · ${fmt(day.kcal)} kcal</span>
          </header>
          ${day.meals
            .map(
              (meal) => `
            <button class="week-cell" type="button" data-day="${dayIndex}">
              <span class="week-cell__type">${MEAL_META[meal.mealType]?.icon ?? ""} ${meal.mealType}</span>
              <span class="week-cell__name">${escapeHtml(meal.name)}</span>
              <span class="week-cell__kcal num">${fmt(meal.kcal)} kcal${meal.ingredients.some((i) => i.substitutedFor) ? " · ersetzt" : ""}</span>
            </button>`
            )
            .join("")}
        </article>`
        )
        .join("")}
    </section>
  `;
}

function renderDayView() {
  const day = state.plan.days[state.selectedDay];
  const withinTolerance = Math.abs(day.deviation) <= DAILY_TOLERANCE;

  return `
    <nav class="day-strip" aria-label="Tag auswählen">
      ${state.plan.days
        .map(
          (d, index) => `
        <button class="day-pill" type="button" data-day="${index}" aria-pressed="${index === state.selectedDay}">
          <span class="day-pill__short">${d.dayName.slice(0, 2)}</span>
          <span class="day-pill__date num">${parseIsoDate(d.date).getDate()}</span>
          <span class="day-pill__dot"></span>
        </button>`
        )
        .join("")}
    </nav>

    <div class="day-summary">
      <h2 class="headline">${day.dayName}, ${formatDate(day.date, { day: "numeric", month: "long" })}</h2>
      <div class="actions">
        <span class="badge badge--info num">${fmt(day.kcal)} kcal · ${fmt(day.protein)} g Protein</span>
        <span class="badge ${withinTolerance ? "badge--ok" : "badge--warn"} num">${signed(day.deviation)} kcal zum Ziel</span>
      </div>
    </div>

    <section class="meals">
      ${day.meals.map(renderMealCard).join("")}
    </section>
  `;
}

function renderMealCard(meal) {
  const meta = MEAL_META[meal.mealType] ?? { icon: "", time: "" };
  const substitutions = meal.ingredients.filter((i) => i.substitutedFor).length;

  return `
    <article class="card meal">
      <div class="meal__top">
        <span class="meal__type">${meta.icon} ${meal.mealType}</span>
        <span class="meal__time num">${meta.time} Uhr</span>
      </div>
      <div>
        <h3 class="headline">${escapeHtml(meal.name)}</h3>
        ${substitutions ? `<span class="swap">✓ ${substitutions} ${substitutions === 1 ? "Zutat" : "Zutaten"} wegen Allergie ersetzt</span>` : ""}
      </div>
      <p class="meal__kcal num">${fmt(meal.kcal)} <span class="small muted">kcal</span></p>
      <div class="meal__macros num">
        <div class="macro-box"><strong>${fmt(meal.protein)} g</strong><small>Protein</small></div>
        <div class="macro-box"><strong>${fmt(meal.carbs)} g</strong><small>Kohlenhydrate</small></div>
        <div class="macro-box"><strong>${fmt(meal.fat)} g</strong><small>Fett</small></div>
      </div>
      <details class="ingredients">
        <summary>${meal.ingredients.length} Zutaten anzeigen</summary>
        <ul>
          ${meal.ingredients
            .map(
              (ingredient) => `
            <li>
              <span class="amount num">${fmt(ingredient.amountG)} g</span>
              <span>${escapeHtml(ingredient.name)}${
                ingredient.substitutedFor ? `<span class="swap">statt ${escapeHtml(ingredient.substitutedFor)}</span>` : ""
              }</span>
              <span class="small muted num">${fmt(ingredient.kcal)} kcal</span>
            </li>`
            )
            .join("")}
        </ul>
      </details>
    </article>
  `;
}

async function regenerate() {
  state.busy = true;
  render();
  try {
    const { plan } = await api("POST", "/api/plan");
    state.plan = plan;
    showToast("Neue Woche geplant ✨");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    state.busy = false;
    render();
  }
}

// ---------- Steuerung ----------

function render() {
  editProfileButton.hidden = state.view !== "plan";
  if (state.view === "onboarding") renderOnboarding();
  else if (state.view === "plan") renderPlan();
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target || state.view !== "plan") return;

  if (target.dataset.action === "regenerate") {
    regenerate();
  } else if (target.dataset.mode) {
    state.mode = target.dataset.mode;
    render();
  } else if (target.dataset.day !== undefined) {
    // Klick in der Wochenansicht öffnet den Tag mit allen Details
    state.selectedDay = Number(target.dataset.day);
    state.mode = "day";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

editProfileButton.addEventListener("click", () => {
  state.view = "onboarding";
  render();
  window.scrollTo({ top: 0 });
});

async function init() {
  try {
    const [allergens, saved] = await Promise.all([api("GET", "/api/allergens"), api("GET", "/api/state")]);
    state.allergens = allergens;
    state.profile = saved.profile;
    state.plan = saved.plan;

    if (state.profile && state.plan) {
      showPlan();
    } else {
      state.view = "onboarding";
      render();
    }
  } catch (error) {
    app.innerHTML = `<p class="form-error">Der Server ist nicht erreichbar: ${escapeHtml(error.message)}</p>`;
  }
}

init();
