import { FormEvent, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
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
  visit_welcome?: string;
  youtube_url?: string;
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
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(!isMember);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState<ChurchProfile>({
    name: '',
    tagline: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    denomination: '',
    visit_welcome: '',
    youtube_url: '',
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || user?.phone || '');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  useEffect(() => {
    setWhatsapp(user?.whatsapp || user?.phone || '');
  }, [user?.whatsapp, user?.phone]);

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
              visit_welcome: church.visit_welcome || '',
              youtube_url: church.youtube_url || '',
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

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      await api.post('/auth/me/avatar', fd);
      await refreshProfile();
      toast.success('Profile photo updated');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not upload photo';
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleMemberCredentials = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(currentPassword)) {
      toast.error('Current PIN must be 4 digits');
      return;
    }
    if (!/^\d{4}$/.test(newPassword)) {
      toast.error('New PIN must be exactly 4 digits');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New PINs do not match');
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/member/change-pin', {
        current_pin: currentPassword,
        new_pin: newPassword,
      });
      await refreshProfile();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('PIN updated');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not update PIN';
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
          visit_welcome: form.visit_welcome,
          youtube_url: form.youtube_url,
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

  const initials =
    `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || '?';
  const avatarSrc = resolveMediaUrl(user?.avatar_url);

  const profilePhotoCard = (
    <div className="card settings-form settings-photo-card">
      <div className="settings-photo-row">
        <button
          type="button"
          className="settings-photo-btn"
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploadingAvatar}
          aria-label="Change profile photo"
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="settings-photo-img" />
          ) : (
            <span className="settings-photo-fallback">{initials}</span>
          )}
          <span className="settings-photo-overlay">
            <Camera size={18} />
          </span>
        </button>
        <div>
          <h3 className="settings-photo-name">
            {user?.first_name} {user?.last_name}
          </h3>
          <p className="settings-hint" style={{ marginBottom: 8 }}>
            Add a clear photo so church family and shoppers recognize you.
          </p>
          <button
            type="button"
            className="settings-logo-upload"
            style={{ marginTop: 0, background: 'none', border: 'none', padding: 0 }}
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? 'Uploading…' : avatarSrc ? 'Change photo' : 'Upload photo'}
          </button>
        </div>
      </div>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          void handleAvatarUpload(e.target.files?.[0] || null);
          e.target.value = '';
        }}
      />
    </div>
  );

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
        {profilePhotoCard}
        <form
          className="card settings-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingWhatsapp(true);
            try {
              await api.put('/auth/me', { whatsapp });
              await refreshProfile();
              toast.success('WhatsApp number saved');
            } catch (err: unknown) {
              const msg =
                (err as { response?: { data?: { error?: string } } })?.response
                  ?.data?.error || 'Could not save WhatsApp';
              toast.error(msg);
            } finally {
              setSavingWhatsapp(false);
            }
          }}
        >
          <p className="settings-hint">
            Login phone is <strong>{user?.phone || '—'}</strong> (used to sign in).
            WhatsApp is what buyers see when they order from your shop — it can be the same number.
          </p>
          <Input
            label="WhatsApp number"
            value={whatsapp}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setWhatsapp(e.target.value)
            }
            placeholder="0244 123 456"
          />
          <div className="form-actions">
            <Button type="submit" variant="primary" loading={savingWhatsapp}>
              Save WhatsApp
            </Button>
          </div>
        </form>
        <form className="card settings-form" onSubmit={handleMemberCredentials}>
          <p className="settings-hint">
            Sign in with your phone <strong>{user?.phone || 'number'}</strong> and a 4-digit PIN.
            Default PIN is the last 4 digits of your phone until you change it.
          </p>
          <Input
            label="Current PIN"
            type="password"
            value={currentPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCurrentPassword(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            inputMode="numeric"
            maxLength={4}
            autoComplete="current-password"
            required
          />
          <Input
            label="New PIN"
            type="password"
            value={newPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            inputMode="numeric"
            maxLength={4}
            autoComplete="new-password"
            placeholder="4 digits"
            required
          />
          <Input
            label="Confirm new PIN"
            type="password"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setConfirmPassword(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            inputMode="numeric"
            maxLength={4}
            autoComplete="new-password"
            required
          />
          <div className="form-actions">
            <Button type="submit" variant="primary" loading={saving}>
              Update PIN
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
      {profilePhotoCard}
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
          <label className="label">Visit page welcome message</label>
          <textarea
            className="input"
            rows={3}
            value={form.visit_welcome || ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, visit_welcome: e.target.value }))
            }
            placeholder="Warm words for visitors on /visit — not the app dashboard"
          />
          <Input
            label="YouTube video URL (visit page)"
            value={form.youtube_url || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, youtube_url: e.target.value }))
            }
            placeholder="https://www.youtube.com/watch?v=..."
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
      .settings-photo-row {
        display: flex;
        align-items: center;
        gap: 18px;
      }
      .settings-photo-btn {
        position: relative;
        width: 88px;
        height: 88px;
        border-radius: 50%;
        border: none;
        padding: 0;
        cursor: pointer;
        overflow: hidden;
        flex-shrink: 0;
        background: var(--accent-light, #ede8fa);
        box-shadow: 0 0 0 3px rgba(45, 27, 105, 0.12);
      }
      .settings-photo-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .settings-photo-fallback {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        font-family: var(--font-display, 'Cormorant Garamond', serif);
        font-size: 28px;
        font-weight: 600;
        color: var(--accent, #2d1b69);
      }
      .settings-photo-overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(15, 13, 20, 0.42);
        color: #fff;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .settings-photo-btn:hover .settings-photo-overlay,
      .settings-photo-btn:focus-visible .settings-photo-overlay {
        opacity: 1;
      }
      .settings-photo-name {
        font-family: var(--font-display, 'Cormorant Garamond', serif);
        font-size: 22px;
        font-weight: 600;
        margin: 0 0 4px;
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
        .settings-photo-row { align-items: flex-start; }
      }
    `}</style>
  );
}
