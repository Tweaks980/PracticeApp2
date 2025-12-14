import {
  CONTACT_TYPES, MISS_DIRS,
  todayYMD, getClubs, setClubs, getDrills,
  getShots, addShot, deleteShotById,
  getUIState, setUIState,
  toast, fmtClubPill,
  shotsForDateAndDrill, aggregateByClub, pct,
  listSessionDates,
  exportBackupJSON, importBackupJSON,
  ymdToDate,
  clearAllLogs
} from "./app.js";
import { DEFAULT_CLUBS } from "./data.js";

// Elements
const dateEl = document.getElementById("date");
const drillEl = document.getElementById("drill");
const drillTitleEl = document.getElementById("drillTitle");
const drillDescEl = document.getElementById("drillDesc");
const constraintsEl = document.getElementById("constraints");
const clubPillsEl = document.getElementById("clubPills");
const clubLabelEl = document.getElementById("clubLabel");
const clubLREl = document.getElementById("clubLR");
const contextWrap = document.getElementById("contextWrap");
const contextSelect = document.getElementById("contextSelect");
const shotNoteInputEl = document.getElementById("shotNoteInput");
const shotNoteAttachedBadgeEl = document.getElementById("shotNoteAttachedBadge");

const sessionSummaryEl = document.getElementById("sessionSummary");
const ssTitleEl = document.getElementById("ssTitle");
const ssTodayPctEl = document.getElementById("ssTodayPct");
const ssSuccessFracEl = document.getElementById("ssSuccessFrac");
const ssSuccessPctEl = document.getElementById("ssSuccessPct");
const ssAvg30El = document.getElementById("ssAvg30");
const ssCommonMissEl = document.getElementById("ssCommonMiss");
const ssContactTrendEl = document.getElementById("ssContactTrend");
const ssMissLeftEl = document.getElementById("ssMissLeft");
const ssMissRightEl = document.getElementById("ssMissRight");
const ssMissShortEl = document.getElementById("ssMissShort");
const ssMissLongEl = document.getElementById("ssMissLong");
const shotCountEl = document.getElementById("shotCount");
const clubTableBody = document.getElementById("clubTableBody");
const sessionShotsBody = document.getElementById("sessionShotsBody");

const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnUndo = document.getElementById("btnUndo");

const contactGrid = document.getElementById("contactGrid");
const contactSection = document.getElementById("contactSection");
const btnSuccess = document.getElementById("btnSuccess");
const btnMiss = document.getElementById("btnMiss");
const missDirWrap = document.getElementById("missDirWrap");
const missGrid = document.getElementById("missGrid");

const btnExportJson = document.getElementById("btnExportJson");
const btnImportJson = document.getElementById("btnImportJson");
const importJsonFile = document.getElementById("importJsonFile");
const btnClearLogs = document.getElementById("btnClearLogs");
const btnClubs = document.getElementById("btnClubs");
const modalBackdrop = document.getElementById("modalBackdrop");
const btnCloseModal = document.getElementById("btnCloseModal");
const btnAddClub = document.getElementById("btnAddClub");
const btnSaveClubs = document.getElementById("btnSaveClubs");
const btnResetClubs = document.getElementById("btnResetClubs");
const clubsEditor = document.getElementById("clubsEditor");

let drills = getDrills();
let clubs = getClubs();
let shots = getShots();

let ui = getUIState();
let selectedDate = ui.selectedDate || todayYMD();
let selectedDrillId = ui.selectedDrillId || ((drills[0] && drills[0].id) ? drills[0].id : "") || "";
let selectedClubId = ui.selectedClubId || ((clubs[0] && clubs[0].id) ? clubs[0].id : "") || "";

// Context is optional and only enabled for certain drills.
// Stored on each shot as a simple string, default "".
let selectedContext = "";

// Shot note attaches to the next committed shot, then clears.
let pendingShotNote = "";

