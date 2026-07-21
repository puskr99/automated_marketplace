import { db } from "@/lib/db";

// Postgres full-text search (tsvector/ts_rank, weighted by field importance)
// combined with pg_trgm word_similarity for typo tolerance — not an LLM.
// This covers tokenizing, stemming, ranking, and fuzzy matching "for free"
// via Postgres itself; an embeddings/LLM layer would only be worth adding
// later for genuine natural-language intent queries ("contracts that let
// the owner secretly mint tokens"), which keyword+trigram search can't
// resolve.
//
// The tsvector is built on the fly per query (no stored/indexed column)
// since it has to span three tables (worker, its latest approved manifest,
// and the developer's user record) — Postgres generated columns can't
// reference a join. Fine at our current scale; if the catalog grows into
// the thousands, materialize this into a stored tsvector + GIN index
// (refreshed on manifest approval) instead of recomputing it per search.
//
// Two things learned by testing against real data, not assumption:
// - `similarity()` compares the query against the *whole* target string,
//   which dilutes badly for a one-word typo against a longer name/
//   description ("wather" vs "City Weather Lookup" scores 0.23 — below any
//   sane threshold). `word_similarity()` instead finds the best-matching
//   substring, scoring the same case at 0.57. That's the function that
//   actually delivers typo tolerance here.
// - Emails can't go through tsvector/tsquery at all: `to_tsvector` treats
//   "demo-developer@example.com" as one atomic token, but
//   `websearch_to_tsquery('demo-developer')` splits it into a 3-lexeme
//   phrase query — they can never match `@@`. Email search is a plain
//   substring match instead.
const WORD_SIMILARITY_THRESHOLD = 0.4;

export async function searchWorkerIds(query: string, limit = 50): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT w.id
    FROM workers w
    LEFT JOIN LATERAL (
      SELECT wm.manifest
      FROM worker_manifests wm
      WHERE wm."workerId" = w.id AND wm.status = 'APPROVED'
      ORDER BY wm."createdAt" DESC
      LIMIT 1
    ) m ON true
    LEFT JOIN developer_profiles dp ON dp.id = w."developerId"
    LEFT JOIN users u ON u.id = dp."userId"
    WHERE
      (
        setweight(to_tsvector('english', coalesce(w.name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(w.category, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(m.manifest->>'description', '')), 'C') ||
        setweight(to_tsvector('english', coalesce(u.name, '')), 'D')
      ) @@ websearch_to_tsquery('english', ${q})
      OR word_similarity(${q}, w.name) > ${WORD_SIMILARITY_THRESHOLD}
      OR word_similarity(${q}, w.category) > ${WORD_SIMILARITY_THRESHOLD}
      OR u.email ILIKE '%' || ${q} || '%'
    ORDER BY
      ts_rank_cd(
        setweight(to_tsvector('english', coalesce(w.name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(w.category, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(m.manifest->>'description', '')), 'C') ||
        setweight(to_tsvector('english', coalesce(u.name, '')), 'D'),
        websearch_to_tsquery('english', ${q})
      ) DESC,
      GREATEST(word_similarity(${q}, w.name), word_similarity(${q}, w.category)) DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => r.id);
}
