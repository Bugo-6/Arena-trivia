-- =====================================================================
--  Hamirdaf-style multiplayer trivia — Supabase schema
--  Run once in the Supabase SQL editor (or `supabase db push`).
--  Then run supabase/seed.sql to load the question bank.
--
--  Security model:
--   * Clients can only SELECT rooms/players of rooms they joined (RLS).
--   * The question bank, correct answers and all answers live in tables
--     with RLS enabled and NO policies => clients can never read them.
--   * Every write goes through SECURITY DEFINER functions (RPC) that
--     validate the caller (auth.uid()), the room state and the input.
--   * Scores are computed only on the server.
--  Requires: Authentication -> Providers -> "Allow anonymous sign-ins" ON.
-- =====================================================================

-- ---------- tables ----------------------------------------------------
create table if not exists public.questions (
  id      serial primary key,
  cat     text  not null check (cat in ('general','science','geography','history','sports','entertainment','technology','music','israel','food')),
  diff    text  not null check (diff in ('easy','medium','hard')),
  q       text  not null unique,
  answers jsonb not null  -- [correct, wrong1, wrong2, wrong3]; shuffled per room on the server
);

create table if not exists public.rooms (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  host_player_id uuid,
  mode           text not null default 'ffa' check (mode in ('ffa','chase','team')),
  status         text not null default 'lobby',
  settings       jsonb not null default '{"categories":[],"difficulty":"mixed","rounds":10,"time_limit":15}',
  state          jsonb not null default '{}',
  round          int  not null default 0,
  step           int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.players (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references public.rooms(id) on delete cascade,
  user_id            uuid not null,
  name               text not null,
  avatar             int  not null default 0,
  team               int,
  score              int  not null default 0,
  correct_count      int  not null default 0,
  bank               int  not null default 0,
  position           int  not null default 0,
  chase_status       text not null default 'alive' check (chase_status in ('alive','caught','qualified')),
  final_correct      int  not null default 0,
  final_wrong        int  not null default 0,
  final_n            int  not null default 0,
  final_q            jsonb,
  final_locked_until timestamptz,
  last_seen          timestamptz not null default now(),
  joined_at          timestamptz not null default now(),
  unique (room_id, user_id)
);
create index if not exists players_room_idx on public.players(room_id);
create index if not exists players_user_idx on public.players(user_id);

create table if not exists public.room_questions (
  id          bigserial primary key,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  player_id   uuid references public.players(id) on delete cascade,  -- null = shared question, set = final-round question
  idx         int  not null,
  question_id int  not null references public.questions(id),
  answers     jsonb not null,   -- shuffled
  correct_idx int  not null
);
create unique index if not exists rq_shared_idx on public.room_questions(room_id, idx) where player_id is null;
create unique index if not exists rq_player_idx on public.room_questions(player_id, idx) where player_id is not null;
create index if not exists rq_room_q_idx on public.room_questions(room_id, question_id);

create table if not exists public.answers (
  room_id     uuid not null references public.rooms(id) on delete cascade,
  idx         int  not null,
  player_id   uuid not null references public.players(id) on delete cascade,
  choice      int  not null check (choice between 0 and 3),
  answered_at timestamptz not null default clock_timestamp(),
  primary key (room_id, idx, player_id)
);

create table if not exists public.game_results (
  id            bigserial primary key,
  user_id       uuid not null,
  room_code     text not null,
  mode          text not null,
  player_name   text not null,
  rank          int  not null,
  score         int  not null,
  correct_count int  not null,
  answered      int  not null default 0,
  players_count int  not null,
  won           boolean not null default false,
  details       jsonb not null default '{}',
  played_at     timestamptz not null default now()
);
create index if not exists game_results_user_idx on public.game_results(user_id, played_at desc);

-- ---------- row level security ---------------------------------------
alter table public.questions      enable row level security;
alter table public.room_questions enable row level security;
alter table public.answers        enable row level security;
alter table public.rooms          enable row level security;
alter table public.players        enable row level security;
alter table public.game_results   enable row level security;

create or replace function public.is_member(p_room uuid) returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.players where room_id = p_room and user_id = auth.uid()) $$;

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select to authenticated using (public.is_member(id));
drop policy if exists players_select on public.players;
create policy players_select on public.players for select to authenticated using (public.is_member(room_id));
drop policy if exists results_select on public.game_results;
create policy results_select on public.game_results for select to authenticated using (user_id = auth.uid());

