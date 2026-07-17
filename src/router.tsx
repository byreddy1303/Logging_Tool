import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import RequireAuth from '@/components/shared/RequireAuth';
import LoadingScreen from '@/components/shared/LoadingScreen';
import Auth from '@/pages/Auth';
import NotFound from '@/pages/NotFound';

const DevPrimitives = lazy(() => import('@/pages/DevPrimitives'));

const devRoutes = import.meta.env.DEV
  ? [
      {
        path: '/dev/primitives',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <DevPrimitives />
          </Suspense>
        )
      }
    ]
  : [];

// Routes are added step-by-step as pages land (BUILD.md §8).
export const router = createBrowserRouter([
  ...devRoutes,
  { path: '/auth', element: <Auth /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <div className="bg-dotgrid flex min-h-dvh items-center justify-center">
          <div className="text-center">
            <p className="u-label">AIR Journal</p>
            <p className="u-num mt-2 text-lg text-text-muted">dashboard lands at S09</p>
          </div>
        </div>
      </RequireAuth>
    )
  },
  { path: '*', element: <NotFound /> }
]);
