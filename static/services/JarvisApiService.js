/**
 * JarvisApiService.js
 *
 * Frontend service class connecting the Assignment Tracker dashboard to the
 * Jarvis Java backend (Jarvis-main).
 *
 * ═══════════════════════════════════════════════════════════════════
 *  JAVA BACKEND ANALYSIS (from Jarvis-main/src)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Model: Assignment.java
 *    Fields serialised to JSON when Spring Boot / Jackson is wired up:
 *      {
 *        "id":             <int>,
 *        "subject":        <string>,
 *        "title":          <string>,
 *        "dueDate":        <"YYYY-MM-DD">,   // LocalDate → ISO string
 *        "difficultyLevel":<int 1-5>,
 *        "priorityScore":  <double>,         // computed by AssignmentService
 *        "completed":      <boolean>
 *      }
 *
 *  Controller: AssignmentController.java  (framework-agnostic today)
 *  Expected REST surface when wrapped by Spring Boot / Servlet:
 *
 *    GET    /api/assignments          → list sorted by priority (array)
 *    POST   /api/assignments          → body: { subject, title, dueDate, difficultyLevel }
 *                                       → "Assignment #N created successfully!"
 *    PATCH  /api/assignments/{id}/complete  → marks completed
 *                                       → "Assignment #N marked as completed!"
 *    DELETE /api/assignments/{id}     → "Assignment #N deleted!"
 *
 *  Priority formula (from AssignmentService.calculatePriority):
 *    urgency    = max(0, 30 − daysRemaining) / 30.0    (overdue → >1)
 *    difficulty = difficultyLevel / 5.0
 *    score      = (0.7 × urgency) + (0.3 × difficulty)
 *
 *  Difficulty: 1 (easy) – 5 (hard); default 3
 *
 * ═══════════════════════════════════════════════════════════════════
 *  DASHBOARD FIELD MAPPING  (Jarvis Java → our dashboard)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Java field        Dashboard field     Notes
 *  ─────────────     ───────────────     ──────────────────────────
 *  id                id                  Prefixed "ASG-{id}" in UI
 *  subject           subject
 *  title             title
 *  dueDate           due_date            Same ISO format, renamed
 *  difficultyLevel   difficulty_level    1-5 from Java
 *  priorityScore × 10  priority_score    Java 0.0-1.0+ → UI 1-10
 *  completed         status              false→"Not Started"/"In Progress"
 *                                        true →"Completed"
 *
 * ═══════════════════════════════════════════════════════════════════
 */

// ── Configuration ────────────────────────────────────────────────────────────

/**
 * Base URL of the Jarvis Java backend.
 * Change this to match your Spring Boot server address when available.
 * Leave the Python fallback URL in FALLBACK_BASE if the Java backend
 * is not yet running HTTP (it currently runs as a CLI).
 */
export const JARVIS_BASE_URL = "http://localhost:8080";
export const FALLBACK_BASE_URL = "http://localhost:8000"; // our Python server

/**
 * Timeout in milliseconds before we give up waiting for the backend.
 * 5 seconds is reasonable; increase if the Java DB start-up is slow.
 */
