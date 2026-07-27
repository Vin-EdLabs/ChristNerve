import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { initFirebaseAnalytics } from './lib/firebase';
import './index.css';

void initFirebaseAnalytics();

async function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Wipe broken old caches/SWs that blanked the app
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore
  }

  // Dev: stay SW-free so Vite/HMR works. Push SW registers on demand via firebase.ts.
  if (import.meta.env.DEV) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('ChristNerve SW registered:', reg.scope);
  } catch (err) {
    console.error('SW registration failed:', err);
  }
}

void setupServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          fontFamily: "var(--font-body, 'Inter', sans-serif)",
          fontSize: '14px',
          borderRadius: '10px',
          border: '1px solid var(--border, #e8e4dc)',
        },
      }}
    />
  </React.StrictMode>
);
