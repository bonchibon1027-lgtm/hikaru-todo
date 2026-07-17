import { isSupabaseConfigured } from './supabaseClient';
import { LocalRepository } from './localRepository';
import { SupabaseRepository } from './supabaseRepository';
import type { Repository } from './types';

export type { Repository } from './types';
export { isSupabaseConfigured };

let instance: Repository | null = null;

export function getRepository(): Repository {
  if (!instance) {
    instance = isSupabaseConfigured ? new SupabaseRepository() : new LocalRepository();
  }
  return instance;
}
