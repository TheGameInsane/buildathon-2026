-- Foundational extensions and the runtime application role.
--
-- Two Postgres roles are involved from here on:
--   * the role that RUNS migrations (owns every object, has BYPASSRLS as a superuser/service
--     role — this is what Supabase's connection string gives you by default).
--   * app_user: the role the API and worker connect as at runtime. It does NOT bypass RLS,
--     so row-level security (section 5, layer 3) is a real, tested guarantee and not just
--     defence-in-depth on paper. Its password is set out of band (never in a migration file,
--     never in CLAUDE.md or git — see backend/.env.example APP_DATABASE_URL).
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user login noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end
$$;

grant usage on schema public to app_user;
