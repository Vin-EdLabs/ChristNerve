import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { isIosDevice, isPwaStandalone } from '../../utils/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const { tenant } = useAuth();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isPwaStandalone()) return;
    if (localStorage.getItem('pwa-prompt-dismissed') === 'true') return;

    if (isIosDevice()) {
      const t = window.setTimeout(() => {
        setIosHelp(true);
        setShow(true);
      }, 12000);
      return () => window.clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      window.setTimeout(() => setShow(true), 15000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!show) return null;

  const churchName = tenant?.name || 'ChristNerve';
  const logoUrl = resolveMediaUrl(
    tenant?.logo_url,
    '/icons/christnerve-192.png'
  );

  return (
    <div className="pwa-install-banner" role="dialog" aria-label="Install app">
      <img src={logoUrl} alt="" className="pwa-install-logo" />
      <div className="pwa-install-copy">
        <p className="pwa-install-title">Add to Home Screen</p>
        <p className="pwa-install-sub">
          {iosHelp
            ? `Tap Share → Add to Home Screen so ${churchName} can send notifications.`
            : `Install ${churchName} for quick access and notifications.`}
        </p>
      </div>
      {!iosHelp && deferredPrompt ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void handleInstall()}
        >
          <Download size={14} />
          Install
        </button>
      ) : iosHelp ? (
        <span className="pwa-install-ios-hint" aria-hidden>
          <Share size={16} />
        </span>
      ) : null}
      <button
        type="button"
        className="pwa-install-close"
        aria-label="Dismiss"
        onClick={handleDismiss}
      >
        <X size={18} />
      </button>
    </div>
  );
}

export default InstallPrompt;
