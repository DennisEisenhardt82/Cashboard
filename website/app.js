/* Cashboard – App-Logik (klassisches Skript, läuft auch per Doppelklick im Demo-Modus) */
(() => {
"use strict";

/* ---------------------------------------------------------------------
   Grundlagen
--------------------------------------------------------------------- */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const eur = v => (Number(v) || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => isoDate(new Date());

const BANK_ORDER = ["Trade Republic", "Haspa", "ING", "Blaue Geldkassette"];

const CFG = window.CASHBOARD_CONFIG || {};
const configured = !!CFG.SUPABASE_URL && !CFG.SUPABASE_URL.includes("DEIN-PROJEKT") && !!CFG.SUPABASE_ANON_KEY && !CFG.SUPABASE_ANON_KEY.includes("DEIN-");
// Demo-Modus: ohne Supabase-Zugang (oder mit ?demo in der Adresse) – Beispieldaten, nichts wird gespeichert
const DEMO = !configured || new URLSearchParams(location.search).has("demo");
const sb = !DEMO && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
const uid = () => "demo-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

let POTS = [];   // {id,name,bank,c,t,g,goal}
let TX = [];     // {id,pot,type,amount,date,note}
let bankFilter = null, current = null, monthOffset = 0, view = "loading";
const lastPct = new Map();   // für Ring-Animation nur bei Änderung
let channel = null;

/* ---------------------------------------------------------------------
   Daten
--------------------------------------------------------------------- */
const mapPot = p => ({ id: p.id, name: p.name, bank: p.bank, c: p.color, t: p.text_color, g: p.ring_color, goal: p.goal == null ? null : Number(p.goal) });
const mapTx = t => ({ id: t.id, pot: t.pot_id, type: t.type, amount: Number(t.amount), date: t.date, note: t.note || "" });

async function fetchAllTx() {
  const out = [], step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await sb.from("transactions").select("id,pot_id,type,amount,date,note")
      .order("date", { ascending: false }).order("created_at", { ascending: false }).range(from, from + step - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < step) return out;
  }
}

async function loadAll() {
  if (DEMO) { if (!POTS.length) demoData(); return; }
  const [{ data: pots, error }, tx] = await Promise.all([
    sb.from("pots").select("*").order("sort"),
    fetchAllTx()
  ]);
  if (error) throw error;
  POTS = pots.map(mapPot);
  TX = tx.map(mapTx);
}

let reloadTimer;
function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    try { await loadAll(); refresh(); } catch (e) { console.error(e); }
  }, 400);
}

function subscribeLive() {
  if (DEMO || channel) return;
  channel = sb.channel("cashboard")
    .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, scheduleReload)
    .on("postgres_changes", { event: "*", schema: "public", table: "pots" }, scheduleReload)
    .subscribe();
}

const bal = id => TX.reduce((s, t) => t.pot === id ? s + (t.type === "in" ? t.amount : -t.amount) : s, 0);
const potById = id => POTS.find(p => p.id === id);
const vars = p => `--c:${p.c};--c-text:${p.t}`;

/* ---------------------------------------------------------------------
   Darstellung
--------------------------------------------------------------------- */
function ring(p, size) {
  if (!p.goal) return `<div class="orb"></div>`;
  const pct = Math.max(0, Math.min(1, bal(p.id) / p.goal)), r = size / 2 - 5, c = 2 * Math.PI * r;
  const key = `${p.id}-${size}`, changed = lastPct.get(key) !== pct;
  lastPct.set(key, pct);
  return `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.c}" stroke-opacity=".22" stroke-width="5.5"/>
  <circle class="arc${changed ? "" : " still"}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.c}" stroke-width="5.5" stroke-linecap="round"
    style="--len:${c.toFixed(1)};stroke-dasharray:${c.toFixed(1)};stroke-dashoffset:${(c * (1 - pct)).toFixed(1)}"/></svg>
  <span class="pct">${Math.round(pct * 100)}%</span>`;
}