-- no direct writes from clients, ever
revoke all on public.questions, public.room_questions, public.answers from anon, authenticated;
revoke insert, update, delete, truncate on public.rooms, public.players, public.game_results from anon, authenticated;
revoke all on public.rooms, public.players, public.game_results from anon;
grant select on public.rooms, public.players, public.game_results to authenticated;

-- ---------- realtime --------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.rooms;   exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.players; exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------- triggers --------------------------------------------------
create or replace function public._rooms_bump() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then new.step := old.step + 1; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists rooms_bump on public.rooms;
create trigger rooms_bump before update on public.rooms for each row execute function public._rooms_bump();

-- ---------- internal helpers -----------------------------------------
create or replace function public._uid() returns uuid language plpgsql stable as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_authenticated'; end if;
  return v;
end $$;

create or replace function public._clean_name(p_name text) returns text language plpgsql immutable as $$
declare v text;
begin
  v := btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]+', '', 'g'));
  v := regexp_replace(v, '\s+', ' ', 'g');
  if char_length(v) < 1 or char_length(v) > 16 then raise exception 'invalid_name'; end if;
  return v;
end $$;

create or replace function public._int_setting(p_room uuid, p_key text, p_default int) returns int
language sql stable security definer set search_path = public as
$$ select coalesce((select (settings->>p_key)::int from public.rooms where id = p_room), p_default) $$;

create or replace function public._shuffle(p_answers jsonb, out o_answers jsonb, out o_correct int)
language plpgsql volatile as $$
begin
  with t as (
    select value, ord - 1 as orig, row_number() over (order by random()) - 1 as pos
    from jsonb_array_elements_text(p_answers) with ordinality as x(value, ord)
  )
  select jsonb_agg(value order by pos), min(pos) filter (where orig = 0)
    into o_answers, o_correct from t;
end $$;

