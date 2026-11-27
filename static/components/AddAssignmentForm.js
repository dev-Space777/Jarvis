/**
 * Reusable Add Assignment form component.
 * Renders fields for Subject, Title, Due Date (YYYY-MM-DD, no past dates),
 * and Difficulty Level (1-5), validates before submit, and invokes onCreate.
 */

const DIFFICULTY_OPTIONS = [
  { value: "1",  label: "1 – Very Easy" },
  { value: "2",  label: "2 – Easy" },
  { value: "3",  label: "3 – Moderate" },
  { value: "4",  label: "4 – Hard" },
  { value: "5",  label: "5 – Challenging" },
  { value: "6",  label: "6 – Very Hard" },
  { value: "7",  label: "7 – Demanding" },
  { value: "8",  label: "8 – Intense" },
  { value: "9",  label: "9 – Expert" },
  { value: "10", label: "10 – Extreme" },
];

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function validateAssignmentFormValues(values, todayIso) {
  const errors = {};
  const subject = String(values.subject ?? "").trim();
  const title = String(values.title ?? "").trim();
  const dueDate = String(values.due_date ?? "").trim();
  const difficultyRaw = String(values.difficulty_level ?? "").trim();

  if (!subject) {
    errors.subject = "Subject is required.";
  }

  if (!title) {
    errors.title = "Title is required.";
  }

  if (!dueDate) {
    errors.due_date = "Due Date is required.";
  } else if (!isValidIsoDate(dueDate)) {
    errors.due_date = "Due Date must be a valid YYYY-MM-DD date.";
  } else if (dueDate < todayIso) {
    errors.due_date = `Due Date cannot be before today (${todayIso}).`;
  }

  const difficultyNum = Number(difficultyRaw);
  if (!difficultyRaw) {
    errors.difficulty_level = "Please select a Difficulty Level (1 – 10).";
  } else if (!Number.isInteger(difficultyNum) || difficultyNum < 1 || difficultyNum > 10) {
    errors.difficulty_level = "Difficulty Level must be between 1 and 10.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      subject,
      title,
      due_date: dueDate,
      difficulty_level: difficultyNum,
      priority_score: difficultyNum,   // 1-10 maps directly to 1-10
      status: "Not Started",
    },
  };
}

export function mountAddAssignmentForm(container, { getTodayIsoDate, onCreate, onError }) {
  if (!container) {
    throw new Error("AddAssignmentForm container element was not found.");
  }

  const today = getTodayIsoDate();

  container.innerHTML = `
    <div class="add-form-header">
      <div>
        <h2 class="add-form-title">New Assignment</h2>
        <p class="add-form-subtitle">Difficulty (1–10) sets Priority Score directly.</p>
      </div>
    </div>
    <form id="addAssignmentForm" class="add-form" novalidate>
      <div class="add-form-grid">
        <div class="field-group" data-field="subject">
          <label class="field" for="formSubject">
            <span>Subject *</span>
            <input id="formSubject" name="subject" type="text" placeholder="e.g. Distributed Systems" autocomplete="off" required>
          </label>
          <span class="field-error" id="err-subject" role="alert"></span>
        </div>

        <div class="field-group" data-field="title">
          <label class="field" for="formTitle">
            <span>Title *</span>
            <input id="formTitle" name="title" type="text" placeholder="e.g. Raft Consensus Lab" autocomplete="off" required>
          </label>
          <span class="field-error" id="err-title" role="alert"></span>
        </div>

        <div class="field-group" data-field="due_date">
          <label class="field" for="formDueDate">
            <span>Due Date *</span>
            <input id="formDueDate" name="due_date" type="date" min="${today}" pattern="\\d{4}-\\d{2}-\\d{2}" required>
          </label>
          <span class="field-error" id="err-due_date" role="alert"></span>
        </div>

        <div class="field-group" data-field="difficulty_level">
          <label class="field" for="formDifficulty">
            <span>Difficulty / Priority (1–10) *</span>
            <select id="formDifficulty" name="difficulty_level" required>
              <option value="">Select level (1–10)</option>
              ${DIFFICULTY_OPTIONS.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join("")}
            </select>
          </label>
          <span class="field-error" id="err-difficulty_level" role="alert"></span>
        </div>

        <div class="add-form-submit">
          <button id="addFormSubmitBtn" class="btn btn-primary" type="submit">+ Add</button>
          <button id="addFormResetBtn" class="btn btn-ghost" type="button">Clear</button>
        </div>
      </div>
    </form>
  `;

  const form = container.querySelector("#addAssignmentForm");
  const subjectInput = container.querySelector("#formSubject");
  const titleInput = container.querySelector("#formTitle");
  const dueDateInput = container.querySelector("#formDueDate");
  const difficultySelect = container.querySelector("#formDifficulty");
  const submitBtn = container.querySelector("#addFormSubmitBtn");
  const resetBtn = container.querySelector("#addFormResetBtn");

  const fieldInputs = {
    subject: subjectInput,
    title: titleInput,
    due_date: dueDateInput,
    difficulty_level: difficultySelect,
  };

  function syncMinDate() {
    dueDateInput.min = getTodayIsoDate();
  }

  function clearFieldError(name) {
    const group = container.querySelector(`.field-group[data-field="${name}"]`);
    const errEl = container.querySelector(`#err-${name}`);
    const input = fieldInputs[name];
    if (group) group.classList.remove("has-error");
    if (errEl) errEl.textContent = "";
    if (input) input.removeAttribute("aria-invalid");
  }

  function clearAllErrors() {
    Object.keys(fieldInputs).forEach(clearFieldError);
  }

  function applyErrors(errors) {
    clearAllErrors();
    let firstInvalid = null;
    for (const [name, msg] of Object.entries(errors)) {
      const group = container.querySelector(`.field-group[data-field="${name}"]`);
      const errEl = container.querySelector(`#err-${name}`);
      const input = fieldInputs[name];
      if (group) group.classList.add("has-error");
      if (errEl) errEl.textContent = msg;
      if (input) {
        input.setAttribute("aria-invalid", "true");
        if (!firstInvalid) firstInvalid = input;
      }
    }
    if (firstInvalid) firstInvalid.focus();
  }

  Object.entries(fieldInputs).forEach(([name, input]) => {
    const evt = input.tagName === "SELECT" || input.type === "date" ? "change" : "input";
    input.addEventListener(evt, () => {
      syncMinDate();
      clearFieldError(name);
    });
  });

  resetBtn.addEventListener("click", () => {
    form.reset();
    syncMinDate();
    clearAllErrors();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    syncMinDate();

    const currentToday = getTodayIsoDate();
    const result = validateAssignmentFormValues(
      {
        subject: subjectInput.value,
        title: titleInput.value,
        due_date: dueDateInput.value,
        difficulty_level: difficultySelect.value,
      },
      currentToday
    );

    if (!result.valid) {
      applyErrors(result.errors);
      if (onError) {
        onError("Please fix the highlighted fields before submitting.");
      }
      return;
    }

    clearAllErrors();
    submitBtn.disabled = true;
    submitBtn.textContent = "Adding...";

    try {
      await onCreate(result.data);
      form.reset();
      syncMinDate();
    } catch (err) {
      if (onError) {
        onError(err.message || "Could not add assignment.");
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "+ Add Assignment";
    }
  });

  return {
    focus() {
      syncMinDate();
      container.scrollIntoView({ behavior: "smooth", block: "nearest" });
      subjectInput.focus();
    },
    syncMinDate,
  };
}
