import { mountAddAssignmentForm } from "./components/AddAssignmentForm.js";
import { JarvisApiService, BackendError } from "./services/JarvisApiService.js";

/** Base URL of the Jarvis Java HTTP backend. */
const API_BASE_URL = "http://localhost:8080";

/** Shared API client. api.loadingState drives the loading UI below. */
const api = new JarvisApiService(API_BASE_URL);

/** Java priorityScore (0.0 – 1.0+) -> dashboard scale (1 – 10). */
const JAVA_SCORE_TO_UI_SCALE = 10;

const OFFLINE_MESSAGE =
  `Jarvis backend is offline: the Java HTTP server isn't responding at ${API_BASE_URL}. ` +
  "Start it, then press Refresh.";
const TIMEOUT_MESSAGE =
  `Jarvis backend at ${API_BASE_URL} timed out. It may still be starting up. Try again in a moment.`;

const state = {
  assignments: [],
  search: "",
  subject: "all",
  status: "all",
  priority: "all",
  sortKey: "priority_score",
  sortDir: "desc",
  viewMode: "table",
  backendOnline: null, // null = unknown yet, true = reachable, false = offline
};

const els = {
  tbody: document.getElementById("assignmentsBody"),
  tableWrapper: document.getElementById("tableWrapper"),
  emptyState: document.getElementById("emptyState"),
  searchInput: document.getElementById("searchInput"),
  subjectFilter: document.getElementById("subjectFilter"),
  statusFilter: document.getElementById("statusFilter"),
  priorityFilter: document.getElementById("priorityFilter"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  emptyResetBtn: document.getElementById("emptyResetBtn"),
  emptyAddBtn: document.getElementById("emptyAddBtn"),
  visibleCountLabel: document.getElementById("visibleCountLabel"),
  backendStatus: document.getElementById("backendStatus"),
  refreshBtn: document.getElementById("refreshBtn"),
  importJsonBtn: document.getElementById("importJsonBtn"),
  addAssignmentBtn: document.getElementById("addAssignmentBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  tableViewBtn: document.getElementById("tableViewBtn"),
  gridViewBtn: document.getElementById("gridViewBtn"),
  kpiTotal: document.getElementById("kpiTotal"),
  kpiOverdue: document.getElementById("kpiOverdue"),
  kpiHighPriority: document.getElementById("kpiHighPriority"),
  kpiPending: document.getElementById("kpiPending"),
  kpiCompleted: document.getElementById("kpiCompleted"),
  addAssignmentMount: document.getElementById("addAssignmentMount"),
  jsonModal: document.getElementById("jsonModal"),
  jsonForm: document.getElementById("jsonImportForm"),
  jsonTextarea: document.getElementById("jsonTextarea"),
  jsonErrorMsg: document.getElementById("jsonErrorMsg"),
  toastContainer: document.getElementById("toastContainer"),
};

// The Refresh button is "<svg> Refresh". Remember its text node so we can swap
// the label to "Syncing..." without destroying the icon.
const refreshLabelNode = Array.from(els.refreshBtn.childNodes)
  .reverse()
  .find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
const refreshLabelDefault = refreshLabelNode ? refreshLabelNode.textContent : "";

/** Normalize an assignment object regardless of snake_case / camelCase backend keys. */
function normalizeItem(raw) {
  // priority_score is already 1-10 (the service converts it). A raw Java
  // `priorityScore` (0.0 - 1.0+) is scaled up to the dashboard's 1-10 range.
  const rawScore =
    raw.priority_score != null
      ? Number(raw.priority_score)
      : raw.priorityScore != null
        ? Number(raw.priorityScore) * JAVA_SCORE_TO_UI_SCALE
        : raw["Priority Score"] != null
          ? Number(raw["Priority Score"])
          : 5;
  const clampedScore = Number.isFinite(rawScore)
    ? Math.max(1, Math.min(10, Math.round(rawScore)))
    : 5;

  const rawDifficulty = Number(raw.difficulty_level ?? raw.difficultyLevel);

  const rawStatus = String(raw.status ?? raw.Status ?? "Not Started").trim();
  const lowered = rawStatus.toLowerCase();
  let normalizedStatus = "Not Started";
  if (lowered === "completed") normalizedStatus = "Completed";
  else if (lowered === "in progress") normalizedStatus = "In Progress";

  return {
    id: String(raw.id ?? raw.ID ?? "").trim(),
    _jarvisId: raw._jarvisId ?? null,
    subject: String(raw.subject ?? raw.Subject ?? "").trim(),
    title: String(raw.title ?? raw.Title ?? "").trim(),
    due_date: String(raw.due_date ?? raw.dueDate ?? raw["Due Date"] ?? "").trim(),
    difficulty_level: Number.isFinite(rawDifficulty) ? rawDifficulty : null, // 1-5 (backend scale)
    priority_score: clampedScore,                                            // 1-10 (display scale)
    status: normalizedStatus,
  };
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diffDaysFromToday(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  const targetUtc = Date.UTC(y, m - 1, d);
  const todayStr = getTodayIsoDate();
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((targetUtc - todayUtc) / 86400000);
}

function isCompleted(item) {
  return item.status.toLowerCase() === "completed";
}

function isOverdue(item) {
  if (isCompleted(item)) return false;
  const delta = diffDaysFromToday(item.due_date);
  return delta !== null && delta < 0;
}

function getPriorityTier(score) {
  if (score >= 8) return { key: "high", label: "High", pillClass: "priority-high", fillClass: "fill-high" };
  if (score >= 5) return { key: "medium", label: "Medium", pillClass: "priority-medium", fillClass: "fill-medium" };
  return { key: "low", label: "Low", pillClass: "priority-low", fillClass: "fill-low" };
}

function showToast(message, isError = false, durationMs = 3000) {
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " toast-error" : ""}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, durationMs);
}

function setSyncStatus(ok, label, tooltip) {
  els.backendStatus.classList.toggle("error", !ok);
  const textNode = els.backendStatus.querySelector(".sync-text");
  if (textNode) textNode.textContent = label;
  if (tooltip) els.backendStatus.title = tooltip;
}

/** Single source of truth for the sync pill in the header. */
function renderSyncStatus() {
  if (api.loadingState.isLoading) {
    setSyncStatus(true, "Syncing...", `Talking to ${API_BASE_URL}`);
  } else if (state.backendOnline === false) {
    setSyncStatus(false, "Backend offline", `Cannot reach the Java backend at ${API_BASE_URL}`);
  } else if (state.backendOnline === true) {
    setSyncStatus(true, `Synced (${state.assignments.length})`, `Connected to ${API_BASE_URL}`);
  } else {
    setSyncStatus(true, "Connecting...", `Backend API status (${API_BASE_URL})`);
  }
}

function setBackendOnline(isOnline) {
  state.backendOnline = isOnline;
  renderSyncStatus();
}

/**
 * Translate an error from JarvisApiService into a UI message and update the
 * sync pill. Returns { offline, message } so callers decide how to surface it.
 */
function handleApiError(err) {
  if (err instanceof BackendError) {
    if (err.code === "NETWORK_ERROR") {
      setBackendOnline(false);
      return { offline: true, message: OFFLINE_MESSAGE };
    }
    if (err.code === "TIMEOUT") {
      setBackendOnline(false);
      return { offline: true, message: TIMEOUT_MESSAGE };
    }
    if (err.code === "HTTP_ERROR" || err.code === "PARSE_ERROR") {
      // The server answered, so it is reachable even though the request failed.
      setBackendOnline(true);
    } else {
      renderSyncStatus();
    }
    return { offline: false, message: err.message };
  }
  renderSyncStatus();
  return { offline: false, message: err?.message || "Unknown error" };
}

/** Loading state is shared by every request, so only one runs at a time. */
function ensureIdle() {
  if (api.loadingState.isLoading) {
    showToast("Please wait, another request is still in progress.", true);
    return false;
  }
  return true;
}

/** Load an array of assignment objects into dashboard state and re-render. */
function setAssignmentsFromArray(jsonArray) {
  if (!Array.isArray(jsonArray)) {
    throw new Error("Expected a JSON array of assignments from backend.");
  }
  state.assignments = jsonArray.map(normalizeItem);
  populateSubjectOptions();
  renderAll();
}

async function fetchAssignments() {
  if (api.loadingState.isLoading) return;
  try {
    const assignments = await api.fetchAssignments();
    setAssignmentsFromArray(assignments);
    setBackendOnline(true);
  } catch (err) {
    const { offline, message } = handleApiError(err);
    showToast(
      offline ? message : `Failed to load assignments: ${message}`,
      true,
      offline ? 6000 : 3000
    );
  }
}

async function markAssignmentComplete(id) {
  if (!ensureIdle()) return;
  try {
    await api.completeAssignment(id);
    state.assignments = state.assignments.map((item) =>
      item.id === id ? { ...item, status: "Completed" } : item
    );
    renderAll();
    setBackendOnline(true);
    showToast(`Marked ${id} as Completed`);
  } catch (err) {
    const { offline, message } = handleApiError(err);
    showToast(offline ? message : `Could not complete ${id}: ${message}`, true, offline ? 6000 : 3000);
  }
}

async function deleteAssignment(id) {
  if (!ensureIdle()) return;
  try {
    await api.deleteAssignment(id);
    state.assignments = state.assignments.filter((item) => item.id !== id);
    populateSubjectOptions();
    renderAll();
    setBackendOnline(true);
    showToast(`Deleted assignment ${id}`);
  } catch (err) {
    const { offline, message } = handleApiError(err);
    showToast(offline ? message : `Could not delete ${id}: ${message}`, true, offline ? 6000 : 3000);
  }
}

/**
 * Called by AddAssignmentForm. Errors are re-thrown so the form can show them
 * (it calls onError -> showToast) and keep the user's input.
 */
async function createAssignment(payload) {
  if (api.loadingState.isLoading) {
    throw new Error("Please wait, another request is still in progress.");
  }
  let created;
  try {
    created = await api.addAssignment(payload);
  } catch (err) {
    const { message } = handleApiError(err);
    throw new Error(message);
  }
  setBackendOnline(true);

  if (created && !state.assignments.some((a) => a.id === created.id)) {
    state.assignments.push(normalizeItem(created));
    populateSubjectOptions();
    renderAll();
  } else {
    // Server accepted it but we couldn't pinpoint the new row: reload the list.
    await fetchAssignments();
  }
  showToast(`Added ${created?.id ?? "assignment"}`);
}

/**
 * NOTE: JarvisApiService has no bulk-import method and the Java backend does
 * not document a POST /api/assignments/import endpoint yet, so this keeps the
 * original request but targets the Java backend and reports offline clearly.
 */
async function importAssignmentsJson(itemsArray, mode) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/assignments/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments: itemsArray, mode }),
    });
  } catch (_err) {
    setBackendOnline(false);
    throw new Error(OFFLINE_MESSAGE);
  }
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${response.status}`);
  }
  const updatedList = await response.json();
  setAssignmentsFromArray(updatedList);
  setBackendOnline(true);
  showToast(`Loaded ${updatedList.length} assignments from JSON`);
}

/**
 * Reflect api.loadingState in the UI: "Syncing..." on Refresh and the sync
 * pill, and disable every action button while a request is in flight.
 */
function applyLoadingUI({ isLoading }) {
  const busy = Boolean(isLoading);

  if (refreshLabelNode) {
    refreshLabelNode.textContent = busy ? " Syncing..." : refreshLabelDefault;
  }
  els.refreshBtn.disabled = busy;
  els.refreshBtn.setAttribute("aria-busy", String(busy));
  els.importJsonBtn.disabled = busy;
  els.tableWrapper.setAttribute("aria-busy", String(busy));

  document.querySelectorAll(".btn-complete").forEach((btn) => {
    btn.disabled = busy || btn.classList.contains("is-done");
  });
  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.disabled = busy;
  });

  const formSubmit = els.addAssignmentMount.querySelector("#addFormSubmitBtn");
  const formReset = els.addAssignmentMount.querySelector("#addFormResetBtn");
  if (formSubmit) formSubmit.disabled = busy;
  if (formReset) formReset.disabled = busy;

  renderSyncStatus();
}

function populateSubjectOptions() {
  const prev = state.subject;
  const subjects = Array.from(
    new Set(state.assignments.map((a) => a.subject).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  els.subjectFilter.innerHTML = '<option value="all">All Subjects</option>';
  for (const subj of subjects) {
    const opt = document.createElement("option");
    opt.value = subj;
    opt.textContent = subj;
    els.subjectFilter.appendChild(opt);
  }
  state.subject = subjects.includes(prev) ? prev : "all";
  els.subjectFilter.value = state.subject;
}

function getFilteredSortedAssignments() {
  const q = state.search.trim().toLowerCase();

  const filtered = state.assignments.filter((item) => {
    if (q) {
      const hay = `${item.id} ${item.subject} ${item.title}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (state.subject !== "all" && item.subject !== state.subject) {
      return false;
    }

    if (state.status === "overdue" && !isOverdue(item)) {
      return false;
    } else if (state.status === "active" && isCompleted(item)) {
      return false;
    } else if (
      !["all", "overdue", "active"].includes(state.status) &&
      item.status !== state.status
    ) {
      return false;
    }

    const tier = getPriorityTier(item.priority_score).key;
    if (state.priority !== "all" && tier !== state.priority) {
      return false;
    }

    return true;
  });

  const dir = state.sortDir === "asc" ? 1 : -1;
  return filtered.sort((a, b) => {
    if (state.sortKey === "priority_score") {
      return (a.priority_score - b.priority_score) * dir;
    }
    if (state.sortKey === "days_left") {
      const da = isCompleted(a) ? Number.MAX_SAFE_INTEGER : (diffDaysFromToday(a.due_date) ?? Number.MAX_SAFE_INTEGER);
      const db = isCompleted(b) ? Number.MAX_SAFE_INTEGER : (diffDaysFromToday(b.due_date) ?? Number.MAX_SAFE_INTEGER);
      return (da - db) * dir;
    }
    const va = String(a[state.sortKey] ?? "");
    const vb = String(b[state.sortKey] ?? "");
    return va.localeCompare(vb, undefined, { numeric: true }) * dir;
  });
}

