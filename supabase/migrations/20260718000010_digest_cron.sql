-- Schedule the daily-digest edge function. pg_cron runs in UTC; we fire on
-- every hour, and the edge function itself decides which users are "at 6 AM
-- local" for the moment it runs. This makes per-user hour preferences work
-- without a per-timezone cron.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drop any prior schedule so this migration is idempotent.
select cron.unschedule('daily-digest')
  where exists (select 1 from cron.job where jobname = 'daily-digest');

select cron.schedule(
  'daily-digest',
  '30 * * * *',  -- :30 past every hour, covers 6:00, 6:30 offsets globally
  $$
  select
    net.http_post(
      url := (select current_setting('supabase.functions_url', true) || '/daily-digest'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);
