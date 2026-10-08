export function isoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function mondayIso(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDate(d);
}
export function selectedDay(plan, date = new Date()) {
  const index = plan.days.findIndex((d) => d.date === isoDate(date));
  return index < 0 ? 0 : index;
}
export function dateLabel(
  iso,
  options = { weekday: "long", day: "numeric", month: "long" },
) {
  return new Date(iso + "T12:00:00").toLocaleDateString("de-AT", options);
}
export function shares(macros) {
  const total = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
  return {
    protein: total ? ((macros.protein * 4) / total) * 100 : 0,
    carbs: total ? ((macros.carbs * 4) / total) * 100 : 0,
    fat: total ? ((macros.fat * 9) / total) * 100 : 0,
  };
}
export function dailyTarget(p) {
  return (
    p.maintenanceCalories +
    (p.goal === "diaet" ? -1 : p.goal === "zunahme" ? 1 : 0) *
      p.calorieAdjustment
  );
}
