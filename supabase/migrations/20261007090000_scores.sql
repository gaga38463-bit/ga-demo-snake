-- Every finished game inserts one row; the leaderboard view shows each player's best.
create table public.scores (
  id bigint generated always as identity primary key,
  username text not null check (char_length(username) between 1 and 16),
  -- 20x20 board, one point per food, so 400 is the ceiling
  score integer not null check (score between 0 and 400),
  created_at timestamptz not null default now()
);

create index scores_score_idx on public.scores (score desc);

alter table public.scores enable row level security;

-- Public game with no accounts: anyone may read and add scores, nobody may edit or delete.
create policy "Anyone can read scores"
  on public.scores for select
  to anon, authenticated
  using (true);

create policy "Anyone can submit a score"
  on public.scores for insert
  to anon, authenticated
  with check (true);

grant select, insert on public.scores to anon, authenticated;

create view public.leaderboard
  with (security_invoker = true) as
  select username, max(score) as score, min(created_at) as first_played
  from public.scores
  group by username
  order by score desc, first_played asc
  limit 10;

grant select on public.leaderboard to anon, authenticated;
