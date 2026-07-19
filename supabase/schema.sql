-- ひかるのやることリスト: Supabaseスキーマ
-- Supabaseダッシュボード → SQL Editor に貼り付けて実行してください。
-- 新規プロジェクトはこのファイルだけで完結します。
-- 既にv1.1以前のテーブルが存在するプロジェクトにv1.2(フォルダ機能)だけを追加したい場合は
-- supabase/migration-v1.2.sql を実行してください(このファイルを再実行してもfoldersテーブル追加/
-- goals.folder_id列追加は `if not exists` / `add column if not exists` 相当で安全ですが、
-- 個別ALTER文が欲しい場合はmigration-v1.2.sqlを使ってください)。
-- 既にv3.0以前のテーブルが存在するプロジェクトにv3.1(ステップ・Todoの期限)だけを追加したい場合は
-- supabase/migration-v3.1.sql を実行してください。

create extension if not exists "pgcrypto";

-- ---------- folders ---------- (v1.2で追加)
create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- goals ----------
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  folder_id   uuid null references public.folders(id) on delete set null, -- v1.2で追加。null = トップレベル
  title       text not null,
  sort_order  integer not null default 0,
  status      text not null default 'active' check (status in ('active', 'done', 'archived')),
  due_date    date null,
  created_at  timestamptz not null default now()
);

-- ---------- steps ----------
create table if not exists public.steps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id     uuid not null references public.goals(id) on delete cascade,
  title       text not null,
  sort_order  integer not null default 0,
  status      text not null default 'active' check (status in ('active', 'done')),
  due_date    date null, -- v3.1で追加。null = 無期限
  created_at  timestamptz not null default now()
);

-- ---------- todos ----------
create table if not exists public.todos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  step_id       uuid not null references public.steps(id) on delete cascade,
  title         text not null,
  done          boolean not null default false,
  sort_order    integer not null default 0,
  due_date      date null, -- v3.1で追加。null = 無期限
  created_at    timestamptz not null default now(),
  completed_at  timestamptz null
);

create index if not exists steps_goal_id_idx on public.steps(goal_id);
create index if not exists todos_step_id_idx on public.todos(step_id);
create index if not exists folders_user_id_idx on public.folders(user_id);
create index if not exists goals_user_id_idx on public.goals(user_id);
create index if not exists goals_folder_id_idx on public.goals(folder_id);
create index if not exists steps_user_id_idx on public.steps(user_id);
create index if not exists todos_user_id_idx on public.todos(user_id);

-- ---------- RLS ----------
alter table public.folders enable row level security;
alter table public.goals enable row level security;
alter table public.steps enable row level security;
alter table public.todos enable row level security;

-- 自分専用アプリのため、認証済みユーザーは自分の行のみ全操作可能
create policy "folders: owner full access" on public.folders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "goals: owner full access" on public.goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "steps: owner full access" on public.steps
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "todos: owner full access" on public.todos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
