import {
  getClubs, getDrills, getShots, todayYMD,
  aggregateByClub, pct, toCSV, downloadText, toast, exportBackupJSON, importBackupJSON,
  deleteShotById, clearAllLogs
} from "./app.js";

const dateMode = document.getElementById("dateMode");
const singleDateField = document.getElementById("singleDateField");
const singleDate = document.getElementById("singleDate");
const drillFilter = document.getElementById("drillFilter");
const clubFilter = document.getElementById("clubFilter");
const viewMode = document.getElementById("viewMode");
const matchCount = document.getElementById("matchCount");
const successRate = document.getElementById("successRate");
const thead = document.getElementById("thead");
const tbody = document.getElementById("tbody");
const btnExportJsonStats = document.getElementById("btnExportJsonStats");
const btnImportJsonStats = document.getElementById("btnImportJsonStats");
const importJsonFileStats = document.getElementById("importJsonFileStats");
const btnExport = document.getElementById("btnExport");
const btnClearLogsStats = document.getElementById("btnClearLogsStats");

let clubs = getClubs();
let drills = getDrills();
let shots = getShots();

function idxClubs() {
  const m = new Map();
  for (const c of clubs) m.set(c.id, c);
  return m;
}
function idxDrills() {
  const m = new Map();
  for (const d of drills) m.set(d.id, d);
  return m;
}
const drillMap = idxDrills();
const clubMap = idxClubs();

function renderFilters() {
  // date
  singleDate.value = todayYMD();

  // drill
  drillFilter.innerHTML = "";
  drillFilter.appendChild(new Option("All drills", ""));
  for (const d of drills) drillFilter.appendChild(new Option(d.name, d.id));

  // club
  clubFilter.innerHTML = "";
  clubFilter.appendChild(new Option("All clubs", ""));
  for (const c of clubs) clubFilter.appendChild(new Option(c.name, c.id));
}

function applyFilters() {
  const dm = dateMode.value;
  const dSingle = singleDate.value;
  const df = drillFilter.value;
  const cf = clubFilter.value;

  let filtered = shots.slice();

  if (dm === "single" && dSingle) filtered = filtered.filter(s => s.date === dSingle);
  if (df) filtered = filtered.filter(s => s.drillId === df);
  if (cf) filtered = filtered.filter(s => s.clubId === cf);

  // Stats badges
  matchCount.textContent = String(filtered.length);
  const success = filtered.filter(s => s.outcome === "success").length;
  successRate.textContent = filtered.length ? `${success}/${filtered.length} (${Math.round((success/filtered.length)*100)}%)` : "–";

  renderTable(enrichShots(filtered));
}

function enrichShots(arr) {
  // success pct per (date + drill + club)
  const group = new Map();
  for (const s of arr) {
    const k = `${s.date||""}__${s.drillId||""}__${s.clubId||""}`;
    if (!group.has(k)) group.set(k, { shots:0, success:0 });
    const g = group.get(k);
    g.shots += 1;
    if (s.outcome === "success") g.success += 1;
  }
  return arr.map(s => {
    const k = `${s.date||""}__${s.drillId||""}__${s.clubId||""}`;
    const g = group.get(k) || { shots:0, success:0 };
    const pct = g.shots ? `${Math.round((g.success / g.shots) * 100)}%` : "";
    return { ...s, __success_pct_session: pct };
  });
}

function renderTable(filteredShots) {
  const mode = viewMode.value;

  if (mode === "raw") {
    renderRaw(filteredShots);
    return;
  }
  if (mode === "byClub") {
    renderByClub(filteredShots);
    return;
  }
  if (mode === "byDrill") {
    renderByDrill(filteredShots);
    return;
  }
  if (mode === "byDate") {
    renderByDate(filteredShots);
    return;
  }
}

