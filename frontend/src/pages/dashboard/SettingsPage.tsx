import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SkeletonCard } from '../../components/ui/SkeletonCard';

interface ChurchProfile {
  id?: number;
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  denomination?: string;
  logo_url?: string;
}

function canEditChurchProfile(role?: string | null) {
  const r = String(role || '').toLowerCase();
  return r === 'pastor' || r === 'admin' || r === 'super-admin';
}

export default function SettingsPage() {
  const { user, tenant, accountType, refreshProfile } = useAuth();
  const isMember = accountType === 'member';
  const canEditChurch = !isMember && canEditChurchProfile(user?.role);

  const [loading, setLoading] = useState(!isMember);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ChurchProfile>({
    name: '',
    tagline: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    denomination: '',
  });

  const [username, setUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    setUsername(user?.username || '');
  }, [user?.username]);

  useEffect(() => {
    if (isMember) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const slug = tenant?.slug;
        if (slug) {
          const res = await api.get(`/public/church/${slug}`);
          const church = res.data?.church ?? res.data;
          if (!cancelled && church) {
            setForm({
              id: church.id,
              name: church.name || '',
              slug: church.slug,
              tagline: church.tagline || '',
              description: church.description || '',
              phone: church.phone || '',
              email: church.email || '',
              address: church.address || '',
              city: church.city || '',
              region: church.region || '',
              denomination: church.denomination || '',
              logo_url: church.logo_url,
            });
          }
        } else if (tenant) {
          setForm((f) => ({
            ...f,
            name: tenant.name || '',
            slug: tenant.slug,
            tagline: tenant.tagline || '',
            city: tenant.city || '',
            logo_url: tenant.logo_url,
          }));
        }
      } catch {
        if (tenant) {
          setForm((f) => ({
            ...f,
            name: tenant.name || '',
            slug: tenant.slug,
            tagline: tenant.tagline || '',
            city: tenant.city || '',
          }));
        } else {
          toast.error('Failed to load church profile');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant, isMember]);

  const handleMemberCredentials = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error('Username is required');
      return;
    }
    if (!currentPassword) {
      toast.error('Enter your current password');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      const res = await api.put('/auth/me', {
        username: username.trim(),
        current_password: currentPassword,
        new_password: newPassword || undefined,
      });
      if (res.data.token) {
        localStorage.setItem('church_token', res.data.token);
      }
      await refreshProfile();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(newPassword ? 'Username and password updated' : 'Username updated');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not update credentials';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleChurchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEditChurch) {
      toast.error('Only pastors and admins can edit church profile');
      return;
    }
    setSaving(true);
    try {
      await api.put('/auth/me', {
        church: {
          name: form.name,
          tagline: form.tagline,
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
          denomination: form.denomination,
          description: form.description,
        },
      });
      await refreshProfile();
      toast.success('Church profile saved');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not save settings';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file || !canEditChurch) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await api.post('/auth/church/logo', fd);
      const logo = res.data?.tenant?.logo_url as string | undefined;
      if (logo) setForm((f) => ({ ...f, logo_url: logo }));
      await refreshProfile();
      toast.success('Church logo updated — it will show on the login page');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not upload logo';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <SkeletonCard />
      </div>
    );
  }

  if (isMember) {
    return (
      <div className="settings-page">
        <h2 className="page-heading">Account Settings</h2>
        <form className="card settings-form" onSubmit={handleMemberCredentials}>
          <p className="settings-hint">
            Update your login username and password. Church profile is managed by pastors and admins.
          </p>
          <Input
            label="Username"
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setUsername(e.target.value)
            }
            autoComplete="username"
            required
          />
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCurrentPassword(e.target.value)
            }
            autoComplete="current-password"
            required
          />
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewPassword(e.target.value)
            }
            autoComplete="new-password"
            placeholder="Leave blank to keep current"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setConfirmPassword(e.target.value)
            }
            autoComplete="new-password"
          />
          <div className="form-actions">
            <Button type="submit" variant="primary" loading={saving}>
              Save Credentials
            </Button>
          </div>
        </form>
        <SettingsStyles />
      </div>
    );
  }

  return (
    <div className="settings-page">
      <h2 className="page-heading">Church Settings</h2>
      {!canEditChurch ? (
        <div className="card settings-form">
          <p className="settings-hint">
            Only pastors and admins can edit the church profile. Contact your church admin for changes.
          </p>
          <div className="settings-brand">
            {form.logo_url ? (
              <img
                src={resolveMediaUrl(form.logo_url)}
                alt={form.name}
                className="settings-logo"
              />
            ) : (
              <div className="settings-logo settings-logo--fallback">
                {form.name?.[0] || 'C'}
              </div>
            )}
            <div>
              <h3>{form.name || tenant?.name || 'Church Profile'}</h3>
              <p>{form.slug ? `ch-${form.slug}.scholarnerve.com` : 'Your church subdomain'}</p>
            </div>
          </div>
        </div>
      ) : (
        <form className="card settings-form" onSubmit={handleChurchSubmit}>
          <div className="settings-brand">
            {form.logo_url ? (
              <img
                src={resolveMediaUrl(form.logo_url)}
                alt={form.name}
                className="settings-logo"
              />
            ) : (
              <div className="settings-logo settings-logo--fallback">
                {form.name?.[0] || 'C'}
              </div>
            )}
            <div>
              <h3>{form.name || 'Church Profile'}</h3>
              <p>{form.slug ? `ch-${form.slug}.scholarnerve.com` : 'Your church subdomain'}</p>
              <label className="settings-logo-upload">
                <span>Upload logo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    void handleLogoUpload(e.target.files?.[0] || null);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <Input
            label="Church Name"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
            required
          />
          <Input
            label="Tagline"
            value={form.tagline || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, tagline: e.target.value }))
            }
            placeholder="A church that believes in supporting one another"
          />
          <label className="label">Description</label>
          <textarea
            className="input"
            rows={4}
            value={form.description || ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          <div className="settings-grid">
            <Input
              label="Phone"
              value={form.phone || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              placeholder="0244 000 000"
            />
            <Input
              label="Email"
              type="email"
              value={form.email || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
            <Input
              label="City"
              value={form.city || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, city: e.target.value }))
              }
              placeholder="Kumasi"
            />
            <Input
              label="Denomination"
              value={form.denomination || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, denomination: e.target.value }))
              }
            />
          </div>
          <Input
            label="Address"
            value={form.address || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
          />

          <div className="form-actions">
            <Button type="submit" variant="primary" loading={saving}>
              Save Changes
            </Button>
          </div>
        </form>
      )}
      <SettingsStyles />
    </div>
  );
}

