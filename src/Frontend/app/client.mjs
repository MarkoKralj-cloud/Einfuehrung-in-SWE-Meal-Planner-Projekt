export async function requestJson(url, init, fetchImpl = fetch) {
  const response = await fetchImpl(url, init);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Die Antwort des Servers konnte nicht gelesen werden.");
  }
  if (!response.ok)
    throw new Error(
      data.error || `Anfrage fehlgeschlagen (${response.status})`,
    );
  return data;
}
export async function getCalendar(fetchImpl = fetch) {
  const response = await fetchImpl("/api/plan.ics");
  if (!response.ok) {
    let message;
    try {
      message = (await response.json()).error;
    } catch {}
    throw new Error(message || "Kalender konnte nicht geladen werden");
  }
  if (!response.headers.get("content-type")?.startsWith("text/calendar"))
    throw new Error("Unerwartetes Kalenderformat");
  const blob = await response.blob();
  if (!(await blob.text()).startsWith("BEGIN:VCALENDAR"))
    throw new Error("Unerwartetes Kalenderformat");
  const match = response.headers
    .get("content-disposition")
    ?.match(/filename="(essensplan-\d{4}-\d{2}-\d{2}\.ics)"/);
  return { blob, filename: match?.[1] || "essensplan.ics" };
}
