import { FormEvent, useMemo, useState } from 'react';
import {
  Check,
  ClipboardList,
  ImagePlus,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { churchDomainUrl, churchHostLabel } from '../../utils/tenantHost';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { useSuperAdmin, type ChurchRow } from './SuperAdminLayout';

const GH_REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern', 'Northern',
  'Volta', 'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo',
  'Western North', 'Oti', 'North East', 'Savannah',
];

const DENOMINATIONS = [
  'Church of Pentecost', 'Methodist', 'Presbyterian', 'Catholic',
  'Assemblies of God', 'Baptist', 'Charismatic', 'Interdenominational', 'Other',
];

function getErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error || fallback
  );
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const EMPTY_SETUP = {
  name: '',
  slug: '',
  tagline: '',
  denomination: '',
  city: '',
  region: '',
  phone: '',
  email: '',
  address: '',
  brand_color: '#2D1B69',
  secondary_color: '#C4A035',
  short_name: '',
  admin_name: '',
  admin_username: '',
  admin_password: '',
};

export default function SuperAdminRegistrations() {
  const { churches, refresh, stats } = useSuperAdmin();
  const [actingId, setActingId] = useState<number | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupChurch, setSetupChurch] = useState<ChurchRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [setupForm, setSetupForm] = useState(EMPTY_SETUP);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const pending = useMemo(
    () => churches.filter((c) => c.subscription_status === 'pending'),
    [churches]
  );
  const approved = useMemo(
    () =>
      churches.filter(
        (c) => c.subscription_status === 'approved' && c.is_active === false
      ),
    [churches]
  );

  const approve = async (id: number) => {
    setActingId(id);
    try {
      const res = await api.post(`/superadmin/churches/${id}/approve`);
      toast.success('Approved — finish Activate to go live');
      await refresh();
      const church = (res.data?.church as ChurchRow) || churches.find((c) => c.id === id);
      if (church) openActivate(church);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to approve'));
    } finally {
      setActingId(null);
    }
  };

  const reject = async (id: number) => {
    setActingId(id);
    try {
      await api.post(`/superadmin/churches/${id}/reject`);
      toast.success('Registration rejected');
      await refresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to reject'));
    } finally {
      setActingId(null);
    }
  };

  const openActivate = (c: ChurchRow) => {
    setSetupChurch(c);
    const email = c.email || '';
    setSetupForm({
      name: c.name || '',
      slug: c.slug || '',
      tagline: c.tagline || '',
      denomination: c.denomination || '',
      city: c.city || '',
      region: c.region || '',
      phone: c.phone || '',
      email,
      address: c.address || '',
      brand_color: c.brand_color || '#2D1B69',
      secondary_color: c.secondary_color || '#C4A035',
      short_name: c.short_name || c.name?.split(/\s+/).slice(0, 2).join(' ') || '',
      admin_name: '',
      admin_username: email,
      admin_password: '',
    });
    setLogoFile(null);
    setLogoPreview(resolveMediaUrl(c.logo_url));
    setSetupOpen(true);
  };

  const closeActivate = () => {
    setSetupOpen(false);
    setSetupChurch(null);
    setLogoFile(null);
    setLogoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const updateSetup = (key: keyof typeof EMPTY_SETUP, value: string) => {
    setSetupForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'email') {
        next.admin_username = value.trim().toLowerCase();
      }
      if (key === 'name' && !prev.slug) {
        next.slug = toSlug(value);
      }
      return next;
    });
  };

  const onLogoPick = (file: File | null) => {
    setLogoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : resolveMediaUrl(setupChurch?.logo_url);
    });
    setLogoFile(file);
  };

  const submitSetup = async (e: FormEvent) => {
    e.preventDefault();
    if (!setupChurch) return;
    if (!setupForm.name.trim() || !setupForm.slug.trim()) {
      toast.error('Church name and domain slug are required');
      return;
    }
    if (!setupForm.email.trim()) {
      toast.error('Church email is required for Primary Admin login');
      return;
    }
    if (!setupForm.admin_name.trim()) {
      toast.error('Primary Admin name is required');
      return;
    }
    if (!setupForm.admin_username.trim() || setupForm.admin_username.trim().length < 3) {
      toast.error('Primary Admin username is required');
      return;
    }
    if (setupForm.admin_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        await api.post(`/superadmin/churches/${setupChurch.id}/logo`, fd);
      }

      const res = await api.post(`/superadmin/churches/${setupChurch.id}/setup`, {
        name: setupForm.name.trim(),
        slug: setupForm.slug.trim(),
        tagline: setupForm.tagline.trim() || null,
        denomination: setupForm.denomination.trim() || null,
        city: setupForm.city.trim() || null,
        region: setupForm.region.trim() || null,
        phone: setupForm.phone.trim() || null,
        email: setupForm.email.trim(),
        address: setupForm.address.trim() || null,
        brand_color: setupForm.brand_color,
        secondary_color: setupForm.secondary_color,
        short_name: setupForm.short_name.trim() || null,
        admin_name: setupForm.admin_name.trim(),
        admin_username: setupForm.admin_username.trim().toLowerCase(),
        admin_password: setupForm.admin_password,
      });

      const slug = (res.data?.church?.slug as string) || setupForm.slug;
      toast.success(`Church activated — ${churchHostLabel(slug)}`);
      closeActivate();
      await refresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to activate church'));
    } finally {
      setSaving(false);
    }
  };

  const renderCard = (c: ChurchRow, mode: 'pending' | 'approved') => {
    const logo = resolveMediaUrl(c.logo_url);
    const email = c.email;
    const phone = c.phone;
    const tagline = c.tagline;

    return (
      <article key={c.id} className="sa-reg-card">
        <div className="sa-reg-card-top">
          <div className="sa-reg-logo">
            {logo ? <img src={logo} alt="" /> : c.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="sa-reg-meta">
            <h3>{c.name}</h3>
            <Badge variant={mode === 'pending' ? 'visitor' : 'gold'}>
              {mode === 'pending' ? 'New request' : 'Approved · needs activate'}
            </Badge>
            {tagline && <p className="sa-reg-tagline">{tagline}</p>}
          </div>
        </div>

        <dl className="sa-reg-dl">
          {(c.city || c.region) && (
            <div>
              <dt>
                <MapPin size={14} /> Location
              </dt>
              <dd>{[c.city, c.region].filter(Boolean).join(', ')}</dd>
            </div>
          )}
          {phone && (
            <div>
              <dt>
                <Phone size={14} /> Phone
              </dt>
              <dd>{phone}</dd>
            </div>
          )}
          {email && (
            <div>
              <dt>
                <Mail size={14} /> Email
              </dt>
              <dd>{email}</dd>
            </div>
          )}
          <div>
            <dt>Submitted</dt>
            <dd>
              {c.created_at
                ? new Date(c.created_at).toLocaleDateString('en-GH', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </dd>
          </div>
        </dl>

        <div className="sa-reg-actions">
          {mode === 'pending' ? (
            <>
              <button
                type="button"
                className="btn btn-primary sa-gold-btn btn-sm"
                disabled={actingId === c.id}
                onClick={() => void approve(c.id)}
              >
                <Check size={14} />
                Approve
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={actingId === c.id}
                onClick={() => void reject(c.id)}
              >
                <X size={14} />
                Reject
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary sa-gold-btn btn-sm"
                onClick={() => openActivate(c)}
              >
                <KeyRound size={14} />
                Activate
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={actingId === c.id}
                onClick={() => void reject(c.id)}
              >
                <X size={14} />
                Discard
              </button>
            </>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="sa-view">
      <div className="sa-page-head">
        <div className="sa-page-head-icon">
          <ClipboardList size={22} />
        </div>
        <div>
          <h2 className="sa-section-title">Registrations</h2>
          <p className="sa-section-sub">
            Approve requests, then Activate to set branding, domain, and Primary Admin login.
          </p>
        </div>
      </div>

      <div className="sa-reg-summary">
        <div className="sa-reg-stat">
          <strong>{stats?.pending_churches ?? pending.length}</strong>
          <span>Waiting for review</span>
        </div>
        <div className="sa-reg-stat">
          <strong>{approved.length}</strong>
          <span>Approved · need activate</span>
        </div>
      </div>

      <section className="sa-reg-section">
        <h3 className="sa-reg-section-title">New requests</h3>
        {pending.length === 0 ? (
          <EmptyState
            title="No new registrations"
            description="When a church registers from the landing page, it appears here."
          />
        ) : (
          <div className="sa-reg-grid">
            {pending.map((c) => renderCard(c, 'pending'))}
          </div>
        )}
      </section>

      <section className="sa-reg-section">
        <h3 className="sa-reg-section-title">Approved — activate</h3>
        {approved.length === 0 ? (
          <p className="sa-muted">
            After approval, Activate to set colors, domain, and Primary Admin.
          </p>
        ) : (
          <div className="sa-reg-grid">
            {approved.map((c) => renderCard(c, 'approved'))}
          </div>
        )}
      </section>

      <Modal
        open={setupOpen}
        onClose={closeActivate}
        title={`Activate · ${setupChurch?.name || 'Church'}`}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={closeActivate}>
              Cancel
            </button>
            {setupForm.slug && (
              <a
                className="btn btn-outline"
                href={churchDomainUrl(setupForm.slug, '/login')}
                target="_blank"
                rel="noopener noreferrer"
              >
                Preview login
              </a>
            )}
            <button
              type="submit"
              form="sa-activate-form"
              className="btn btn-primary sa-gold-btn"
              disabled={saving}
            >
              {saving ? 'Activating…' : 'Activate church'}
            </button>
          </>
        }
      >
        <form id="sa-activate-form" className="sa-create-form" onSubmit={submitSetup}>
          <section className="sa-panel" style={{ boxShadow: 'none', border: 'none', padding: 0 }}>
            <h3 className="sa-panel-title">Church profile</h3>
            <p className="sa-panel-sub">
              Confirm everything before going live — same fields as Edit Church.
            </p>

            <div className="sa-logo-picker">
              <div className="sa-logo-preview">
                {logoPreview ? (
                  <img src={logoPreview} alt="" />
                ) : (
                  <ImagePlus size={28} />
                )}
              </div>
              <div className="sa-logo-copy">
                <label className="label">Church logo</label>
                <p className="sa-field-hint">Shown on login and home screen install.</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => onLogoPick(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="sa-form-grid">
              <div className="sa-field">
                <label className="label">Church name *</label>
                <input
                  className="input"
                  value={setupForm.name}
                  onChange={(e) => updateSetup('name', e.target.value)}
                  required
                />
              </div>
              <div className="sa-field">
                <label className="label">Domain slug *</label>
                <input
                  className="input"
                  value={setupForm.slug}
                  onChange={(e) => updateSetup('slug', toSlug(e.target.value))}
                  required
                />
                <span className="sa-field-hint">
                  {(setupForm.slug ? churchHostLabel(setupForm.slug) : 'ch-slug.scholarnerve.com')}
                </span>
              </div>
              <div className="sa-field">
                <label className="label">Tagline</label>
                <input
                  className="input"
                  value={setupForm.tagline}
                  onChange={(e) => updateSetup('tagline', e.target.value)}
                />
              </div>
              <div className="sa-field">
                <label className="label">Short app name</label>
                <input
                  className="input"
                  value={setupForm.short_name}
                  onChange={(e) => updateSetup('short_name', e.target.value)}
                  maxLength={50}
                />
              </div>
              <div className="sa-field">
                <label className="label">Denomination</label>
                <select
                  className="input sa-select"
                  value={setupForm.denomination}
                  onChange={(e) => updateSetup('denomination', e.target.value)}
                >
                  <option value="">Select</option>
                  {DENOMINATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="sa-field">
                <label className="label">City</label>
                <input
                  className="input"
                  value={setupForm.city}
                  onChange={(e) => updateSetup('city', e.target.value)}
                />
              </div>
              <div className="sa-field">
                <label className="label">Region</label>
                <select
                  className="input sa-select"
                  value={setupForm.region}
                  onChange={(e) => updateSetup('region', e.target.value)}
                >
                  <option value="">Select</option>
                  {GH_REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="sa-field">
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={setupForm.phone}
                  onChange={(e) => updateSetup('phone', e.target.value)}
                />
              </div>
              <div className="sa-field">
                <label className="label">Church email *</label>
                <input
                  className="input"
                  type="email"
                  value={setupForm.email}
                  onChange={(e) => updateSetup('email', e.target.value)}
                  required
                />
                <span className="sa-field-hint">Also used as Primary Admin login email</span>
              </div>
            </div>
            <div className="sa-field">
              <label className="label">Address</label>
              <input
                className="input"
                value={setupForm.address}
                onChange={(e) => updateSetup('address', e.target.value)}
              />
            </div>

            <h3 className="sa-panel-title" style={{ marginTop: 20 }}>Brand colors</h3>
            <p className="sa-panel-sub">These theme the church login page and PWA.</p>
            <div className="sa-form-grid">
              <div className="sa-field">
                <label className="label">Primary color</label>
                <div className="sa-color-row">
                  <input
                    type="color"
                    value={setupForm.brand_color}
                    onChange={(e) => updateSetup('brand_color', e.target.value)}
                    aria-label="Primary color"
                  />
                  <input
                    className="input"
                    value={setupForm.brand_color}
                    onChange={(e) => updateSetup('brand_color', e.target.value)}
                  />
                </div>
              </div>
              <div className="sa-field">
                <label className="label">Secondary color</label>
                <div className="sa-color-row">
                  <input
                    type="color"
                    value={setupForm.secondary_color}
                    onChange={(e) => updateSetup('secondary_color', e.target.value)}
                    aria-label="Secondary color"
                  />
                  <input
                    className="input"
                    value={setupForm.secondary_color}
                    onChange={(e) => updateSetup('secondary_color', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <h3 className="sa-panel-title" style={{ marginTop: 20 }}>Primary Admin</h3>
            <p className="sa-panel-sub">
              Church-level super admin — sees everything in this church system.
              Signs in with username or the church email.
            </p>
            <div className="sa-form-grid">
              <div className="sa-field">
                <label className="label">Full name *</label>
                <input
                  className="input"
                  value={setupForm.admin_name}
                  onChange={(e) => updateSetup('admin_name', e.target.value)}
                  placeholder="Pastor Kwame Mensah"
                  required
                />
              </div>
              <div className="sa-field">
                <label className="label">Username *</label>
                <input
                  className="input"
                  value={setupForm.admin_username}
                  onChange={(e) => updateSetup('admin_username', e.target.value)}
                  required
                />
                <span className="sa-field-hint">Defaults to church email</span>
              </div>
              <div className="sa-field">
                <label className="label">Login email</label>
                <input className="input" value={setupForm.email} readOnly disabled />
              </div>
              <div className="sa-field">
                <label className="label">Password *</label>
                <input
                  className="input"
                  type="password"
                  value={setupForm.admin_password}
                  onChange={(e) => updateSetup('admin_password', e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>
          </section>
        </form>
      </Modal>
    </div>
  );
}
