package jarvis.dao;

import jarvis.model.Assignment;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Simple in-memory DAO backed by an ArrayList, useful for tests and
 * temporary, non-persistent runs.
 */
public class InMemoryAssignmentDAO implements AssignmentDAO {

    private final List<Assignment> store = new ArrayList<>();
    private final AtomicInteger idGen = new AtomicInteger(1);

    @Override
    public int save(Assignment assignment) {
        int id = idGen.getAndIncrement();
        assignment.setId(id);
        store.add(assignment);
        return id;
    }

    @Override
    public List<Assignment> findAll() {
        return new ArrayList<>(store);   // defensive copy
    }

    @Override
    public Assignment findById(int id) {
        for (Assignment a : store) {
            if (a.getId() == id) return a;
        }
        return null;
    }

    @Override
    public boolean update(Assignment assignment) {
        for (int i = 0; i < store.size(); i++) {
            if (store.get(i).getId() == assignment.getId()) {
                store.set(i, assignment);
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean delete(int id) {
        return store.removeIf(a -> a.getId() == id);
    }
}
