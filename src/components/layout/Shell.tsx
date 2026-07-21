import { Outlet, useLocation } from 'react-router-dom';
import Nav from '@/components/layout/Nav';
import MobileTabs from '@/components/layout/MobileTabs';
import DailyQuote from '@/components/shared/DailyQuote';
import OfflineBadge from '@/components/shared/OfflineBadge';
import { useSyncBootstrap } from '@/hooks/useSync';

export default function Shell() {
  useSyncBootstrap();
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh">
      <Nav />
      <OfflineBadge className="fixed right-4 top-3 z-40" />
      <main className="pb-16 md:pb-0 md:pl-[220px]">
        <div className="mx-auto w-full max-w-[720px] px-4 py-6 md:py-8">
          <Outlet />
          {pathname === '/' ? null : <DailyQuote />}
        </div>
      </main>
      <MobileTabs />
    </div>
  );
}
