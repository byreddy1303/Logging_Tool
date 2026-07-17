import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from '@/router';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';
import { Toaster } from '@/components/ui/Toast';

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => init(), [init]);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
