import { Outlet } from 'react-router-dom';
import Nav from '@/components/layout/Nav';
import MobileTabs from '@/components/layout/MobileTabs';

export default function Shell() {
  return (
    <div className="min-h-dvh">
      <Nav />
      <main className="pb-16 md:pb-0 md:pl-[220px]">
        <div className="mx-auto w-full max-w-[720px] px-4 py-6 md:py-8">
          <Outlet />
        </div>
      </main>
      <MobileTabs />
    </div>
  );
}
