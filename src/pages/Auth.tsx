import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useAuthStore } from '@/stores/auth';
import { useAuth } from '@/hooks/useAuth';
import { supabaseConfigured } from '@/lib/supabase';
import { EXAM_DATE_DEFAULT } from '@/lib/constants';
import { cn } from '@/lib/utils';

type SendState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

function CornerTicks() {
  const tick = 'pointer-events-none absolute h-2 w-2 border-border-hover';
  return (
    <>
      <span aria-hidden className={cn(tick, 'left-[-1px] top-[-1px] border-l border-t')} />
      <span aria-hidden className={cn(tick, 'right-[-1px] top-[-1px] border-r border-t')} />
      <span aria-hidden className={cn(tick, 'bottom-[-1px] left-[-1px] border-b border-l')} />
      <span aria-hidden className={cn(tick, 'bottom-[-1px] right-[-1px] border-b border-r')} />
    </>
  );
}

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
    <div className="bg-dotgrid relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="u-label text-text-muted">AIR Journal</span>
        <span className="u-label">invite-only</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="u-panel relative w-full max-w-[360px] p-8">
          <CornerTicks />

          <div>
            <h1 className="font-mono text-[28px] font-medium leading-none tracking-[0.04em]">
              AIR<span className="text-accent">_</span>
            </h1>
            <p className="u-label mt-2">Journal / GATE 2027</p>
            <p className="mt-4 text-[13px] leading-relaxed text-text-muted">
              Every solved question becomes data. Compress your mistake surface.
            </p>
          </div>

          <div className="u-rule my-6" />

          {invite && (
            <div className="mb-6 border border-accent-faint bg-bg-overlay px-3 py-2">
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
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint transition-colors hover:border-border-hover focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={send.kind === 'sending'}
                  className="mt-4 w-full rounded-sm bg-accent px-3 py-2 text-sm font-medium text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {send.kind === 'sending' ? 'Sending link…' : 'Send magic link'}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="u-rule flex-1" />
                <span className="u-label">or</span>
                <div className="u-rule flex-1" />
              </div>

              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-text transition-colors hover:border-border-hover hover:bg-bg-overlay"
              >
                Continue with Google
              </button>

              <div className="mt-6 min-h-[18px]" aria-live="polite">
                {send.kind === 'sent' && (
                  <p className="u-num text-xs text-success">Link sent — check your inbox.</p>
                )}
                {send.kind === 'error' && (
                  <p className="u-num text-xs text-danger">{send.message}</p>
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
                <button
                  type="button"
                  onClick={() => void enterSandbox()}
                  className="mt-4 w-full rounded-sm border border-accent-faint px-3 py-2 text-sm text-accent transition-colors hover:border-accent hover:bg-bg-overlay"
                >
                  Enter local sandbox
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="flex items-center justify-between px-6 py-4">
        <span className="u-label">GATE CS · {EXAM_DATE_DEFAULT}</span>
        <span className="u-num text-xs text-text-muted">
          T−{daysLeft}<span className="text-text-faint">d</span>
        </span>
      </footer>
    </div>
  );
}