const REQUEST_TIMEOUT_MS = 5000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wraps fetch() with an AbortController timeout and descriptive errors.
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new BackendError(
        `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. ` +
          "Is the Jarvis Java backend running on port 8080?",
        "TIMEOUT"
      );
    }
    // Network / CORS / connection refused
    throw new BackendError(
      "Cannot reach the Jarvis backend. " +
        "Make sure the Spring Boot server is running on http://localhost:8080. " +
        `Original error: ${err.message}`,
      "NETWORK_ERROR"
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Typed error class so callers can distinguish backend errors from
 * programming bugs.
 */
export class BackendError extends Error {
  /**
   * @param {string} message  User-facing description
   * @param {"NETWORK_ERROR"|"TIMEOUT"|"HTTP_ERROR"|"PARSE_ERROR"|"VALIDATION_ERROR"} code
   * @param {number} [status]  HTTP status, if available
   */
  constructor(message, code = "HTTP_ERROR", status = 0) {
    super(message);
    this.name = "BackendError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Convert a raw Jarvis Java Assignment JSON object into the shape our
 * dashboard expects.
 *
 * Java model → dashboard model
 *
 * @param {object} raw  Parsed JSON from the Java backend
 * @returns {object}    Dashboard-compatible assignment object
 */
export function normalizeJarvisAssignment(raw) {
  if (!raw || typeof raw !== "object") {
    throw new BackendError(
      "Received an invalid assignment object from the backend.",
      "PARSE_ERROR"
    );
  }

  // Java priorityScore is a double in roughly [0.0 … 1.4+].
  // Map it to our 1-10 integer scale:  clamp(round(score * 10), 1, 10).
  const rawScore =
    typeof raw.priorityScore === "number" ? raw.priorityScore : 0.5;
  const priorityScore = Math.max(1, Math.min(10, Math.round(rawScore * 10)));

  // difficulty_level: Java uses 1-5, our dashboard shows 1-10 from difficulty.
  // Keep the original 1-5 value so the form knows what was selected.
  const difficultyLevel =
    typeof raw.difficultyLevel === "number" ? raw.difficultyLevel : 3;

  // Status: Java uses boolean `completed`; map to our three-state string.
  let status = "Not Started";
  if (raw.completed === true) {
    status = "Completed";
  }
  // Note: Java has no "In Progress" concept yet — treat non-completed as
  // "Not Started" and let the user update it in the dashboard.

  return {
    id: `ASG-${raw.id}`,             // prefix so IDs match our "ASG-N" format
    _jarvisId: raw.id,               // keep raw numeric ID for API calls
    subject: String(raw.subject ?? "").trim(),
    title: String(raw.title ?? "").trim(),
    due_date: String(raw.dueDate ?? raw.due_date ?? "").trim(),
    difficulty_level: difficultyLevel,
    priority_score: priorityScore,
    status,
  };
}

/**
 * Convert our dashboard's assignment form payload into the Java backend's
 * expected POST body.
 *
 * @param {object} dashboardData  Payload from AddAssignmentForm or the modal
 * @returns {object}  Body to send to POST /api/assignments
 */
export function toDashboardPayloadToJarvis(dashboardData) {
  const diffLevel =
    typeof dashboardData.difficulty_level === "number" &&
    dashboardData.difficulty_level >= 1 &&
    dashboardData.difficulty_level <= 5
      ? dashboardData.difficulty_level
      : // If difficulty_level is out of Java's 1-5 range, map from priority_score
        Math.max(1, Math.min(5, Math.round((dashboardData.priority_score ?? 5) / 2)));

  return {
    subject: String(dashboardData.subject ?? "").trim(),
    title: String(dashboardData.title ?? "").trim(),
    dueDate: String(dashboardData.due_date ?? "").trim(),   // Java expects "dueDate"
    difficultyLevel: diffLevel,                              // Java expects "difficultyLevel"
  };
}

// ── Loading State Manager ─────────────────────────────────────────────────────

/**
 * Simple reactive loading-state store.
 * Components subscribe to state changes by passing a listener.
 */
export class LoadingState {
  constructor() {
    this._state = {
      isLoading: false,
      operation: null,  // "fetch" | "add" | "complete" | "delete"
      error: null,
    };
    this._listeners = new Set();
  }

  get isLoading() { return this._state.isLoading; }
  get operation() { return this._state.operation; }
  get error()     { return this._state.error; }

  _notify() {
    for (const fn of this._listeners) {
      try { fn({ ...this._state }); } catch (_) {}
    }
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn); // returns unsubscribe fn
  }

  _begin(operation) {
    this._state = { isLoading: true, operation, error: null };
    this._notify();
  }

  _end(error = null) {
    this._state = { isLoading: false, operation: this._state.operation, error };
    this._notify();
  }
}

// ── JarvisApiService ──────────────────────────────────────────────────────────

/**
 * Service class that connects the dashboard and Add Assignment form to the
 * Jarvis Java backend REST endpoints.
 *
 * Usage:
 *   import { JarvisApiService } from "./services/JarvisApiService.js";
 *   const api = new JarvisApiService();
 *   api.loadingState.subscribe(({ isLoading, operation, error }) => { ... });
 *   const assignments = await api.fetchAssignments();
 */
export class JarvisApiService {
  /**
   * @param {string} [baseUrl]  Override the default backend URL for testing.
   */
  constructor(baseUrl = JARVIS_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // strip trailing slash
    this.loadingState = new LoadingState();
  }

  // ── Private request helper ──────────────────────────────────────────────

  async _request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
    };
    if (body !== null) {
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetchWithTimeout(url, options);
    } catch (err) {
      // fetchWithTimeout already throws BackendError
      throw err;
    }

    // Parse body (might be JSON or plain text)
    let parsed;
    const contentType = response.headers.get("content-type") ?? "";
    try {
      parsed = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
    } catch {
      throw new BackendError(
        `Could not parse the response from the server (status ${response.status}).`,
        "PARSE_ERROR",
        response.status
      );
    }

    if (!response.ok) {
      // Try to extract a message from JSON error body { error: "...", message: "..." }
      const msg =
        (typeof parsed === "object" && (parsed.error || parsed.message)) ||
        (typeof parsed === "string" && parsed) ||
        `Unexpected HTTP ${response.status} from ${method} ${path}`;
      throw new BackendError(msg, "HTTP_ERROR", response.status);
    }

    return parsed;
  }

  // ── Public API Methods ──────────────────────────────────────────────────

  /**
   * Fetch all assignments from the Jarvis backend, sorted by priority
   * (highest first — the Java service handles the sorting).
   *
   * Maps:  GET /api/assignments  →  Assignment[]
   *
   * @returns {Promise<object[]>}  Dashboard-normalised assignment objects
   * @throws {BackendError}  With a user-friendly message if the backend
   *                         is unreachable or returns an error
   */
  async fetchAssignments() {
    this.loadingState._begin("fetch");
    try {
      const raw = await this._request("GET", "/api/assignments");

      if (!Array.isArray(raw)) {
        throw new BackendError(
          "The backend returned an unexpected data format " +
            "(expected a JSON array of assignments).",
          "PARSE_ERROR"
        );
      }

      const assignments = raw.map(normalizeJarvisAssignment);
      this.loadingState._end();
      return assignments;
    } catch (err) {
      const message = this._formatError(err, "fetch");
      this.loadingState._end(message);
      throw new BackendError(message, err.code ?? "HTTP_ERROR", err.status ?? 0);
    }
  }

  /**
   * Add a new assignment by POSTing to the Jarvis backend.
   *
   * Maps:  POST /api/assignments
   *   Body (Java expected):
   *     { "subject": "...", "title": "...", "dueDate": "YYYY-MM-DD",
   *       "difficultyLevel": <1-5> }
   *   Response (plain text from AssignmentController):
   *     "Assignment #N created successfully!"
   *   On error:
   *     "Error: Subject cannot be empty." (etc.)
   *
   * @param {object} data  Dashboard form payload (from AddAssignmentForm)
   * @returns {Promise<object>}  The created assignment, re-fetched from backend
   * @throws {BackendError}
   */
  async addAssignment(data) {
    this.loadingState._begin("add");
    try {
      const jarvisBody = toDashboardPayloadToJarvis(data);

      // Validate required fields before even hitting the network
      if (!jarvisBody.subject) throw new BackendError("Subject is required.", "VALIDATION_ERROR");
      if (!jarvisBody.title)   throw new BackendError("Title is required.", "VALIDATION_ERROR");
      if (!jarvisBody.dueDate) throw new BackendError("Due Date is required.", "VALIDATION_ERROR");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(jarvisBody.dueDate)) {
        throw new BackendError(
          "Due Date must use YYYY-MM-DD format (e.g. 2026-12-01).",
          "VALIDATION_ERROR"
        );
      }

      const result = await this._request("POST", "/api/assignments", jarvisBody);

      // Java controller returns a plain-text success/error string
      if (typeof result === "string" && result.startsWith("Error:")) {
        throw new BackendError(result.replace(/^Error:\s*/, ""), "HTTP_ERROR");
      }

      // Re-fetch to get the server-assigned ID and computed priorityScore
      const all = await this._request("GET", "/api/assignments");
      const created = Array.isArray(all)
        ? all.find(
            (a) =>
              a.subject === jarvisBody.subject &&
              a.title === jarvisBody.title &&
              a.dueDate === jarvisBody.dueDate
          )
        : null;

      this.loadingState._end();
      return created ? normalizeJarvisAssignment(created) : null;
    } catch (err) {
      const message = this._formatError(err, "add");
      this.loadingState._end(message);
      throw new BackendError(message, err.code ?? "HTTP_ERROR", err.status ?? 0);
    }
  }

  /**
   * Mark an assignment as completed.
   *
   * Maps:  PATCH /api/assignments/{id}/complete
   *   Response (plain text): "Assignment #N marked as completed!"
   *
   * @param {string|number} id  Dashboard "ASG-N" string or raw numeric ID
   * @returns {Promise<boolean>}  true if successful
   * @throws {BackendError}
   */
  async completeAssignment(id) {
    this.loadingState._begin("complete");
    try {
      const numericId = this._extractNumericId(id);
      const result = await this._request(
        "PATCH",
        `/api/assignments/${numericId}/complete`
      );

      if (typeof result === "string" && result.startsWith("Error:")) {
        throw new BackendError(
          result.replace(/^Error:\s*/, "") ||
            `Assignment ${id} not found on the server.`,
          "HTTP_ERROR",
          404
        );
      }

      this.loadingState._end();
      return true;
    } catch (err) {
      const message = this._formatError(err, "complete");
      this.loadingState._end(message);
      throw new BackendError(message, err.code ?? "HTTP_ERROR", err.status ?? 0);
    }
  }

  /**
   * Delete an assignment by ID.
   *
   * Maps:  DELETE /api/assignments/{id}
   *   Response (plain text): "Assignment #N deleted!"
   *
   * @param {string|number} id  Dashboard "ASG-N" string or raw numeric ID
   * @returns {Promise<boolean>}  true if deleted
   * @throws {BackendError}
   */
  async deleteAssignment(id) {
    this.loadingState._begin("delete");
    try {
      const numericId = this._extractNumericId(id);
      const result = await this._request(
        "DELETE",
        `/api/assignments/${numericId}`
      );

      if (typeof result === "string" && result.startsWith("Error:")) {
        throw new BackendError(
          result.replace(/^Error:\s*/, "") ||
            `Assignment ${id} was not found on the server.`,
          "HTTP_ERROR",
          404
        );
      }

      this.loadingState._end();
      return true;
    } catch (err) {
      const message = this._formatError(err, "delete");
      this.loadingState._end(message);
      throw new BackendError(message, err.code ?? "HTTP_ERROR", err.status ?? 0);
    }
  }

  // ── Utility ────────────────────────────────────────────────────────────

  /**
   * Parse "ASG-7" → 7, or pass through a plain number.
   * @param {string|number} id
   * @returns {number}
   */
  _extractNumericId(id) {
    if (typeof id === "number") return id;
    const str = String(id);
    // Handle "ASG-7" or "_jarvisId" stored directly
    const match = str.match(/(\d+)$/);
    if (!match) {
      throw new BackendError(
        `Cannot determine the numeric ID from "${id}". ` +
          "Make sure assignments were loaded from the Jarvis backend.",
        "VALIDATION_ERROR"
      );
    }
    return parseInt(match[1], 10);
  }

  /**
   * Produce a human-readable error message based on error code and operation.
   * @param {Error|BackendError} err
   * @param {"fetch"|"add"|"complete"|"delete"} operation
   * @returns {string}
   */
  _formatError(err, operation) {
    if (err instanceof BackendError) {
      switch (err.code) {
        case "NETWORK_ERROR":
          return (
            "⚠ Jarvis backend is not reachable. " +
            "Start the Spring Boot server on http://localhost:8080, " +
            "or use the Python fallback server on http://localhost:8000."
          );
        case "TIMEOUT":
          return (
            `⏱ The request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. ` +
            "The Jarvis Java server may be starting up — please try again."
          );
        case "VALIDATION_ERROR":
          return err.message;
        case "PARSE_ERROR":
          return (
            "The server returned data in an unexpected format. " +
            "Check that the Jarvis backend version matches this frontend."
          );
        case "HTTP_ERROR":
          if (err.status === 404) {
            return `Assignment not found — it may have been deleted already.`;
          }
          if (err.status === 400) {
            return `Invalid request: ${err.message}`;
          }
          if (err.status >= 500) {
            return (
              "The Jarvis backend encountered an internal error. " +
              "Check the Spring Boot console for a stack trace."
            );
          }
          return err.message;
        default:
          return err.message;
      }
    }
    return `Unexpected error during ${operation}: ${err.message}`;
  }
}

// ── Singleton factory (dashboard wires up once) ───────────────────────────────

let _serviceInstance = null;

/**
 * Returns the shared JarvisApiService singleton.
 * Override the base URL in tests by calling getJarvisService(url) explicitly.
 *
 * @param {string} [baseUrl]
 * @returns {JarvisApiService}
 */
export function getJarvisService(baseUrl) {
  if (!_serviceInstance || baseUrl) {
    _serviceInstance = new JarvisApiService(baseUrl ?? JARVIS_BASE_URL);
  }
  return _serviceInstance;
}
