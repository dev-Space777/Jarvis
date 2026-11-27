# Jarvis

Assignment tracker project using a PostgreSQL-backed JDBC DAO and a browser
dashboard (`static/`).

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

## Frontend setup (`static/`)

The dashboard is a dependency-free browser app (plain ES modules, no build
step) that talks to the Java backend over HTTP.

```text
static/
├── index.html                      Dashboard markup
├── styles.css                      Styles (light/dark themes)
├── app.js                          Dashboard logic, wired to JarvisApiService
├── components/
│   └── AddAssignmentForm.js        "New Assignment" form + validation
└── services/
    └── JarvisApiService.js         REST client + loading state for the Java backend
```

### Running it

1. Start the Java backend so it is reachable at **`http://localhost:8080`**
   (the base URL is set in `static/app.js` as `API_BASE_URL`).
2. Serve the `static/` folder over HTTP from its root. ES modules do not load
   from `file://`, and `index.html` references `/styles.css` and `/app.js` as
   root-relative paths. For example:

   ```text
   cd static
   python3 -m http.server 3000
   ```

   Then open <http://localhost:3000>.

### Backend requirements

The frontend expects this REST surface on `http://localhost:8080`:

| Method   | Path                               | Purpose                                                  |
|----------|------------------------------------|----------------------------------------------------------|
| `GET`    | `/api/assignments`                 | List assignments (JSON array)                            |
| `POST`   | `/api/assignments`                 | Create: `{ subject, title, dueDate, difficultyLevel }`   |
| `PATCH`  | `/api/assignments/{id}/complete`   | Mark an assignment completed                             |
| `DELETE` | `/api/assignments/{id}`            | Delete an assignment                                     |

Because the dashboard is served from a different origin (for example
`localhost:3000`), the Java HTTP server must send CORS headers
(`Access-Control-Allow-Origin`, and allow the `GET, POST, PATCH, DELETE,
OPTIONS` methods and the `Content-Type` and `Accept` headers) and answer
`OPTIONS` preflight requests.

### Offline and loading behavior

- If the Java HTTP server is not running (or times out), the header pill shows
  **"Backend offline"** and a toast explains that the server at
  `http://localhost:8080` is not responding. Start the server and press
  **Refresh**.
- While any request is in flight (`api.loadingState`), the **Refresh** button
  reads **"Syncing..."**, the header pill shows "Syncing...", and the Refresh,
  Load JSON, row **Mark Complete** / **Delete**, and form **Add** / **Clear**
  buttons are disabled until the request finishes.
- **Load JSON** (bulk import) calls `POST /api/assignments/import`, which is not
  part of the REST surface above and has no `JarvisApiService` method yet. It
  will report "Backend offline" or an HTTP error until that endpoint exists.

## Difficulty input (1–5)

The **New Assignment** form collects **Difficulty Level** on the same **1–5**
scale as the Java backend:

| Value | Label          |
|-------|----------------|
| 1     | Very Easy      |
| 2     | Easy           |
| 3     | Moderate       |
| 4     | Hard           |
| 5     | Challenging    |

Validation rejects anything that is not an integer from 1 to 5. The value is
sent to the backend as `difficultyLevel`. The form also includes a
`priority_score` estimate in its payload (`difficulty × 2`, so 1–5 maps to
2–10), but the score shown in the dashboard after creation is the one the
backend calculates.

## Priority score mapping (Java → dashboard)

The Java backend (`AssignmentService.calculatePriority`) returns `priorityScore`
as a `double` in the range **0.0 – 1.0+**:

```text
urgency    = max(0, 30 - daysRemaining) / 30.0     (overdue assignments exceed 1.0)
difficulty = difficultyLevel / 5.0                 (difficultyLevel is 1-5)
score      = (0.7 * urgency) + (0.3 * difficulty)
```

The dashboard displays priority on a **1–10** integer scale. `JarvisApiService`
converts it with:

```text
priority_score = clamp(round(priorityScore * 10), 1, 10)
```

Scores above 1.0 (overdue work) are capped at 10, and very low scores are raised
to 1. The dashboard then groups the 1–10 value into tiers:

| Dashboard score | Tier   |
|-----------------|--------|
| 8 – 10          | High   |
| 5 – 7           | Medium |
| 1 – 4           | Low    |

Examples:

| Due in      | Difficulty | Java `priorityScore` | Dashboard score | Tier   |
|-------------|------------|----------------------|-----------------|--------|
| 30+ days    | 1          | 0.06                 | 1               | Low    |
| 30+ days    | 5          | 0.30                 | 3               | Low    |
| 15 days     | 3          | 0.53                 | 5               | Medium |
| 5 days      | 4          | 0.82                 | 8               | High   |
| today       | 5          | 1.00                 | 10              | High   |
| 10 days late| 5          | 1.23                 | 10 (capped)     | High   |

Other field mappings applied by `JarvisApiService`: `id` becomes `ASG-{id}` in
the UI, `dueDate` becomes `due_date`, and `completed: true` becomes the status
"Completed" (otherwise "Not Started"; the backend has no "In Progress" state).