function renderByClub(filtered) {
  thead.innerHTML = `
    <tr>
      <th>Club</th>
      <th>Success</th>
      <th>Miss</th>
      <th>Success %</th>
      <th>Solid</th>
      <th>Thin</th>
      <th>Fat</th>
      <th>Toe</th>
      <th>Heel</th>
      <th>Success % (session)</th>
      <th>Miss: Short</th>
      <th>Miss: Long</th>
      <th>Miss: Left</th>
      <th>Miss: Right</th>
    </tr>
  `;
  tbody.innerHTML = "";

  // If filters narrow to a single date + drill, "session" == this filtered set.
  const isSingleSession = (new Set(filtered.map(s => s.date || ""))).size <= 1
    && (new Set(filtered.map(s => s.drillId || ""))).size <= 1;

  const agg = aggregateByClub(filtered, clubMap);
  for (const a of agg) {
    const tr = document.createElement("tr");
    const sessionPct = isSingleSession ? pct(a.success, a.outcomeTotal) : "–";
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
      <td>${sessionPct}</td>
      <td>${a.miss_short}</td>
      <td>${a.miss_long}</td>
      <td>${a.miss_left}</td>
      <td>${a.miss_right}</td>
    `;
    tbody.appendChild(tr);
    const btn = tr.querySelector("button[data-id]");
    if (btn) {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        if (!confirm("Delete this shot?")) return;
        deleteShotById(id);
        shots = getShots();
        toast("Deleted shot");
        applyFilters();
      });
    }
  }
}


function renderByDrill(filtered) {
  thead.innerHTML = `
    <tr>
      <th>Drill</th>
      <th>Shots</th>
      <th>Success</th>
      <th>Miss</th>
      <th>Success %</th>
    </tr>
  `;
  tbody.innerHTML = "";

  const map = new Map();
  for (const s of filtered) {
    const id = s.drillId || "unknown";
    if (!map.has(id)) map.set(id, { drillId:id, drillName: drillMap.get(id)?.name ?? s.drillName ?? id, shots:0, success:0, miss:0 });
    const r = map.get(id);
    r.shots += 1;
    if (s.outcome === "success") r.success += 1;
    if (s.outcome === "miss") r.miss += 1;
  }

  const rows = Array.from(map.values()).sort((a,b)=>a.drillName.localeCompare(b.drillName));
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.drillName}</td>
      <td>${r.shots}</td>
      <td>${r.success}</td>
      <td>${r.miss}</td>
      <td>${pct(r.success, r.shots)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderByDate(filtered) {
  thead.innerHTML = `
    <tr>
      <th>Date</th>
      <th>Shots</th>
      <th>Success</th>
      <th>Miss</th>
      <th>Success %</th>
    </tr>
  `;
  tbody.innerHTML = "";

  const map = new Map();
  for (const s of filtered) {
    const d = s.date || "unknown";
    if (!map.has(d)) map.set(d, { date:d, shots:0, success:0, miss:0 });
    const r = map.get(d);
    r.shots += 1;
    if (s.outcome === "success") r.success += 1;
    if (s.outcome === "miss") r.miss += 1;
  }

  const rows = Array.from(map.values()).sort((a,b)=>a.date.localeCompare(b.date));
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${r.shots}</td>
      <td>${r.success}</td>
      <td>${r.miss}</td>
      <td>${pct(r.success, r.shots)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderRaw(filtered) {
  thead.innerHTML = `
    <tr>
      <th>Date</th>
      <th>Time (ISO)</th>
      <th>Drill</th>
      <th>Club</th>
      <th>Context</th>
      <th>Shot note</th>
      <th>Outcome</th>
      <th>Miss dir</th>
      <th>Solid</th>
      <th>Thin</th>
      <th>Fat</th>
      <th>Toe</th>
      <th>Heel</th>
      <th>Success % (session)</th>
      <th>Delete</th>
    </tr>
  `;
  tbody.innerHTML = "";

  const rows = filtered.slice().sort((a,b)=>(a.timestamp||"").localeCompare(b.timestamp||""));
  for (const s of rows) {
    const c = s.contact || {};
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.date ?? ""}</td>
      <td style="font-family:var(--mono); font-size:.84rem;">${s.timestamp ?? ""}</td>
      <td>${drillMap.get(s.drillId)?.name ?? s.drillName ?? s.drillId ?? ""}</td>
      <td>${clubMap.get(s.clubId)?.name ?? s.clubName ?? s.clubId ?? ""}</td>
      <td>${s.context ?? ""}</td>
      <td>${s.shot_note ?? ""}</td>
      <td>${s.outcome ?? ""}</td>
      <td>${s.missDirection ?? ""}</td>
      <td>${c.solid ? 1 : 0}</td>
      <td>${c.thin ? 1 : 0}</td>
      <td>${c.fat ? 1 : 0}</td>
      <td>${c.toe ? 1 : 0}</td>
      <td>${c.heel ? 1 : 0}</td>
      <td>${s.__success_pct_session ?? ""}</td>
      <td><button class="btn red small" data-id="${s.id ?? ""}">Delete</button></td>
    `;
    const btn = tr.querySelector('button[data-id]');
    if (btn) {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (!confirm('Delete this shot?')) return;
        deleteShotById(id);
        shots = getShots();
        toast('Deleted shot');
        applyFilters();
      });
    }

    tbody.appendChild(tr);
  }
}

