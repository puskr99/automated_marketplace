-- Enables trigram similarity for typo-tolerant fuzzy matching (used
-- alongside Postgres's built-in full-text search — tsvector/ts_rank need
-- no extension). See src/lib/search.ts for how these are used together.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Speeds up trigram similarity lookups on the fields we fuzzy-match against.
CREATE INDEX IF NOT EXISTS workers_name_trgm_idx ON workers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS workers_category_trgm_idx ON workers USING gin (category gin_trgm_ops);
