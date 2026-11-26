package jarvis.model;

import java.time.LocalDate;

/**
 * Core domain model for an assignment.
 * Decoupled from any I/O (Scanner, CLI, HTTP) so it can flow
 * freely between the frontend, service layer, and DAO.
 */
public class Assignment {

    private int id;
    private String subject;
    private String title;
    private LocalDate dueDate;       // upgraded from String
    private int difficultyLevel;     // 1 (easy) – 5 (hard)
    private double priorityScore;    // computed by the service layer
    private boolean completed;

    // ── Constructors ──────────────────────────────────────────

    /** Full constructor used when restoring from the database. */
    public Assignment(int id, String subject, String title,
                      LocalDate dueDate, int difficultyLevel) {
        this.id = id;
        this.subject = subject;
        this.title = title;
        setDueDate(dueDate);
        setDifficultyLevel(difficultyLevel);
        this.priorityScore = 0.0;
        this.completed = false;
    }

    /** Convenience constructor – difficulty defaults to 3 (medium). */
    public Assignment(int id, String subject, String title, LocalDate dueDate) {
        this(id, subject, title, dueDate, 3);
    }

    // ── Getters ───────────────────────────────────────────────

    public int getId()               { return id; }
    public String getSubject()       { return subject; }
    public String getTitle()         { return title; }
    public LocalDate getDueDate()    { return dueDate; }
    public int getDifficultyLevel()  { return difficultyLevel; }
    public double getPriorityScore() { return priorityScore; }
    public boolean isCompleted()     { return completed; }

    // ── Setters (with validation) ─────────────────────────────

    public void setId(int id) {
        this.id = id;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setDueDate(LocalDate dueDate) {
        if (dueDate == null) {
            throw new IllegalArgumentException("dueDate must not be null");
        }
        this.dueDate = dueDate;
    }

    public void setDifficultyLevel(int difficultyLevel) {
        if (difficultyLevel < 1 || difficultyLevel > 5) {
            throw new IllegalArgumentException(
                    "difficultyLevel must be between 1 and 5, got: " + difficultyLevel);
        }
        this.difficultyLevel = difficultyLevel;
    }

    public void setPriorityScore(double priorityScore) {
        this.priorityScore = priorityScore;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    // ── Display ───────────────────────────────────────────────

    @Override
    public String toString() {
        return String.format(
                "[#%d] %s – %s | Due: %s | Difficulty: %d | Priority: %.2f | %s",
                id, subject, title, dueDate, difficultyLevel, priorityScore,
                completed ? "✅ Completed" : "⏳ Pending");
    }
}
