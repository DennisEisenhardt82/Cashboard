// Supabase-Zugangsdaten
// Zu finden im Supabase-Dashboard unter: Project Settings → API (bzw. "Data API" / "API Keys").
//
// Der "anon / public"-Schlüssel darf öffentlich sein (auch im öffentlichen GitHub-Repo):
// Ohne Anmeldung sieht man damit nichts, die Datenbank ist per Row Level Security geschützt.
// NIEMALS den "service_role"- bzw. "secret"-Schlüssel hier eintragen!
//
// Solange hier noch die Platzhalter stehen, startet die App im Demo-Modus mit Beispieldaten.

window.CASHBOARD_CONFIG = {
  SUPABASE_URL: "https://DEIN-PROJEKT.supabase.co",
  SUPABASE_ANON_KEY: "DEIN-ANON-KEY"
};
