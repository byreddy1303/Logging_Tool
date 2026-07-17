import { useAuthStore } from '@/stores/auth';

export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const sandbox = useAuthStore((s) => s.sandbox);
  const userId = sandbox ? profile?.id : user?.id;
  return { status, user, profile, sandbox, userId: userId ?? null };
}