function renderKpis() {
  const total = state.assignments.length;
  const overdue = state.assignments.filter(isOverdue).length;
  const highActive = state.assignments.filter(
    (a) => !isCompleted(a) && a.priority_score >= 8
  ).length;
  const completed = state.assignments.filter(isCompleted).length;
  const active = total - completed;

  els.kpiTotal.textContent = String(total);
  els.kpiOverdue.textContent = String(overdue);
  els.kpiHighPriority.textContent = String(highActive);
  els.kpiPending.textContent = String(active);
  els.kpiCompleted.textContent = String(completed);

  document.querySelectorAll(".kpi-card").forEach((card) => {
    const key = card.dataset.quickFilter;
    let isActive = false;
    if (key === "all") {
      isActive = state.status === "all" && state.priority === "all";
    } else if (key === "overdue") {
      isActive = state.status === "overdue";
    } else if (key === "high") {
      isActive = state.priority === "high" && state.status === "active";
    } else if (key === "active") {
      isActive = state.status === "active" && state.priority === "all";
    } else if (key === "completed") {
      isActive = state.status === "Completed";
    }
    card.classList.toggle("active-filter", isActive);
  });
}

function renderSortIndicators() {
  document.querySelectorAll("th.sortable").forEach((th) => {
    const ind = th.querySelector(".sort-ind");
    if (!ind) return;
    if (th.dataset.sort === state.sortKey) {
      ind.textContent = state.sortDir === "asc" ? "▲" : "▼";
    } else {
      ind.textContent = "";
    }
  });
}

