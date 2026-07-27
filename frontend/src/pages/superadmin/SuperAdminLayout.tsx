import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  Activity,
  Moon,
  Sun,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { Spinner } from '../../components/ui/Spinner';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { useTheme } from '../../contexts/ThemeContext';
import { enablePushNotifications } from '../../lib/firebase';
import { clearChurchSlug, platformDomainUrl } from '../../utils/tenantHost';
import { NotificationPrompt } from '../../components/notifications/NotificationPrompt';
import './SuperAdminPage.css';

const TOKEN_KEY = 'superadmin_token';

export interface PlatformStats {
  total_churches?: number;
  active_churches?: number;
  pending_churches?: number;
  total_members?: number;
  total_listings?: number;
  monthly_revenue?: number;
}

export interface ChurchRow {
  id: number;
  name: string;
  slug: string;
  city?: string;
  region?: string;
  address?: string | null;
  denomination?: string;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  subscription_status?: string;
  subscription_plan?: string | null;
  is_active?: boolean;
  logo_url?: string | null;
  brand_color?: string | null;
  secondary_color?: string | null;
  short_name?: string | null;
  primary_admin?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    username?: string | null;
    role?: string;
  } | null;
  member_count?: number;
  listing_count?: number;
  created_at?: string;
}

interface SuperAdminContextValue {
  token: string | null;
  stats: PlatformStats | null;
  churches: ChurchRow[];
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => void;
  pageTitle: string;
}

const SuperAdminContext = createContext<SuperAdminContextValue | null>(null);

export function useSuperAdmin() {
  const ctx = useContext(SuperAdminContext);
  if (!ctx) throw new Error('useSuperAdmin must be used within SuperAdminLayout');
  return ctx;
}

function getErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error || fallback
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000 * 30);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString('en-GH', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SuperAdminLogin({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [email, setEmail] = useState('admin@christnerve.com');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Enter your email and password');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/auth/superadmin/login', {
        email: email.trim(),
        password,
      });
      const nextToken = res.data?.token as string | undefined;
      if (!nextToken) throw new Error('No token returned');
      localStorage.setItem(TOKEN_KEY, nextToken);
      onSuccess(nextToken);
      toast.success('Welcome, Platform Admin');

      try {
        const push = await enablePushNotifications();
        if (push.token) {
          await api.post('/superadmin/notifications/device-token', {
            token: push.token,
          });
        }
      } catch {
        // ignore
      }    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Invalid email or password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sa-login">
      <aside className="sa-login-brand">
        <div className="sa-login-brand-inner">
          <BrandLogo size="lg" inverted />
          <p className="sa-login-tagline">The Nerve System of Your Church.</p>
          <p className="sa-login-note">
            Create churches, assign domains, and open pastor accounts from one console.
          </p>
        </div>
      </aside>
      <main className="sa-login-panel">
        <form className="sa-login-form" onSubmit={handleLogin}>
          <p className="sa-login-eyebrow">Platform access</p>
          <h1 className="sa-login-title">Sign in</h1>
          <p className="sa-login-sub">Hidden entry — not linked from the public landing page.</p>
          <label className="label" htmlFor="sa-email">Email</label>
          <input
            id="sa-email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p className="sa-field-hint">Default: admin@christnerve.com</p>
          <label className="label" htmlFor="sa-password" style={{ marginTop: 16 }}>
            Password
          </label>
          <input
            id="sa-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="btn btn-primary sa-gold-btn"
            style={{ width: '100%', marginTop: 24, justifyContent: 'center' }}
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </main>
    </div>
  );
}

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'OVERVIEW' },
  { to: '/admin/monitor', label: 'Monitor', icon: Activity, group: 'OVERVIEW' },
  { to: '/admin/registrations', label: 'Registrations', icon: ClipboardList, group: 'TENANTS' },
  { to: '/admin/churches', label: 'Churches', icon: Building2, group: 'TENANTS' },
];