function flashShotNoteAttached() {
  if (!shotNoteAttachedBadgeEl) return;
  // Restart animation if fired repeatedly.
  shotNoteAttachedBadgeEl.classList.remove("hidden");
  shotNoteAttachedBadgeEl.classList.remove("pop");
  // Force reflow so the animation restarts reliably.
  void shotNoteAttachedBadgeEl.offsetWidth;
  shotNoteAttachedBadgeEl.classList.add("pop");

  window.clearTimeout(window.__shotNoteAttachedT);
  window.__shotNoteAttachedT = window.setTimeout(() => {
    shotNoteAttachedBadgeEl.classList.add("hidden");
    shotNoteAttachedBadgeEl.classList.remove("pop");
  }, 1500);
}

const DRILL_CONTEXTS = {
  "arc-depth-woods": ["Mat", "Tiny Tee", "Small Tee", "Mid Tee", "High Tee"],
  "ball-flight-control": ["High", "Low"],
  "blue-brick-fade-draw": ["Fade", "Draw"],
  "knocked-down-wedges": ["60", "80", "100", "120"],
  "ladder-lw-distance": ["10", "20", "30", "40", "50", "60", "70", "80"],
  "variability": ["Toe Address", "Heel Address", "Center Address"],
};

function getContextOptions(drillId) {
  const opts = DRILL_CONTEXTS[drillId];
  return Array.isArray(opts) && opts.length ? opts : null;
}

function renderContextPicker() {
  if (!contextWrap || !contextSelect) return;
  const opts = getContextOptions(selectedDrillId);
  if (!opts) {
    contextWrap.classList.add("hidden");
    selectedContext = "";
    contextSelect.innerHTML = "";
    return;
  }

  contextWrap.classList.remove("hidden");
  contextSelect.innerHTML = "";
  contextSelect.appendChild(new Option("(none)", ""));
  for (const v of opts) contextSelect.appendChild(new Option(v, v));

  // Keep selection if still valid; otherwise default blank.
  if (!opts.includes(selectedContext)) selectedContext = "";
  contextSelect.value = selectedContext;
}

let currentContact = Object.fromEntries(CONTACT_TYPES.map(k=>[k,false]));

function clubsIndex() {
  const m = new Map();
  for (const c of clubs) m.set(c.id, c);
  return m;
}
function drillsIndex() {
  const m = new Map();
  for (const d of drills) m.set(d.id, d);
  return m;
}
const drillMap = drillsIndex();

function renderDrillSelect() {
  drillEl.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Select a drill…";
  drillEl.appendChild(opt0);

  for (const d of drills) {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.name;
    drillEl.appendChild(opt);
  }
  drillEl.value = selectedDrillId || "";
}

function renderDrillCard() {
  const d = drillMap.get(selectedDrillId);
  if (!d) {
    drillTitleEl.textContent = "Pick a drill";
    drillDescEl.textContent = "Select a drill above. Then pick a club and start logging shots.";
    constraintsEl.innerHTML = "";
    return;
  }
  drillTitleEl.textContent = d.name;
  drillDescEl.textContent = d.desc || "";
  if (Array.isArray(d.constraints) && d.constraints.length) {
    constraintsEl.innerHTML = "<strong>Constraints:</strong><ul style='margin:6px 0 0; padding-left:18px;'>" +
      d.constraints.map(x=>`<li>${x}</li>`).join("") + "</ul>";
  } else {
    constraintsEl.innerHTML = "";
  }
}

function renderClubPills() {
  clubPillsEl.innerHTML = "";
  for (const c of clubs) {
    const b = document.createElement("button");
    b.className = "pill" + (c.id === selectedClubId ? " active" : "");
    b.type = "button";
    b.dataset.clubId = c.id;
    const right = fmtClubPill(c);
    b.innerHTML = `<span>${c.name}</span>${right ? `<small>${right}</small>` : ""}`;
    b.addEventListener("click", () => {
      selectedClubId = c.id;
      setUIState({ selectedClubId });
      updateSelectedClubLabel();
      renderSessionSummary();
      renderClubPills();
    });
    clubPillsEl.appendChild(b);
  }
  updateSelectedClubLabel();
}