function SettingsStyles() {
  return (
    <style>{`
      .settings-page { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 720px; margin: 0 auto; }
      .page-heading {
        font-family: var(--font-display, 'Cormorant Garamond', serif);
        font-size: 28px;
        font-weight: 600;
      }
      .settings-form { display: flex; flex-direction: column; gap: 14px; }
      .settings-hint {
        font-size: 14px;
        color: var(--text-muted, #9e9893);
        line-height: 1.45;
        margin: 0;
      }
      .settings-brand {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 8px;
      }
      .settings-logo {
        width: 64px;
        height: 64px;
        border-radius: 14px;
        object-fit: cover;
      }
      .settings-logo--fallback {
        display: grid;
        place-items: center;
        background: var(--accent-light, #ede8fa);
        color: var(--accent, #2d1b69);
        font-family: var(--font-display, 'Cormorant Garamond', serif);
        font-size: 24px;
        font-weight: 600;
      }
      .settings-logo-upload {
        display: inline-flex;
        margin-top: 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--accent, #2d1b69);
        cursor: pointer;
      }
      .settings-brand h3 {
        font-family: var(--font-display, 'Cormorant Garamond', serif);
        font-size: 22px;
        font-weight: 600;
      }
      .settings-brand p {
        font-size: 13px;
        color: var(--text-muted, #9e9893);
      }
      .settings-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
      }
      @media (max-width: 640px) {
        .settings-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}
