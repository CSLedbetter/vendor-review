-- Let Vendor Risk Reviewer spend from the same demo budget, and count its calls on /admin.
-- The tables and functions come from api-error-explainer/supabase/migrations/20261013230000_demo_sign_in.sql.

alter table public.demo_calls drop constraint if exists demo_calls_tool_check;
alter table public.demo_calls add constraint demo_calls_tool_check
  check (tool in ('api-error-explainer', 'sso-assistant', 'vendor-review'));

create or replace function public.demo_admin_list()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'settings', (select jsonb_build_object('global_cap_usd', global_cap_usd, 'enabled', enabled, 'hourly_limit', hourly_limit) from public.demo_settings where id = 1),
    'spent_total_usd', (select round(coalesce(sum(public.demo_call_cost(c)), 0), 4) from public.demo_calls c),
    'users', coalesce((select jsonb_agg(row_to_json(r) order by r.status = 'pending' desc, r.requested_at desc) from (
      select u.user_id, u.email, u.full_name, u.provider, u.status, u.cap_usd, u.requested_at, u.decided_at, u.last_seen_at,
             count(c.id) as requests,
             count(c.id) filter (where c.tool = 'api-error-explainer') as explainer_requests,
             count(c.id) filter (where c.tool = 'sso-assistant') as sso_requests,
             count(c.id) filter (where c.tool = 'vendor-review') as vendor_requests,
             round(coalesce(sum(public.demo_call_cost(c)), 0), 4) as spent_usd,
             max(c.started_at) as last_used
        from public.demo_users u left join public.demo_calls c on c.user_id = u.user_id
       group by u.user_id) r), '[]'::jsonb))
$$;
revoke execute on function public.demo_admin_list() from public, anon, authenticated;
grant execute on function public.demo_admin_list() to service_role;