function renderHome() {
  $("#total").textContent = eur(POTS.reduce((s, p) => s + bal(p.id), 0));
  const ym = todayStr().slice(0, 7);
  $("#monthOut").textContent = "− " + eur(TX.filter(t => t.type === "out" && t.date.startsWith(ym)).reduce((s, t) => s + t.amount, 0));
  const banks = [...new Set([...BANK_ORDER.filter(b => POTS.some(p => p.bank === b)), ...POTS.map(p => p.bank)])];
  $("#chips").innerHTML = banks.map(b => `<button class="chip glass ${bankFilter === b ? "on" : ""}" data-bank="${esc(b)}" aria-pressed="${bankFilter === b}">
    <small>${esc(b)}</small><span>${eur(POTS.filter(p => p.bank === b).reduce((s, p) => s + bal(p.id), 0))}</span></button>`).join("");
  $("#grid").innerHTML = POTS.filter(p => !bankFilter || p.bank === bankFilter).map(p => {
    const b = bal(p.id);
    return `<button class="pot glass" data-pot="${p.id}" style="${vars(p)}">
      <div class="ring">${ring(p, 50)}</div>
      <div class="info"><div class="name">${esc(p.name)}</div><div class="bank">${esc(p.bank)}</div>${p.goal ? `<div class="goal">Ziel ${eur(p.goal)}</div>` : ""}</div>
      <div class="bal ${b < 0 ? "neg" : ""}">${eur(b)}</div>
    </button>`;
  }).join("");
}

function renderDetail() {
  const p = potById(current);
  if (!p) return go("home");
  const b = bal(p.id);
  $("#hero").setAttribute("style", vars(p));
  $("#hero").innerHTML = `<div class="ring">${ring(p, 106)}</div>
    <div class="txt"><div class="meta">${esc(p.name)} · ${esc(p.bank)}</div><div class="val ${b < 0 ? "neg" : ""}">${eur(b)}</div>
    <div class="meta">${p.goal ? (b >= p.goal ? `Ziel von ${eur(p.goal)} erreicht 🎉` : `Noch ${eur(p.goal - b)} bis zum Ziel von ${eur(p.goal)}`) : "Kein Sparziel gesetzt"}</div>
    <button class="pill-btn" id="goalBtn">🎯 ${p.goal ? "Ziel ändern" : "Sparziel festlegen"}</button></div>`;
  $("#goalBtn").onclick = openGoal;
  const list = TX.filter(t => t.pot === p.id).sort((a, b) => b.date.localeCompare(a.date));
  $("#txCount").textContent = list.length === 1 ? "1 Eintrag" : `${list.length} Einträge`;
  $("#swipeHint").hidden = !list.length;
  $("#txList").innerHTML = list.map(t => `<div class="tx-wrap"><div class="tx-del">Löschen</div>
    <div class="tx glass" data-tx="${t.id}"><span class="d">${t.date.slice(8, 10)}.${t.date.slice(5, 7)}.${t.date.slice(2, 4)}</span>
    <span class="n">${esc(t.note || (t.type === "in" ? "Einzahlung" : "Auszahlung"))}</span>
    <span class="a ${t.type}">${t.type === "in" ? "+" : "−"} ${eur(t.amount)}</span></div></div>`).join("")
    || `<div class="empty glass">Noch keine Buchungen.<br>Mit dem + unten geht's los.</div>`;
  bindSwipe();
}

