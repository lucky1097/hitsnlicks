-- Hits & Licks: one row per player. The whole game state is a JSON document that only the server
-- (Edge Function "game", service role) reads and writes. Players never touch the table directly.

create table if not exists public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  cls text not null,
  level int not null default 1,
  pvp_points int not null default 1000,   -- arena points; other players' wins change them, so they live outside the state
  fighter jsonb,                          -- public arena snapshot: level, class, stats, weapon, armor
  state jsonb not null,
  version int not null default 1,         -- optimistic locking: a save only succeeds on the version it read
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists players_name_key on public.players (lower(name));
create index if not exists players_points_idx on public.players (pvp_points desc);

alter table public.players enable row level security;
-- no policies on purpose: anon / authenticated users get nothing, the server uses the service role

-- save the state if nobody saved in between; arena points change by a delta so wins of other players are kept
create or replace function public.save_player(
  p_id uuid, p_state jsonb, p_version int, p_name text, p_cls text, p_level int, p_fighter jsonb, p_points int, p_delta int
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_version is null then
    insert into players (id, name, cls, level, fighter, pvp_points, state, version)
    values (p_id, p_name, p_cls, p_level, p_fighter, p_points, p_state, 1)
    on conflict (id) do nothing;
    return found;
  end if;
  update players
     set state = p_state, version = version + 1, name = p_name, cls = p_cls, level = p_level, fighter = p_fighter,
         pvp_points = greatest(0, pvp_points + p_delta), updated_at = now()
   where id = p_id and version = p_version;
  return found;
end $$;

-- arena: a few players with points close to yours, picked at random
create or replace function public.arena_pool(p_id uuid, p_points int, p_n int)
returns table (id uuid, name text, points int, fighter jsonb)
language sql security definer set search_path = public as $$
  select c.id, c.name, c.pvp_points, c.fighter
    from (select * from players where players.id <> p_id and players.fighter is not null
          order by abs(players.pvp_points - p_points) limit 30) c
   order by random() limit p_n
$$;

create or replace function public.add_pvp_points(p_id uuid, p_delta int) returns void
language sql security definer set search_path = public as $$
  update players set pvp_points = greatest(0, pvp_points + p_delta) where id = p_id
$$;

revoke all on function public.save_player(uuid, jsonb, int, text, text, int, jsonb, int, int) from public, anon, authenticated;
revoke all on function public.arena_pool(uuid, int, int) from public, anon, authenticated;
revoke all on function public.add_pvp_points(uuid, int) from public, anon, authenticated;
grant execute on function public.save_player(uuid, jsonb, int, text, text, int, jsonb, int, int) to service_role;
grant execute on function public.arena_pool(uuid, int, int) to service_role;
grant execute on function public.add_pvp_points(uuid, int) to service_role;
