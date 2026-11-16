# Cashboard – Spartöpfe

Unsere 11 Spartöpfe als kleine Web-App: aktuelles Guthaben pro Topf und pro Bank, Buchungen mit Notiz,
Sparziele mit Fortschrittsring und eine Monatsübersicht. Läuft im Browser auf Handy, Tablet und PC
und lässt sich wie eine App auf den Startbildschirm legen.

- **Oberfläche:** reines HTML/CSS/JavaScript im Ordner `website/` – kein Build nötig
- **Datenbank & Anmeldung:** [Supabase](https://supabase.com) (kostenloser Plan reicht)
- **Hosting:** [Netlify](https://netlify.com), verbunden mit diesem GitHub-Repo

```
website/            ← wird auf Netlify veröffentlicht
  index.html
  styles.css
  app.js            ← App-Logik
  config.js         ← Supabase-Adresse + öffentlicher Schlüssel
  img/              ← Hintergrund + Traumfänger (optimiert als WebP)
  manifest.webmanifest, sw.js, icons/
supabase/schema.sql ← Tabellen, Zugriffsschutz, die 11 Töpfe
netlify.toml        ← Netlify-Einstellungen
```

## Ausprobieren ohne Datenbank (Demo-Modus)

`website/index.html` doppelt anklicken: Solange in `config.js` noch die Platzhalter stehen,
startet die App mit Beispieldaten – ohne Anmeldung, es wird nichts gespeichert.
Auch die fertige Seite zeigt mit `?demo` am Ende der Adresse diesen Modus.

---

## Einrichtung (einmalig, ca. 15 Minuten)

### 1. Supabase-Projekt anlegen
1. Auf **supabase.com** kostenlos registrieren → **New project**.
2. Name z. B. `cashboard`, ein Datenbank-Passwort vergeben (gut aufheben),
   Region **Central EU (Frankfurt)** wählen → **Create new project**.

### 2. Datenbank einrichten
1. Links **SQL Editor** → **New query**.
2. Den kompletten Inhalt von `supabase/schema.sql` hineinkopieren → **Run**.
3. Unter **Table Editor** sollten jetzt `pots` (mit 11 Töpfen) und `transactions` auftauchen.

### 3. Anmeldung absichern und Konten anlegen
1. **Authentication → Sign In / Providers** (bzw. *Settings*):
   **„Allow new users to sign up“ ausschalten** → Speichern.
   So kann sich niemand Fremdes ein Konto anlegen.
2. **Authentication → Users → Add user → Create new user**:
   - deine E-Mail + Passwort, Haken bei **Auto Confirm User**
   - dasselbe nochmal für deine Frau

### 4. Zugangsdaten eintragen
1. **Project Settings → API** (bzw. *Data API* / *API Keys*).
2. **Project URL** und den **Publishable key** (`sb_publishable_…`, früher „anon / public“) kopieren.
3. In `website/config.js` eintragen:
   ```js
   window.CASHBOARD_CONFIG = {
     SUPABASE_URL: "https://xxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi..."
   };
   ```
   Der anon-Schlüssel darf öffentlich im Repo stehen – ohne Anmeldung gibt die Datenbank nichts heraus.
   **Niemals** den `service_role`- bzw. `secret`-Schlüssel eintragen.
4. Änderung committen und zu GitHub pushen.

### 5. Auf Netlify veröffentlichen
1. Auf **netlify.com** anmelden (geht direkt mit dem GitHub-Konto).
2. **Add new site → Import an existing project → GitHub → `Cashboard`**.
3. Die Einstellungen kommen automatisch aus `netlify.toml` (Publish directory: `website`) → **Deploy**.
4. Unter **Site configuration → Change site name** einen schönen Namen vergeben,
   z. B. `unsere-spartoepfe` → Adresse `https://unsere-spartoepfe.netlify.app`.

Ab jetzt wird jede Änderung, die zu GitHub gepusht wird, automatisch neu veröffentlicht.

### 6. Als App aufs Handy / Tablet
- **Android (Chrome):** Seite öffnen → Menü ⋮ → **„Zum Startbildschirm hinzufügen“** bzw. **„App installieren“**
- **iPhone / iPad (Safari):** Seite öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“**

Einmal anmelden – danach bleibt man angemeldet.

---

## Benutzung

- **Startguthaben:** pro Topf einmal eine **Einzahlung** mit der Notiz „Startguthaben“ buchen.
- **Buchen:** großes **+** unten → Aus- oder Einzahlung → Topf → Betrag → (Notiz, Datum) → Speichern.
- **Topf antippen:** Verlauf ansehen, **Sparziel** festlegen, Buchung **nach links wischen** zum Löschen
  (mit „Rückgängig“).
- **Bank-Kapseln** oben antippen filtert die Töpfe nach Bank.
- **Monat:** Ausgaben pro Topf, mit ‹ › durch die Monate blättern.
- Was einer bucht, erscheint beim anderen automatisch (Live-Abgleich).

## Gut zu wissen

- **Updates:** Nach jeder Änderung an der App in `website/sw.js` die Zahl bei `CACHE = "cashboard-vX"` um eins erhöhen.
  Dann erkennen Handy und Tablet die neue Version selbst und laden einmal kurz neu („App aktualisiert ✨“).

- **Kostenloser Supabase-Plan:** Projekte werden nach **7 Tagen ohne jede Nutzung pausiert**.
  Bei regelmäßiger Nutzung passiert das nicht. Falls doch: im Supabase-Dashboard auf
  **Restore project** klicken – die Daten bleiben erhalten.
- **Passwort vergessen:** im Supabase-Dashboard unter *Authentication → Users* beim Konto
  ein neues Passwort setzen.
- **Töpfe umbenennen / Farben ändern:** im Supabase **Table Editor** in der Tabelle `pots`.