function renderMonth() {
  const now = new Date(), m = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const ym = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`;
  $("#mLabel").textContent = m.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  $("#mNext").disabled = monthOffset === 0;
  const rows = POTS.map(p => ({ p, v: TX.filter(t => t.pot === p.id && t.type === "out" && t.date.startsWith(ym)).reduce((s, t) => s + t.amount, 0) }))
    .filter(r => r.v > 0).sort((a, b) => b.v - a.v);
  const max = Math.max(1, ...rows.map(r => r.v)), sum = rows.reduce((s, r) => s + r.v, 0);
  $("#bars").innerHTML = rows.length
    ? rows.map((r, i) => `<div class="bar-row"><span class="l">${esc(r.p.name)}</span><div class="track"><div class="fill" style="width:${r.v / max * 100}%;background:${r.p.c};animation-delay:${i * 60}ms"></div></div><span class="v">${eur(r.v)}</span></div>`).join("")
      + `<div class="bar-row sum"><span class="l">Summe</span><span></span><span class="v" style="color:var(--neg)">${eur(sum)}</span></div>`
    : `<div class="hint">Keine Auszahlungen in diesem Monat</div>`;
}

const RENDER = { home: renderHome, detail: renderDetail, month: renderMonth, login() {}, loading() {} };

function go(v) {
  view = v;
  $$(".view").forEach(e => e.classList.toggle("on", e.id === "v-" + v));
  $$(".nav [data-go]").forEach(b => b.classList.toggle("on", b.dataset.go === (v === "detail" ? "home" : v)));
  document.body.classList.toggle("auth", v === "login" || v === "loading");
  RENDER[v]();
  scrollTo({ top: 0, behavior: "smooth" });
}
const refresh = () => RENDER[view]();

/* Navigation mit Browser-Verlauf: Der Zurück-Knopf (z. B. Android) schließt erst ein
   offenes Fenster, dann Topf-/Monatsansicht – und erst auf der Startseite die App. */
function nav(v) {
  if (v === view) return;
  if (v === "home") {
    if (history.state && history.state.view && history.state.view !== "home") history.back();
    else go("home");
    return;
  }
  const st = { view: v, pot: current };
  if (view === "home") history.pushState(st, ""); else history.replaceState(st, "");
  go(v);
}
addEventListener("popstate", e => {
  hideSheets();
  if (view === "login" || view === "loading") return;
  const st = e.state || { view: "home" };
  if (st.sheet) { history.back(); return; }          // „Vorwärts“ in ein altes Fenster: überspringen
  if (st.pot != null) current = st.pot;
  if (st.view !== view || st.view === "detail") go(st.view || "home");
});

/* ---------------------------------------------------------------------
   Bedienung
--------------------------------------------------------------------- */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-go],[data-pot],[data-bank]");
  if (!t) return;
  if (t.dataset.go) nav(t.dataset.go);
  else if (t.dataset.pot) { current = +t.dataset.pot; nav("detail"); }
  else { bankFilter = bankFilter === t.dataset.bank ? null : t.dataset.bank; renderHome(); }
});
$("#mPrev").onclick = () => { monthOffset++; renderMonth(); };
$("#mNext").onclick = () => { monthOffset = Math.max(0, monthOffset - 1); renderMonth(); };

// Theme
const setTheme = t => {
  document.documentElement.dataset.theme = t;
  $("#themeBtn").textContent = t === "dark" ? "☀️" : "🌙";
  $('meta[name="theme-color"]').content = t === "dark" ? "#22231C" : "#EEE8DA";
  try { localStorage.setItem("theme", t); } catch (e) {}
};
setTheme(document.documentElement.dataset.theme || "light");
$("#themeBtn").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

// Sheets
function openSheet(id) {
  $("#scrim").classList.add("show"); $(id).classList.add("show");
  history.pushState({ ...(history.state || { view }), sheet: id }, "");
}
function hideSheets() { $("#scrim").classList.remove("show"); $$(".sheet").forEach(s => s.classList.remove("show")); }
function closeSheets() {
  if (history.state && history.state.sheet) history.back();   // popstate blendet das Fenster aus
  else hideSheets();
}
$("#scrim").onclick = closeSheets;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheets(); });

// Buchen
let sType = "out", sPot = null, digits = "", saving = false;
$("#keys").innerHTML = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"].map(k => `<button type="button" data-k="${k}" aria-label="${k === "⌫" ? "Löschen" : k}">${k}</button>`).join("");
const amountValue = () => parseFloat((digits || "0").replace(",", ".")) || 0;
function showAmount() {
  $("#amount").textContent = eur(amountValue());
  $("#amount").style.color = sType === "out" ? "var(--neg)" : "var(--pos)";
}
function pressKey(k) {
  if (k === "⌫") digits = digits.slice(0, -1);
  else if (k === ",") { if (!digits.includes(",")) digits = (digits || "0") + ","; }
  else {
    const dec = digits.split(",")[1];
    if (dec !== undefined && dec.length >= 2) return;
    if (!digits.includes(",") && digits.replace(/^0+/, "").length >= 7) return;
    if (digits === "0") digits = "";
    digits += k;
  }
  showAmount();
}
$("#keys").onclick = e => { const k = e.target.closest("[data-k]")?.dataset.k; if (k) pressKey(k); };
document.addEventListener("keydown", e => {
  if (!$("#bookSheet").classList.contains("show") || e.target.matches("input")) return;
  if (/^\d$/.test(e.key)) pressKey(e.key);
  else if (e.key === "," || e.key === ".") pressKey(",");
  else if (e.key === "Backspace") pressKey("⌫");
  else if (e.key === "Enter") saveBooking();
  else return;
  e.preventDefault();
});
$$(".seg button").forEach(b => b.onclick = () => {
  sType = b.dataset.type;
  $$(".seg button").forEach(x => x.classList.toggle("on", x === b));
  showAmount();
});
function openBooking() {
  sPot = view === "detail" ? current : null;
  digits = ""; $("#note").value = ""; $("#date").value = todayStr(); $("#date").max = todayStr();
  $("#potPick").innerHTML = POTS.map(p => `<button type="button" data-pick="${p.id}" class="${p.id === sPot ? "on" : ""}"><i style="background:${p.c}"></i>${esc(p.name)}</button>`).join("");
  showAmount();
  openSheet("#bookSheet");
  $("#potPick .on")?.scrollIntoView({ inline: "center", block: "nearest" });
}
$("#potPick").onclick = e => {
  const b = e.target.closest("[data-pick]"); if (!b) return;
  sPot = +b.dataset.pick;
  $$("[data-pick]").forEach(x => x.classList.toggle("on", x === b));
};
$("#fab").onclick = openBooking;

async function saveBooking() {
  if (saving) return;
  const v = Math.round(amountValue() * 100) / 100;
  if (!sPot) return toast("Bitte einen Topf wählen", null, true);
  if (!(v > 0)) return toast("Bitte einen Betrag eingeben", null, true);
  const date = $("#date").value || todayStr();
  saving = true; $("#save").disabled = true;
  const row = { pot_id: sPot, type: sType, amount: v, date, note: $("#note").value.trim() || null };
  const { data, error } = DEMO ? { data: { id: uid(), ...row }, error: null }
    : await sb.from("transactions").insert(row).select("id,pot_id,type,amount,date,note").single();
  saving = false; $("#save").disabled = false;
  if (error) { console.error(error); return toast("Speichern hat nicht geklappt – bitte nochmal versuchen", null, true); }
  if (!TX.some(t => t.id === data.id)) TX.push(mapTx(data));
  closeSheets();
  toast(`${eur(v)} bei ${potById(sPot).name} ${sType === "in" ? "eingezahlt" : "ausgezahlt"}`);
  refresh();
}
$("#save").onclick = saveBooking;

// Sparziel
function openGoal() {
  const p = potById(current);
  $("#goalTitle").textContent = `Sparziel für ${p.name}`;
  $("#goalInput").value = p.goal ? String(p.goal).replace(".", ",") : "";
  $("#goalRemove").hidden = !p.goal;
  openSheet("#goalSheet");
  setTimeout(() => $("#goalInput").focus(), 300);
}
async function setGoal(goal) {
  const p = potById(current), old = p.goal;
  p.goal = goal; refresh(); closeSheets();
  const { error } = DEMO ? {} : await sb.from("pots").update({ goal }).eq("id", p.id);
  if (error) { console.error(error); p.goal = old; refresh(); return toast("Ziel konnte nicht gespeichert werden", null, true); }
  toast(goal ? `Sparziel ${eur(goal)} gespeichert` : "Sparziel entfernt");
}
$("#goalSave").onclick = () => {
  const raw = $("#goalInput").value.trim().replace(/\s|€/g, "").replace(/\./g, "").replace(",", ".");
  const v = Math.round(parseFloat(raw) * 100) / 100;
  if (!(v > 0)) return toast("Bitte einen Betrag größer 0 eingeben", null, true);
  setGoal(v);
};
$("#goalInput").addEventListener("keydown", e => { if (e.key === "Enter") $("#goalSave").click(); });
$("#goalRemove").onclick = () => setGoal(null);

// Toast + Rückgängig
let undoFn = null, toastTimer;
function toast(msg, undo, warn) {
  $("#toastMsg").textContent = msg; undoFn = undo || null;
  $("#undo").hidden = !undo;
  $("#toast").classList.toggle("warn", !!warn);
  $("#toast").classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $("#toast").classList.remove("show"), undo ? 5000 : 3200);
}
$("#undo").onclick = () => { const f = undoFn; undoFn = null; $("#toast").classList.remove("show"); if (f) f(); };

// Löschen per Wischen
async function deleteTx(id) {
  const i = TX.findIndex(t => t.id === id); if (i < 0) return;
  const t = TX[i];
  TX.splice(i, 1); refresh();
  const { error } = DEMO ? {} : await sb.from("transactions").delete().eq("id", id);
  if (error) { console.error(error); TX.push(t); refresh(); return toast("Löschen hat nicht geklappt", null, true); }
  toast("Buchung gelöscht", async () => {
    const { error: e2 } = DEMO ? {} : await sb.from("transactions").insert({ id: t.id, pot_id: t.pot, type: t.type, amount: t.amount, date: t.date, note: t.note || null });
    if (e2) { console.error(e2); return toast("Wiederherstellen hat nicht geklappt", null, true); }
    if (!TX.some(x => x.id === t.id)) TX.push(t);
    refresh();
  });
}
function bindSwipe() {
  $$(".tx").forEach(el => {
    let x0 = null, y0 = 0, dx = 0, horizontal = null;
    el.onpointerdown = e => { x0 = e.clientX; y0 = e.clientY; dx = 0; horizontal = null; el.classList.add("drag"); };
    el.onpointermove = e => {
      if (x0 === null) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (horizontal === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
        horizontal = Math.abs(mx) > Math.abs(my);
        if (horizontal) el.setPointerCapture(e.pointerId);
      }
      if (!horizontal) return;
      dx = Math.min(0, mx);
      el.style.transform = `translateX(${dx}px)`;
    };
    el.onpointerup = el.onpointercancel = () => {
      el.classList.remove("drag");
      if (horizontal && dx < -90) {
        el.style.transform = "translateX(-110%)";
        setTimeout(() => deleteTx(el.dataset.tx), 180);
      } else el.style.transform = "";
      x0 = null;
    };
  });
}

/* ---------------------------------------------------------------------
   Anmeldung
--------------------------------------------------------------------- */
$("#loginForm").onsubmit = async e => {
  e.preventDefault();
  $("#loginErr").textContent = "";
  $("#loginBtn").disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email: $("#email").value.trim(), password: $("#password").value });
  $("#loginBtn").disabled = false;
  if (error) {
    $("#loginErr").textContent = /invalid/i.test(error.message) ? "E-Mail oder Passwort stimmt nicht." : "Anmeldung fehlgeschlagen: " + error.message;
    return;
  }
  $("#password").value = "";
  await startApp();
};
$("#logoutBtn").onclick = async () => {
  if (!confirm("Wirklich abmelden?")) return;
  await sb.auth.signOut();
};

async function startApp() {
  go("loading");
  try {
    await loadAll();
  } catch (e) {
    console.error(e);
    go("login");
    $("#loginErr").textContent = "Daten konnten nicht geladen werden. Ist die Datenbank eingerichtet?";
    return;
  }
  subscribeLive();
  history.replaceState({ view: "home" }, "");
  go("home");
}

// Traumfänger: sanfter Scroll-Parallax (nur Transform, GPU-freundlich)
function startParallax() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const px = $("#dream .px"); let tick = false;
  addEventListener("scroll", () => {
    if (tick) return; tick = true;
    requestAnimationFrame(() => { px.style.transform = `translate3d(0,${(-scrollY * .12).toFixed(1)}px,0)`; tick = false; });
  }, { passive: true });
}

async function init() {
  startParallax();
  if (DEMO) {
    $("#logoutBtn").hidden = true;
    await startApp();
    toast("Demo-Modus: Beispieldaten, es wird nichts gespeichert", null, true);
    return;
  }
  sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      if (channel) { sb.removeChannel(channel); channel = null; }
      POTS = []; TX = []; hideSheets(); go("login");
    }
  });
  const { data: { session } } = await sb.auth.getSession();
  if (session) await startApp(); else go("login");

  // Beim Zurückkehren in die App frische Daten holen
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && view !== "login" && view !== "loading") scheduleReload();
  });
}

/* Beispieldaten für den Demo-Modus */
function demoData() {
  const P = [
    [1, "Notgroschen", "Trade Republic", "#7FA06A", "#4E6B3A", 5000], [2, "Urlaub", "Trade Republic", "#9BAEB0", "#4F6466", 2000],
    [3, "Ausflüge", "Haspa", "#C9A54E", "#7A5E1E", 1500], [4, "Kleidung", "Haspa", "#E39A6B", "#A4552C", null],
    [5, "Taschengeld", "Blaue Geldkassette", "#A9B6C2", "#55626E", null], [6, "Autoversicherung", "Trade Republic", "#B3AA86", "#6A6244", 900],
    [7, "TÜV + Service", "Trade Republic", "#A6A35A", "#646130", 800], [8, "Weihnachten", "ING", "#D08C86", "#8E4A45", 600],
    [9, "Krötenwanderung", "ING", "#C3C46E", "#6C6D2C", null], [10, "Rauchen", "ING", "#E2B48C", "#9A6438", null],
    [11, "Essen (Mastercard-Bons)", "ING", "#C79AB5", "#7E4E6A", null]];
  POTS = P.map(([id, name, bank, c, t, goal]) => ({ id, name, bank, c, t, g: c, goal }));
  const n = new Date(), d = (dd, m = 0) => isoDate(new Date(n.getFullYear(), n.getMonth() - m, Math.min(dd, 28)));
  TX = [[1, "in", 3200, d(1, 2), "Startguthaben"], [1, "in", 150, d(1), "Monatsrate"], [2, "in", 1100, d(1, 2), "Startguthaben"], [2, "in", 120, d(1)],
    [3, "in", 1180, d(1, 1), "Startguthaben"], [3, "out", 42.5, d(9), "Tierpark"], [4, "in", 300, d(1, 1), "Startguthaben"], [4, "out", 49.99, d(12), "Winterjacke"],
    [5, "in", 140, d(1)], [5, "out", 15, d(6), "Kino"], [6, "in", 60, d(1)], [7, "in", 370, d(1, 1), "Startguthaben"], [7, "out", 89, d(3), "Ölwechsel"],
    [8, "in", 410, d(1, 2), "Startguthaben"], [8, "out", 64.9, d(11), "Geschenke"], [9, "in", 50, d(1)], [10, "in", 100, d(1)], [10, "out", 58, d(8)],
    [11, "in", 120, d(1)], [11, "out", 37.4, d(4), "Wocheneinkauf"], [11, "out", 23.15, d(10)], [3, "out", 25, d(18, 1), "Minigolf"]]
    .map(([pot, type, amount, date, note], i) => ({ id: "demo-" + i, pot, type, amount, date, note: note || "" }));
}

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

init();
})();
