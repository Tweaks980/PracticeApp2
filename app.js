import { DEFAULT_DRILLS, DEFAULT_CLUBS, ensure28Drills } from "./data.js";

const KEYS = {
  SHOTS: "golfPracticeShots_v1",
  CLUBS: "golfPracticeClubs_v1",
  DRILLS: "golfPracticeDrills_v1",
  UI: "golfPracticeUI_v1",
};

export const CONTACT_TYPES = ["solid", "thin", "fat", "toe", "heel"];
export const OUTCOME_TYPES = ["success", "miss"];
export const MISS_DIRS = ["short", "long", "left", "right"];

export function todayYMD() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getClubs() {
  const stored = loadJSON(KEYS.CLUBS, null);
  if (Array.isArray(stored) && stored.length) return stored;
  saveJSON(KEYS.CLUBS, DEFAULT_CLUBS);
  return DEFAULT_CLUBS;
}

export function setClubs(clubs) {
  saveJSON(KEYS.CLUBS, clubs);
}

export function getDrills() {
  const stored = loadJSON(KEYS.DRILLS, null);
  const base = ensure28Drills(DEFAULT_DRILLS);
  if (Array.isArray(stored) && stored.length) return ensure28Drills(stored);
  saveJSON(KEYS.DRILLS, base);
  return base;
}

export function getShots() {
  const shots = loadJSON(KEYS.SHOTS, []);
  return Array.isArray(shots) ? shots : [];
}

export function addShot(shot) {
  const shots = getShots();
  shots.push(shot);
  saveJSON(KEYS.SHOTS, shots);
}

export function deleteShotById(id) {
  const shots = getShots().filter(s => s.id !== id);
  saveJSON(KEYS.SHOTS, shots);
}

export function getUIState() {
  return loadJSON(KEYS.UI, { selectedDate: todayYMD(), selectedDrillId: "", selectedClubId: "" });
}

export function setUIState(partial) {
  const current = getUIState();
  saveJSON(KEYS.UI, { ...current, ...partial });
}

export function uid() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

export function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  window.clearTimeout(window.__toastT);
  window.__toastT = window.setTimeout(() => el.classList.remove("show"), 1400);
}

export function fmtClubPill(club) {
  const parts = [];
  if (typeof club.carryAvg === "number") parts.push(`${club.carryAvg}`);
  if (typeof club.carryMin === "number" && typeof club.carryMax === "number") parts.push(`(${club.carryMin}–${club.carryMax})`);
  return parts.join(" ");
}

export function shotsForDateAndDrill(shots, dateYmd, drillId) {
  return shots.filter(s => s.date === dateYmd && s.drillId === drillId);
}

export function aggregateByClub(shots, clubsIndex) {
  const out = {};
  for (const s of shots) {
    const clubId = s.clubId;
    if (!out[clubId]) {
      out[clubId] = {
        clubId,
        clubName: clubsIndex.get(clubId)?.name ?? clubId,
        outcomeTotal: 0,
        success: 0,
        miss: 0,
        contactTotal: 0,
        solid: 0, thin: 0, fat: 0, toe: 0, heel: 0,
        miss_short: 0, miss_long: 0, miss_left: 0, miss_right: 0,
      };
    }
    const a = out[clubId];
    a.outcomeTotal += 1;
    if (s.outcome === "success") a.success += 1;
    if (s.outcome === "miss") {
      a.miss += 1;
      if (s.missDirection) a["miss_" + s.missDirection] += 1;
    }
    const c = s.contact || {};
    const hasContact = Object.values(c).some(Boolean);
    if (hasContact) {
      a.contactTotal += 1;
      for (const k of CONTACT_TYPES) if (c[k]) a[k] += 1;
    }
  }
  return Object.values(out).sort((a,b)=> (a.clubName||"").localeCompare(b.clubName||""));
}

export function pct(n, d) {
  if (!d) return "–";
  return `${Math.round((n / d) * 100)}%`;
}

export function toCSV(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"','""')}"`;
    return s;
  };
  const keys = Object.keys(rows[0] || {});
  const header = keys.map(esc).join(",");
  const lines = rows.map(r => keys.map(k => esc(r[k])).join(","));
  return [header, ...lines].join("\n");
}

export function downloadText(filename, text, mime="text/plain") {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1200);
}

export function listSessionDates(shots, drillId=null) {
  const set = new Set();
  for (const s of shots) {
    if (!drillId || s.drillId === drillId) set.add(s.date);
  }
  return Array.from(set).sort(); // yyyy-mm-dd sorts naturally
}
