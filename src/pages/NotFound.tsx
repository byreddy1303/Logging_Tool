import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <div className="text-center">
        <p className="font-display text-[72px] font-bold leading-none text-text-faint">
          404<span className="text-accent">.</span>
        </p>
        <p className="mt-4 text-sm text-text-muted">This route does not exist.</p>
      </div>
      <Link
        to="/"
        className="u-label rounded border border-border bg-bg-raised px-4 py-2 text-text-muted shadow-sm transition-all hover:-translate-y-px hover:border-border-hover hover:text-text hover:shadow-card"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
