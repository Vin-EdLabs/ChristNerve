import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { initFirebaseAnalytics } from './lib/firebase';
import { ensureAppServiceWorker } from './utils/pwa';
import './index.css';

void initFirebaseAnalytics();
void ensureAppServiceWorker();

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
