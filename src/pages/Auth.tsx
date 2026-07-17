import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useAuthStore } from '@/stores/auth';
import { useAuth } from '@/hooks/useAuth';
import { supabaseConfigured } from '@/lib/supabase';
import { EXAM_DATE_DEFAULT } from '@/lib/constants';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type SendState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

export default function Auth() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const invite = params.get('invite') ?? undefined;
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const enterSandbox = useAuthStore((s) => s.enterSandbox);

  const [email, setEmail] = useState('');
  const [send, setSend] = useState<SendState>({ kind: 'idle' });

  if (status === 'signed_in') return <Navigate to="/" replace />;

  const daysLeft = differenceInCalendarDays(parseISO(EXAM_DATE_DEFAULT), new Date());

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || send.kind === 'sending') return;
    setSend({ kind: 'sending' });
    const { error } = await signInWithEmail(email.trim(), invite);
    setSend(error ? { kind: 'error', message: error } : { kind: 'sent' });
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="u-label text-text-muted">AIR Journal</span>
        <span className="u-label">invite-only</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="u-panel relative w-full max-w-[380px] p-8">
          <span className="u-stamp absolute right-6 top-7">gate 2027</span>

          <div className="u-margin-line">
            <h1 className="font-display text-[38px] font-bold leading-none tracking-tight">
              AIR<span className="text-accent">.</span>
            </h1>
            <p className="u-label mt-2">the rank notebook</p>
            <p className="mt-4 text-[13.5px] leading-relaxed text-text-muted">
              Every solved question becomes data.{' '}
              <span className="u-highlight font-medium text-text">
                Compress your mistake surface.
              </span>
            </p>
          </div>

          <div className="u-rule my-6" />

          {invite && (
            <div className="mb-6 rounded border border-accent/30 bg-accent-faint/60 px-3 py-2">
              <p className="u-label text-accent">invite detected</p>
              <p className="u-num mt-1 truncate text-xs text-text-muted">{invite}</p>
              <p className="mt-1 text-xs text-text-faint">
                Sending the link will create your account with this invite.
              </p>
            </div>
          )}

          {supabaseConfigured ? (
            <>
              <form onSubmit={onSubmit}>
                <label htmlFor="email" className="u-label block">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2"
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={send.kind === 'sending'}
                  className="mt-4 w-full"
                >
                  {send.kind === 'sending' ? 'Sending link…' : 'Send magic link'}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="u-rule flex-1" />
                <span className="u-label">or</span>
                <div className="u-rule flex-1" />
              </div>

              <Button type="button" onClick={() => void signInWithGoogle()} className="w-full">
                Continue with Google
              </Button>

              <div className="mt-6 min-h-[18px]" aria-live="polite">
                {send.kind === 'sent' && (
                  <p className="text-xs font-medium text-success">Link sent — check your inbox.</p>
                )}
                {send.kind === 'error' && (
                  <p className="text-xs font-medium text-danger">{send.message}</p>
                )}
              </div>
            </>
          ) : (
            <div>
              <p className="text-[13px] leading-relaxed text-text-muted">
                Supabase is not configured. Fill{' '}
                <span className="u-num text-xs text-text">.env.local</span> to enable sign-in.
              </p>
              {import.meta.env.DEV && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void enterSandbox()}
                  className="mt-4 w-full"
                >
                  Enter local sandbox
                </Button>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="flex items-center justify-between px-6 py-4">
        <span className="u-label">GATE CS · {EXAM_DATE_DEFAULT}</span>
        <span className="u-num text-xs text-text-muted">
          T−{daysLeft}
          <span className="text-text-faint">d</span>
        </span>
      </footer>
    </div>
  );
}