function updateSelectedClubLabel() {
  const c = clubsIndex().get(selectedClubId);
  clubLabelEl.textContent = c ? c.name : "None";
  if (clubLREl) clubLREl.textContent = c && c.lrRef ? ` ${c.lrRef}` : "";
}

function renderSessionSummary() {
  if (!sessionSummaryEl) return;

  const d = drillMap.get(selectedDrillId);
  const c = clubsIndex().get(selectedClubId);
  const drillName = (d && d.name) ? d.name : "—";
  const clubName = (c && c.name) ? c.name : "—";

  // Session scope: selected date + selected drill + selected club
  const sessionAll = currentSessionShots();
  const clubShots = sessionAll.filter(s => s.clubId === selectedClubId);

  // Hide card if no shots yet for this club in this session
  if (!clubShots.length) {
    sessionSummaryEl.classList.add("hidden");
    return;
  }
  sessionSummaryEl.classList.remove("hidden");

  // Title
  const isToday = selectedDate === todayYMD();
  if (ssTitleEl) ssTitleEl.textContent = `${clubName} · ${drillName} · ${isToday ? "Today" : selectedDate}`;

  // Success today
  const total = clubShots.length;
  const success = clubShots.filter(s => s.outcome === "success").length;
  const todayPct = total ? Math.round((success / total) * 100) : null;
  if (ssTodayPctEl) ssTodayPctEl.textContent = todayPct === null ? "–" : `${todayPct}%`;
  if (ssSuccessFracEl) ssSuccessFracEl.textContent = `${success} / ${total}`;
  if (ssSuccessPctEl) ssSuccessPctEl.textContent = todayPct === null ? "" : `(${todayPct}%)`;

  // Miss direction counts (session)
  const missCounts = { left:0, right:0, short:0, long:0 };
  for (const s of clubShots) {
    if (s.outcome !== "miss") continue;
    const dir = s.missDirection;
    if (dir && dir in missCounts) missCounts[dir] += 1;
  }
  if (ssMissLeftEl) ssMissLeftEl.textContent = String(missCounts.left);
  if (ssMissRightEl) ssMissRightEl.textContent = String(missCounts.right);
  if (ssMissShortEl) ssMissShortEl.textContent = String(missCounts.short);
  if (ssMissLongEl) ssMissLongEl.textContent = String(missCounts.long);

  // Most common miss
  const dirOrder = ["right","left","short","long"];
  let commonDir = null;
  let commonN = 0;
  for (const dir of dirOrder) {
    const n = missCounts[dir] || 0;
    if (n > commonN) { commonN = n; commonDir = dir; }
  }
  const niceDir = commonDir ? (commonDir[0].toUpperCase() + commonDir.slice(1)) : "–";
  if (ssCommonMissEl) ssCommonMissEl.textContent = commonDir ? `${niceDir} (${commonN})` : "–";

  // Contact trend (session): count tags across shots with contact
  const contactCounts = Object.fromEntries(CONTACT_TYPES.map(k=>[k,0]));
  for (const s of clubShots) {
    const cobj = s.contact || {};
    for (const k of CONTACT_TYPES) if (cobj[k]) contactCounts[k] += 1;
  }
  let topContact = null;
  let topContactN = 0;
  for (const k of CONTACT_TYPES) {
    const n = contactCounts[k] || 0;
    if (n > topContactN) { topContactN = n; topContact = k; }
  }
  const niceContact = topContact ? (topContact[0].toUpperCase()+topContact.slice(1)) : "–";
  if (ssContactTrendEl) ssContactTrendEl.textContent = topContact ? `${niceContact} (${topContactN})` : "–";

  // 30-day rolling average for this club (all drills), ending on selectedDate
  const end = ymdToDate(selectedDate);
  let avg30Text = "–";
  if (end) {
    const start = new Date(end.getTime());
    start.setDate(start.getDate() - 29); // inclusive window
    let nShots = 0;
    let nSuccess = 0;
    for (const s of shots) {
      if (s.clubId !== selectedClubId) continue;
      const sd = ymdToDate(s.date);
      if (!sd) continue;
      if (sd < start || sd > end) continue;
      nShots += 1;
      if (s.outcome === "success") nSuccess += 1;
    }
    if (nShots) avg30Text = `${Math.round((nSuccess / nShots) * 100)}% (${nSuccess}/${nShots})`;
  }
  if (ssAvg30El) ssAvg30El.textContent = avg30Text;
}


