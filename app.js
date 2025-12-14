import { DEFAULT_DRILLS, DEFAULT_CLUBS, ensure28Drills } from "./data.js";

const KEYS = {
  SHOTS: "golfPracticeShots_v1",
  CLUBS: "golfPracticeClubs_v2",
  DRILLS: "golfPracticeDrills_v2",
  UI: "golfPracticeUI_v1",
  NOTES: "golfPracticeNotes_v1",
  CLUB_NOTES: "golfPracticeClubNotes_v1",
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
  let clubs = (Array.isArray(stored) && stored.length) ? stored : DEFAULT_CLUBS;

  // Lightweight migration: ensure Putter exists even if you have older saved clubs.
  // (Keeps your custom clubs; just appends Putter if missing.)
  const hasPutter = clubs.some(c => c && c.id === "P");
  if (!hasPutter) {
    const putter = DEFAULT_CLUBS.find(c => c.id === "P") || { id:"P", name:"Putter", loft:null, carryAvg:null, carryMin:null, carryMax:null, lrRef:"", notes:"" };
    clubs = [...clubs, putter];
    saveJSON(KEYS.CLUBS, clubs);
  }

  if (!(Array.isArray(stored) && stored.length)) {
    saveJSON(KEYS.CLUBS, clubs);
  }
  return clubs;
}

export function setClubs(clubs) {
  saveJSON(KEYS.CLUBS, clubs);
}

