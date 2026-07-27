import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Share, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { enablePushNotifications, isFirebaseConfigured } from '../../lib/firebase';
import { getChurchSlug } from '../../utils/tenantHost';
import { isIosDevice, isPwaStandalone } from '../../utils/pwa';
import { Button } from '../ui/Button';
import './NotificationPrompt.css';

export interface NotificationPromptProps {
  mode?: 'church' | 'platform';
}

function dismissKey(mode: 'church' | 'platform') {
  const slug = mode === 'platform' ? 'platform' : getChurchSlug() || 'church';
  return `christnerve_notif_prompt_dismissed_${slug}`;
}

export const NotificationPrompt: React.FC<NotificationPromptProps> = ({
  mode = 'church',
}) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const needsIosInstall = isIosDevice() && !isPwaStandalone();

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    if (typeof Notification === 'undefined' && !needsIosInstall) return;
    if (!needsIosInstall && Notification.permission === 'granted') return;
    if (!needsIosInstall && Notification.permission === 'denied') return;
    if (sessionStorage.getItem(dismissKey(mode)) === '1') return;

    const t = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(t);
  }, [mode, needsIosInstall]);

  if (!open) return null;

  const dismiss = () => {
    sessionStorage.setItem(dismissKey(mode), '1');
    setOpen(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const result = await enablePushNotifications();
      if (result.needsInstall) {
        toast.error(result.error || 'Add to Home Screen first');
        return;
      }
      if (result.permission === 'denied' || result.permission === 'unsupported') {
        toast.error(result.error || 'Notifications blocked');
        dismiss();
        return;
      }
      if (result.token) {
        const path =
          mode === 'platform'
            ? '/superadmin/notifications/device-token'
            : '/notifications/device-token';
        await api.post(path, { token: result.token });
        toast.success('Notifications enabled');
        dismiss();
        return;
      }
      toast.error(result.error || 'Could not enable notifications');
    } catch {
      toast.error('Could not enable notifications');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notif-prompt" role="dialog" aria-label="Enable notifications">
      <button type="button" className="notif-prompt-close" onClick={dismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
      <div className="notif-prompt-icon">
        <Bell size={22} />
      </div>
      <div className="notif-prompt-body">
        {needsIosInstall ? (
          <>
            <strong>Install for notifications</strong>
            <p>
              On iPhone, tap Share <Share size={12} style={{ display: 'inline' }} /> then
              &nbsp;<strong>Add to Home Screen</strong>. Open the app icon and enable
              notifications.
            </p>
            <div className="notif-prompt-actions">
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Got it
              </Button>
            </div>
          </>
        ) : (
          <>
            <strong>Stay in the loop</strong>
            <p>Enable notifications for messages, new marketplace posts, and church updates.</p>
            <div className="notif-prompt-actions">
              <Button size="sm" loading={busy} onClick={() => void enable()}>
                Enable notifications
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                <BellOff size={14} /> Not now
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationPrompt;
