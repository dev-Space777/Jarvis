package jarvis.dao;

import jarvis.model.Assignment;
import java.util.List;

/**
 * Data-access contract.
 * Antariksh can swap in a JDBC / file-backed implementation later
 * without touching the service or controller layers.
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
}
