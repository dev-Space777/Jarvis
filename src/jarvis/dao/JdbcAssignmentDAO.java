package jarvis.dao;

import jarvis.model.Assignment;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * JDBC-backed assignment storage. Each operation owns and closes its
 * connection and statements; callers receive persistence errors as runtime
 * exceptions so the existing service and controller contract stays unchanged.
 */
public class JdbcAssignmentDAO implements AssignmentDAO {

    private static final String INSERT =
            "INSERT INTO assignments (subject, title, due_date, difficulty_level, priority_score, is_completed) "
                    + "VALUES (?, ?, ?, ?, ?, ?)";
    private static final String SELECT_COLUMNS =
            "id, subject, title, due_date, difficulty_level, priority_score, is_completed";

    private final DatabaseConnection connectionManager;

    public JdbcAssignmentDAO() {
        this(DatabaseConnection.getInstance());
    }

    JdbcAssignmentDAO(DatabaseConnection connectionManager) {
        this.connectionManager = connectionManager;
    }

    @Override
    public int save(Assignment assignment) {
        try (Connection connection = connectionManager.getConnection();
                PreparedStatement statement = connection.prepareStatement(
                        INSERT, Statement.RETURN_GENERATED_KEYS)) {
            bindAssignment(statement, assignment, 1);
            statement.executeUpdate();
            try (ResultSet keys = statement.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("The database did not return a generated assignment ID.");
                }
                int id = keys.getInt(1);
                assignment.setId(id);
                return id;
            }
        } catch (SQLException e) {
            throw new AssignmentPersistenceException("save assignment", e);
        }
    }

    @Override
    public List<Assignment> findAll() {
        String sql = "SELECT " + SELECT_COLUMNS + " FROM assignments ORDER BY id";
        List<Assignment> assignments = new ArrayList<>();
        try (Connection connection = connectionManager.getConnection();
                PreparedStatement statement = connection.prepareStatement(sql);
                ResultSet results = statement.executeQuery()) {
            while (results.next()) {
                assignments.add(readAssignment(results));
            }
            return assignments;
        } catch (SQLException e) {
            throw new AssignmentPersistenceException("find all assignments", e);
        }
    }

    @Override
    public Assignment findById(int id) {
        String sql = "SELECT " + SELECT_COLUMNS + " FROM assignments WHERE id = ?";
        try (Connection connection = connectionManager.getConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            try (ResultSet results = statement.executeQuery()) {
                return results.next() ? readAssignment(results) : null;
            }
        } catch (SQLException e) {
            throw new AssignmentPersistenceException("find assignment by ID", e);
        }
    }

    @Override
    public boolean update(Assignment assignment) {
        String sql = "UPDATE assignments SET subject = ?, title = ?, due_date = ?, "
                + "difficulty_level = ?, priority_score = ?, is_completed = ? WHERE id = ?";
        try (Connection connection = connectionManager.getConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {
            bindAssignment(statement, assignment, 1);
            statement.setInt(7, assignment.getId());
            return statement.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new AssignmentPersistenceException("update assignment", e);
        }
    }

    @Override
    public boolean delete(int id) {
        String sql = "DELETE FROM assignments WHERE id = ?";
        try (Connection connection = connectionManager.getConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            return statement.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new AssignmentPersistenceException("delete assignment", e);
        }
    }

    public int addAssignment(Assignment assignment) {
        return save(assignment);
    }

    @Override
    public int insertAssignment(Assignment assignment) {
        return save(assignment);
    }

    @Override
    public List<Assignment> getAllAssignments() {
        return findAll();
    }

    public Assignment getAssignmentById(int id) {
        return findById(id);
    }

    public boolean updateAssignment(Assignment assignment) {
        return update(assignment);
    }

    @Override
    public boolean updateStatus(int id, boolean status) {
        String sql = "UPDATE assignments SET is_completed = ? WHERE id = ?";
        try (Connection connection = connectionManager.getConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setBoolean(1, status);
            statement.setInt(2, id);
            return statement.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new AssignmentPersistenceException("update assignment status", e);
        }
    }

    @Override
    public boolean deleteAssignment(int id) {
        return delete(id);
    }

    private static void bindAssignment(
            PreparedStatement statement, Assignment assignment, int firstParameter) throws SQLException {
        statement.setString(firstParameter, assignment.getSubject());
        statement.setString(firstParameter + 1, assignment.getTitle());
        statement.setDate(firstParameter + 2, Date.valueOf(assignment.getDueDate()));
        statement.setInt(firstParameter + 3, assignment.getDifficultyLevel());
        statement.setDouble(firstParameter + 4, assignment.getPriorityScore());
        statement.setBoolean(firstParameter + 5, assignment.isCompleted());
    }

    private static Assignment readAssignment(ResultSet results) throws SQLException {
        Assignment assignment = new Assignment(
                results.getInt("id"),
                results.getString("subject"),
                results.getString("title"),
                results.getDate("due_date").toLocalDate(),
                results.getInt("difficulty_level"));
        assignment.setPriorityScore(results.getDouble("priority_score"));
        assignment.setCompleted(results.getBoolean("is_completed"));
        return assignment;
    }
}