function renderContactGrid() {
  contactGrid.innerHTML = "";
  for (const k of CONTACT_TYPES) {
    const btn = document.createElement("button");
    btn.className = "tile" + (currentContact[k] ? " active" : "");
    btn.type = "button";
    btn.textContent = k[0].toUpperCase()+k.slice(1);
    btn.addEventListener("click", () => {
      currentContact[k] = !currentContact[k];
      renderContactGrid();
    });
    contactGrid.appendChild(btn);
  }
}

function resetContact() {
  currentContact = Object.fromEntries(CONTACT_TYPES.map(k=>[k,false]));
  renderContactGrid();
}

function renderMissDirs() {
  missGrid.innerHTML = "";
  for (const dir of MISS_DIRS) {
    const btn = document.createElement("button");
    btn.className = "tile warn";
    btn.type = "button";
    btn.textContent = dir[0].toUpperCase() + dir.slice(1);
    btn.addEventListener("click", () => commitShot("miss", dir));
    missGrid.appendChild(btn);
  }
}

function currentSessionShots() {
  if (!selectedDrillId) return [];
  return shotsForDateAndDrill(shots, selectedDate, selectedDrillId);
}

function renderTable() {
  const cIndex = clubsIndex();
  const session = currentSessionShots();
  shotCountEl.textContent = String(session.length);

  // Build aggregates
  const agg = aggregateByClub(session, cIndex);

  // Ensure rows exist for all clubs (so table doesn't jump around)
  const existing = new Map(agg.map(a => [a.clubId, a]));
  const full = clubs.map(c => existing.get(c.id) || {
    clubId: c.id, clubName: c.name,
    outcomeTotal: 0, success: 0, miss: 0,
    contactTotal: 0, solid:0, thin:0, fat:0, toe:0, heel:0,
    miss_short:0, miss_long:0, miss_left:0, miss_right:0
  });

  clubTableBody.innerHTML = "";
  for (const a of full) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${a.clubName}</td>
      <td>${a.success}</td>
      <td>${a.miss}</td>
      <td>${pct(a.success, a.outcomeTotal)}</td>
      <td>${a.solid}</td>
      <td>${a.thin}</td>
      <td>${a.fat}</td>
      <td>${a.toe}</td>
      <td>${a.heel}</td>
      <td>${a.miss_short}</td>
      <td>${a.miss_long}</td>
      <td>${a.miss_left}</td>
      <td>${a.miss_right}</td>
    `;
    clubTableBody.appendChild(tr);
  }

  renderSessionSummary();
  renderSessionShots();

}


function renderSessionShots() {
  if (!sessionShotsBody) return;
  const cIndex = clubsIndex();
  const session = currentSessionShots()
    .slice()
    .sort((a,b)=> (a.timestamp||"").localeCompare(b.timestamp||"")); // oldest -> newest

  sessionShotsBody.innerHTML = "";
  if (!session.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="8" style="text-align:left; color:var(--muted);">No shots yet for this date + drill.</td>`;
    sessionShotsBody.appendChild(tr);
    return;
  }

  for (const s of session) {
    const tr = document.createElement("tr");
    const t = (s.timestamp || "").replace("T"," ").slice(11,16); // HH:MM
    const _clubObj = cIndex.get(s.clubId); const clubName = (_clubObj && _clubObj.name) || s.clubName || s.clubId || "";
    const contact = s.contact || {};
    const contactTags = Object.entries(contact).filter(([k,v])=>v).map(([k])=>k).join(", ");
    tr.innerHTML = `
      <td style="font-family:var(--mono); font-size:.84rem;">${escapeHtml(t || "")}</td>
      <td>${escapeHtml(clubName)}</td>
      <td>${escapeHtml(s.context || "")}</td>
      <td>${escapeHtml(s.shot_note || "")}</td>
      <td>${escapeHtml(s.outcome || "")}</td>
      <td>${escapeHtml(s.missDirection || "")}</td>
      <td>${escapeHtml(contactTags)}</td>
      <td><button class="btn red small" data-id="${escapeHtml(s.id)}">Delete</button></td>
    `;
    const _btn = tr.querySelector("button");
    if (_btn) _btn.addEventListener("click", () => {
      if (!confirm("Delete this shot?")) return;
      deleteShotById(s.id);
      shots = getShots();
      toast("Deleted shot");
      renderTable();
      updatePrevNextButtons();
    });
    sessionShotsBody.appendChild(tr);
  }
}


