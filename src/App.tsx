import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { useAuthStore } from '@/stores/auth';

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => init(), [init]);
  return <RouterProvider router={router} />;
}