function formatDaysLeft(item) {
  if (isCompleted(item)) {
    return { text: "Completed", className: "is-ok" };
  }
  const delta = diffDaysFromToday(item.due_date);
  if (delta === null) {
    return { text: "—", className: "is-ok" };
  }
  if (delta < 0) {
    const days = Math.abs(delta);
    return { text: `${days}d overdue`, className: "is-overdue" };
  }
  if (delta === 0) {
    return { text: "Due today", className: "is-soon" };
  }
  if (delta <= 2) {
    return { text: `${delta}d left`, className: "is-soon" };
  }
  return { text: `${delta}d left`, className: "is-ok" };
}

function buildRowElement(item) {
  const tr = document.createElement("tr");
  const completed = isCompleted(item);
  const overdue = isOverdue(item);
  const tier = getPriorityTier(item.priority_score);
  const busy = api.loadingState.isLoading;

  if (completed) {
    tr.classList.add("row-completed");
  } else if (overdue) {
    tr.classList.add("row-overdue");
  } else if (tier.key === "high") {
    tr.classList.add("row-high-priority");
  }

  // 1. ID
  const tdId = document.createElement("td");
  tdId.dataset.label = "ID";
  const idSpan = document.createElement("span");
  idSpan.className = "id-badge";
  idSpan.textContent = item.id;
  tdId.appendChild(idSpan);

  // 2. Subject
  const tdSubject = document.createElement("td");
  tdSubject.dataset.label = "Subject";
  const subjSpan = document.createElement("span");
  subjSpan.className = "subject-tag";
  subjSpan.textContent = item.subject;
  tdSubject.appendChild(subjSpan);

  // 3. Title
  const tdTitle = document.createElement("td");
  tdTitle.dataset.label = "Title";
  const titleWrap = document.createElement("div");
  titleWrap.className = "title-cell";
  const titleSpan = document.createElement("span");
  titleSpan.className = "title-text";
  titleSpan.textContent = item.title;
  titleWrap.appendChild(titleSpan);
  if (overdue) {
    const warn = document.createElement("span");
    warn.className = "urgency-sub";
    warn.textContent = "⚠ Action required: past due date";
    titleWrap.appendChild(warn);
  }
  tdTitle.appendChild(titleWrap);

  // 4. Due Date (date only)
  const tdDue = document.createElement("td");
  tdDue.dataset.label = "Due Date";
  const dueMain = document.createElement("span");
  dueMain.className = "due-date-main";
  dueMain.textContent = item.due_date;
  tdDue.appendChild(dueMain);

  // 5. Days Left (shows days remaining or _d overdue)
  const tdDaysLeft = document.createElement("td");
  tdDaysLeft.dataset.label = "Days Left";
  const daysLeftInfo = formatDaysLeft(item);
  const daysLeftSpan = document.createElement("span");
  daysLeftSpan.className = `days-left-badge ${daysLeftInfo.className}`;
  daysLeftSpan.textContent = daysLeftInfo.text;
  tdDaysLeft.appendChild(daysLeftSpan);

  // 5. Priority Score
  const tdPriority = document.createElement("td");
  tdPriority.dataset.label = "Priority Score";
  const prioWrap = document.createElement("div");
  prioWrap.className = "priority-wrap";

  const prioTop = document.createElement("div");
  prioTop.className = "priority-top";
  const prioPill = document.createElement("span");
  prioPill.className = `priority-pill ${tier.pillClass}`;
  prioPill.textContent = tier.label;
  const prioNum = document.createElement("span");
  prioNum.className = "priority-num";
  prioNum.textContent = `${item.priority_score}/10`;
  prioTop.append(prioPill, prioNum);

  const bar = document.createElement("div");
  bar.className = "priority-bar";
  const fill = document.createElement("div");
  fill.className = `priority-fill ${tier.fillClass}`;
  fill.style.width = `${item.priority_score * 10}%`;
  bar.appendChild(fill);

  prioWrap.append(prioTop, bar);
  tdPriority.appendChild(prioWrap);

  // 6. Status
  const tdStatus = document.createElement("td");
  tdStatus.dataset.label = "Status";
  const statusStack = document.createElement("div");
  statusStack.className = "status-stack";

  const statusPill = document.createElement("span");
  let statusCls = "status-pending";
  if (item.status === "Completed") statusCls = "status-completed";
  else if (item.status === "In Progress") statusCls = "status-progress";
  statusPill.className = `status-pill ${statusCls}`;
  statusPill.textContent = item.status;
  statusStack.appendChild(statusPill);

  if (overdue) {
    const overdueTag = document.createElement("span");
    overdueTag.className = "status-overdue-badge";
    overdueTag.textContent = "Overdue";
    statusStack.appendChild(overdueTag);
  }
  tdStatus.appendChild(statusStack);

  // 7. Actions ('Mark Complete' and 'Delete'), disabled while a request is in flight
  const tdActions = document.createElement("td");
  tdActions.dataset.label = "Actions";
  const actionsWrap = document.createElement("div");
  actionsWrap.className = "row-actions";

  const completeBtn = document.createElement("button");
  completeBtn.type = "button";
  completeBtn.className = `btn btn-sm btn-complete${completed ? " is-done" : ""}`;
  completeBtn.textContent = completed ? "✓ Completed" : "Mark Complete";
  completeBtn.disabled = completed || busy;
  completeBtn.setAttribute("aria-label", `Mark Complete ${item.id}`);
  completeBtn.addEventListener("click", () => markAssignmentComplete(item.id));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-sm btn-delete";
  deleteBtn.textContent = "Delete";
  deleteBtn.disabled = busy;
  deleteBtn.setAttribute("aria-label", `Delete ${item.id}`);
  deleteBtn.addEventListener("click", () => deleteAssignment(item.id));

  actionsWrap.append(completeBtn, deleteBtn);
  tdActions.appendChild(actionsWrap);

  tr.append(tdId, tdSubject, tdTitle, tdDue, tdDaysLeft, tdPriority, tdStatus, tdActions);
  return tr;
}

