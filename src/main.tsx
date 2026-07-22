import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from '@/App';
import '@/index.css';

// When an installed PWA is already controlled by a service worker, a newly
// activated release should replace the open app without asking the learner to
// refresh. Ignore the first controller claim on a brand-new installation so
// that installing the app does not cause a redundant reload.
let hasServiceWorkerController = Boolean(navigator.serviceWorker?.controller);
let reloadingForUpdate = false;

navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (!hasServiceWorkerController) {
    hasServiceWorkerController = true;
    return;
  }
  if (reloadingForUpdate) return;

  reloadingForUpdate = true;
  window.location.reload();
});

// Installed copies can stay open for days. Check immediately and periodically
// so an activated release replaces obsolete cached screens without requiring
// the learner to clear site data or reinstall the PWA.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    void registration.update();
    window.setInterval(() => void registration.update(), 15 * 60 * 1000);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
