import { createBrowserRouter } from 'react-router-dom';
import NotFound from '@/pages/NotFound';

// Routes are added step-by-step as pages land (BUILD.md §8).
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <div className="bg-dotgrid flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <p className="u-label">AIR Journal</p>
          <p className="u-num mt-2 text-lg text-text-muted">building — S04</p>
        </div>
      </div>
    )
  },
  { path: '*', element: <NotFound /> }
]);
