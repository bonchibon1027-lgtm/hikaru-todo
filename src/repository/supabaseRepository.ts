import { supabase } from './supabaseClient';
import type { Folder, Goal, Step, Todo } from '../types';
import type { Repository } from './types';

// DB(snake_case)⇔アプリ内(camelCase)の変換
interface FolderRow {
  id: string;
  title: string;
  sort_order: number;
  created_at: string;
}
interface GoalRow {
  id: string;
  folder_id: string | null;
  title: string;
  sort_order: number;
  status: Goal['status'];
  due_date: string | null;
  created_at: string;
}
interface StepRow {
  id: string;
  goal_id: string;
  title: string;
  sort_order: number;
  status: Step['status'];
  created_at: string;
}
interface TodoRow {
  id: string;
  step_id: string;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: string;
  completed_at: string | null;
}

function folderFromRow(r: FolderRow): Folder {
  return {
    id: r.id,
    title: r.title,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}
function goalFromRow(r: GoalRow): Goal {
  return {
    id: r.id,
    folderId: r.folder_id,
    title: r.title,
    sortOrder: r.sort_order,
    status: r.status,
    dueDate: r.due_date,
    createdAt: r.created_at,
  };
}
function stepFromRow(r: StepRow): Step {
  return {
    id: r.id,
    goalId: r.goal_id,
    title: r.title,
    sortOrder: r.sort_order,
    status: r.status,
    createdAt: r.created_at,
  };
}
function todoFromRow(r: TodoRow): Todo {
  return {
    id: r.id,
    stepId: r.step_id,
    title: r.title,
    done: r.done,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export class SupabaseRepository implements Repository {
  async loadAll() {
    const db = client();
    const [foldersRes, goalsRes, stepsRes, todosRes] = await Promise.all([
      db.from('folders').select('*').order('sort_order', { ascending: true }),
      db.from('goals').select('*').order('sort_order', { ascending: true }),
      db.from('steps').select('*').order('sort_order', { ascending: true }),
      db.from('todos').select('*').order('sort_order', { ascending: true }),
    ]);
    if (foldersRes.error) throw foldersRes.error;
    if (goalsRes.error) throw goalsRes.error;
    if (stepsRes.error) throw stepsRes.error;
    if (todosRes.error) throw todosRes.error;
    return {
      folders: (foldersRes.data as FolderRow[]).map(folderFromRow),
      goals: (goalsRes.data as GoalRow[]).map(goalFromRow),
      steps: (stepsRes.data as StepRow[]).map(stepFromRow),
      todos: (todosRes.data as TodoRow[]).map(todoFromRow),
    };
  }

  // ---- Folder ----
  async createFolder(input: { title: string }): Promise<Folder> {
    const db = client();
    const { data: existing } = await db
      .from('folders')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);
    const nextSort = existing && existing.length > 0 ? (existing[0] as { sort_order: number }).sort_order + 1 : 0;
    const { data, error } = await db
      .from('folders')
      .insert({ title: input.title, sort_order: nextSort })
      .select()
      .single();
    if (error) throw error;
    return folderFromRow(data as FolderRow);
  }

  async updateFolder(id: string, patch: Partial<Pick<Folder, 'title' | 'sortOrder'>>): Promise<void> {
    const db = client();
    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    const { error } = await db.from('folders').update(row).eq('id', id);
    if (error) throw error;
  }

  async deleteFolder(id: string): Promise<void> {
    const db = client();
    // goals.folder_id は on delete set null なのでDB側で自動的にトップレベルへ戻る
    const { error } = await db.from('folders').delete().eq('id', id);
    if (error) throw error;
  }

  // ---- Goal ----
  async createGoal(input: { title: string; dueDate: string | null; folderId?: string | null }): Promise<Goal> {
    const db = client();
    const { data: existing } = await db.from('goals').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    const nextSort = existing && existing.length > 0 ? (existing[0] as { sort_order: number }).sort_order + 1 : 0;
    const { data, error } = await db
      .from('goals')
      .insert({
        title: input.title,
        due_date: input.dueDate,
        folder_id: input.folderId ?? null,
        sort_order: nextSort,
        status: 'active',
      })
      .select()
      .single();
    if (error) throw error;
    return goalFromRow(data as GoalRow);
  }

  async updateGoal(
    id: string,
    patch: Partial<Pick<Goal, 'title' | 'dueDate' | 'status' | 'sortOrder' | 'folderId'>>
  ): Promise<void> {
    const db = client();
    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    if (patch.folderId !== undefined) row.folder_id = patch.folderId;
    const { error } = await db.from('goals').update(row).eq('id', id);
    if (error) throw error;
  }

  async deleteGoal(id: string): Promise<void> {
    const db = client();
    const { error } = await db.from('goals').delete().eq('id', id);
    if (error) throw error;
  }

  async createStep(input: { goalId: string; title: string }): Promise<Step> {
    const db = client();
    const { data: existing } = await db
      .from('steps')
      .select('sort_order')
      .eq('goal_id', input.goalId)
      .order('sort_order', { ascending: false })
      .limit(1);
    const nextSort = existing && existing.length > 0 ? (existing[0] as { sort_order: number }).sort_order + 1 : 0;
    const { data, error } = await db
      .from('steps')
      .insert({ goal_id: input.goalId, title: input.title, sort_order: nextSort, status: 'active' })
      .select()
      .single();
    if (error) throw error;
    return stepFromRow(data as StepRow);
  }

  async updateStep(id: string, patch: Partial<Pick<Step, 'title' | 'status' | 'sortOrder'>>): Promise<void> {
    const db = client();
    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    const { error } = await db.from('steps').update(row).eq('id', id);
    if (error) throw error;
  }

  async deleteStep(id: string): Promise<void> {
    const db = client();
    const { error } = await db.from('steps').delete().eq('id', id);
    if (error) throw error;
  }

  async createTodo(input: { stepId: string; title: string }): Promise<Todo> {
    const db = client();
    const { data: existing } = await db
      .from('todos')
      .select('sort_order')
      .eq('step_id', input.stepId)
      .order('sort_order', { ascending: false })
      .limit(1);
    const nextSort = existing && existing.length > 0 ? (existing[0] as { sort_order: number }).sort_order + 1 : 0;
    const { data, error } = await db
      .from('todos')
      .insert({ step_id: input.stepId, title: input.title, sort_order: nextSort, done: false })
      .select()
      .single();
    if (error) throw error;
    return todoFromRow(data as TodoRow);
  }

  async updateTodo(id: string, patch: Partial<Pick<Todo, 'title' | 'done' | 'sortOrder' | 'completedAt'>>): Promise<void> {
    const db = client();
    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.done !== undefined) row.done = patch.done;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
    const { error } = await db.from('todos').update(row).eq('id', id);
    if (error) throw error;
  }

  async deleteTodo(id: string): Promise<void> {
    const db = client();
    const { error } = await db.from('todos').delete().eq('id', id);
    if (error) throw error;
  }
}
