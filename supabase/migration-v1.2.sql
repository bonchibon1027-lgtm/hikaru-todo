-- ひかるのやることリスト: v1.2マイグレーション(フォルダ階層の追加)
-- 既にv1.1以前の schema.sql を実行済みのSupabaseプロジェクト向け。
-- SQL Editor に貼り付けて実行してください。新規プロジェクトはこのファイル不要です(schema.sqlだけでOK)。
--
-- 内容:
--   1. folders テーブルを新規作成
--   2. goals テーブルに folder_id 列を追加(nullable、folders削除時は自動でnullに戻る)
--   3. 関連インデックス・RLSポリシーを追加
-- すべて既存データを削除・変更しない安全な追加のみ(既存のgoals/steps/todosの行は無傷)。

create extension if not exists "pgcrypto";

-- ---------- folders ----------
create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- goals に folder_id を追加 ----------
alter table public.goals
  add column if not exists folder_id uuid null references public.folders(id) on delete set null;

-- ---------- インデックス ----------
create index if not exists folders_user_id_idx on public.folders(user_id);
create index if not exists goals_folder_id_idx on public.goals(folder_id);

-- ---------- RLS ----------
alter table public.folders enable row level security;

-- PostgreSQLにはCREATE POLICY IF NOT EXISTSが無いため、DOブロックで存在チェックしてから作成する
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'folders' and policyname = 'folders: owner full access'
  ) then
    create policy "folders: owner full access" on public.folders
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
