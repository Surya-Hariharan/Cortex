-- ============================================================
-- Cortex — Vector Embeddings  (Supabase / PostgreSQL)
-- 002_embeddings.sql
--
-- Run AFTER 001_initial_schema.sql.
-- Adds pgvector extension, embedding column, HNSW index, and a
-- parameterized semantic-search helper function.
--
-- BGE-small-en-v1.5 → 384-dimensional L2-normalised vectors.
-- Cosine similarity = 1 - (embedding <=> query_embedding).
-- ============================================================

SET search_path = public, pg_catalog;

-- ── pgvector extension ───────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Add embedding column ─────────────────────────────────────────────────────
ALTER TABLE document_chunks
    ADD COLUMN IF NOT EXISTS embedding VECTOR(384);

-- ── HNSW index (cosine / inner-product after L2 normalisation) ───────────────
-- HNSW gives the best query latency at scale; m=16, ef_construction=128 are
-- solid defaults for millions of 384-d vectors.
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding_hnsw
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- ── Semantic search helper function ─────────────────────────────────────────
-- Always accepts embeddings and thresholds as bound parameters — never
-- string-interpolated — so there is zero SQL-injection surface here.
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding VECTOR(384),
    match_threshold FLOAT    DEFAULT 0.35,
    match_count     INTEGER  DEFAULT 5,
    p_user_id       UUID     DEFAULT NULL   -- NULL = admin / unrestricted search
)
RETURNS TABLE (
    id          UUID,
    document_id UUID,
    chunk_index INTEGER,
    content     TEXT,
    page_number INTEGER,
    similarity  FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    -- Validate inputs to prevent resource-exhaustion
    IF match_count  < 1   THEN match_count  := 1;   END IF;
    IF match_count  > 100 THEN match_count  := 100;  END IF;
    IF match_threshold < 0.0 THEN match_threshold := 0.0; END IF;
    IF match_threshold > 1.0 THEN match_threshold := 1.0; END IF;

    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.chunk_index,
        dc.content,
        dc.page_number,
        (1.0 - (dc.embedding <=> query_embedding))::FLOAT AS similarity
    FROM  document_chunks dc
    JOIN  documents       d  ON d.id = dc.document_id
    WHERE dc.embedding IS NOT NULL
      AND d.deleted_at IS NULL
      AND d.status     = 'ready'
      -- RLS-compatible ownership check when a user scope is supplied
      AND (p_user_id IS NULL OR d.user_id = p_user_id)
      AND (1.0 - (dc.embedding <=> query_embedding)) >= match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant execute only to authenticated users (anon cannot run searches)
REVOKE EXECUTE ON FUNCTION match_document_chunks(VECTOR, FLOAT, INTEGER, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION match_document_chunks(VECTOR, FLOAT, INTEGER, UUID) TO  authenticated;
