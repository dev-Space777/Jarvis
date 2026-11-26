# Jarvis

Assignment tracker project using a PostgreSQL-backed JDBC DAO.

## Database setup

1. Create the PostgreSQL database by running
   [`schema/create_database.sql`](schema/create_database.sql) against the
   default `postgres` database. Run this script once.
2. Apply [`schema/postgresql.sql`](schema/postgresql.sql) to `jarvis_db`. It
   creates the assignments table and indexes due dates and completion status.
3. Copy `db.properties.example` to `db.properties` and set `jdbc.url`,
   `jdbc.username`, and `jdbc.password`. The local configuration file is ignored
   by Git. You can use another configuration path with the
   `-Djarvis.db.config=<path>` JVM property.
4. Build and run with Java 8+ and Maven:

   ```text
   mvn compile exec:java
   ```

   Maven downloads the PostgreSQL JDBC driver declared in `pom.xml`.

`Main` wires `JdbcAssignmentDAO` into the existing service/controller stack,
using the `AssignmentDAO` interface as the shared contract. `DatabaseConnection`
is the JDBC singleton. The DAO uses prepared statements and closes each
connection and statement after use. JDBC failures are raised as
`AssignmentPersistenceException` with
the operation and SQL state, while missing or invalid configuration is reported
as an `IllegalStateException`.

The database itself stays on the local PostgreSQL server; only its schema and
application code are stored in this repository. Do not commit `db.properties`
or database credentials.
