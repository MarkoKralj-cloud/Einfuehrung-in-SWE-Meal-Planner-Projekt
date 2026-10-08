import { requestJson, getCalendar } from "./client.mjs";
import {
  isoDate,
  mondayIso,
  selectedDay,
  dateLabel,
  shares,
  dailyTarget,
} from "./model.mjs";
const root = document.querySelector("#app");
const dialog = document.querySelector("#recipe-dialog");
const state = {
  options: null,
  profile: null,
  plan: null,
  view: "home",
  day: 0,
  week: false,
  step: 1,
  draft: null,
  busy: false,
  error: "",
  warning: "",
  editing: false,
};
const labels = {
  normal: "Normal",
  vegetarisch: "Vegetarisch",
  pescetarisch: "Pescetarisch",
  vegan: "Vegan",
  diaet: "Diät",
  maintenance: "Gewicht halten",
  zunahme: "Gewichtszunahme",
  protein: "Protein-heavy",
  lowcarb: "Low Carb",
  keto: "Keto",
};
const dietHint = {
  normal: "Ausgewogen und vielseitig",
  vegetarisch: "Ohne Fleisch und Fisch",
  pescetarisch: "Pflanzlich mit Fisch",
  vegan: "Rein pflanzlich",
};
const paths = {
  home: "M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  plan: "M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16 M8 14h2 M14 14h2 M8 18h2",
  recipes:
    "M12 5c-3-2-7-2-9-1v16c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1z M12 5v16",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 22v-2a8 8 0 0 1 16 0v2",
  back: "M15 5l-7 7 7 7",
  arrow: "M9 5l7 7-7 7",
  close: "M5 5l14 14 M19 5L5 19",
  check: "M5 12l4 4L19 6",
  leaf: "M20 3C8 3 3 8 5 16c7 5 15-1 15-13z M4 21L16 9",
  flame: "M12 2c1 5 7 6 7 13a7 7 0 0 1-14 0c0-4 2-6 4-8 0 4 3 5 3 5s3-3 0-10z",
  target:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 11v2",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4 4l2 2 M18 18l2 2 M4 20l2-2 M18 6l2-2",
  moon: "M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10z",
  edit: "M4 20l4-1L20 7l-4-4L4 15z M13 6l4 4",
  download: "M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4",
  spark: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v6 M12 7v1",
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.leaf}"/></svg>`;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const num = (v, digits = 0) =>
  (Math.abs(Number(v)) < 0.5 * 10 ** -digits ? 0 : Number(v)).toLocaleString(
    "de-AT",
    { maximumFractionDigits: digits },
  );
const btn = (text, action, cls = "primary", extra = "") =>
  `<button type="button" class="button ${cls}" data-action="${action}" ${extra}>${text}</button>`;
const brand = () =>
  `<img class="mascot" src="/assets/seali.jpg" alt=""><span class="wordmark">seali</span>`;
