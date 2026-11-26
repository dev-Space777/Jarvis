package jarvis.controller;

import jarvis.model.Assignment;
import jarvis.service.AssignmentService;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * API / entry-point layer.
 *
 * <p>This controller is intentionally framework-agnostic: each method
 * receives plain Java parameters and returns plain Java objects.
 * It can be called directly by a CLI front-end, wrapped in a Servlet,
 * or exposed through Spring Boot {@code @RestController} annotations
 * without changing any logic.</p>
 *
 * <p><b>Responsibilities:</b>
 * <ul>
 *   <li>Validate and parse raw input from the frontend.</li>
 *   <li>Delegate to {@link AssignmentService} for business logic.</li>
 *   <li>Return results (or error messages) the frontend can render.</li>
 * </ul>
 */
public class AssignmentController {

    private final AssignmentService service;

    public AssignmentController(AssignmentService service) {
        this.service = service;
    }

    // ── Create ────────────────────────────────────────────────

    /**
     * Validate frontend input and create a new assignment.
     *
     * @return a user-facing status message
     */
    public String createAssignment(String subject, String title,
                                   String dueDateStr, String difficultyStr) {
        // --- input validation ---
        if (subject == null || subject.trim().isEmpty()) {
            return "Error: Subject cannot be empty.";
        }
        if (title == null || title.trim().isEmpty()) {
            return "Error: Title cannot be empty.";
        }

        LocalDate dueDate;
        try {
            dueDate = LocalDate.parse(dueDateStr);          // expects ISO-8601 (yyyy-MM-dd)
        } catch (DateTimeParseException | NullPointerException e) {
            return "Error: Invalid date format. Please use yyyy-MM-dd.";
        }

        int difficulty;
        try {
            difficulty = Integer.parseInt(difficultyStr);
            if (difficulty < 1 || difficulty > 5) {
                return "Error: Difficulty must be between 1 and 5.";
            }
        } catch (NumberFormatException e) {
            return "Error: Difficulty must be an integer between 1 and 5.";
        }

        // --- delegate to service ---
        int id = service.addAssignment(subject, title, dueDate, difficulty);
        return "Assignment #" + id + " created successfully!";
    }

    // ── Read ──────────────────────────────────────────────────

    /** Return all assignments sorted by priority (highest first). */
    public List<Assignment> listAssignments() {
        return service.getAllAssignmentsSorted();
    }

    /** Look up a single assignment by id. */
    public Assignment getAssignment(int id) {
        return service.getAssignment(id);
    }

    // ── Update ────────────────────────────────────────────────

    public String markCompleted(int id) {
        boolean ok = service.markCompleted(id);
        return ok ? "Assignment #" + id + " marked as completed!"
                  : "Error: Assignment #" + id + " not found.";
    }

    // ── Delete ────────────────────────────────────────────────

    public String deleteAssignment(int id) {
        boolean ok = service.deleteAssignment(id);
        return ok ? "Assignment #" + id + " deleted!"
                  : "Error: Assignment #" + id + " not found.";
    }
}
