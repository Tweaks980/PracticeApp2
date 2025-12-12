import {
  CONTACT_TYPES, MISS_DIRS,
  todayYMD, getClubs, setClubs, getDrills,
  getShots, addShot, deleteShotById,
  getUIState, setUIState,
  toast, fmtClubPill,
  shotsForDateAndDrill, aggregateByClub, pct,
  listSessionDates
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
const shotCountEl = document.getElementById("shotCount");
const clubTableBody = document.getElementById("clubTableBody");

const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnUndo = document.getElementById("btnUndo");

const contactGrid = document.getElementById("contactGrid");
const contactSection = document.getElementById("contactSection");
const btnSuccess = document.getElementById("btnSuccess");
const btnMiss = document.getElementById("btnMiss");
const missDirWrap = document.getElementById("missDirWrap");
const missGrid = document.getElementById("missGrid");

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
let selectedDrillId = ui.selectedDrillId || drills[0]?.id || "";
let selectedClubId = ui.selectedClubId || clubs[0]?.id || "";

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
      renderClubPills();
    });
    clubPillsEl.appendChild(b);
  }
  updateSelectedClubLabel();
}

function updateSelectedClubLabel() {
  const c = clubsIndex().get(selectedClubId);
  clubLabelEl.textContent = c ? c.name : "None";
}

function renderContactGrid() {
  contactGrid.innerHTML = "";
  for (const k of CONTACT_TYPES) {
    const btn = document.createElement("button");
    btn.className = "tile" + (currentContact[k] ? " active" : "");
    btn.type = "button";
    btn.innerHTML = `${k[0].toUpperCase()+k.slice(1)}<span>${currentContact[k] ? "tagged" : "tap to tag"}</span>`;
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
      <td>${a.outcomeTotal}</td>
      <td>${a.success}</td>
      <td>${a.miss}</td>
      <td>${pct(a.success, a.outcomeTotal)}</td>
      <td>${a.contactTotal}</td>
      <td>${a.solid}</td>
      <td>${a.thin}</td>
      <td>${a.fat}</td>
      <td>${a.toe}</td>
      <td>${a.heel}</td>
      <td>${pct(a.solid, a.contactTotal)}</td>
      <td>${a.miss_short}</td>
      <td>${a.miss_long}</td>
      <td>${a.miss_left}</td>
      <td>${a.miss_right}</td>
    `;
    clubTableBody.appendChild(tr);
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
  const d = drillMap.get(selectedDrillId);
  const c = clubsIndex().get(selectedClubId);
  const shot = {
    id: crypto?.randomUUID?.() || (Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9)),
    timestamp: new Date().toISOString(),
    date: selectedDate, // important: selected date (reviewable later)
    drillId: selectedDrillId,
    drillName: d?.name ?? selectedDrillId,
    clubId: selectedClubId,
    clubName: c?.name ?? selectedClubId,
    contact: isPuttingDrill(selectedDrillId) ? {} : { ...currentContact },
    outcome,
    missDirection: outcome === "miss" ? missDirection : null,
  };

  addShot(shot);
  shots = getShots();

  resetContact();
  missDirWrap.classList.add("hidden");

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
  const dates = listSessionDates(shots, selectedDrillId);
  const idx = dates.indexOf(selectedDate);
  btnPrev.disabled = idx <= 0;
  btnNext.disabled = idx === -1 || idx >= dates.length - 1;
  btnPrev.title = btnPrev.disabled ? "No previous session" : `Go to ${dates[idx-1]}`;
  btnNext.title = btnNext.disabled ? "No next session" : `Go to ${dates[idx+1]}`;
}

function goToSessionOffset(delta) {
  const dates = listSessionDates(shots, selectedDrillId);
  const idx = dates.indexOf(selectedDate);
  const next = dates[idx + delta];
  if (!next) return;
  selectedDate = next;
  dateEl.value = selectedDate;
  setUIState({ selectedDate });
  renderTable();
  updatePrevNextButtons();
  toast(`Viewing ${selectedDate}`);
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
  return String(s ?? "")
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
    renderTable();
    updatePrevNextButtons();
  });

  // Default drill if none
  if (!selectedDrillId) {
    selectedDrillId = drills[0]?.id || "";
    drillEl.value = selectedDrillId;
    setUIState({ selectedDrillId });
  }

  // Clubs
  renderClubPills();

  // Contact + miss grid
  renderContactGrid();
  renderMissDirs();

  btnSuccess.addEventListener("click", () => commitShot("success", null));
  btnMiss.addEventListener("click", showMissDirs);
  btnUndo.addEventListener("click", undoLastShot);

  btnPrev.addEventListener("click", ()=>goToSessionOffset(-1));
  btnNext.addEventListener("click", ()=>goToSessionOffset(1));

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