export function getDrills() {
  const stored = loadJSON(KEYS.DRILLS, null);
  const base = ensure28Drills(DEFAULT_DRILLS);

  // Lightweight migration: if you already have drills saved, append any new default drills
  // (keeps your customized drills/order; just ensures new drills appear).
  if (Array.isArray(stored) && stored.length) {
    const current = ensure28Drills(stored);
    const have = new Set(current.map(d => (d && d.id) ? d.id : null).filter(Boolean));
    let changed = false;
    for (const d of base) {
      if (d && d.id && !have.has(d.id)) {
        current.push(d);
        have.add(d.id);
        changed = true;
      }
    }
    if (changed) saveJSON(KEYS.DRILLS, current);
    return current;
  }

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

export function clearAllLogs() {
  // Clears all shots + notes on this device/browser. Keeps clubs + drills.
  localStorage.removeItem(KEYS.SHOTS);
  localStorage.removeItem(KEYS.NOTES);
  localStorage.removeItem(KEYS.CLUB_NOTES);
  toast("Cleared shots");
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
        clubName: ((clubsIndex.get(clubId) && clubsIndex.get(clubId).name) ? clubsIndex.get(clubId).name : clubId),
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
    const s = String((v === null || v === undefined) ? "" : v);
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
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


export function getSessionNote(dateYMD, drillId, clubId) {
  const all = loadJSON(KEYS.NOTES, {});
  const key = `${dateYMD}__${drillId}__${clubId}`;
  return all[key] || "";
}

export function setSessionNote(dateYMD, drillId, clubId, text) {
  const all = loadJSON(KEYS.NOTES, {});
  const key = `${dateYMD}__${drillId}__${clubId}`;
  all[key] = String(text || "");
  saveJSON(KEYS.NOTES, all);
}


// --- Club Notes (running log) ---
// Stored as an array per (date + club). Each note is its own record.
export function getClubNotes(dateYMD, clubId) {
  const all = loadJSON(KEYS.CLUB_NOTES, {});
  const key = `${dateYMD}__${clubId}`;
  const arr = all[key];
  return Array.isArray(arr) ? arr : [];
}

export function addClubNote(dateYMD, clubId, text, drillId = "") {
  const clean = String(text || "").trim();
  if (!clean) return null;
  const all = loadJSON(KEYS.CLUB_NOTES, {});
  const key = `${dateYMD}__${clubId}`;
  const arr = Array.isArray(all[key]) ? all[key] : [];
  const note = {
    id: ((typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : uid()),
    timestamp: new Date().toISOString(),
    date: dateYMD,
    clubId,
    drillId: drillId || "",
    text: clean
  };
  arr.push(note);
  all[key] = arr;
  saveJSON(KEYS.CLUB_NOTES, all);
  return note;
}

export function deleteClubNote(dateYMD, clubId, noteId) {
  const all = loadJSON(KEYS.CLUB_NOTES, {});
  const key = `${dateYMD}__${clubId}`;
  const arr = Array.isArray(all[key]) ? all[key] : [];
  all[key] = arr.filter(n => n.id !== noteId);
  saveJSON(KEYS.CLUB_NOTES, all);
}




// Get the most recent N notes for a club across all dates (newest first)
export function getRecentNotesForClub(clubId, limit = 2) {
  const all = loadJSON(KEYS.CLUB_NOTES, {});
  const out = [];
  for (const arr of Object.values(all)) {
    if (!Array.isArray(arr)) continue;
    for (const n of arr) {
      if (n && n.clubId === clubId) out.push(n);
    }
  }
  out.sort((a,b)=> (b.timestamp||"").localeCompare(a.timestamp||""));
  return out.slice(0, Math.max(0, limit|0));
}

// Utility: parse YYYY-MM-DD into a Date (local midnight)
export function ymdToDate(ymd) {
  if (!ymd) return null;
  const [y,m,d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m-1, d);
}

// --- Backup / Restore (JSON) ---

function normalizeShotRecord(s) {
  if (!s || typeof s !== "object") return null;
  const out = { ...s };

  // Ensure shot_note round-trips cleanly (and support the occasional older key).
  if (out.shot_note === undefined || out.shot_note === null) {
    if (out.shotNote !== undefined && out.shotNote !== null) out.shot_note = String(out.shotNote);
    else out.shot_note = "";
  } else {
    out.shot_note = String(out.shot_note);
  }

  return out;
}

function normalizeShotArray(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const s of arr) {
    const n = normalizeShotRecord(s);
    if (n) out.push(n);
  }
  return out;
}

export function exportBackupJSON() {
  const payload = {
    meta: {
      exportedAt: new Date().toISOString(),
      version: 1,
      keys: KEYS,
    },
    data: {
      shots: normalizeShotArray(loadJSON(KEYS.SHOTS, [])),
      clubs: loadJSON(KEYS.CLUBS, []),
      drills: loadJSON(KEYS.DRILLS, []),
      ui: loadJSON(KEYS.UI, {}),
      notes: loadJSON(KEYS.NOTES, {}),
      clubNotes: loadJSON(KEYS.CLUB_NOTES, {}),
    }
  };
  const ymd = todayYMD();
  const filename = `golf-practice-backup-${ymd}.json`;
  downloadText(filename, JSON.stringify(payload, null, 2), "application/json");
  toast("Downloaded JSON backup");
}

export function importBackupJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    toast("Invalid JSON file");
    return { ok: false, error: "invalid_json" };
  }
  const data = parsed && parsed.data;
  if (!data || typeof data !== "object") {
    toast("Backup file missing data");
    return { ok: false, error: "missing_data" };
  }
  // Write only our known keys; fall back to empty structures
  saveJSON(KEYS.SHOTS, normalizeShotArray(data.shots));
  saveJSON(KEYS.CLUBS, Array.isArray(data.clubs) ? data.clubs : DEFAULT_CLUBS);
  saveJSON(KEYS.DRILLS, Array.isArray(data.drills) ? data.drills : ensure28Drills(DEFAULT_DRILLS));
  saveJSON(KEYS.UI, data.ui && typeof data.ui === "object" ? data.ui : { selectedDate: todayYMD(), selectedDrillId: "", selectedClubId: "" });
  saveJSON(KEYS.NOTES, data.notes && typeof data.notes === "object" ? data.notes : {});
  saveJSON(KEYS.CLUB_NOTES, data.clubNotes && typeof data.clubNotes === "object" ? data.clubNotes : {});
  toast("Imported backup — reloading…");
  return { ok: true };
}
