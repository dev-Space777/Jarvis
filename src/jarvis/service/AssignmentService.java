package jarvis.service;

import jarvis.dao.AssignmentDAO;
import jarvis.model.Assignment;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;

/**
 * Business-logic layer: validation, priority scoring, and sorting.
 * Sits between the Controller and the DAO – no I/O of its own.
 */
public class AssignmentService {

    private final AssignmentDAO dao;

    public AssignmentService(AssignmentDAO dao) {
        this.dao = dao;
    }

    // ── CRUD operations (delegated to DAO) ────────────────────

    public int addAssignment(String subject, String title,
            LocalDate dueDate, int difficultyLevel) {
        Assignment a = new Assignment(0, subject, title, dueDate, difficultyLevel);
        a.setPriorityScore(calculatePriority(dueDate, difficultyLevel));
        return dao.save(a);
    }

    public Assignment getAssignment(int id) {
        return dao.findById(id);
    }

    /**
     * Returns every assignment, freshly scored and sorted
     * highest-priority-first so the frontend can display them
     * in the order that matters most to the student.
     */
    public List<Assignment> getAllAssignmentsSorted() {
        List<Assignment> all = dao.findAll();
        // Re-score (priority is time-sensitive)
        for (Assignment a : all) {
            a.setPriorityScore(
                    calculatePriority(a.getDueDate(), a.getDifficultyLevel()));
        }
        // Sort: highest priority first; completed assignments sink to the bottom
        all.sort(Comparator
                .comparing(Assignment::isCompleted) // false < true
                .thenComparing(
                        Comparator.comparingDouble(Assignment::getPriorityScore)
                                .reversed())); // high score first
        return all;
    }

    public boolean markCompleted(int id) {
        Assignment a = dao.findById(id);
        if (a == null)
            return false;
        a.setCompleted(true);
        return dao.update(a);
    }

    public boolean deleteAssignment(int id) {
        return dao.delete(id);
    }

    // ── Priority Algorithm ────────────────────────────────────

    /**
     * Pure, stateless priority scoring.
     *
     * <p>
     * <b>Formula:</b>
     * 
     * <pre>
     *   urgency     = max(0, 30 − daysRemaining) / 30.0   → 0.0 … 1.0
     *   difficulty  = difficultyLevel / 5.0                → 0.2 … 1.0
     *   priority    = (0.7 × urgency) + (0.3 × difficulty)
     * </pre>
     *
     * <ul>
     * <li>Urgency is weighted 70 % – assignments due tomorrow always
     * float above a hard assignment due in three weeks.</li>
     * <li>If the due date is <em>past</em>, daysRemaining is negative,
     * which pushes urgency above 1.0 (overdue boost).</li>
     * <li>Completed assignments still get scored but are sorted
     * to the bottom by {@link #getAllAssignmentsSorted()}.</li>
     * </ul>
     *
     * @param dueDate         the assignment's due date
     * @param difficultyLevel 1 (easy) through 5 (hard)
     * @return a score where higher = "do this first"
     */
    public static double calculatePriority(LocalDate dueDate,
            int difficultyLevel) {
        long daysRemaining = ChronoUnit.DAYS.between(LocalDate.now(), dueDate);

        // Urgency: 0 when 30+ days out, 1.0 when due today, >1 when overdue
        double urgency = Math.max(0, 30 - daysRemaining) / 30.0;

        // Difficulty: linear scale 0.2 … 1.0
        double difficulty = difficultyLevel / 5.0;

        return (0.7 * urgency) + (0.3 * difficulty);
    }
}