function notice(message) {
  const target = document.querySelector("#notice");
  target.textContent = message;
  target.hidden = false;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => (target.hidden = true), 5000);
}
function head() {
  const wizard = state.view === "onboarding";
  return `<header class="topbar"><div class="topbar-inner"><a class="brand" href="#home" aria-label="seali Home">${brand()}<span class="section-name">· ${wizard ? "Dein Start" : { home: "Home", plan: "Plan", recipes: "Rezepte", profile: "Profil" }[state.view]}</span></a>${wizard ? (state.editing ? btn(icon("close"), "cancel", "icon-button", 'aria-label="Bearbeitung abbrechen"') : "") : btn(icon("profile"), "profile", "icon-button avatar", 'aria-label="Profil öffnen"')}</div></header>`;
}
function nav() {
  return `<nav class="bottom-nav" aria-label="Hauptnavigation">${["home", "plan", "recipes", "profile"].map((v) => `<a href="#${v}" class="nav-item ${state.view === v ? "active" : ""}" ${state.view === v ? 'aria-current="page"' : ""}><span>${icon(v)}</span><small>${{ home: "Home", plan: "Plan", recipes: "Rezepte", profile: "Profil" }[v]}</small></a>`).join("")}</nav>`;
}
function title(eyebrow, text, description = "") {
  return `<div class="intro"><p class="eyebrow">${eyebrow}</p><h1>${text}</h1>${description ? `<p class="muted">${description}</p>` : ""}</div>`;
}
function render() {
  document.title = `seali · ${state.view === "onboarding" ? "Dein Start" : { home: "Home", plan: "Plan", recipes: "Rezepte", profile: "Profil" }[state.view]}`;
  root.innerHTML =
    head() +
    `<main id="main" tabindex="-1" class="screen ${state.view === "onboarding" ? "wizard" : ""}">${state.busy ? loading() : state.view === "onboarding" ? onboarding() : state.view === "home" ? home() : state.view === "plan" ? planPage() : state.view === "recipes" ? recipes() : profilePage()}</main>` +
    (state.profile && state.view !== "onboarding" && !state.busy ? nav() : "");
  bindWizard();
  const errorPanel = root.querySelector(".planning-error");
  if (errorPanel) {
    errorPanel.focus({ preventScroll: true });
    errorPanel.scrollIntoView({ block: "center" });
  }
}
function option(name, value, heading, hint, symbol) {
  return `<label class="choice ${state.draft[name] === value ? "selected" : ""}"><input type="radio" name="${name}" value="${value}" ${state.draft[name] === value ? "checked" : ""}><span class="choice-symbol">${icon(symbol)}</span><span class="choice-text"><strong>${heading}</strong><small>${hint}</small></span><span class="check">${icon("check")}</span></label>`;
}
function onboarding() {
  const d = state.draft;
  return `<div class="step-head"><span>Schritt ${state.step} von 2</span><span>${state.step === 1 ? "Ernährung & Ziele" : "Makros & Allergene"}</span></div><div class="progress"><span style="width:${state.step * 50}%"></span></div>${title("Dein persönlicher Wochenplan", state.step === 1 ? "Wie möchtest du dich ernähren?" : "Was passt zu dir?", state.step === 1 ? "Wähle deine Ernährungsform und dein Ziel. Daraus entsteht dein Plan für sieben Tage." : "Lege deine Makropräferenz fest und wähle die Allergene, die dein Plan berücksichtigen soll.")}<form id="onboarding" novalidate>${state.step === 1 ? `<fieldset><legend>Ernährungsform <span class="tag">Einzelauswahl</span></legend><div class="choice-list">${state.options.diets.map((v) => option("dietCategory", v, labels[v], dietHint[v], v === "normal" ? "recipes" : "leaf")).join("")}</div></fieldset><fieldset><legend>Ernährungsziel</legend><div class="choice-list">${state.options.goals.map((v) => option("goal", v, labels[v], v === "diaet" ? "Kaloriendefizit" : v === "zunahme" ? "Kalorienüberschuss" : "Energiebedarf halten", "target")).join("")}</div></fieldset><section class="surface calorie-settings"><label for="maintenance">Täglicher Erhaltungskalorienwert</label><div class="number-field"><input id="maintenance" name="maintenanceCalories" type="number" min="1200" max="4500" step="1" inputmode="numeric" value="${d.maintenanceCalories}" required><span>kcal</span></div><div id="slider-section" ${d.goal === "maintenance" ? "hidden" : ""}><div class="slider-label"><label for="adjustment">${d.goal === "zunahme" ? "Kalorienüberschuss" : "Kaloriendefizit"}</label><output id="adjustment-output">${d.calorieAdjustment} kcal</output></div><input id="adjustment" name="calorieAdjustment" type="range" min="100" max="1000" step="50" value="${d.calorieAdjustment || 300}"><div class="slider-scale"><span>100 kcal</span><span>1000 kcal</span></div><p class="small muted" id="recommendation">Startwert: ${state.options.suggestedAdjustments[d.goal]} kcal</p></div><div class="target-preview" id="target-preview">Tagesziel <strong>${num(dailyTarget(d))} kcal</strong></div></section>` : `<fieldset><legend>Makronährstoffverteilung</legend><div class="choice-list">${state.options.macroPreferences.map((v) => option("macroPreference", v, labels[v], { protein: "Proteinbetonte Rezeptauswahl", lowcarb: "Kohlenhydratärmere Rezeptauswahl", keto: "Fettbetonte, kohlenhydratarme Rezeptauswahl" }[v], "flame")).join("")}</div></fieldset><fieldset><legend>Allergien & Unverträglichkeiten <span class="tag">Mehrfachauswahl</span></legend><p class="muted small">Betroffene Zutaten werden durch passende Alternativen ersetzt.</p><div class="allergen-grid">${state.options.allergens.map((a, i) => `<label class="allergen ${d.allergens.includes(a.allergen_id) ? "selected" : ""}"><input type="checkbox" name="allergens" value="${a.allergen_id}" ${d.allergens.includes(a.allergen_id) ? "checked" : ""}><span class="choice-symbol">${icon(i % 3 ? "leaf" : "recipes")}</span><strong>${esc(a.name)}</strong><span class="check">${icon("check")}</span></label>`).join("")}</div></fieldset>`}${state.error ? `<section class="planning-error surface" role="alert" tabindex="-1"><div class="error-symbol">${icon("info")}</div><p class="eyebrow">Planung nicht abgeschlossen</p><h2>Dein Plan braucht eine Anpassung</h2><p>${esc(state.error)}</p><p class="muted small">Deine Eingaben bleiben erhalten. Bearbeite sie und versuche es erneut.</p></section>` : ""}<div class="wizard-actions">${state.step === 2 ? btn(icon("back") + " Zurück", "previous", "secondary") : ""}<button class="button primary" type="submit">${state.step === 1 ? "Weiter zu Makros & Allergenen " + icon("arrow") : "Wochenplan erstellen " + icon("spark")}</button></div></form>`;
}
function bindWizard() {
  const form = document.querySelector("#onboarding");
  if (!form) return;
  form.addEventListener("input", (event) => {
    readDraft(form);
    if (event.target.name === "goal") {
      state.draft.calorieAdjustment =
        state.options.suggestedAdjustments[state.draft.goal];
      render();
      document.querySelector('input[name="goal"]:checked').focus();
      return;
    }
    form
      .querySelectorAll(".choice,.allergen")
      .forEach((label) =>
        label.classList.toggle(
          "selected",
          label.querySelector("input").checked,
        ),
      );
    const preview = document.querySelector("#target-preview");
    if (preview)
      preview.innerHTML = `Tagesziel <strong>${num(dailyTarget(state.draft))} kcal</strong>`;
    const output = document.querySelector("#adjustment-output");
    if (output) output.textContent = state.draft.calorieAdjustment + " kcal";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    readDraft(form);
    if (state.step === 1) {
      if (
        state.draft.maintenanceCalories < 1200 ||
        state.draft.maintenanceCalories > 4500 ||
        !Number.isFinite(state.draft.maintenanceCalories)
      ) {
        state.error =
          "Der Erhaltungskalorienwert muss zwischen 1200 und 4500 kcal liegen.";
        render();
        return;
      }
      state.step = 2;
      state.error = "";
      render();
      window.scrollTo(0, 0);
    } else await generate("PUT", state.draft);
  });
}
function readDraft(form) {
  const data = new FormData(form);
  for (const name of ["dietCategory", "goal", "macroPreference"])
    if (data.has(name)) state.draft[name] = data.get(name);
  for (const name of ["maintenanceCalories", "calorieAdjustment"])
    if (data.has(name)) state.draft[name] = Number(data.get(name));
  if (state.step === 2) state.draft.allergens = data.getAll("allergens");
  if (state.draft.goal === "maintenance") state.draft.calorieAdjustment = 0;
}
function loading() {
  return `<section class="generation"><img src="/assets/seali.jpg" alt="seali" class="generation-seal"><div class="spinner" aria-hidden="true"></div><p class="eyebrow">Ein Moment für deinen Plan</p><h1>Dein persönlicher Wochenplan entsteht …</h1><p class="muted" role="status">Rezepte auswählen, Allergene berücksichtigen und Zutatenmengen berechnen.</p><div class="generation-items"><p>${icon("leaf")} Ernährungsform berücksichtigen</p><p>${icon("target")} Kalorienziel berechnen</p><p>${icon("recipes")} Sieben Tage mit drei Mahlzeiten planen</p></div></section>`;
}
function media(meal) {
  if (
    meal.recipeId === "R023" &&
    !meal.ingredients.some((i) => i.substitutedFor)
  )
    return `<img class="recipe-photo" src="/assets/quinoa.jpg" alt="Quinoa-Gemüse-Bowl mit Feta" loading="lazy">`;
  return `<div class="recipe-placeholder ${meal.mealType === "Frühstück" ? "breakfast" : meal.mealType === "Mittagessen" ? "lunch" : "dinner"}" role="img" aria-label="Gestalteter Platzhalter für ${esc(meal.name)}"><div class="plate"><span>${icon(meal.mealType === "Frühstück" ? "sun" : meal.mealType === "Mittagessen" ? "leaf" : "moon")}</span></div><div class="placeholder-caption">${icon("recipes")} ${esc(meal.mealType)}</div></div>`;
}
function mealCard(meal, day, index, compact = false) {
  const swapped = meal.ingredients.some((i) => i.substitutedFor);
  return `<article class="meal-card surface ${compact ? "compact" : ""}"><div class="meal-image">${media(meal)}<span class="image-badge">${icon(meal.mealType === "Frühstück" ? "sun" : meal.mealType === "Mittagessen" ? "leaf" : "moon")} ${meal.mealType}</span></div><div class="meal-body"><h3>${esc(meal.name)}</h3>${
    swapped
      ? '<p class="swap-note">' +
        icon("check") +
        " " +
        meal.ingredients
          .filter((i) => i.substitutedFor)
          .map((i) => `${esc(i.name)} statt ${esc(i.substitutedFor)}`)
          .join(" · ") +
        "</p>"
      : ""
  }<div class="meal-metrics"><span>${num(meal.kcal)} kcal</span><span>${num(meal.protein)} g Protein</span><span>${num(meal.carbs)} g KH</span></div><div class="meal-tags"><span class="tag">${labels[state.profile.dietCategory]}</span><span class="tag">${meal.ingredients.length} Zutaten</span></div>${btn(icon("recipes") + " Rezept & Zutaten", "recipe", "secondary", `data-day="${day}" data-meal="${index}"`)}</div></article>`;
}
function warning() {
  return state.warning
    ? `<div class="error-banner" role="alert">${icon("info")}<p>${esc(state.warning)}</p>${btn("Erneut versuchen", "regenerate", "secondary")}</div>`
    : "";
}
function home() {
  const day = state.plan.days[selectedDay(state.plan)];
  const macro = shares(day);
  const ratio = Math.min(day.kcal / state.plan.dailyTarget, 1);
  return (
    warning() +
    title(
      dateLabel(day.date),
      "Dein Tag, gut geplant",
      "Deine Mahlzeiten und Nährwerte auf einen Blick.",
    ) +
    `<div class="tip surface-tint"><img src="/assets/seali.jpg" alt=""><p><strong>Dein Plan steht.</strong><br>Alle Angaben beziehen sich auf die geplanten Mahlzeiten.</p></div><section class="surface energy-card"><div class="section-head"><h2>Energie & Nährstoffe</h2><span class="tag">Geplant</span></div><div class="energy-grid"><div class="energy-ring" style="--ring:${ratio * 360}deg"><div><strong>${num(day.kcal)}</strong><small>kcal geplant</small></div></div><div class="energy-values"><p class="muted small">Tagesziel</p><strong>${num(state.plan.dailyTarget)} <small>kcal</small></strong><div class="progress"><span style="width:${ratio * 100}%"></span></div><p class="small muted">${num(day.kcal - state.plan.dailyTarget, 1)} kcal Abweichung</p></div></div><div class="macro-grid">${["protein", "carbs", "fat"].map((m, i) => `<div><span class="macro-dot dot-${i}"></span><strong>${num(day[m])} g</strong><small>${{ protein: "Protein", carbs: "Kohlenhydrate", fat: "Fett" }[m]}</small><span class="small muted">${num(macro[m])} %</span></div>`).join("")}</div></section><div class="section-head"><h2>Heutiger Speiseplan</h2><a href="#plan" class="text-link">Zum Plan ${icon("arrow")}</a></div><div class="meal-grid">${day.meals.map((m, i) => mealCard(m, selectedDay(state.plan), i)).join("")}</div><section class="surface quick-actions"><h2>Deine Woche</h2><p class="muted">${dateLabel(state.plan.weekStart, { day: "numeric", month: "long" })} – ${dateLabel(state.plan.days[6].date, { day: "numeric", month: "long" })}</p><div class="action-row">${btn(icon("plan") + " Wochenplan", "plan", "secondary")}${btn(icon("download") + " Export (.ics)", "export", "secondary")}</div></section>`
  );
}
function days() {
  return `<nav class="day-strip" aria-label="Tag auswählen">${state.plan.days.map((d, i) => `<button type="button" class="day-pill ${state.day === i ? "selected" : ""}" aria-pressed="${state.day === i}" data-action="day" data-day="${i}"><small>${d.dayName.slice(0, 2)}</small><strong>${Number(d.date.slice(-2))}</strong><span class="day-dot"></span></button>`).join("")}</nav>`;
}
function planPage() {
  const day = state.plan.days[state.day];
  return (
    warning() +
    title("Deine laufende Woche", "Dein Wochenplan") +
    `<section class="surface-tint calendar-card"><div class="section-head"><strong>${dateLabel(state.plan.weekStart, { day: "numeric", month: "long" })} – ${dateLabel(state.plan.days[6].date, { day: "numeric", month: "long" })}</strong>${btn(state.week ? "Tagesansicht" : "Ganze Woche " + icon("arrow"), "week", "text-button")}</div>${days()}<div class="day-summary"><span>${icon("check")} ${dateLabel(day.date, { weekday: "long", day: "numeric", month: "short" })}</span><strong>${num(day.kcal)} kcal <span>· ${num(day.protein)} g Protein</span></strong></div></section><div class="tip surface"><img src="/assets/seali.jpg" alt=""><p><strong>Deine Woche im Gleichgewicht</strong><br>${num(state.plan.weeklyTotal)} von ${num(state.plan.weeklyTarget)} kcal geplant.</p></div><div class="action-row planning-actions">${btn(icon("spark") + " Woche neu", "regenerate")}${btn(icon("download") + " Export (.ics)", "export", "secondary")}</div>${state.week ? `<div class="week-grid">${state.plan.days.map((d, di) => `<section class="surface week-column"><h2>${d.dayName}</h2><p class="small muted">${num(d.kcal)} kcal</p>${d.meals.map((m, mi) => `<button class="week-meal" data-action="recipe" data-day="${di}" data-meal="${mi}"><span class="small muted">${m.mealType}</span><strong>${esc(m.name)}</strong><span>${num(m.kcal)} kcal${m.ingredients.some((i) => i.substitutedFor) ? " · angepasst" : ""}</span></button>`).join("")}</section>`).join("")}</div>` : `<div class="meal-grid">${day.meals.map((m, i) => mealCard(m, state.day, i)).join("")}</div>`}`
  );
}
function recipes() {
  return (
    title(
      "Aus deinem Wochenplan",
      "Deine Rezepte",
      "Alle Gerichte deiner geplanten Woche. Zutaten und Mengen gelten für die jeweilige Mahlzeit.",
    ) +
    `<div class="recipe-grid">${state.plan.days.flatMap((d, di) => d.meals.map((m, mi) => `<div class="recipe-entry"><p class="eyebrow">${d.dayName} · ${m.mealType}</p>${mealCard(m, di, mi, true)}</div>`)).join("")}</div>`
  );
}
function profilePage() {
  const p = state.profile;
  return (
    title("Dein Profil", "So planst du") +
    `<section class="surface profile-hero"><div class="profile-circle">${icon("profile")}</div><div><h2>Dein persönlicher Plan</h2><p class="muted">${labels[p.dietCategory]} · ${labels[p.goal]}</p></div></section><section class="surface profile-section"><h2>Ernährungsplan & Ziele</h2>${profileRow("Ernährungsform", labels[p.dietCategory], "leaf")}${profileRow("Primäres Ziel", labels[p.goal], "target")}${profileRow("Tagesziel", num(state.plan.dailyTarget) + " kcal", "flame")}${profileRow("Makropräferenz", labels[p.macroPreference], "recipes")}${btn(icon("edit") + " Präferenzen bearbeiten", "edit", "secondary")}</section><section class="surface profile-section"><h2>Allergien & Unverträglichkeiten</h2><div class="meal-tags">${p.allergens.length ? p.allergens.map((id) => `<span class="tag">${esc(state.options.allergens.find((a) => a.allergen_id === id)?.name || id)}</span>`).join("") : '<p class="muted">Keine Allergene ausgewählt.</p>'}</div></section><section class="surface profile-section"><h2>Kalender-Export</h2><p class="muted">Lade die 21 Mahlzeiten deiner Woche als Kalenderdatei herunter.</p>${btn(icon("download") + " Kalender herunterladen", "export", "secondary")}</section>`
  );
}
function profileRow(label, value, symbol) {
  return `<div class="profile-row"><span class="choice-symbol">${icon(symbol)}</span><div><small class="muted">${label}</small><strong>${esc(value)}</strong></div></div>`;
}
function startWizard() {
  state.draft = state.profile
    ? structuredClone(state.profile)
    : {
        dietCategory: "vegetarisch",
        goal: "maintenance",
        maintenanceCalories: 2000,
        calorieAdjustment: 0,
        macroPreference: "protein",
        allergens: [],
      };
  state.editing = !!state.profile;
  state.view = "onboarding";
  state.step = 1;
  state.error = "";
  render();
  window.scrollTo(0, 0);
}
async function generate(method, profile) {
  if (state.busy) return;
  const oldView = state.view;
  state.busy = true;
  state.error = "";
  render();
  try {
    const saved = await requestJson(
      method === "PUT" ? "/api/profile" : "/api/plan",
      {
        method,
        headers:
          method === "PUT" ? { "content-type": "application/json" } : undefined,
        body: method === "PUT" ? JSON.stringify(profile) : undefined,
      },
    );
    state.profile = saved.profile;
    state.plan = saved.plan;
    state.day = selectedDay(saved.plan);
    state.warning = "";
    state.view = "plan";
    location.hash = "plan";
    notice("Dein Wochenplan ist bereit.");
  } catch (error) {
    state.view = oldView;
    state.error = error.message;
    if (oldView !== "onboarding") state.warning = error.message;
    else state.step = 2;
  } finally {
    state.busy = false;
    render();
    if (!state.error) window.scrollTo(0, 0);
  }
}
let recipeTrigger;
function showRecipe(day, index, trigger) {
  const meal = state.plan.days[day].meals[index];
  recipeTrigger = trigger;
  dialog.innerHTML = `<div class="dialog-hero">${media(meal)}${btn(icon("close"), "close", "icon-button", 'aria-label="Rezept schließen"')}</div><div class="dialog-body"><p class="eyebrow">${state.plan.days[day].dayName} · ${meal.mealType}</p><h2 id="recipe-title">${esc(meal.name)}</h2>${meal.ingredients.some((i) => i.substitutedFor) ? '<div class="tip surface-tint"><p><strong>Angepasstes Rezept</strong><br>Die unten aufgeführten Ersatz-Zutaten sind Bestandteil dieser Mahlzeit.</p></div>' : ""}<div class="meal-metrics"><span>${num(meal.kcal)} kcal</span><span>${num(meal.protein)} g Protein</span><span>${num(meal.carbs)} g KH</span><span>${num(meal.fat)} g Fett</span></div><h3>Zutaten & Mengen</h3><ul class="ingredient-list">${meal.ingredients.map((i) => `<li><span class="ingredient-amount">${num(i.amountG, 1)} g</span><div><strong>${esc(i.name)}</strong>${i.substitutedFor ? `<small class="swap-note">statt ${esc(i.substitutedFor)}</small>` : ""}</div><span class="small muted">${num(i.kcal)} kcal</span></li>`).join("")}</ul></div>`;
  dialog.showModal();
}
dialog.addEventListener("close", () => recipeTrigger?.focus());
document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || state.busy) return;
  const action = target.dataset.action;
  if (action === "recipe") {
    showRecipe(Number(target.dataset.day), Number(target.dataset.meal), target);
    return;
  }
  if (action === "close") {
    dialog.close();
    return;
  }
  if (action === "edit") {
    startWizard();
    return;
  }
  if (action === "cancel") {
    state.view = "profile";
    state.error = "";
    render();
    return;
  }
  if (action === "previous") {
    state.step = 1;
    state.error = "";
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (action === "regenerate") {
    await generate("POST");
    return;
  }
  if (action === "week") {
    state.week = !state.week;
    render();
    return;
  }
  if (action === "day") {
    state.day = Number(target.dataset.day);
    state.week = false;
    render();
    return;
  }
  if (action === "export") {
    target.disabled = true;
    try {
      const file = await getCalendar();
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notice(error.message);
    } finally {
      target.disabled = false;
    }
    return;
  }
  if (["home", "plan", "recipes", "profile"].includes(action))
    location.hash = action;
});
window.addEventListener("hashchange", () => {
  if (state.busy || !state.profile) return;
  const view = location.hash.slice(1);
  if (["home", "plan", "recipes", "profile"].includes(view)) {
    state.view = view;
    render();
    window.scrollTo(0, 0);
  }
});
async function init() {
  try {
    const [options, saved] = await Promise.all([
      requestJson("/api/options"),
      requestJson("/api/state"),
    ]);
    state.options = options;
    state.profile = saved.profile;
    state.plan = saved.plan;
    state.warning = saved.warning || "";
    if (state.profile && state.plan) {
      state.day = selectedDay(state.plan);
      const view = location.hash.slice(1);
      state.view = ["home", "plan", "recipes", "profile"].includes(view)
        ? view
        : "home";
      render();
    } else startWizard();
  } catch (error) {
    root.innerHTML = `<main id="main" class="screen"><section class="surface error-screen">${title("Verbindung fehlgeschlagen", "Dein Plan ist gerade nicht erreichbar")}<p class="form-error" role="alert">${esc(error.message)}</p><button class="button primary" id="retry">Erneut versuchen</button></section></main>`;
    document.querySelector("#retry").addEventListener("click", init);
  }
}
init();
