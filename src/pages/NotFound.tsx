import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="bg-dotgrid flex min-h-dvh flex-col items-center justify-center gap-6">
      <div className="text-center">
        <p className="u-num text-[64px] font-medium leading-none text-text-faint">404</p>
        <p className="mt-4 text-sm text-text-muted">This route does not exist.</p>
      </div>
      <Link
        to="/"
        className="u-label border border-border px-4 py-2 text-text-muted transition-colors hover:border-border-hover hover:text-text"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
