-- Ops dashboard for super admins: every platform-wide aggregate in ONE call.
-- The DB is a transatlantic round trip from the app, and PostgREST can't
-- group, so the admin endpoint calls this instead of paging raw rows.
-- Read-only. Executable by service_role only (the admin API), never anon /
-- authenticated.
create or replace function public.admin_ops_metrics()
returns jsonb
language sql
stable
set search_path = public
as $$
with
-- A training day = distinct (client, day), same rule as the trainer detail page.
td as (
  select distinct l.client_id, c.tenant as trainer_id,
         coalesce(l.training_date, (l.created_at at time zone 'UTC')::date) as day
  from exercise_logs l
  join clients c on c.id = l.client_id
  where coalesce(l.training_date, (l.created_at at time zone 'UTC')::date) >= current_date - 90
),
fr as (
  select f.client_id, c.tenant as trainer_id, f.form_type, f.created_at, f.reviewed_at
  from form_responses f
  join clients c on c.id = f.client_id
  where f.created_at >= now() - interval '90 days'
),
-- Videos live on sets (and legacy on the log); a review is keyed by video_url.
vid as (
  select v.video_url, v.trainer_id, v.uploaded_at, r.reviewed_at
  from (
    select distinct on (video_url) video_url, client_id, trainer_id, uploaded_at
    from (
      select s.video_url, l.client_id, c.tenant as trainer_id, coalesce(s.created_at, l.created_at) as uploaded_at
      from exercise_log_sets s
      join exercise_logs l on l.id = s.exercise_log_id
      join clients c on c.id = l.client_id
      where s.video_url is not null
      union all
      select l.video_url, l.client_id, c.tenant, l.created_at
      from exercise_logs l
      join clients c on c.id = l.client_id
      where l.video_url is not null
    ) u
    where uploaded_at >= now() - interval '90 days'
    order by video_url, uploaded_at
  ) v
  left join lateral (
    select min(r.reviewed_at) as reviewed_at
    from exercise_video_reviews r
    where r.client_id = v.client_id and r.video_url = v.video_url
  ) r on true
),
msg as (
  select m.client_id, c.tenant as trainer_id, m.sender_type::text as sender, m.read_at, m.created_at
  from messages m
  join clients c on c.id = m.client_id
  where m.created_at >= now() - interval '90 days'
),
wk as (select generate_series(0, 11) as w),
last_day as (
  select client_id, trainer_id, max(day) as last_day from td group by client_id, trainer_id
),
-- Per-trainer aggregates, grouped once instead of a subquery per trainer row.
t_td as (
  select trainer_id,
         count(distinct client_id) filter (where day > current_date - 7) as active7,
         round(count(distinct (client_id, (current_date - day - 7) / 7))
                 filter (where day > current_date - 35 and day <= current_date - 7)::numeric / 4, 1) as active_prev4,
         count(*) filter (where day > current_date - 7) as training_days7
  from td group by trainer_id
),
t_fr as (
  select trainer_id,
         count(*) filter (where form_type = 'checkins' and created_at >= now() - interval '7 days') as checkins7,
         count(*) filter (where form_type = 'checkins' and reviewed_at is null and created_at >= now() - interval '14 days') as checkins_pending
  from fr group by trainer_id
),
t_vid as (
  select trainer_id,
         count(*) filter (where reviewed_at is null and uploaded_at >= now() - interval '14 days') as videos_pending,
         round((percentile_cont(0.5) within group (order by extract(epoch from reviewed_at - uploaded_at) / 3600)
                 filter (where reviewed_at is not null and uploaded_at >= now() - interval '30 days'))::numeric) as video_review_h
  from vid group by trainer_id
),
t_msg as (
  select trainer_id, count(*) filter (where sender = 'client' and read_at is null) as unread_messages
  from msg group by trainer_id
),
t_misc as (
  select c.tenant as trainer_id, count(*) as clients,
         bool_or(exists (select 1 from meal_cycles m where m.client_id = c.id and m.status = 'active')) as uses_nutrition
  from clients c group by c.tenant
),
t_stop as (
  select trainer_id, count(*) as stopped from last_day
  where last_day <= current_date - 14 and last_day > current_date - 60 group by trainer_id
)
select jsonb_build_object(
  'generatedAt', now(),

  'kpis', jsonb_build_object(
    'trainers',            (select count(*) from trainers),
    'trainersLogin7d',     (select count(*) from trainers where last_login_at >= (now() at time zone 'UTC') - interval '7 days'),
    'clients',             (select count(*) from clients),
    'newClients30d',       (select count(*) from clients where sign_up_date >= now() - interval '30 days'),
    'newClientsPrev30d',   (select count(*) from clients where sign_up_date >= now() - interval '60 days' and sign_up_date < now() - interval '30 days'),
    'training7d',          (select count(distinct client_id) from td where day > current_date - 7),
    'trainingPrev7d',      (select count(distinct client_id) from td where day > current_date - 14 and day <= current_date - 7),
    'training30d',         (select count(distinct client_id) from td where day > current_date - 30),
    'trainingDays7d',      (select count(*) from td where day > current_date - 7),
    'trainingDaysPrev7d',  (select count(*) from td where day > current_date - 14 and day <= current_date - 7),
    'sets7d',              (select count(*) from exercise_log_sets s join exercise_logs l on l.id = s.exercise_log_id
                              where coalesce(l.training_date, (l.created_at at time zone 'UTC')::date) > current_date - 7),
    'checkins7d',          (select count(*) from fr where form_type = 'checkins' and created_at >= now() - interval '7 days'),
    'checkinsPrev7d',      (select count(*) from fr where form_type = 'checkins' and created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
    'habits7d',            (select count(*) from fr where form_type = 'habits' and created_at >= now() - interval '7 days'),
    'videos7d',            (select count(*) from vid where uploaded_at >= now() - interval '7 days'),
    'messages7d',          (select count(*) from msg where created_at >= now() - interval '7 days'),
    'stoppedTraining',     (select count(*) from last_day where last_day <= current_date - 14 and last_day > current_date - 60),
    'neverTrained',        (select count(*) from clients c where c.sign_up_date < now() - interval '14 days'
                              and not exists (select 1 from exercise_logs l where l.client_id = c.id))
  ),

  -- Rolling 7-day windows ending today, oldest first (w = 0 is this week).
  'weeks', (
    select jsonb_agg(jsonb_build_object(
      'weeksAgo', w,
      'end', current_date - 7 * w,
      'activeClients', (select count(distinct client_id) from td where day > current_date - 7 * (w + 1) and day <= current_date - 7 * w),
      'trainingDays',  (select count(*) from td where day > current_date - 7 * (w + 1) and day <= current_date - 7 * w),
      'checkins',      (select count(*) from fr where form_type = 'checkins'
                          and created_at::date > current_date - 7 * (w + 1) and created_at::date <= current_date - 7 * w),
      'newClients',    (select count(*) from clients
                          where sign_up_date::date > current_date - 7 * (w + 1) and sign_up_date::date <= current_date - 7 * w)
    ) order by w desc)
    from wk
  ),

  -- When clients train (last 8 weeks, Spain local time).
  'weekday', (
    select jsonb_agg(coalesce(n, 0) order by d)
    from generate_series(1, 7) d
    left join (select extract(isodow from day)::int as dow, count(*) as n
               from td where day > current_date - 56 group by 1) x on x.dow = d
  ),
  'hour', (
    select jsonb_agg(coalesce(n, 0) order by h)
    from generate_series(0, 23) h
    left join (select extract(hour from l.created_at at time zone 'Europe/Madrid')::int as hr, count(distinct (l.client_id, l.created_at::date)) as n
               from exercise_logs l where l.created_at >= now() - interval '56 days' group by 1) x on x.hr = h
  ),

  'service', jsonb_build_object(
    'videosPending14d',     (select count(*) from vid where reviewed_at is null and uploaded_at >= now() - interval '14 days'),
    'videosOldestPendingH', (select round(extract(epoch from now() - min(uploaded_at)) / 3600)
                               from vid where reviewed_at is null and uploaded_at >= now() - interval '14 days'),
    'videoReviewMedianH',   (select round((percentile_cont(0.5) within group (order by extract(epoch from reviewed_at - uploaded_at) / 3600))::numeric, 1)
                               from vid where reviewed_at is not null and uploaded_at >= now() - interval '30 days'),
    'videosReviewed30dPct', (select round(100.0 * count(*) filter (where reviewed_at is not null) / nullif(count(*), 0))
                               from vid where uploaded_at >= now() - interval '30 days' and uploaded_at < now() - interval '2 days'),
    'checkinsPending14d',   (select count(*) from fr where form_type = 'checkins' and reviewed_at is null and created_at >= now() - interval '14 days'),
    'unreadClientMessages', (select count(*) from msg where sender = 'client' and read_at is null)
  ),

  -- Share of trainers using each feature (last 30 days unless noted).
  'adoption', jsonb_build_object(
    'trainers',  (select count(*) from trainers),
    'programs',  (select count(distinct c.tenant) from client_programs cp join clients c on c.id = cp.client_id where cp.status = 'active'),
    'nutrition', (select count(distinct c.tenant) from meal_cycles m join clients c on c.id = m.client_id where m.status = 'active'),
    'checkins',  (select count(distinct trainer_id) from fr where form_type = 'checkins' and created_at >= now() - interval '30 days'),
    'habits',    (select count(distinct trainer_id) from fr where form_type = 'habits' and created_at >= now() - interval '30 days'),
    'videos',    (select count(distinct trainer_id) from vid where reviewed_at >= now() - interval '30 days'),
    'chat',      (select count(distinct trainer_id) from msg where sender = 'trainer' and created_at >= now() - interval '30 days')
  ),

  'trainers', (
    select coalesce(jsonb_agg(row_to_json(t) order by t.active7 desc, t.clients desc), '[]'::jsonb)
    from (
      select
        tr.id, tr.full_name as name, tr.email, tn.slug, tr.created_at, tr.last_login_at,
        coalesce(m.clients, 0) as clients,
        coalesce(a.active7, 0) as active7,
        coalesce(a.active_prev4, 0) as active_prev4,
        coalesce(a.training_days7, 0) as training_days7,
        coalesce(f.checkins7, 0) as checkins7,
        coalesce(f.checkins_pending, 0) as checkins_pending,
        coalesce(v.videos_pending, 0) as videos_pending,
        v.video_review_h,
        coalesce(g.unread_messages, 0) as unread_messages,
        coalesce(m.uses_nutrition, false) as uses_nutrition,
        coalesce(st.stopped, 0) as stopped
      from trainers tr
      left join tenants tn on tn.trainer_id = tr.id
      left join t_td a on a.trainer_id = tr.id
      left join t_fr f on f.trainer_id = tr.id
      left join t_vid v on v.trainer_id = tr.id
      left join t_msg g on g.trainer_id = tr.id
      left join t_misc m on m.trainer_id = tr.id
      left join t_stop st on st.trainer_id = tr.id
    ) t
  )
);
$$;

revoke all on function public.admin_ops_metrics() from public, anon, authenticated;
grant execute on function public.admin_ops_metrics() to service_role;