function renderTable() {
  const rows = getFilteredSortedAssignments();
  els.tbody.innerHTML = "";

  if (rows.length === 0) {
    els.tableWrapper.classList.add("hidden");
    els.emptyState.classList.remove("hidden");
  } else {
    els.tableWrapper.classList.remove("hidden");
    els.emptyState.classList.add("hidden");
    const frag = document.createDocumentFragment();
    for (const item of rows) {
      frag.appendChild(buildRowElement(item));
    }
    els.tbody.appendChild(frag);
  }

  els.visibleCountLabel.textContent = `Showing ${rows.length} of ${state.assignments.length} assignments`;
}

function renderAll() {
  renderKpis();
  renderSortIndicators();
  renderTable();
}

function resetFilters() {
  state.search = "";
  state.subject = "all";
  state.status = "all";
  state.priority = "all";
  els.searchInput.value = "";
  els.subjectFilter.value = "all";
  els.statusFilter.value = "all";
  els.priorityFilter.value = "all";
  renderAll();
}

function setViewMode(mode) {
  state.viewMode = mode;
  els.tableWrapper.classList.toggle("view-table", mode === "table");
  els.tableWrapper.classList.toggle("view-grid", mode === "grid");
  els.tableViewBtn.classList.toggle("active", mode === "table");
  els.gridViewBtn.classList.toggle("active", mode === "grid");
}