function exportCSV() {
  const all = shots.slice().sort((a,b)=>(a.timestamp||"").localeCompare(b.timestamp||""));

  // success pct per (date + drill + club)
  const group = new Map();
  for (const s of all) {
    const k = `${s.date||""}__${s.drillId||""}__${s.clubId||""}`;
    if (!group.has(k)) group.set(k, { shots:0, success:0 });
    const g = group.get(k);
    g.shots += 1;
    if (s.outcome === "success") g.success += 1;
  }

  const rows = all.map(s => {
    const c = s.contact || {};
    const miss = s.missDirection ?? "";
    const k = `${s.date||""}__${s.drillId||""}__${s.clubId||""}`;
    const g = group.get(k) || { shots:0, success:0 };
    const successPct = g.shots ? Math.round((g.success / g.shots) * 100) : "";
    return {
      id: s.id ?? "",
      date: s.date ?? "",
      timestamp: s.timestamp ?? "",
      drillId: s.drillId ?? "",
      drillName: drillMap.get(s.drillId)?.name ?? s.drillName ?? "",
      clubId: s.clubId ?? "",
      clubName: clubMap.get(s.clubId)?.name ?? s.clubName ?? "",
      context: s.context ?? "",
      outcome: s.outcome ?? "",
      missDirection: miss,
      miss_left: miss === "left" ? 1 : 0,
      miss_right: miss === "right" ? 1 : 0,
      miss_short: miss === "short" ? 1 : 0,
      miss_long: miss === "long" ? 1 : 0,
      solid: c.solid ? 1 : 0,
      thin: c.thin ? 1 : 0,
      fat: c.fat ? 1 : 0,
      toe: c.toe ? 1 : 0,
      heel: c.heel ? 1 : 0,
      shot_note: s.shot_note ?? "",
      success_pct_session: successPct,
    };
  });

  const csv = toCSV(rows);
  const filename = `golf-practice-shots-${todayYMD()}.csv`;
  downloadText(filename, csv, "text/csv");
  toast("Downloaded CSV");
}


// Wiring
dateMode.addEventListener("change", () => {
  singleDateField.style.display = (dateMode.value === "single") ? "" : "none";
  applyFilters();
});
singleDate.addEventListener("change", applyFilters);
drillFilter.addEventListener("change", applyFilters);
clubFilter.addEventListener("change", applyFilters);
viewMode.addEventListener("change", applyFilters);
if (btnExportJsonStats) btnExportJsonStats.addEventListener("click", () => exportBackupJSON());
if (btnImportJsonStats && importJsonFileStats) {
  btnImportJsonStats.addEventListener("click", () => importJsonFileStats.click());
  importJsonFileStats.addEventListener("change", () => {
    const file = importJsonFileStats.files && importJsonFileStats.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const res = importBackupJSON(text);
      if (res && res.ok) setTimeout(() => location.reload(), 250);
    };
    reader.readAsText(file);
    importJsonFileStats.value = "";
  });
}

btnExport.addEventListener("click", exportCSV);

renderFilters();
applyFilters();


// Clear logs
if (btnClearLogsStats) {
  btnClearLogsStats.addEventListener("click", () => {
    if (!confirm("Clear ALL shots on this device? This cannot be undone.")) return;
    clearAllLogs();
    setTimeout(() => location.reload(), 150);
  });
}