function commitShot(outcome, missDirection=null) {
  if (!selectedDrillId) {
    toast("Pick a drill first.");
    return;
  }
  if (!selectedClubId) {
    toast("Pick a club first.");
    return;
  }

  // Harden: a Miss doesn't "commit" until a miss direction is chosen.
  if (outcome === "miss" && !missDirection) {
    missDirWrap.classList.remove("hidden");
    toast("Pick miss direction");
    return;
  }

  // Persist until the shot is committed (Success OR Miss+Direction).
  const noteRaw = (shotNoteInputEl ? shotNoteInputEl.value : pendingShotNote) || "";
  const noteTrim = String(noteRaw).trim();
  const d = drillMap.get(selectedDrillId);
  const c = clubsIndex().get(selectedClubId);
  const shot = {
    id: (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9))),
    timestamp: new Date().toISOString(),
    date: selectedDate, // important: selected date (reviewable later)
    drillId: selectedDrillId,
    drillName: (d && d.name) ? d.name : selectedDrillId,
    clubId: selectedClubId,
    clubName: (c && c.name) ? c.name : selectedClubId,
    context: selectedContext || "",
    contact: isPuttingDrill(selectedDrillId) ? {} : { ...currentContact },
    shot_note: noteTrim,
    outcome,
    missDirection: outcome === "miss" ? missDirection : null,
  };

  addShot(shot);
  shots = getShots();

  resetContact();
  // Clear shot note after it has been attached to this shot
  pendingShotNote = "";
  if (shotNoteInputEl) shotNoteInputEl.value = "";
  missDirWrap.classList.add("hidden");

  // Subtle visual confirmation that the note was attached.
  if (noteTrim) flashShotNoteAttached();

  toast(outcome === "success" ? "Logged: Success" : `Logged: Miss (${missDirection})`);
  renderTable();
  updatePrevNextButtons();
}

function showMissDirs() {
  if (!selectedDrillId) return toast("Pick a drill first.");
  if (!selectedClubId) return toast("Pick a club first.");
  missDirWrap.classList.remove("hidden");
  toast("Pick miss direction");
}

function undoLastShot() {
  const session = currentSessionShots();
  if (!session.length) return toast("Nothing to undo.");
  // Last shot by timestamp (they were appended, but be safe)
  const last = session.slice().sort((a,b)=> (a.timestamp||"").localeCompare(b.timestamp||"")).pop();
  deleteShotById(last.id);
  shots = getShots();
  toast("Deleted last shot");
  renderTable();
  updatePrevNextButtons();
}

function updatePrevNextButtons() {
  const ids = drills.map(d=>d.id);
  const idx = ids.indexOf(selectedDrillId);
  btnPrev.disabled = idx <= 0;
  btnNext.disabled = idx === -1 || idx >= ids.length - 1;
  const prevName = idx>0 ? drills[idx-1].name : "";
  const nextName = (idx>=0 && idx<drills.length-1) ? drills[idx+1].name : "";
  btnPrev.title = btnPrev.disabled ? "No previous drill" : `Previous drill: ${prevName}`;
  btnNext.title = btnNext.disabled ? "No next drill" : `Next drill: ${nextName}`;
}

