import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import RequireAuth from '@/components/shared/RequireAuth';
import LoadingScreen from '@/components/shared/LoadingScreen';
import Shell from '@/components/layout/Shell';
import Auth from '@/pages/Auth';
import Signup from '@/pages/Signup';
import ForgotPin from '@/pages/ForgotPin';
import ResetPin from '@/pages/ResetPin';
import RequestAccess from '@/pages/RequestAccess';
import NotFound from '@/pages/NotFound';
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
import Log from '@/pages/Log';
import DoubtChat from '@/pages/DoubtChat';
import Triangulate from '@/pages/Triangulate';
import Formulas from '@/pages/Formulas';
import TriggerDrill from '@/pages/TriggerDrill';
import Settings from '@/pages/Settings';
import Readiness from '@/pages/Readiness';
import Buddy from '@/pages/Buddy';

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
  { path: '/signup', element: <Signup /> },
  { path: '/forgot-pin', element: <ForgotPin /> },
  { path: '/reset-pin', element: <ResetPin /> },
  { path: '/request-access', element: <RequestAccess /> },
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
      { path: 'log', element: <Log /> },
      { path: 'patterns', element: <Patterns /> },
      { path: 'reattempts', element: <Reattempts /> },
      { path: 'weekly-review', element: <WeeklyReview /> },
      { path: 'heatmap', element: <Heatmap /> },
      { path: 'calibration', element: <Calibration /> },
      { path: 'readiness', element: <Readiness /> },
      { path: 'doubt', element: <DoubtChat /> },
      { path: 'triangulate', element: <Triangulate /> },
      { path: 'trigger-drill', element: <TriggerDrill /> },
      { path: 'formulas', element: <Formulas /> },
      { path: 'buddy', element: <Buddy /> },
      { path: 'settings', element: <Settings /> }
    ]
  },
  { path: '*', element: <NotFound /> }
]);
