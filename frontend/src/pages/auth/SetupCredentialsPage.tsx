import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';

function safeReturnPath(path?: string | null): string | null {
  if (!path || typeof path !== 'string') return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.startsWith('/login')) return null;
  return path;
}

export default function SetupCredentialsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = safeReturnPath(
    (location.state as { from?: string } | null)?.from
  );
  const {
    setupMemberCredentials,
    user,
    logout,
    isAuthenticated,
    isLoading,
    accountType,
    needsSetup,
  } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && accountType === 'member' && !needsSetup) {
      navigate(returnTo || '/', { replace: true });
    }
  }, [isLoading, isAuthenticated, accountType, needsSetup, navigate, returnTo]);

  if (isLoading) return <Spinner fullPage />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (accountType !== 'member') return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await setupMemberCredentials(username, password);
      toast.success('Account ready — welcome!');
      navigate(returnTo || '/', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not save credentials';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-page login-page--center">
      <form className="card glass-card setup-card" onSubmit={handleSubmit}>
        <h1 className="page-title">Set up your login</h1>
        <p className="page-sub">
          Hi {user?.first_name} — choose a username and password for next time.
          You can still use your phone number to sign in.
        </p>
        <Input
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. ama.mensah"
          required
        />
        <Input
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button type="submit" loading={saving} block>
          Save & continue
        </Button>
        <button type="button" className="btn btn-ghost" onClick={logout}>
          Sign out
        </button>
      </form>
      <style>{`
        .setup-card {
          width: min(420px, 92vw);
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 28px;
        }
        .login-page--center {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: var(--bg-secondary);
          padding: 24px;
        }
      `}</style>
    </div>
  );
}
