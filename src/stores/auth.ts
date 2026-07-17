import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { db, clearLocalData } from '@/lib/db';
import type { UserRow } from '@/types';
import { EXAM_DATE_DEFAULT } from '@/lib/constants';

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  profile: UserRow | null;
  /** True when running without Supabase env in dev ("local sandbox"). */
  sandbox: boolean;
  init: () => void;
  signInWithEmail: (email: string, inviteToken?: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  enterSandbox: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const SANDBOX_PROFILE: UserRow = {
  id: '00000000-0000-4000-8000-00000000dev0',
  name: 'Sandbox',
  email: 'sandbox@local',
  exam_date: EXAM_DATE_DEFAULT,
  target_rank: 100,
  sadhana_practice: true,
  timezone: 'Asia/Kolkata',
  created_at: new Date().toISOString()
};

let initialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  profile: null,
  sandbox: false,

  init: () => {
    if (initialized) return;
    initialized = true;

    if (!supabaseConfigured) {
      // Resume a previous sandbox session if one exists.
      db.meta.get('sandbox').then((row) => {
        if (row?.value) {
          set({ status: 'signed_in', profile: SANDBOX_PROFILE, sandbox: true });
        } else {
          set({ status: 'signed_out' });
        }
      });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      set({ user, status: user ? 'signed_in' : 'signed_out' });
      if (user) void get().refreshProfile();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      set({ user, status: user ? 'signed_in' : 'signed_out' });
      if (user) void get().refreshProfile();
      else set({ profile: null });
    });
  },

  refreshProfile: async () => {
    const { user, sandbox } = get();
    if (sandbox || !user) return;
    const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (!error && data) set({ profile: data as UserRow });
  },

  signInWithEmail: async (email, inviteToken) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
        data: inviteToken ? { invite_token: inviteToken } : undefined
      }
    });
    return error ? { error: error.message } : {};
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    return error ? { error: error.message } : {};
  },

  enterSandbox: async () => {
    if (!import.meta.env.DEV || supabaseConfigured) return;
    await db.meta.put({ key: 'sandbox', value: true });
    set({ status: 'signed_in', profile: SANDBOX_PROFILE, sandbox: true });
  },

  signOut: async () => {
    if (get().sandbox) {
      await clearLocalData();
      set({ status: 'signed_out', profile: null, sandbox: false, user: null });
      return;
    }
    await supabase.auth.signOut();
    await clearLocalData();
    set({ status: 'signed_out', profile: null, user: null });
  }
}));

/** The id every local row is scoped to (sandbox id when offline-dev). */
export function currentUserId(): string | null {
  const s = useAuthStore.getState();
  return s.sandbox ? s.profile!.id : (s.user?.id ?? null);
}
