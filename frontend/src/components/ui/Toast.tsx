import { Toaster } from 'react-hot-toast';

/** Re-export react-hot-toast toaster with ChristNerve styling. */
export const ToastProvider = () => (
  <Toaster
    position="top-right"
    toastOptions={{
      duration: 3500,
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        borderRadius: '8px',
        background: '#0F0D0A',
        color: '#F8F7F5',
      },
      success: {
        iconTheme: { primary: '#1D6348', secondary: '#F8F7F5' },
      },
      error: {
        iconTheme: { primary: '#B91C1C', secondary: '#F8F7F5' },
      },
    }}
  />
);

export { toast, Toaster } from 'react-hot-toast';
export default ToastProvider;
