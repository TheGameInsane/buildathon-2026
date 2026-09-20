-- kb_chunks: the pgvector-dependent half of the knowledge base. Requires the `vector`
-- extension to be installed on the Postgres server (it is on Supabase). Embedding
-- dimension must match EMBED_MODEL (spec section 6); 1536 matches OpenAI's
-- text-embedding-3-small/-large-compatible default — change it here if EMBED_MODEL
-- produces a different width, and re-embed existing chunks.
create extension if not exists vector;

create table kb_chunks (
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  document_id uuid references kb_documents(id) on delete cascade,
  campaign_id uuid, doc_type text, source text, chunk_index int,
  content text, embedding vector(1536)
);
create index on kb_chunks using hnsw (embedding vector_cosine_ops);

alter table kb_chunks enable row level security;
create policy kb_chunks_isolation on kb_chunks
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

grant select, insert, update, delete on kb_chunks to app_user;
