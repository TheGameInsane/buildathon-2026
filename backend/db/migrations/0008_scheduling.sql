-- Lets the worker (spec section 9) see due prospects across every organization to
-- schedule fairly, without ever granting the app's runtime role (`app_user`) a general
-- RLS bypass (spec section 5, enforcement layer 3: app_user must never bypass RLS).
--
-- This mirrors resolve_api_key / resolve_org_by_webhook_token in 0002_tenancy.sql: a
-- narrow SECURITY DEFINER function that runs with the migration-owning role's
-- privileges but returns only the handful of columns the worker needs to then open a
-- properly org-scoped connection (db.connection.org_connection) for the real work —
-- never full rows, never anything from another tenant table.
--
-- Claiming is a lease, not a delete: it bumps next_action_at forward by 2 minutes so a
-- crashed worker's claimed rows become claimable again shortly, instead of stuck
-- forever. orchestrator.step sets the real next_action_at once it actually finishes.
create or replace function claim_due_prospects(p_limit int)
returns table (id uuid, org_id uuid, campaign_id uuid, prospect_id uuid, stage text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update campaign_prospects cp
  set next_action_at = now() + interval '2 minutes'
  from (
    select cp2.id
    from campaign_prospects cp2
    join campaigns c on c.id = cp2.campaign_id
    where cp2.next_action_at <= now()
      and cp2.stage not in ('disqualified', 'stopped')
      and c.status = 'live'
    order by cp2.next_action_at
    for update of cp2 skip locked
    limit p_limit
  ) as due
  where cp.id = due.id
  returning cp.id, cp.org_id, cp.campaign_id, cp.prospect_id, cp.stage;
end;
$$;

revoke all on function claim_due_prospects(int) from public;
grant execute on function claim_due_prospects(int) to app_user;
