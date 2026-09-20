-- The "Sample message previewed" preflight check (and its confirm-preview action) has
-- been removed from the wizard and draft-guidance checklists - nothing sets or reads
-- this column anymore.
alter table campaigns drop column preview_confirmed_at;
