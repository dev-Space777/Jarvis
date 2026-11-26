package jarvis.dao;

/**
 * Unchecked exception raised when an assignment cannot be persisted.
 */
public class AssignmentPersistenceException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public AssignmentPersistenceException(String operation, java.sql.SQLException cause) {
        super(buildMessage(operation, cause), cause);
    }

    private static String buildMessage(String operation, java.sql.SQLException cause) {
        StringBuilder message = new StringBuilder("Database operation '")
                .append(operation)
                .append("' failed");
        if (cause.getSQLState() != null) {
            message.append(" [SQLState ").append(cause.getSQLState()).append(']');
        }
        message.append(": ").append(cause.getMessage());
        return message.toString();
    }
}
