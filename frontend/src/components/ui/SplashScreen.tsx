import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';

function isStandalonePWA() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function SplashScreen() {
  const { tenant } = useAuth();
  const [visible, setVisible] = useState(() => isStandalonePWA());

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const logoUrl = resolveMediaUrl(
    tenant?.logo_url,
    '/icons/christnerve-192.png'
  );
  const churchName = tenant?.name || 'ChristNerve';
  const themeColor = tenant?.brand_color || '#2D1B69';

  return (
    <div
      className="pwa-splash"
      style={{ background: themeColor }}
      aria-hidden={!visible}
    >
      <img
        src={logoUrl}
        alt=""
        className="pwa-splash-logo"
      />
      <p className="pwa-splash-name">{churchName}</p>
      <p className="pwa-splash-powered">Powered by ChristNerve</p>
    </div>
  );
}

export default SplashScreen;
