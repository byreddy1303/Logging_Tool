import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import RequireAuth from '@/components/shared/RequireAuth';
import LoadingScreen from '@/components/shared/LoadingScreen';
import Shell from '@/components/layout/Shell';
import Auth from '@/pages/Auth';
import NotFound from '@/pages/NotFound';
import Pending from '@/components/shared/Pending';
import Dashboard from '@/pages/Dashboard';
import SessionNew from '@/pages/SessionNew';
import SessionActive from '@/pages/SessionActive';
import SessionReview from '@/pages/SessionReview';
import Journal from '@/pages/Journal';
import Patterns from '@/pages/Patterns';
import Reattempts from '@/pages/Reattempts';
import WeeklyReview from '@/pages/WeeklyReview';
import Heatmap from '@/pages/Heatmap';
import Calibration from '@/pages/Calibration';

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
        <Shell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'session/new', element: <SessionNew /> },
      { path: 'session/:id/solve', element: <SessionActive /> },
      { path: 'session/:id/review', element: <SessionReview /> },
      { path: 'journal', element: <Journal /> },
      { path: 'patterns', element: <Patterns /> },
      { path: 'reattempts', element: <Reattempts /> },
      { path: 'weekly-review', element: <WeeklyReview /> },
      { path: 'heatmap', element: <Heatmap /> },
      { path: 'calibration', element: <Calibration /> },
      { path: 'doubt', element: <Pending step="S20" /> },
      { path: 'triangulate', element: <Pending step="S21" /> },
      { path: 'trigger-drill', element: <Pending step="S24" /> },
      { path: 'formulas', element: <Pending step="S23" /> },
      { path: 'buddy', element: <Pending step="S29" /> },
      { path: 'settings', element: <Pending step="S39" /> }
    ]
  },
  { path: '*', element: <NotFound /> }
]);