create or replace function public._diff_for(p_room uuid, p_kind text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare v text;
begin
  select settings->>'difficulty' into v from public.rooms where id = p_room;
  if v is null or v = 'mixed' then
    if p_kind = 'build' then return case when random() < 0.55 then 'easy' else 'medium' end; end if;
    if p_kind = 'final' then return case when random() < 0.45 then 'easy' when random() < 0.8 then 'medium' else 'hard' end; end if;
    return 'mixed';
  end if;
  return v;
end $$;

create or replace function public._pick_question(p_room uuid, p_diff text) returns public.questions
language plpgsql volatile security definer set search_path = public as $$
declare v_cats text[]; v_q public.questions;
begin
  select coalesce(array(select jsonb_array_elements_text(settings->'categories')), '{}') into v_cats from public.rooms where id = p_room;

  select * into v_q from public.questions q
   where (cardinality(v_cats) = 0 or q.cat = any(v_cats)) and (p_diff = 'mixed' or q.diff = p_diff)
     and q.id not in (select question_id from public.room_questions where room_id = p_room)
   order by random() limit 1;
  if found then return v_q; end if;

  select * into v_q from public.questions q
   where (cardinality(v_cats) = 0 or q.cat = any(v_cats))
     and q.id not in (select question_id from public.room_questions where room_id = p_room)
   order by random() limit 1;
  if found then return v_q; end if;

  select * into v_q from public.questions q
   where q.id not in (select question_id from public.room_questions where room_id = p_room)
   order by random() limit 1;
  if found then return v_q; end if;

  select * into v_q from public.questions order by random() limit 1;
  if not found then raise exception 'no_questions'; end if;
  return v_q;
end $$;

create or replace function public._serve_question(p_room uuid, p_kind text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_q public.questions; v_sh record; v_idx int; v_limit int; v_now timestamptz := clock_timestamp();
        v_prev text; v_start timestamptz;
begin
  v_q := public._pick_question(p_room, public._diff_for(p_room, p_kind));
  select state->'q'->>'kind' into v_prev from public.rooms where id = p_room;
  -- 3s "get ready" lead-in when a phase begins, short 1.2s breather between questions
  v_start := v_now + make_interval(secs => case when v_prev is distinct from p_kind then 3 else 1.2 end);
  select * into v_sh from public._shuffle(v_q.answers);
  select count(*) into v_idx from public.room_questions where room_id = p_room and player_id is null;
  v_limit := public._int_setting(p_room, 'time_limit', 15);
  insert into public.room_questions(room_id, idx, question_id, answers, correct_idx)
  values (p_room, v_idx, v_q.id, v_sh.o_answers, v_sh.o_correct);
  update public.rooms set
    status = 'question', round = v_idx + 1,
    state = (state - 'reveal') || jsonb_build_object(
      'answered', '[]'::jsonb,
      'q', jsonb_build_object('idx', v_idx, 'kind', p_kind, 'text', v_q.q, 'answers', v_sh.o_answers,
                              'cat', v_q.cat, 'diff', v_q.diff, 'limit', v_limit,
                              'started_at', v_start, 'deadline', v_start + make_interval(secs => v_limit)))
  where id = p_room;
end $$;

create or replace function public._all_answered(p_room uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_room public.rooms; v_idx int; v_kind text;
begin
  select * into v_room from public.rooms where id = p_room;
  v_idx := (v_room.state->'q'->>'idx')::int; v_kind := v_room.state->'q'->>'kind';
  return not exists (
    select 1 from public.players p
     where p.room_id = p_room
       and p.last_seen > now() - interval '25 seconds'
       and (v_kind <> 'chase' or p.chase_status = 'alive')
       and not exists (select 1 from public.answers a where a.room_id = p_room and a.idx = v_idx and a.player_id = p.id));
end $$;

create or replace function public._team_scores(p_room uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    '0', coalesce((select sum(score) from public.players where room_id = p_room and team = 0), 0),
    '1', coalesce((select sum(score) from public.players where room_id = p_room and team = 1), 0))
$$;

-- compute the results of the current question and move to 'reveal'
create or replace function public._reveal(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_room public.rooms; v_q jsonb; v_idx int; v_kind text; v_correct int; v_limit int;
  v_deadline timestamptz; v_started timestamptz; v_results jsonb := '[]'::jsonb;
  v_chaser jsonb := null; v_chaser_pos int; v_chaser_ok boolean; v_chaser_choice int; v_p numeric;
  v_caught jsonb := '[]'::jsonb; v_qual jsonb := '[]'::jsonb; v_bonus jsonb := '[]'::jsonb;
  v_len int := 12; r record; v_ok boolean; v_ms int; v_pts int; v_t int;
begin
  select * into v_room from public.rooms where id = p_room for update;
  v_q := v_room.state->'q'; v_idx := (v_q->>'idx')::int; v_kind := v_q->>'kind';
  v_limit := (v_q->>'limit')::int; v_deadline := (v_q->>'deadline')::timestamptz; v_started := (v_q->>'started_at')::timestamptz;
  select correct_idx into v_correct from public.room_questions where room_id = p_room and player_id is null and idx = v_idx;

  for r in
    select p.id, a.choice, a.answered_at
      from public.players p
      left join public.answers a on a.player_id = p.id and a.room_id = p_room and a.idx = v_idx
     where p.room_id = p_room and (v_kind <> 'chase' or p.chase_status = 'alive')
     order by p.joined_at
  loop
    v_ok := r.choice is not null and r.choice = v_correct;
    v_ms := case when r.answered_at is null then null
                 else greatest(0, round(extract(epoch from (r.answered_at - v_started)) * 1000))::int end;
    v_pts := 0;
    if v_kind in ('ffa', 'team') and v_ok then
      v_pts := 600 + round(400 * greatest(0, least(1, extract(epoch from (v_deadline - r.answered_at)) / v_limit)))::int;
    end if;

    if v_kind = 'build' then
      update public.players set bank = bank + case when v_ok then 1 else 0 end,
             correct_count = correct_count + case when v_ok then 1 else 0 end where id = r.id;
    elsif v_kind = 'chase' then
      if v_ok then
        update public.players set position = least(v_len, position + 1), correct_count = correct_count + 1,
               chase_status = case when position + 1 >= v_len then 'qualified' else chase_status end where id = r.id;
      end if;
    else
      update public.players set score = score + v_pts,
             correct_count = correct_count + case when v_ok then 1 else 0 end where id = r.id;
    end if;

    v_results := v_results || jsonb_build_object('player_id', r.id, 'choice', r.choice, 'correct', v_ok, 'points', v_pts, 'ms', v_ms);
  end loop;

  if v_kind = 'team' then
    for v_t in 0..1 loop
      if exists (select 1 from public.players where room_id = p_room and team = v_t)
         and not exists (
           select 1 from public.players p where p.room_id = p_room and p.team = v_t
              and not exists (select 1 from jsonb_array_elements(v_results) e
                               where (e->>'player_id')::uuid = p.id and (e->>'correct')::boolean))
      then
        update public.players set score = score + 300 where room_id = p_room and team = v_t;
        v_bonus := v_bonus || to_jsonb(v_t);
      end if;
    end loop;
  end if;

  if v_kind = 'chase' then
    v_chaser_pos := coalesce((v_room.state->>'chaser_pos')::int, 0);
    v_p := case v_q->>'diff' when 'easy' then 0.85 when 'medium' then 0.72 else 0.58 end;
    v_chaser_ok := random() < v_p or v_idx >= 24;
    v_chaser_choice := case when v_chaser_ok then v_correct else (v_correct + 1 + floor(random() * 3)::int) % 4 end;
    if v_chaser_ok then v_chaser_pos := v_chaser_pos + 1; end if;

    select coalesce(jsonb_agg(p.id), '[]'::jsonb) into v_qual from public.players p
     where p.room_id = p_room and p.chase_status = 'qualified'
       and p.id::text in (select e->>'player_id' from jsonb_array_elements(v_results) e);

    with c as (
      update public.players set chase_status = 'caught'
       where room_id = p_room and chase_status = 'alive' and position <= v_chaser_pos returning id)
    select coalesce(jsonb_agg(id), '[]'::jsonb) into v_caught from c;

    v_chaser := jsonb_build_object('correct', v_chaser_ok, 'choice', v_chaser_choice);
  end if;

  update public.rooms set status = 'reveal',
    state = state || jsonb_build_object(
      'reveal', jsonb_build_object('idx', v_idx, 'kind', v_kind, 'correct_idx', v_correct, 'results', v_results,
                                   'chaser', v_chaser, 'caught', v_caught, 'qualified', v_qual, 'team_bonus', v_bonus),
      'reveal_at', clock_timestamp(),
      'chaser_pos', coalesce(v_chaser_pos, (state->>'chaser_pos')::int, 0),
      'team_scores', public._team_scores(p_room))
  where id = p_room;
end $$;

create or replace function public._finish(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_room public.rooms; v_nq int; v_total int; v_chaser_final int; v_team_won boolean := false;
  v_chase jsonb := null; v_s0 int; v_s1 int; v_winner_team int := null; v_ranking jsonb; v_count int;
begin
  select * into v_room from public.rooms where id = p_room for update;
  select count(*) into v_count from public.players where room_id = p_room;

  if v_room.mode = 'chase' then
    select count(*), coalesce(sum(final_correct), 0) into v_nq, v_total
      from public.players where room_id = p_room and chase_status = 'qualified';
    v_chaser_final := 12 + 6 * (greatest(v_nq, 1) - 1) + floor(random() * 5)::int;
    v_team_won := v_nq > 0 and v_total > v_chaser_final;
    update public.players set score = bank * 100 + case when chase_status = 'qualified' then 500 else 0 end + final_correct * 200
     where room_id = p_room;
    v_chase := jsonb_build_object('qualified', v_nq, 'team_total', v_total, 'chaser_final', v_chaser_final, 'team_won', v_team_won);
  end if;

  if v_room.mode = 'team' then
    select coalesce(sum(score), 0) into v_s0 from public.players where room_id = p_room and team = 0;
    select coalesce(sum(score), 0) into v_s1 from public.players where room_id = p_room and team = 1;
    v_winner_team := case when v_s0 > v_s1 then 0 when v_s1 > v_s0 then 1 else null end;
  end if;

  select jsonb_agg(jsonb_build_object(
           'player_id', id, 'name', name, 'avatar', avatar, 'team', team, 'score', score, 'rank', rnk,
           'correct_count', correct_count, 'chase_status', chase_status, 'bank', bank,
           'final_correct', final_correct, 'final_wrong', final_wrong) order by rnk, name)
    into v_ranking
    from (select p.*, rank() over (order by score desc, correct_count desc) as rnk from public.players p where room_id = p_room) x;

  insert into public.game_results(user_id, room_code, mode, player_name, rank, score, correct_count, answered, players_count, won, details)
  select p.user_id, v_room.code, v_room.mode, p.name, x.rnk, p.score, p.correct_count,
         (select count(*) from public.answers a where a.player_id = p.id) + p.final_correct + p.final_wrong,
         v_count,
         case v_room.mode when 'team' then (v_winner_team is not null and p.team = v_winner_team)
                          when 'chase' then (x.rnk = 1 and p.score > 0)
                          else x.rnk = 1 end,
         jsonb_build_object('team', p.team, 'chase', v_chase)
    from public.players p
    join (select id, rank() over (order by score desc, correct_count desc) as rnk from public.players where room_id = p_room) x on x.id = p.id
   where p.room_id = p_room;

  update public.rooms set status = 'finished',
    state = state || jsonb_build_object('results', jsonb_build_object('ranking', v_ranking, 'winner_team', v_winner_team,
                                                                       'chase', v_chase, 'team_scores', public._team_scores(p_room)))
  where id = p_room;
end $$;

create or replace function public._serve_final(p_player uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_room uuid; v_n int; v_q public.questions; v_sh record;
begin
  select room_id, final_n into v_room, v_n from public.players where id = p_player;
  v_q := public._pick_question(v_room, public._diff_for(v_room, 'final'));
  select * into v_sh from public._shuffle(v_q.answers);
  insert into public.room_questions(room_id, player_id, idx, question_id, answers, correct_idx)
  values (v_room, p_player, v_n, v_q.id, v_sh.o_answers, v_sh.o_correct);
  update public.players set final_q = jsonb_build_object('n', v_n, 'text', v_q.q, 'answers', v_sh.o_answers, 'cat', v_q.cat, 'diff', v_q.diff)
   where id = p_player;
end $$;

create or replace function public._after_reveal(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_room public.rooms; v_idx int; v_kind text; v_total int; v_alive int; v_qual int;
begin
  select * into v_room from public.rooms where id = p_room;
  v_idx := (v_room.state->'q'->>'idx')::int; v_kind := v_room.state->'q'->>'kind';
  v_total := coalesce((v_room.state->>'total')::int, 10);

  if v_room.mode in ('ffa', 'team') then
    if v_idx + 1 >= v_total then perform public._finish(p_room);
    else perform public._serve_question(p_room, v_room.mode); end if;
    return;
  end if;

  -- chase
  if v_kind = 'build' then
    if v_idx + 1 >= 6 then
      update public.players set position = 1 + bank, chase_status = 'alive' where room_id = p_room;
      update public.rooms set status = 'board', state = state || jsonb_build_object('phase', 'chase', 'chaser_pos', 0) where id = p_room;
    else
      perform public._serve_question(p_room, 'build');
    end if;
    return;
  end if;

  select count(*) filter (where chase_status = 'alive'), count(*) filter (where chase_status = 'qualified')
    into v_alive, v_qual from public.players where room_id = p_room;
  if v_alive > 0 then perform public._serve_question(p_room, 'chase');
  elsif v_qual > 0 then
    update public.rooms set status = 'final_intro', state = state || jsonb_build_object('phase', 'final') where id = p_room;
  else
    perform public._finish(p_room);
  end if;
end $$;

-- ---------- public RPC -----------------------------------------------
create or replace function public.server_time() returns timestamptz
language sql stable as $$ select clock_timestamp() $$;

create or replace function public.create_room(p_name text, p_avatar int default 0) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := public._uid(); v_code text; v_room uuid; v_player uuid; v_try int := 0;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  p_name := public._clean_name(p_name);
  if (select count(*) from public.rooms r join public.players p on p.id = r.host_player_id
       where p.user_id = v_uid and r.status <> 'finished' and r.created_at > now() - interval '6 hours') >= 5 then
    raise exception 'too_many_rooms';
  end if;
  loop
    v_code := '';
    for i in 1..5 loop v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1); end loop;
    exit when not exists (select 1 from public.rooms where code = v_code);
    v_try := v_try + 1;
    if v_try > 30 then raise exception 'code_generation_failed'; end if;
  end loop;
  insert into public.rooms(code) values (v_code) returning id into v_room;
  insert into public.players(room_id, user_id, name, avatar) values (v_room, v_uid, p_name, abs(coalesce(p_avatar, 0)) % 12)
    returning id into v_player;
  update public.rooms set host_player_id = v_player where id = v_room;
  return jsonb_build_object('room_id', v_room, 'code', v_code, 'player_id', v_player);
end $$;

create or replace function public.join_room(p_code text, p_name text, p_avatar int default 0) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_room public.rooms; v_player uuid; v_count int;
begin
  p_code := upper(btrim(coalesce(p_code, '')));
  if p_code !~ '^[A-Z0-9]{5}$' then raise exception 'room_not_found'; end if;
  select * into v_room from public.rooms where code = p_code for update;
  if not found then raise exception 'room_not_found'; end if;

  select id into v_player from public.players where room_id = v_room.id and user_id = v_uid;
  if found then  -- reconnect
    update public.players set last_seen = now() where id = v_player;
    return jsonb_build_object('room_id', v_room.id, 'code', v_room.code, 'player_id', v_player);
  end if;

  p_name := public._clean_name(p_name);
  if v_room.status <> 'lobby' then raise exception 'game_started'; end if;
  select count(*) into v_count from public.players where room_id = v_room.id;
  if v_count >= 8 then raise exception 'room_full'; end if;
  if exists (select 1 from public.players where room_id = v_room.id and lower(name) = lower(p_name)) then
    raise exception 'name_taken';
  end if;
  insert into public.players(room_id, user_id, name, avatar) values (v_room.id, v_uid, p_name, abs(coalesce(p_avatar, 0)) % 12)
    returning id into v_player;
  return jsonb_build_object('room_id', v_room.id, 'code', v_room.code, 'player_id', v_player);
end $$;

create or replace function public.heartbeat(p_room uuid) returns void
language sql volatile security definer set search_path = public as
$$ update public.players set last_seen = now() where room_id = p_room and user_id = auth.uid() $$;

create or replace function public.leave_room(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_me public.players; v_room public.rooms; v_next uuid;
begin
  select * into v_me from public.players where room_id = p_room and user_id = public._uid();
  if not found then return; end if;
  select * into v_room from public.rooms where id = p_room for update;
  if v_room.status <> 'lobby' then return; end if;   -- in a running game: just stop sending heartbeats
  delete from public.players where id = v_me.id;
  select id into v_next from public.players where room_id = p_room order by joined_at limit 1;
  if not found then delete from public.rooms where id = p_room;
  elsif v_room.host_player_id = v_me.id then update public.rooms set host_player_id = v_next where id = p_room; end if;
end $$;

create or replace function public.claim_host(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_me public.players; v_room public.rooms; v_host public.players;
begin
  select * into v_me from public.players where room_id = p_room and user_id = public._uid();
  if not found then raise exception 'not_member'; end if;
  select * into v_room from public.rooms where id = p_room for update;
  select * into v_host from public.players where id = v_room.host_player_id;
  if v_host.id is not null and v_host.last_seen > now() - interval '25 seconds' then raise exception 'host_active'; end if;
  update public.players set last_seen = now() where id = v_me.id;
  update public.rooms set host_player_id = v_me.id where id = p_room;
end $$;

create or replace function public.update_settings(p_room uuid, p_mode text, p_settings jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_me public.players; v_room public.rooms; v_cats jsonb; v_valid text[] := array['general','science','geography','history','sports','entertainment','technology','music','israel','food'];
        v_diff text; v_rounds int; v_time int; c text;
begin
  select * into v_me from public.players where room_id = p_room and user_id = public._uid();
  if not found then raise exception 'not_member'; end if;
  select * into v_room from public.rooms where id = p_room for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if v_room.status <> 'lobby' then raise exception 'invalid_state'; end if;
  if p_mode not in ('ffa', 'chase', 'team') then raise exception 'invalid_mode'; end if;

  v_cats := coalesce(p_settings->'categories', '[]'::jsonb);
  if jsonb_typeof(v_cats) <> 'array' or jsonb_array_length(v_cats) > 10 then raise exception 'invalid_settings'; end if;
  for c in select jsonb_array_elements_text(v_cats) loop
    if not (c = any(v_valid)) then raise exception 'invalid_settings'; end if;
  end loop;
  v_diff := coalesce(p_settings->>'difficulty', 'mixed');
  if v_diff not in ('easy', 'medium', 'hard', 'mixed') then raise exception 'invalid_settings'; end if;
  v_rounds := coalesce((p_settings->>'rounds')::int, 10);
  v_time := coalesce((p_settings->>'time_limit')::int, 15);
  if v_rounds < 3 or v_rounds > 30 or v_time < 5 or v_time > 40 then raise exception 'invalid_settings'; end if;

  update public.rooms set mode = p_mode,
    settings = jsonb_build_object('categories', v_cats, 'difficulty', v_diff, 'rounds', v_rounds, 'time_limit', v_time)
   where id = p_room;
end $$;

create or replace function public.set_team(p_room uuid, p_team int) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_room public.rooms;
begin
  if p_team not in (0, 1) then raise exception 'invalid_team'; end if;
  select * into v_room from public.rooms where id = p_room for update;
  if not found or not public.is_member(p_room) then raise exception 'not_member'; end if;
  if v_room.status <> 'lobby' then raise exception 'invalid_state'; end if;
  update public.players set team = p_team where room_id = p_room and user_id = auth.uid();
end $$;

create or replace function public.start_game(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_me public.players; v_room public.rooms; v_count int; r record; v_t0 int; v_t1 int;
begin
  select * into v_me from public.players where room_id = p_room and user_id = public._uid();
  if not found then raise exception 'not_member'; end if;
  select * into v_room from public.rooms where id = p_room for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if v_room.status <> 'lobby' then raise exception 'invalid_state'; end if;
  select count(*) into v_count from public.players where room_id = p_room;
  if v_count < 2 then raise exception 'need_players'; end if;

  update public.players set score = 0, correct_count = 0, bank = 0, position = 0, chase_status = 'alive',
         final_correct = 0, final_wrong = 0, final_n = 0, final_q = null, final_locked_until = null where room_id = p_room;

  if v_room.mode = 'team' then
    for r in select id from public.players where room_id = p_room and team is null order by joined_at loop
      select count(*) into v_t0 from public.players where room_id = p_room and team = 0;
      select count(*) into v_t1 from public.players where room_id = p_room and team = 1;
      update public.players set team = case when v_t0 <= v_t1 then 0 else 1 end where id = r.id;
    end loop;
    select count(*) into v_t0 from public.players where room_id = p_room and team = 0;
    select count(*) into v_t1 from public.players where room_id = p_room and team = 1;
    if v_t0 = 0 or v_t1 = 0 then raise exception 'teams_unbalanced'; end if;
    update public.rooms set state = jsonb_build_object('phase', 'team', 'total', (settings->>'rounds')::int, 'team_scores', public._team_scores(p_room)) where id = p_room;
    perform public._serve_question(p_room, 'team');
  elsif v_room.mode = 'ffa' then
    update public.rooms set state = jsonb_build_object('phase', 'ffa', 'total', (settings->>'rounds')::int) where id = p_room;
    perform public._serve_question(p_room, 'ffa');
  else
    update public.rooms set state = jsonb_build_object('phase', 'build', 'total', 6, 'board_len', 12, 'chaser_pos', 0) where id = p_room;
    perform public._serve_question(p_room, 'build');
  end if;
end $$;

create or replace function public.submit_answer(p_room uuid, p_idx int, p_choice int) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_me public.players; v_room public.rooms; v_n int;
begin
  if p_choice is null or p_choice < 0 or p_choice > 3 then raise exception 'invalid_choice'; end if;
  select * into v_me from public.players where room_id = p_room and user_id = public._uid();
  if not found then raise exception 'not_member'; end if;
  select * into v_room from public.rooms where id = p_room for update;
  if v_room.status <> 'question' then raise exception 'invalid_state'; end if;
  if (v_room.state->'q'->>'idx')::int <> p_idx then raise exception 'stale_question'; end if;
  if clock_timestamp() < (v_room.state->'q'->>'started_at')::timestamptz - interval '300 milliseconds' then raise exception 'too_early'; end if;
  if clock_timestamp() > (v_room.state->'q'->>'deadline')::timestamptz + interval '400 milliseconds' then raise exception 'too_late'; end if;
  if v_room.state->'q'->>'kind' = 'chase' and v_me.chase_status <> 'alive' then raise exception 'not_eligible'; end if;

  insert into public.answers(room_id, idx, player_id, choice) values (p_room, p_idx, v_me.id, p_choice)
    on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'already_answered'; end if;

  update public.rooms set state = jsonb_set(state, '{answered}', coalesce(state->'answered', '[]'::jsonb) || to_jsonb(v_me.id::text))
   where id = p_room;
  update public.players set last_seen = now() where id = v_me.id;
end $$;

-- host moves the game forward. p_step makes the call idempotent: a stale call is a no-op.
create or replace function public.advance(p_room uuid, p_step int) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_me public.players; v_room public.rooms; v_now timestamptz := clock_timestamp(); v_host boolean; v_deadline timestamptz;
begin
  select * into v_me from public.players where room_id = p_room and user_id = public._uid();
  if not found then raise exception 'not_member'; end if;
  select * into v_room from public.rooms where id = p_room for update;
  if v_room.step <> p_step then return; end if;
  v_host := v_room.host_player_id = v_me.id;

  if v_room.status = 'question' then
    v_deadline := (v_room.state->'q'->>'deadline')::timestamptz;
    if v_host then
      if v_now < v_deadline - interval '300 milliseconds' and not public._all_answered(p_room) then raise exception 'too_early'; end if;
    elsif v_now < v_deadline + interval '5 seconds' then raise exception 'not_host'; end if;
    perform public._reveal(p_room);

  elsif v_room.status = 'reveal' then
    if not v_host and v_now < (v_room.state->>'reveal_at')::timestamptz + interval '20 seconds' then raise exception 'not_host'; end if;
    perform public._after_reveal(p_room);

  elsif v_room.status = 'board' then
    if not v_host and v_now < v_room.updated_at + interval '30 seconds' then raise exception 'not_host'; end if;
    perform public._serve_question(p_room, 'chase');

  elsif v_room.status = 'final_intro' then
    if not v_host and v_now < v_room.updated_at + interval '30 seconds' then raise exception 'not_host'; end if;
    update public.players set final_n = 0, final_correct = 0, final_wrong = 0, final_locked_until = null
     where room_id = p_room and chase_status = 'qualified';
    perform public._serve_final(id) from public.players where room_id = p_room and chase_status = 'qualified';
    update public.rooms set status = 'final',
      state = state || jsonb_build_object('final_started_at', v_now, 'final_seconds', 60, 'final_deadline', v_now + interval '60 seconds')
     where id = p_room;

  elsif v_room.status = 'final' then
    v_deadline := (v_room.state->>'final_deadline')::timestamptz;
    if v_host then
      if v_now < v_deadline then raise exception 'too_early'; end if;
    elsif v_now < v_deadline + interval '5 seconds' then raise exception 'not_host'; end if;
    perform public._finish(p_room);

  else
    raise exception 'invalid_state';
  end if;
end $$;

create or replace function public.final_answer(p_room uuid, p_n int, p_choice int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v_me public.players; v_room public.rooms; v_correct int; v_ok boolean; v_lock timestamptz;
begin
  if p_choice is null or p_choice < 0 or p_choice > 3 then raise exception 'invalid_choice'; end if;
  select * into v_me from public.players where room_id = p_room and user_id = public._uid() for update;
  if not found then raise exception 'not_member'; end if;
  select * into v_room from public.rooms where id = p_room;
  if v_room.status <> 'final' then raise exception 'invalid_state'; end if;
  if clock_timestamp() > (v_room.state->>'final_deadline')::timestamptz + interval '500 milliseconds' then raise exception 'too_late'; end if;
  if v_me.chase_status <> 'qualified' then raise exception 'not_eligible'; end if;
  if v_me.final_n <> p_n then raise exception 'stale_question'; end if;
  if v_me.final_locked_until is not null and v_me.final_locked_until > clock_timestamp() then raise exception 'locked'; end if;

  select correct_idx into v_correct from public.room_questions where player_id = v_me.id and idx = p_n;
  v_ok := p_choice = v_correct;
  v_lock := case when v_ok then null else clock_timestamp() + interval '2 seconds' end;
  update public.players set
    final_correct = final_correct + case when v_ok then 1 else 0 end,
    final_wrong = final_wrong + case when v_ok then 0 else 1 end,
    correct_count = correct_count + case when v_ok then 1 else 0 end,
    final_n = final_n + 1, final_locked_until = v_lock, last_seen = now()
   where id = v_me.id;
  perform public._serve_final(v_me.id);
  return jsonb_build_object('correct', v_ok, 'correct_idx', v_correct, 'locked_until', v_lock);
end $$;

create or replace function public.reset_room(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_me public.players; v_room public.rooms;
begin
  select * into v_me from public.players where room_id = p_room and user_id = public._uid();
  if not found then raise exception 'not_member'; end if;
  select * into v_room from public.rooms where id = p_room for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if v_room.status <> 'finished' then raise exception 'invalid_state'; end if;
  delete from public.answers where room_id = p_room;
  delete from public.room_questions where room_id = p_room;
  update public.players set score = 0, correct_count = 0, bank = 0, position = 0, chase_status = 'alive',
         final_correct = 0, final_wrong = 0, final_n = 0, final_q = null, final_locked_until = null where room_id = p_room;
  update public.rooms set status = 'lobby', state = '{}'::jsonb, round = 0 where id = p_room;
end $$;

-- housekeeping: call from pg_cron (optional) e.g. select cron.schedule('0 * * * *', 'select public.cleanup_old_rooms()');
create or replace function public.cleanup_old_rooms() returns int
language sql volatile security definer set search_path = public as
$$ with d as (delete from public.rooms where created_at < now() - interval '12 hours' returning 1) select count(*)::int from d $$;

-- ---------- grants ----------------------------------------------------
revoke all on function public.cleanup_old_rooms() from public, anon, authenticated;
grant execute on function
  public.server_time(), public.create_room(text, int), public.join_room(text, text, int), public.heartbeat(uuid),
  public.leave_room(uuid), public.claim_host(uuid), public.update_settings(uuid, text, jsonb), public.set_team(uuid, int),
  public.start_game(uuid), public.submit_answer(uuid, int, int), public.advance(uuid, int),
  public.final_answer(uuid, int, int), public.reset_room(uuid)
  to authenticated;
-- internal helpers must not be callable by clients
revoke execute on function
  public._reveal(uuid), public._finish(uuid), public._serve_question(uuid, text), public._serve_final(uuid),
  public._after_reveal(uuid), public._pick_question(uuid, text), public._diff_for(uuid, text), public._all_answered(uuid),
  public._int_setting(uuid, text, int), public._team_scores(uuid)
  from public, anon, authenticated;
