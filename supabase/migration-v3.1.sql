-- ひかるのやることリスト: v3.1マイグレーション(ステップ・Todoの期限追加)
-- 既にv3.0以前の schema.sql を実行済みのSupabaseプロジェクト向け。
-- SQL Editor に貼り付けて実行してください。新規プロジェクトはこのファイル不要です(schema.sqlだけでOK)。
--
-- 内容:
--   1. steps テーブルに due_date 列を追加(nullable、null = 無期限)
--   2. todos テーブルに due_date 列を追加(nullable、null = 無期限)
-- すべて既存データを削除・変更しない安全な追加のみ(既存のsteps/todosの行は無傷。追加された列はnullで初期化される)。

alter table public.steps
  add column if not exists due_date date null;

alter table public.todos
  add column if not exists due_date date null;