function titleFromPath(pathname: string): string {
  if (pathname.startsWith('/admin/registrations')) return 'Registrations';
  if (pathname.startsWith('/admin/churches')) return 'Churches';
  if (pathname.startsWith('/admin/monitor')) return 'Monitor';
  return 'Dashboard';
}

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const clock = useClock();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [loading, setLoading] = useState(Boolean(token));
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [churches, setChurches] = useState<ChurchRow[]>([]);

  const refresh = useCallback(async () => {
    const authToken = localStorage.getItem(TOKEN_KEY);
    if (!authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [statsRes, churchesRes] = await Promise.all([
        api.get('/superadmin/stats'),
        api.get('/superadmin/churches'),
      ]);
      setStats(statsRes.data);
      const rows = churchesRes.data?.data ?? churchesRes.data ?? [];
      setChurches(Array.isArray(rows) ? rows : []);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        toast.error('Session expired. Please sign in again.');
      } else {
        toast.error(getErrorMessage(err, 'Failed to load platform data.'));
      }
      setStats(null);
      setChurches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [token, refresh]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [navOpen]);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setStats(null);
    setChurches([]);
    navigate('/admin', { replace: true });
    toast.success('Signed out');
  }, [navigate]);

  const pageTitle = titleFromPath(location.pathname);

  const value = useMemo(
    () => ({ token, stats, churches, loading, refresh, signOut, pageTitle }),
    [token, stats, churches, loading, refresh, signOut, pageTitle]
  );

  if (!token) {
    return <SuperAdminLogin onSuccess={setToken} />;
  }

  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  const showLabels = !collapsed || navOpen;

  return (
    <SuperAdminContext.Provider value={value}>
      <div
        className={`sa-shell${collapsed ? ' sa-shell--collapsed' : ''}${navOpen ? ' sa-shell--nav-open' : ''}${theme === 'dark' ? ' sa-shell--dark' : ''}`}
      >
        {navOpen && (
          <button
            type="button"
            className="sa-nav-backdrop"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          />
        )}

        <aside className="sa-sidebar" id="sa-sidebar">
          <div className="sa-sidebar-brand">
            <BrandLogo size="sm" inverted showWordmark={showLabels} />
            {showLabels && <span className="sa-sidebar-badge">Platform</span>}
          </div>

          <nav className="sa-sidebar-nav">
            {groups.map((group) => (
              <div key={group} className="sa-nav-group">
                {showLabels && <p className="sa-nav-group-label">{group}</p>}
                {NAV.filter((n) => n.group === group).map((item) => {
                  const Icon = item.icon;
                  const pendingCount =
                    item.to === '/admin/registrations'
                      ? Number(stats?.pending_churches || 0)
                      : 0;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={Boolean(item.end)}
                      title={item.label}
                      className={({ isActive }) =>
                        `sa-nav-link${isActive ? ' is-active' : ''}`
                      }
                      onClick={() => setNavOpen(false)}
                    >
                      <Icon size={18} />
                      {showLabels && (
                        <span className="sa-nav-link-label">
                          {item.label}
                          {pendingCount > 0 && (
                            <span className="sa-nav-badge">{pendingCount}</span>
                          )}
                        </span>
                      )}
                      {!showLabels && pendingCount > 0 && (
                        <span className="sa-nav-badge sa-nav-badge--dot" />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sa-sidebar-foot">
            <button
              type="button"
              className="sa-nav-link"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              {showLabels && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
            </button>
            {showLabels && (
              <a
                className="sa-nav-link"
                href={platformDomainUrl('/')}
                onClick={(e) => {
                  e.preventDefault();
                  clearChurchSlug();
                  window.location.href = platformDomainUrl('/');
                }}
              >
                <ExternalLink size={16} />
                Visit site
              </a>
            )}
            <button type="button" className="sa-signout-btn" onClick={signOut}>
              <LogOut size={16} />
              {showLabels && 'Sign out'}
            </button>
            {showLabels && (
              <p className="sa-powered">Powered by ChristNerve</p>
            )}
          </div>
        </aside>

        <div className="sa-main">
          <header className="sa-topbar">
            <div className="sa-topbar-left">
              <button
                type="button"
                className="sa-icon-btn sa-icon-btn--desktop"
                aria-label="Toggle sidebar"
                onClick={() => setCollapsed((v) => !v)}
              >
                {collapsed ? <Menu size={18} /> : <PanelLeftClose size={18} />}
              </button>
              <button
                type="button"
                className="sa-icon-btn sa-icon-btn--mobile"
                aria-label={navOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={navOpen}
                aria-controls="sa-sidebar"
                onClick={() => setNavOpen((v) => !v)}
              >
                <Menu size={18} />
              </button>
              <div className="sa-topbar-user">
                <div className="sa-avatar">A</div>
                <div className="sa-topbar-user-text">
                  <p className="sa-topbar-greet">
                    {greeting()}, admin
                  </p>
                  <span className="sa-role-pill">Administrator</span>
                </div>
              </div>
              <h1 className="sa-topbar-page">{pageTitle}</h1>
            </div>

            <div className="sa-topbar-right">
              <span className="sa-clock">{clock}</span>
              <NotificationBell mode="platform" />
              <button type="button" className="sa-signout-chip" onClick={signOut}>
                <LogOut size={14} />
                <span className="sa-signout-chip-label">Logout</span>
              </button>
            </div>
          </header>

          <div className="sa-main-body">
            <NotificationPrompt mode="platform" />
            {loading && !stats ? (
              <div className="sa-loading">
                <Spinner size="lg" />
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </div>
      </div>
    </SuperAdminContext.Provider>
  );
}

export function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
