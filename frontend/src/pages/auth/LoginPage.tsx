import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Cross, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { getChurchSlug, churchDomainUrl, isLocalHost } from '../../utils/tenantHost';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { applyTenantPWA } from '../../utils/applyTenantPWA';
import { enablePushNotifications } from '../../lib/firebase';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface ChurchInfo {
  name?: string;
  slug?: string;
  logo_url?: string;
  tagline?: string;
  city?: string;
  brand_color?: string;
  secondary_color?: string;
  short_name?: string;
}

function safeReturnPath(path?: string | null): string | null {
  if (!path || typeof path !== 'string') return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.startsWith('/login')) return null;
  return path;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = safeReturnPath(
    (location.state as { from?: string } | null)?.from
  );
  const {
    login,
    user,
    accountType,
    needsSetup,
    isLoading: authLoading,
  } = useAuth();
  const [church, setChurch] = useState<ChurchInfo | null>(null);
  const [loadingChurch, setLoadingChurch] = useState(true);
  const [mode, setMode] = useState<'member' | 'staff'>('staff');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const slug = getChurchSlug() || 'pka';

  const primary = church?.brand_color || '#2D1B69';
  const secondary = church?.secondary_color || '#C4A035';
  const rgb = useMemo(() => hexToRgb(primary), [primary]);

  const goAfterAuth = (account: 'staff' | 'member', role?: string) => {
    const dest =
      returnTo ||
      (account === 'staff' && String(role || '').toLowerCase() === 'finance'
        ? '/finance'
        : '/');
    if (isLocalHost()) {
      window.location.assign(churchDomainUrl(slug, dest));
      return;
    }
    navigate(dest, { replace: true });
  };

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    root.classList.remove('theme-dark');
    root.classList.add('login-light-lock');
    return () => {
      root.classList.remove('login-light-lock');
      if (prev === 'dark' || prev === 'light') {
        root.setAttribute('data-theme', prev);
        root.classList.toggle('theme-dark', prev === 'dark');
      }
    };
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      if (needsSetup) {
        navigate('/setup-credentials', {
          replace: true,
          state: returnTo ? { from: returnTo } : undefined,
        });
        return;
      }
      goAfterAuth(
        accountType === 'member' ? 'member' : 'staff',
        user.role
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, accountType, needsSetup, navigate, returnTo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingChurch(true);
      try {
        const res = await api.get(`/public/church/${slug}`);
        if (!cancelled) {
          const data = (res.data?.church ?? res.data ?? null) as ChurchInfo | null;
          setChurch(data);
          if (data?.name) {
            applyTenantPWA({
              name: data.name,
              short_name: data.short_name,
              logo_url: data.logo_url,
              brand_color: data.brand_color,
              secondary_color: data.secondary_color,
            });
          }
        }
      } catch {
        if (!cancelled) {
          setChurch({ name: 'Your Church', slug, tagline: 'Welcome back' });
        }
      } finally {
        if (!cancelled) setLoadingChurch(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const enablePush = async () => {
      try {
        const push = await enablePushNotifications();
        if (push.token) {
          await api.post('/notifications/device-token', { token: push.token });
        } else if (push.needsInstall) {
          toast(push.error || 'Add to Home Screen for notifications', { icon: '📱' });
        }
      } catch {
        // ignore
      }
    };

    if (mode === 'member') {
      let normalized = phone.replace(/\D/g, '');
      if (normalized.startsWith('233') && normalized.length >= 12) {
        normalized = `0${normalized.slice(3)}`;
      } else if (normalized.length === 9) {
        normalized = `0${normalized}`;
      }
      if (!/^0\d{9}$/.test(normalized)) {
        toast.error('Phone must start with 0 (e.g. 0244123456)');
        return;
      }
      if (!/^\d{4}$/.test(pin.trim())) {
        toast.error('Enter your 4-digit PIN');
        return;
      }
      setSubmitting(true);
      try {
        await login(normalized, pin.trim(), slug);
        toast.success('Welcome back');
        await enablePush();
        goAfterAuth('member');
      } catch (err: unknown) {
        const data = (err as { response?: { data?: { error?: string } } })?.response
          ?.data;
        toast.error(data?.error || 'Login failed');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!username.trim() || !password) {
      toast.error('Enter your email and password');
      return;
    }
    setSubmitting(true);
    try {
      const type = await login(username.trim(), password, slug);
      toast.success('Welcome back');
      await enablePush();
      if (type === 'staff') {
        const me = await api.get('/auth/me').catch(() => null);
        const role = String(me?.data?.user?.role || '').toLowerCase();
        goAfterAuth('staff', role);
      } else {
        goAfterAuth('member');
      }
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string } } })?.response
        ?.data;
      toast.error(data?.error || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="login-page login-page--center">
        <Spinner />
      </div>
    );
  }

  const churchName = church?.name || 'Your Church';
  const logoUrl = resolveMediaUrl(church?.logo_url);

  return (
    <div
      className="login-page"
      style={
        {
          '--login-primary': primary,
          '--login-secondary': secondary,
          '--login-primary-rgb': rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '45, 27, 105',
        } as CSSProperties
      }
    >
      <aside className="login-aside">
        <div className="login-aside-glow" aria-hidden />
        <div className="login-aside-inner">
          {loadingChurch ? (
            <div className="skeleton" style={{ width: 88, height: 88, borderRadius: 22 }} />
          ) : logoUrl ? (
            <img src={logoUrl} alt={churchName} className="login-logo" />
          ) : (
            <div className="login-logo-fallback">
              <Cross size={32} />
            </div>
          )}
          <p className="login-aside-eyebrow">Welcome</p>
          <h1 className="login-aside-title">{churchName}</h1>
          <p className="login-aside-tagline">
            {church?.tagline ||
              (mode === 'member'
                ? 'Sign in with your phone number and 4-digit PIN.'
                : 'Staff sign in with your church email and password.')}
          </p>
          {church?.city && <p className="login-aside-city">{church.city}</p>}
        </div>
      </aside>

      <main className="login-main">
        <form className="login-form login-form-card" onSubmit={handleSubmit}>
          <div className="login-form-accent" aria-hidden />
          <h2 className="login-form-title">Sign in</h2>

          {slug === 'pka' && (
            <div className="login-demo-hint">
              <strong>Demo login</strong>
              <p>
                Staff tab → <code>pastor@pka.com</code> / <code>password123</code>
              </p>
              <p>
                Member tab → phone <code>0244123456</code> / PIN <code>3456</code>
              </p>
            </div>
          )}

          <div className="login-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'member'}
              className={`login-mode-tab${mode === 'member' ? ' is-active' : ''}`}
              onClick={() => setMode('member')}
            >
              Member
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'staff'}
              className={`login-mode-tab${mode === 'staff' ? ' is-active' : ''}`}
              onClick={() => setMode('staff')}
            >
              Staff
            </button>
          </div>

          {mode === 'member' ? (
            <>
              <p className="login-form-sub">
                Use your phone (starts with 0). Default PIN is the last 4 digits of your number — change it anytime in Settings.
              </p>
              <Input
                label="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0244123456"
                inputMode="tel"
                autoComplete="tel"
                required
              />
              <Input
                label="4-digit PIN"
                type={showPassword ? 'text' : 'password'}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="••••"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                required
              />
            </>
          ) : (
            <>
              <p className="login-form-sub">
                Pastors and staff — sign in with your church email and password.
              </p>
              <Input
                label="Email or username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="pastor@church.com"
                autoComplete="username"
                required
              />
              <div className="login-password-wrap">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </>
          )}

          <Button type="submit" variant="primary" block loading={submitting}>
            Sign In
          </Button>
          <p className="login-powered">Powered by ChristNerve</p>
        </form>
      </main>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(280px, 1.05fr) minmax(320px, 1fr);
          color-scheme: light;
          color: #0f0d0a;
          background:
            radial-gradient(ellipse 70% 50% at 85% 10%, rgba(var(--login-primary-rgb), 0.08), transparent 55%),
            linear-gradient(180deg, #f7f5fb 0%, #efeaf8 100%);
        }
        .login-page--center { display: grid; place-items: center; }
        .login-aside {
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(155deg, var(--login-primary) 0%, color-mix(in srgb, var(--login-primary) 72%, #0a0618) 100%);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px;
        }
        .login-aside-glow {
          position: absolute;
          width: 420px; height: 420px; border-radius: 50%;
          right: -120px; bottom: -140px;
          background: radial-gradient(circle, var(--login-secondary) 0%, transparent 68%);
          opacity: 0.35;
          pointer-events: none;
        }
        .login-aside-inner { position: relative; max-width: 380px; z-index: 1; }
        .login-logo {
          width: 88px; height: 88px; border-radius: 22px;
          object-fit: cover; background: #fff; margin-bottom: 28px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.22);
          border: 3px solid color-mix(in srgb, var(--login-secondary) 70%, #fff);
        }
        .login-logo-fallback {
          width: 88px; height: 88px; border-radius: 22px;
          background: rgba(255,255,255,0.14); display: grid; place-items: center;
          margin-bottom: 28px;
          border: 2px solid color-mix(in srgb, var(--login-secondary) 55%, transparent);
        }
        .login-aside-eyebrow {
          display: inline-block;
          font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--login-secondary);
          margin-bottom: 10px;
        }
        .login-aside-title {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: clamp(32px, 4vw, 44px); font-weight: 600; line-height: 1.12;
          margin-bottom: 14px; color: #fff;
        }
        .login-aside-tagline { font-size: 16px; opacity: 0.9; line-height: 1.55; color: #fff; }
        .login-aside-city { margin-top: 18px; font-size: 13px; opacity: 0.7; color: #fff; }
        .login-main {
          display: flex; align-items: center; justify-content: center;
          padding: 48px 24px;
        }
        .login-form-card {
          width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 16px;
          background: rgba(255,255,255,0.88);
          border: 1px solid rgba(15,13,10,0.06);
          border-radius: 20px;
          padding: 28px 26px 24px;
          box-shadow: 0 18px 48px rgba(15, 13, 10, 0.07);
          position: relative;
          overflow: hidden;
        }
        .login-form-accent {
          position: absolute; left: 0; top: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, var(--login-primary), var(--login-secondary));
        }
        .login-form-title {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 30px; font-weight: 600; margin: 4px 0 0;
          color: #0f0d0a;
        }
        .login-form-sub {
          font-size: 14px; color: #6b6560;
          margin-bottom: 4px; line-height: 1.5;
        }
        .login-demo-hint {
          margin: 0 0 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: #f7f3ea;
          border: 1px solid #e6dcc3;
          font-size: 12px;
          color: #5c5340;
          line-height: 1.45;
        }
        .login-demo-hint strong { display: block; margin-bottom: 4px; color: #3d3424; }
        .login-demo-hint p { margin: 2px 0; }
        .login-demo-hint code {
          font-family: ui-monospace, monospace;
          font-size: 11px;
          background: #fff;
          padding: 1px 5px;
          border-radius: 4px;
        }
        .login-mode-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          padding: 4px;
          margin: 8px 0 14px;
          border-radius: 12px;
          background: rgba(45, 27, 105, 0.06);
        }
        .login-mode-tab {
          border: none;
          background: transparent;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          font-weight: 600;
          color: #6b6560;
          cursor: pointer;
        }
        .login-mode-tab.is-active {
          background: #fff;
          color: var(--login-primary, #2d1b69);
          box-shadow: 0 1px 4px rgba(15, 13, 20, 0.08);
        }
        .login-password-wrap { position: relative; }
        .login-password-toggle {
          position: absolute; right: 12px; bottom: 12px;
          background: none; border: none; color: #9e9893;
          cursor: pointer; padding: 4px;
        }
        .login-form .input,
        .login-form .label { color: #0f0d0a; }
        .login-form .input {
          background: #fff;
          border-color: #e8e4dc;
        }
        .login-form .input:focus {
          border-color: var(--login-primary);
          box-shadow: 0 0 0 3px rgba(var(--login-primary-rgb), 0.18);
        }
        .login-form .btn-primary,
        .login-form button[type="submit"] {
          background: var(--login-primary) !important;
          border-color: var(--login-primary) !important;
        }
        .login-form .btn-primary:hover,
        .login-form button[type="submit"]:hover {
          filter: brightness(1.08);
        }
        .login-powered {
          text-align: center; font-size: 12px; color: #9e9893; margin: 4px 0 0;
        }
        @media (max-width: 768px) {
          .login-page { grid-template-columns: 1fr; }
          .login-aside { min-height: 220px; padding: 36px 24px; }
          .login-aside-title { font-size: 30px; }
          .login-form-card { padding: 24px 18px 20px; }
        }
      `}</style>
    </div>
  );
}