function goToDrillOffset(delta) {
  const ids = drills.map(d=>d.id);
  const idx = ids.indexOf(selectedDrillId);
  const nextId = ids[idx + delta];
  if (!nextId) return;
  selectedDrillId = nextId;
  drillEl.value = selectedDrillId;
  setUIState({ selectedDrillId });
  renderDrillCard();
  updatePuttingUI();
  renderContextPicker();
  renderTable();
  updatePrevNextButtons();
  toast(`Drill: ${(() => { const _d = drills.find(d=>d.id===selectedDrillId); return (_d && _d.name) ? _d.name : selectedDrillId; })()}`);
}

// --- Clubs modal ---
let clubsDraft = null;

function openModal() {
  clubsDraft = clubs.map(c => ({...c}));
  renderClubsEditor();
  modalBackdrop.classList.add("show");
  modalBackdrop.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modalBackdrop.classList.remove("show");
  modalBackdrop.setAttribute("aria-hidden", "true");
}

function sanitizeId(name) {
  const s = String(name || "").trim();
  if (!s) return "club";
  return s.replace(/\s+/g, "")
          .replace(/[^\w\-]/g, "")
          .slice(0, 8) || "club";
}

function renderClubsEditor() {
  clubsEditor.innerHTML = "";
  const cWrap = document.createElement("div");
  cWrap.style.display = "flex";
  cWrap.style.flexDirection = "column";
  cWrap.style.gap = "10px";
  cWrap.style.marginTop = "10px";

  clubsDraft.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "mini-grid";
    row.style.marginTop = "0";

    row.innerHTML = `
      <div class="field">
        <input type="text" value="${escapeHtml(c.name)}" data-k="name" data-i="${i}" />
      </div>
      <div class="field">
        <input type="number" inputmode="decimal" value="${numOrBlank(c.loft)}" data-k="loft" data-i="${i}" />
      </div>
      <div class="field">
        <input type="number" inputmode="decimal" value="${numOrBlank(c.carryAvg)}" data-k="carryAvg" data-i="${i}" />
      </div>
      <div class="field">
        <input type="number" inputmode="decimal" value="${numOrBlank(c.carryMin)}" data-k="carryMin" data-i="${i}" />
      </div>
      <div class="field" style="display:flex; gap:8px; align-items:center;">
        <input style="flex:1" type="number" inputmode="decimal" value="${numOrBlank(c.carryMax)}" data-k="carryMax" data-i="${i}" />
        <button class="btn red" data-action="del" data-i="${i}" title="Remove club">✕</button>
      </div>
    `;

    cWrap.appendChild(row);
  });

  cWrap.addEventListener("input", (e) => {
    const inp = e.target;
    if (!(inp instanceof HTMLInputElement)) return;
    const i = Number(inp.dataset.i);
    const k = inp.dataset.k;
    if (!Number.isFinite(i) || !k) return;
    let v = inp.value;
    if (k !== "name") v = v === "" ? "" : Number(v);
    clubsDraft[i][k] = v;
  });

  cWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.action === "del") {
      const i = Number(btn.dataset.i);
      clubsDraft.splice(i, 1);
      renderClubsEditor();
    }
  });

  clubsEditor.appendChild(cWrap);
}

