import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from '@/router';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';
import { usePrefsStore } from '@/stores/prefs';
import { Toaster } from '@/components/ui/Toast';

const FONT_SCALE_PX: Record<'small' | 'normal' | 'large', string> = {
  small: '14px',
  normal: '16px',
  large: '18px'
};

export default function App() {
  const init = useAuthStore((s) => s.init);
  const fontScale = usePrefsStore((s) => s.fontScale);
  const compactRows = usePrefsStore((s) => s.compactRows);
  useEffect(() => init(), [init]);
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SCALE_PX[fontScale];
  }, [fontScale]);
  useEffect(() => {
    document.documentElement.dataset.density = compactRows ? 'compact' : 'comfy';
  }, [compactRows]);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
