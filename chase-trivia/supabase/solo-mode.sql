-- Arena Trivia: enable single-player practice in FFA rooms.
-- Run this once in Supabase SQL Editor on an existing project.

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
  -- Solo practice is supported only in FFA; chase and team still require at least two players.
  if v_count < 2 and not (v_count = 1 and v_room.mode = 'ffa') then raise exception 'need_players'; end if;

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