function escapeHtml(s) {
  return String((s === null || s === undefined) ? "" : s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function numOrBlank(v) {
  return typeof v === "number" && !Number.isNaN(v) ? String(v) : (v === "" ? "" : "");
}

function normalizeClubsDraft() {
  // Create ids based on name if missing; keep existing ids if present
  const used = new Set();
  const out = [];
  for (const c of clubsDraft) {
    const name = String(c.name || "").trim();
    if (!name) continue;
    let id = c.id || sanitizeId(name);
    // Ensure unique
    let base = id;
    let n = 2;
    while (used.has(id)) { id = base + n; n++; }
    used.add(id);
    out.push({
      id,
      name,
      loft: toNumOrNull(c.loft),
      carryAvg: toNumOrNull(c.carryAvg),
      carryMin: toNumOrNull(c.carryMin),
      carryMax: toNumOrNull(c.carryMax),
      notes: "",
    });
  }
  return out;
}
function toNumOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// --- Wiring ---
function init() {
  // Date
  dateEl.value = selectedDate;
  dateEl.addEventListener("change", () => {
    selectedDate = dateEl.value || todayYMD();
    setUIState({ selectedDate });
    renderTable();
    updatePrevNextButtons();
      toast(`Viewing ${selectedDate}`);
  });
  // Drill
  renderDrillSelect();
  drillEl.value = selectedDrillId || "";
  drillEl.addEventListener("change", () => {
    selectedDrillId = drillEl.value;
    setUIState({ selectedDrillId });
    renderDrillCard();
    updatePuttingUI();
    renderContextPicker();
    renderTable();
    updatePrevNextButtons();
    });

  // Default drill if none
  if (!selectedDrillId) {
    selectedDrillId = (drills[0] && drills[0].id) ? drills[0].id : "";
    drillEl.value = selectedDrillId;
    setUIState({ selectedDrillId });
  }

  // Clubs
  renderClubPills();

  // Context
  renderContextPicker();
  if (contextSelect) {
    contextSelect.addEventListener("change", () => {
      selectedContext = contextSelect.value || "";
    });
  }

  // Shot note
  if (shotNoteInputEl) {
    shotNoteInputEl.addEventListener("input", () => {
      pendingShotNote = shotNoteInputEl.value || "";
    });
  }

  // Backup / Restore
  if (btnExportJson) btnExportJson.addEventListener("click", () => exportBackupJSON());
  if (btnImportJson && importJsonFile) {
    btnImportJson.addEventListener("click", () => importJsonFile.click());
    importJsonFile.addEventListener("change", () => {
      const file = importJsonFile.files && importJsonFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || "");
        const res = importBackupJSON(text);
        if (res && res.ok) setTimeout(() => location.reload(), 250);
      };
      reader.readAsText(file);
      // reset so selecting the same file twice still triggers change
      importJsonFile.value = "";
    });
  }

  // Contact + miss grid
  renderContactGrid();
  renderMissDirs();

  btnSuccess.addEventListener("click", () => commitShot("success", null));
  btnMiss.addEventListener("click", showMissDirs);
  btnUndo.addEventListener("click", undoLastShot);

  btnPrev.addEventListener("click", ()=>goToDrillOffset(-1));
  btnNext.addEventListener("click", ()=>goToDrillOffset(1));

  // Modal
  btnClubs.addEventListener("click", openModal);
  btnCloseModal.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  btnAddClub.addEventListener("click", () => {
    clubsDraft.push({ id:"", name:"New Club", loft:"", carryAvg:"", carryMin:"", carryMax:"" });
    renderClubsEditor();
  });

  btnResetClubs.addEventListener("click", () => {
    clubsDraft = DEFAULT_CLUBS.map(c=>({ ...c }));
    renderClubsEditor();
    toast("Reset draft to defaults");
  });

  btnSaveClubs.addEventListener("click", () => {
    const normalized = normalizeClubsDraft();
    if (!normalized.length) return toast("Add at least one club.");
    setClubs(normalized);
    clubs = getClubs();
    // Keep selected club if possible
    if (!clubs.some(c => c.id === selectedClubId)) {
      selectedClubId = clubs[0].id;
      setUIState({ selectedClubId });
    }
    renderClubPills();
    renderTable();
    closeModal();
    toast("Clubs saved");
  });

  renderDrillCard();
  updatePuttingUI();
  renderContextPicker();
  updateSelectedClubLabel();
  renderTable();
  updatePrevNextButtons();
}

init();

function isPuttingDrill(drillId) {
  return (drillId || "").startsWith("putting-");
}

function updatePuttingUI() {
  if (!contactSection) return;
  const putting = isPuttingDrill(selectedDrillId);
  contactSection.classList.toggle("hidden", putting);
  if (putting) {
    // ensure no contact tags are left selected
    Object.keys(currentContact).forEach(k => currentContact[k] = false);
    renderContactGrid();
  }
}