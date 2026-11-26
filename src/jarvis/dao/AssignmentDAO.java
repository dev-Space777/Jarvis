package jarvis.dao;

import jarvis.model.Assignment;
import java.util.List;

/**
 * Data-access contract.
 * Implementations can be swapped without touching the service or
 * controller layers.
 */
public interface AssignmentDAO {

    /** Persist a new assignment and return its generated id. */
    int save(Assignment assignment);

    /** Return all assignments (both pending and completed). */
    List<Assignment> findAll();

    /** Find by id, or null if not present. */
    Assignment findById(int id);

    /** Update an existing assignment in-place. */
    boolean update(Assignment assignment);

    /** Delete by id. Returns true if something was actually removed. */
    boolean delete(int id);

    default int insertAssignment(Assignment assignment) {
        return save(assignment);
    }

    default List<Assignment> getAllAssignments() {
        return findAll();
    }

    default boolean updateStatus(int id, boolean status) {
        Assignment assignment = findById(id);
        if (assignment == null) {
            return false;
        }
        assignment.setCompleted(status);
        return update(assignment);
    }

    default boolean deleteAssignment(int id) {
        return delete(id);
    }
}
