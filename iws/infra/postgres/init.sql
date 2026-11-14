-- Runs once, when the Postgres data directory is first created.
-- (The API also runs this on startup, so an existing database gets the extension too.)
CREATE EXTENSION IF NOT EXISTS vector;
