-- campaign_prospects (0003_sales_domain.sql) was missing created_at, unlike every
-- other per-row table in the schema — found when a prospects-listing query needed to
-- order by "when this prospect entered the campaign" and had nothing to order by.
alter table campaign_prospects add column created_at timestamptz not null default now();