function initTheme() {
  const saved = localStorage.getItem("assignmentTrackerTheme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("assignmentTrackerTheme", next);
}

function bindEvents() {
  els.searchInput.addEventListener("input", (e) => {
    state.search = e.target.value;
    renderTable();
  });

  els.subjectFilter.addEventListener("change", (e) => {
    state.subject = e.target.value;
    renderAll();
  });

  els.statusFilter.addEventListener("change", (e) => {
    state.status = e.target.value;
    renderAll();
  });

  els.priorityFilter.addEventListener("change", (e) => {
    state.priority = e.target.value;
    renderAll();
  });

  els.clearFiltersBtn.addEventListener("click", resetFilters);
  els.emptyResetBtn.addEventListener("click", resetFilters);

  els.tableViewBtn.addEventListener("click", () => setViewMode("table"));
  els.gridViewBtn.addEventListener("click", () => setViewMode("grid"));
  els.themeToggleBtn.addEventListener("click", toggleTheme);
  els.refreshBtn.addEventListener("click", () => fetchAssignments());

  document.querySelectorAll("th.sortable").forEach((th) => {
    const handleSort = () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = key === "priority_score" ? "desc" : "asc";
      }
      renderAll();
    };
    th.addEventListener("click", handleSort);
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSort();
      }
    });
  });

  document.querySelectorAll(".kpi-card").forEach((card) => {
    card.addEventListener("click", () => {
      const filter = card.dataset.quickFilter;
      state.search = "";
      els.searchInput.value = "";
      state.subject = "all";
      els.subjectFilter.value = "all";

      if (filter === "all") {
        state.status = "all";
        state.priority = "all";
      } else if (filter === "overdue") {
        state.status = "overdue";
        state.priority = "all";
      } else if (filter === "high") {
        state.status = "active";
        state.priority = "high";
      } else if (filter === "active") {
        state.status = "active";
        state.priority = "all";
      } else if (filter === "completed") {
        state.status = "Completed";
        state.priority = "all";
      }
      els.statusFilter.value = state.status;
      els.priorityFilter.value = state.priority;
      renderAll();
    });
  });

  // Add Assignment Form Component
  const addFormComponent = mountAddAssignmentForm(els.addAssignmentMount, {
    getTodayIsoDate,
    onCreate: createAssignment,
    onError: (msg) => showToast(msg, true, 6000),
  });
  els.addAssignmentBtn.addEventListener("click", () => addFormComponent.focus());
  els.emptyAddBtn.addEventListener("click", () => addFormComponent.focus());

  // JSON Import / Inspect Modal
  els.importJsonBtn.addEventListener("click", () => {
    els.jsonErrorMsg.classList.add("hidden");
    els.jsonTextarea.value = JSON.stringify(state.assignments, null, 2);
    els.jsonModal.showModal();
  });

  els.jsonForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.jsonErrorMsg.classList.add("hidden");
    const applyBtn = els.jsonForm.querySelector('button[type="submit"]');
    try {
      const parsed = JSON.parse(els.jsonTextarea.value);
      if (!Array.isArray(parsed)) {
        throw new Error("Root JSON value must be an array [...] of assignment objects.");
      }
      const modeInput = els.jsonForm.querySelector('input[name="importMode"]:checked');
      const mode = modeInput ? modeInput.value : "replace";
      if (applyBtn) applyBtn.disabled = true;
      await importAssignmentsJson(parsed, mode);
      els.jsonModal.close();
    } catch (err) {
      els.jsonErrorMsg.textContent = err.message;
      els.jsonErrorMsg.classList.remove("hidden");
    } finally {
      if (applyBtn) applyBtn.disabled = false;
    }
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = document.getElementById(btn.dataset.closeModal);
      if (modal) modal.close();
    });
  });
}

// Expose programmatic hook for external backend JSON array injection if needed.
window.AssignmentTracker = {
  loadAssignments: setAssignmentsFromArray,
  refresh: () => fetchAssignments(),
};

initTheme();
bindEvents();
api.loadingState.subscribe(applyLoadingUI);
applyLoadingUI({ isLoading: false });
fetchAssignments();
