-- Hits & Licks: real gangs shared by players, and one city (12 turf objects) every gang fights over.
-- Like players, both are JSON documents only the server (Edge Function "game", service role) reads and writes.

alter table public.players add column if not exists gang_id uuid;
create index if not exists players_gang_idx on public.players (gang_id);

create table if not exists public.gangs (
  id uuid primary key,
  name text not null,
  tag text not null,
  color text not null,
  leader uuid,
  data jsonb not null,                 -- members, requests, invites, treasury, upgrades, diary
  wins int not null default 0,         -- won Gang Wars battles: the gangs' hall of fame
  version int not null default 1,
  created_at timestamptz not null default now()
);
create unique index if not exists gangs_tag_key on public.gangs (upper(tag));
create index if not exists gangs_wins_idx on public.gangs (wins desc);

create table if not exists public.world (
  id text primary key,                 -- 'mesto1'
  data jsonb not null,
  version int not null default 1
);

alter table public.gangs enable row level security;
alter table public.world enable row level security;
-- no policies on purpose: only the server (service role) touches them

-- one action of one player, saved all or nothing: his row, the gangs it changed, the city, membership moves.
-- Every row saves only on the version it was read at; a member move only if his gang is still the expected one.
create or replace function public.save_all(
  p_id uuid, p_state jsonb, p_version int, p_name text, p_cls text, p_level int, p_fighter jsonb, p_points int, p_delta int,
  p_gangs jsonb, p_world jsonb, p_world_version int, p_members jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  g jsonb;
  m jsonb;
  n int;
begin
  if p_version is null then
    insert into players (id, name, cls, level, fighter, pvp_points, state, version)
    values (p_id, p_name, p_cls, p_level, p_fighter, p_points, p_state, 1)
    on conflict (id) do nothing;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'conflict'; end if;
  else
    update players
       set state = p_state, version = version + 1, name = p_name, cls = p_cls, level = p_level, fighter = p_fighter,
           pvp_points = greatest(0, pvp_points + p_delta), updated_at = now()
     where id = p_id and version = p_version;
    if not found then raise exception 'conflict'; end if;
  end if;

  for g in select * from jsonb_array_elements(coalesce(p_gangs, '[]'::jsonb)) loop
    if coalesce((g->>'deleted')::boolean, false) then
      delete from gangs where id = (g->>'id')::uuid and version = (g->>'version')::int;
      if not found then raise exception 'conflict'; end if;
    elsif g->>'version' is null then
      insert into gangs (id, name, tag, color, leader, data, wins)
      values ((g->>'id')::uuid, g->>'name', g->>'tag', g->>'color', (g->>'leader')::uuid, g->'data', coalesce((g->>'winsDelta')::int, 0));
    else
      update gangs
         set data = g->'data', leader = (g->>'leader')::uuid, wins = wins + coalesce((g->>'winsDelta')::int, 0), version = version + 1
       where id = (g->>'id')::uuid and version = (g->>'version')::int;
      if not found then raise exception 'conflict'; end if;
    end if;
  end loop;

  if p_world is not null then
    if p_world_version is null then
      insert into world (id, data) values ('mesto1', p_world) on conflict (id) do nothing;
      get diagnostics n = row_count;
      if n = 0 then raise exception 'conflict'; end if;
    else
      update world set data = p_world, version = version + 1 where id = 'mesto1' and version = p_world_version;
      if not found then raise exception 'conflict'; end if;
    end if;
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_members, '[]'::jsonb)) loop
    update players set gang_id = (m->>'gang')::uuid
     where id = (m->>'id')::uuid
       and (not (m ? 'expect') or gang_id is not distinct from (m->>'expect')::uuid);
    if not found then raise exception 'conflict'; end if;
  end loop;

  return true;
exception when others then
  return false;
end $$;

-- a diary line for another gang (a rival took or attacked its object); keeps the newest 30
create or replace function public.add_gang_log(p_gang uuid, p_entry jsonb) returns void
language sql security definer set search_path = public as $$
  update gangs
     set data = jsonb_set(data, '{log}', (
           select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
             from (select e, i from jsonb_array_elements(jsonb_build_array(p_entry) || coalesce(data->'log', '[]'::jsonb)) with ordinality t(e, i)
                   order by i limit 30) s)),
         version = version + 1
   where id = p_gang
$$;

revoke all on function public.save_all(uuid, jsonb, int, text, text, int, jsonb, int, int, jsonb, jsonb, int, jsonb) from public, anon, authenticated;
revoke all on function public.add_gang_log(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_all(uuid, jsonb, int, text, text, int, jsonb, int, int, jsonb, jsonb, int, jsonb) to service_role;
grant execute on function public.add_gang_log(uuid, jsonb) to service_role;
