-- Knowledge base documents (no vector type here — kb_chunks, which needs pgvector, is
-- its own migration so the two ever fail independently, never together).

create table kb_documents (
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  campaign_id uuid references campaigns(id),                 -- null = org-wide
  doc_type text, title text, source_url text, content text, checksum text,
  created_by text, created_at timestamptz default now()
);

alter table kb_documents enable row level security;
create policy kb_documents_isolation on kb_documents
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

grant select, insert, update, delete on kb_documents to app_user;
