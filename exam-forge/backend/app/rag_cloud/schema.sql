-- Run this ONCE in your Supabase SQL editor before using rag_cloud.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_chunks (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL,
    subject      text NOT NULL,
    source_file  text,
    text         text NOT NULL,
    strategy     text,
    passed_parser boolean DEFAULT false,
    emb_arabic   vector(1024),   -- AraBERT large (aubmindlab/bert-large-arabertv02)
    emb_general  vector(384),    -- multilingual-MiniLM
    created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_arabic_emb
    ON rag_chunks USING ivfflat (emb_arabic vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_chunks_general_emb
    ON rag_chunks USING ivfflat (emb_general vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_chunks_user_subject
    ON rag_chunks (user_id, subject);

CREATE INDEX IF NOT EXISTS idx_chunks_fts
    ON rag_chunks USING gin(to_tsvector('simple', text));

-- ─── RPC functions called by CloudRetriever ───────────────────────────────────

CREATE OR REPLACE FUNCTION match_arabic_chunks(
    query_vec   vector(1024),
    user_id     uuid,
    subject     text,
    match_count int DEFAULT 5
)
RETURNS TABLE(id uuid, text text, source_file text, strategy text, similarity float)
LANGUAGE sql STABLE AS $$
    SELECT id, text, source_file, strategy,
           1 - (emb_arabic <=> query_vec) AS similarity
    FROM rag_chunks
    WHERE rag_chunks.user_id = match_arabic_chunks.user_id
      AND rag_chunks.subject = match_arabic_chunks.subject
      AND emb_arabic IS NOT NULL
    ORDER BY emb_arabic <=> query_vec
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_general_chunks(
    query_vec   vector(384),
    user_id     uuid,
    subject     text,
    match_count int DEFAULT 5
)
RETURNS TABLE(id uuid, text text, source_file text, strategy text, similarity float)
LANGUAGE sql STABLE AS $$
    SELECT id, text, source_file, strategy,
           1 - (emb_general <=> query_vec) AS similarity
    FROM rag_chunks
    WHERE rag_chunks.user_id = match_general_chunks.user_id
      AND rag_chunks.subject = match_general_chunks.subject
      AND emb_general IS NOT NULL
    ORDER BY emb_general <=> query_vec
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION search_chunks_fts(
    query_text  text,
    user_id     uuid,
    subject     text,
    match_count int DEFAULT 5
)
RETURNS TABLE(id uuid, text text, source_file text, strategy text, rank float)
LANGUAGE sql STABLE AS $$
    SELECT id, text, source_file, strategy,
           ts_rank(to_tsvector('simple', rag_chunks.text),
                   plainto_tsquery('simple', query_text)) AS rank
    FROM rag_chunks
    WHERE rag_chunks.user_id = search_chunks_fts.user_id
      AND rag_chunks.subject = search_chunks_fts.subject
      AND to_tsvector('simple', rag_chunks.text) @@ plainto_tsquery('simple', query_text)
    ORDER BY rank DESC
    LIMIT match_count;
$$;
