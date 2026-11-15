// Supabase-Zugangsdaten
// Zu finden im Supabase-Dashboard unter: Project Settings → API (bzw. "Data API" / "API Keys").
//
// Der "Publishable key" (früher "anon / public") darf öffentlich sein (auch im öffentlichen GitHub-Repo):
// Ohne Anmeldung sieht man damit nichts, die Datenbank ist per Row Level Security geschützt.
// NIEMALS den "Secret key" (sb_secret_…) bzw. "service_role"-Schlüssel hier eintragen!
//
// Solange hier noch die Platzhalter stehen, startet die App im Demo-Modus mit Beispieldaten.

window.CASHBOARD_CONFIG = {
  SUPABASE_URL: "https://oexpkdlcwhvjzbbgspyg.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_LWavikz_XSkGP3wY6Q1jVQ_scACoqNE"
};
