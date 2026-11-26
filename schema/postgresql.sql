CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    due_date DATE NOT NULL,
    difficulty_level INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 5),
    priority_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_assignments_due_date
    ON assignments (due_date);

CREATE INDEX IF NOT EXISTS idx_assignments_is_completed
    ON assignments (is_completed);
